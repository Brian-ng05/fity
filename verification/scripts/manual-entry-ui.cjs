/*
 Manual measurement entry — end-to-end UI check.

 Drives the real production build against the real backend: types measurements in
 the browser, waits for the 3D viewer, re-reads the rendered WebGL canvas, then
 edits the numbers and regenerates. No camera and no photo files are used.

 Needs a Playwright install with a Chromium/Chrome binary. Resolution order:
   $PLAYWRIGHT_CORE, .cache/qa/node_modules/playwright-core, frontend/node_modules/playwright-core.
 Run:  node verification/scripts/manual-entry-ui.cjs
       MORPH_QA_SKIP_BUILD=1 to reuse the existing .next-review bundle.
*/
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'verification/manual-entry-20261013');
const backendPort = process.env.MANUAL_QA_BACKEND_PORT || '8007';
const frontendPort = process.env.MANUAL_QA_FRONTEND_PORT || '3107';
const backendUrl = `http://127.0.0.1:${backendPort}`;
const frontendUrl = `http://127.0.0.1:${frontendPort}`;

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_CORE,
    path.join(root, '.cache/qa/node_modules/playwright-core'),
    path.join(root, 'frontend/node_modules/playwright-core'),
    'playwright-core',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('playwright-core not found; install it or set PLAYWRIGHT_CORE=<path>');
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

const children = [];
function start(name, exe, args, cwd, extraEnv = {}) {
  const log = fs.openSync(path.join(out, `${name}.log`), 'w');
  const child = spawn(exe, args, { cwd, windowsHide: true, stdio: ['ignore', log, log], env: { ...env, ...extraEnv } });
  children.push(child);
  child.on('error', (error) => console.error(name, error));
}

/** next.config.ts rewrites are baked at build time, so the QA build needs BACKEND_URL. */
function buildFrontend() {
  return new Promise((resolve, reject) => {
    const log = fs.openSync(path.join(out, 'production-build.log'), 'w');
    const child = spawn(process.execPath, [path.join(root, 'frontend/node_modules/next/dist/bin/next'), 'build', '--webpack'], {
      cwd: path.join(root, 'frontend'),
      windowsHide: true,
      stdio: ['ignore', log, log],
      env: { ...env, MORPH_REVIEW: '1' },
    });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`next build exited ${code}`))));
  });
}

async function ready(url) {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`not ready: ${url}`);
}

fs.mkdirSync(out, { recursive: true });
process.env.TEMP = path.join(root, '.cache/tmp');
process.env.TMP = process.env.TEMP;
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', BACKEND_URL: backendUrl, MPLCONFIGDIR: path.join(root, '.cache/matplotlib'), PYTHONUNBUFFERED: '1' };

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
/** A recorded observation that is not an assertion about this feature. */
function note(name, detail) {
  checks.push({ name, ok: true, note: true, detail });
  console.log(`NOTE  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Pixels of the rendered avatar, its bounding box and average colour. */
async function canvasInk(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.scan-stage canvas');
    if (!canvas) return null;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    const context = copy.getContext('2d');
    context.drawImage(canvas, 0, 0);
    const data = context.getImageData(0, 0, copy.width, copy.height).data;
    let ink = 0;
    let minX = copy.width;
    let maxX = -1;
    let minY = copy.height;
    let maxY = -1;
    const sum = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      // The avatar material is dark green-grey; the grid and floor stay pale.
      if (data[i + 3] > 10 && data[i] < 170 && data[i + 1] < 190) {
        const pixel = i / 4;
        const x = pixel % copy.width;
        const y = Math.floor(pixel / copy.width);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sum[0] += data[i];
        sum[1] += data[i + 1];
        sum[2] += data[i + 2];
        ink++;
      }
    }
    return {
      width: copy.width,
      height: copy.height,
      ink,
      total: data.length / 4,
      box: ink ? { width: maxX - minX + 1, height: maxY - minY + 1 } : null,
      average: ink ? sum.map((channel) => Math.round(channel / ink)) : null,
    };
  });
}

async function rows(page) {
  return page.$$eval('.scan-rows button', (nodes) =>
    nodes.map((node) => ({
      label: node.querySelector('span')?.firstChild?.textContent?.trim(),
      source: node.querySelector('span small')?.textContent?.trim(),
      value: node.querySelector('b')?.textContent?.trim(),
      // The list disables a row when the service returned no section to draw for it.
      disabled: node.disabled,
    }))
  );
}

(async () => {
  const { chromium } = loadPlaywright();
  let browser;
  const pageErrors = [];
  const consoleErrors = [];
  const api = [];
  const posts = [];
  try {
    // --timeout-keep-alive: uvicorn's 5s default closes an idle socket that the Next
    // dev-proxy pool still holds, which can surface as ECONNRESET on the first POST
    // after a long pause. Raising it here keeps the QA run about the feature, not the
    // pooled-socket race (the UI shows that failure as a retryable error either way).
    start('backend', path.join(root, 'backend/.venv/Scripts/python.exe'), ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', backendPort, '--timeout-keep-alive', '65'], path.join(root, 'backend'));
    if (!process.env.MORPH_QA_SKIP_BUILD) {
      console.log('building QA bundle (MORPH_REVIEW=1)...');
      await buildFrontend();
      console.log('QA build done');
    }
    start('frontend', process.execPath, [path.join(root, 'frontend/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', frontendPort], path.join(root, 'frontend'), { MORPH_REVIEW: '1' });
    await Promise.all([ready(`${backendUrl}/api/health`), ready(frontendUrl)]);
    console.log('servers ready');

    browser = await chromium.launch({
      executablePath: chromePath(),
      headless: true,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('request', (request) => {
      if (request.url().includes('/api/scans/manual')) posts.push(request.postData());
    });
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/')) api.push({ url: url.replace(frontendUrl, ''), status: response.status() });
    });

    await page.goto(`${frontendUrl}/scan`, { waitUntil: 'networkidle' });
    check('camera onboarding is the default and still intact', await page.locator('.scan-camera-consent').isVisible() && await page.locator('input[type=file]').count() === 0);
    check('no sample mannequin before scanning', await page.locator('canvas').count() === 0);

    // Baseline: is the standalone /scan header itself wider than a phone viewport?
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    const baselineOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.waitForTimeout(300);

    await page.click('.scan-entry-switch button:has-text("Nhập số đo thủ công")');
    await page.waitForSelector('.manual-entry');
    await page.screenshot({ path: path.join(out, 'manual-form-desktop.png'), fullPage: true });

    // Empty form must not submit and must explain what is missing.
    await page.click('.manual-actions button:has-text("Dựng mô hình từ số đo")');
    const emptyErrors = await page.$$eval('.manual-fields small.manual-error', (nodes) => nodes.map((n) => n.textContent.trim()));
    check('empty form shows per-field errors', emptyErrors.length >= 3 && posts.length === 0, emptyErrors.join(' | '));

    // Out-of-range value must be refused in the browser, not sent.
    await page.fill('#manual-height_cm', '90');
    await page.fill('#manual-chest_cm', '96');
    await page.fill('#manual-waist_cm', '82');
    await page.click('.manual-actions button:has-text("Dựng mô hình từ số đo")');
    const heightError = await page.textContent('#manual-height_cm-help');
    check('out-of-range height is rejected locally', heightError.includes('100–230') && posts.length === 0, heightError);
    await page.screenshot({ path: path.join(out, 'manual-form-errors.png'), fullPage: true });

    // Valid entry -> real session -> 3D result.
    await page.fill('#manual-height_cm', '175');
    await page.fill('#manual-hip_cm', '100');
    await page.click('.manual-actions button:has-text("Dựng mô hình từ số đo")');
    await page.waitForSelector('h2:has-text("Hình thể 3D của bạn")', { timeout: 60000 });
    await page.waitForSelector('.scan-stage canvas', { timeout: 60000 });
    await page.waitForTimeout(3500);
    const viewerState = await page.evaluate(() => {
      const canvas = document.querySelector('.scan-stage canvas');
      return {
        canvas: Boolean(canvas),
        size: canvas ? `${canvas.width}x${canvas.height}` : null,
        loading: document.querySelector('.scan-loading')?.textContent?.trim() ?? null,
        fallback: document.querySelector('.viewer-fallback')?.textContent?.trim() ?? null,
      };
    });
    check('the 3D viewer mounted (no loading/fallback state)', viewerState.canvas && !viewerState.loading, JSON.stringify(viewerState));
    await page.screenshot({ path: path.join(out, 'manual-result-desktop.png'), fullPage: true });

    const firstPost = JSON.parse(posts[0]);
    check('the form posts measurements to /api/scans/manual', firstPost.height_cm === 175 && firstPost.chest_cm === 96 && firstPost.waist_cm === 82 && firstPost.hip_cm === 100, JSON.stringify(api.filter((entry) => entry.url.includes('/api/scans')).slice(0, 4)));

    const ink = await canvasInk(page);
    check(
      'the 3D viewer really rendered a body-shaped mesh',
      ink && ink.ink > ink.total * 0.02 && ink.box.height > ink.box.width && ink.average[1] > ink.average[0] && ink.average[1] > ink.average[2],
      ink && `${ink.width}x${ink.height}, ${ink.ink} mesh px, box ${ink.box.width}x${ink.box.height}, avg rgb ${ink.average}`
    );
    check('WebGL created a real context (not the unsupported-browser notice)', ink && ink.ink > 0, ink && `${ink.ink} px drawn`);

    const measurements = await rows(page);
    const value = (label) => measurements.find((row) => row.label === label);
    check('entered values are shown as the user\'s own input', value('Ngực')?.value?.startsWith('96') && value('Ngực')?.source === 'Bạn nhập' && value('Eo')?.value?.startsWith('82') && value('Mông')?.value?.startsWith('100'), JSON.stringify(measurements.map((row) => `${row.label}=${row.value}(${row.source})`)));
    check('template-only measurements stay labelled as the model\'s', value('Vòng đầu')?.source === 'Theo mẫu 3D');
    check('size advice was produced from the entered measurements', await page.locator('.scan-advice-success').count() === 1, (await page.textContent('.scan-size-panel')).slice(0, 120).replace(/\s+/g, ' '));

    const adviceText = await page.textContent('.scan-advice-success');
    const suggested = /Gợi ý: Size ([A-Z0-9, ]+)/.exec(adviceText)?.[1];
    const modelCalls = api.filter((entry) => /\/model$/.test(entry.url));
    check('the GLB model endpoint served the avatar', modelCalls.length >= 1 && modelCalls.every((entry) => entry.status === 200), JSON.stringify(modelCalls));

    // Edit and regenerate.
    await page.click('button:has-text("Sửa số đo")');
    await page.waitForSelector('.manual-entry');
    const prefilled = await page.evaluate(() => ['height_cm', 'chest_cm', 'waist_cm', 'hip_cm'].map((key) => document.querySelector(`#manual-${key}`).value));
    check('editing is pre-filled with the previous numbers', prefilled.join('/') === '175/96/82/100', prefilled.join('/'));

    await page.fill('#manual-chest_cm', '104');
    await page.click('.manual-actions button:has-text("Dựng mô hình từ số đo")');
    await page.waitForSelector('h2:has-text("Hình thể 3D của bạn")', { timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(out, 'manual-regenerated-desktop.png'), fullPage: true });

    const secondPost = JSON.parse(posts[posts.length - 1]);
    const regenerated = await rows(page);
    check('the edited session is a new job with the new value', posts.length === 2 && secondPost.chest_cm === 104 && new Set(api.filter((entry) => entry.url.includes('/api/scans/') && entry.url.endsWith('/model')).map((entry) => entry.url)).size === 2, `${posts.length} submissions, chest now ${secondPost.chest_cm}`);
    check('the viewer shows the regenerated measurements', regenerated.find((row) => row.label === 'Ngực')?.value?.startsWith('104'), JSON.stringify(regenerated.map((row) => `${row.label}=${row.value}`)));
    const replaced = api.filter((entry) => /\/api\/scans\/[0-9a-f]{32}$/.test(entry.url) && entry.status === 204);
    check('the previous session was deleted before regenerating', replaced.length >= 1, JSON.stringify(replaced));

    // Supporting bands: the same flow, with every extra field the form now exposes.
    await page.click('button:has-text("Sửa số đo")');
    await page.waitForSelector('.manual-entry');
    const groups = await page.$$eval('.manual-fields .manual-group', (nodes) => nodes.map((node) => node.firstChild.textContent.trim()));
    check('the form is split into labelled groups', groups.length === 3, groups.join(' | '));

    const supporting = { height_cm: '170', chest_cm: '90', waist_cm: '74', hip_cm: '96', neck_cm: '35', head_cm: '56', thigh_cm: '54', calf_cm: '35', ankle_cm: '21', shoulder_width_cm: '40', arm_length_cm: '59', inseam_cm: '78' };
    for (const [field, value] of Object.entries(supporting)) await page.fill(`#manual-${field}`, value);
    await page.click('.manual-actions button:has-text("Dựng mô hình từ số đo")');
    await page.waitForSelector('h2:has-text("Hình thể 3D của bạn")', { timeout: 60000 });
    await page.waitForSelector('.scan-stage canvas', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(out, 'manual-supporting-desktop.png'), fullPage: true });

    const supportingPost = JSON.parse(posts[posts.length - 1]);
    check('every supporting band is sent to the service', Object.entries(supporting).every(([field, value]) => String(supportingPost[field]) === value), JSON.stringify(supportingPost));
    const supportingInk = await canvasInk(page);
    check('the body is still rendered with all the supporting bands fitted', supportingInk && supportingInk.ink > supportingInk.total * 0.02 && supportingInk.box.height > supportingInk.box.width, supportingInk && `${supportingInk.ink} mesh px, box ${supportingInk.box.width}x${supportingInk.box.height}`);

    const supportingRows = await rows(page);
    const row = (label) => supportingRows.find((entry) => entry.label === label);
    check('fitted supporting girths are shown as the user\'s own input', ['Vòng cổ', 'Vòng đầu', 'Vòng đùi trái', 'Vòng bắp chân trái', 'Vòng cổ chân trái'].every((label) => row(label)?.source === 'Bạn nhập'), JSON.stringify(supportingRows.map((entry) => `${entry.label}=${entry.value}(${entry.source})`)));
    check('numbers that were only recorded say so', row('Rộng vai')?.source === 'Bạn nhập · không dựng vào mô hình' && row('Dài trong chân')?.source === 'Bạn nhập · không dựng vào mô hình', `${row('Rộng vai')?.source} / ${row('Dài trong chân')?.source}`);
    const sectionRows = await page.$$eval('.scan-rows button', (nodes) => nodes.map((node) => ({ label: node.querySelector('span')?.firstChild?.textContent?.trim(), disabled: node.disabled })));
    const clickable = (label) => sectionRows.find((entry) => entry.label === label)?.disabled === false;
    check('the added girths have a real section to draw on the avatar', ['Vòng cổ', 'Vòng đầu', 'Vòng đùi trái', 'Vòng bắp chân trái', 'Vòng cổ chân trái'].every(clickable), JSON.stringify(sectionRows));
    const blocked = (label) => sectionRows.find((entry) => entry.label === label)?.disabled === true;
    check('numbers that were only recorded have no section to draw', ['Rộng vai', 'Dài tay', 'Dài trong chân'].every(blocked), JSON.stringify(sectionRows));
    check('the note describes what was fitted and what was only recorded', (await page.textContent('.scan-source-note')).includes('chỉ được ghi lại'), (await page.textContent('.scan-source-note')).slice(0, 200));

    // Mobile layout of the manual form.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('button:has-text("Sửa số đo")');
    await page.waitForSelector('.manual-entry');
    const overflow = await page.evaluate(() => {
      const limit = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll('body *')]
        .filter((element) => element.getBoundingClientRect().right > limit + 1)
        .slice(0, 8)
        .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`);
      return { px: document.documentElement.scrollWidth - limit, wide };
    });
    check('no horizontal overflow introduced by the manual form', overflow.px === baselineOverflow, `manual ${overflow.px}px vs camera-onboarding baseline ${baselineOverflow}px`);
    note('standalone /scan header already overflows a 390px viewport before this work', `overflow ${overflow.px}px from ${overflow.wide.join(', ')}`);
    await page.screenshot({ path: path.join(out, 'manual-form-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1024 });

    // The product page is the commerce entry point: same components, inside the modal.
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto(`${frontendUrl}/products/ao-thun-essential`, { waitUntil: 'networkidle' });
    await page.click('button.fit-entry');
    await page.waitForSelector('.fit-modal .scan-entry-switch', { timeout: 30000 });
    await page.click('.fit-modal .scan-entry-switch button:has-text("Nhập số đo thủ công")');
    await page.waitForSelector('.fit-modal .manual-entry');
    await page.screenshot({ path: path.join(out, 'manual-form-modal.png'), fullPage: true });
    await page.fill('#manual-height_cm', '162');
    await page.fill('#manual-chest_cm', '88');
    await page.fill('#manual-waist_cm', '70');
    await page.click('.fit-modal .manual-actions button:has-text("Dựng mô hình từ số đo")');
    await page.waitForSelector('.fit-modal h2:has-text("Hình thể 3D của bạn")', { timeout: 60000 });
    await page.waitForSelector('.fit-modal .scan-stage canvas', { timeout: 60000 });
    await page.waitForTimeout(3500);
    const modalInk = await canvasInk(page);
    await page.screenshot({ path: path.join(out, 'manual-result-modal.png'), fullPage: true });
    check('the product page modal builds and displays a manual model', modalInk && modalInk.ink > modalInk.total * 0.02 && modalInk.box.height > modalInk.box.width, modalInk && `${modalInk.ink} mesh px, box ${modalInk.box.width}x${modalInk.box.height}, avg rgb ${modalInk.average}`);
    const modalRows = await rows(page);
    check('the modal lists the entered measurements with their source', modalRows.find((row) => row.label === 'Ngực')?.value?.startsWith('88') && modalRows.find((row) => row.label === 'Ngực')?.source === 'Bạn nhập', JSON.stringify(modalRows.slice(0, 4).map((row) => `${row.label}=${row.value}(${row.source})`)));

    check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
    check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify({ url: frontendUrl, suggested_size: suggested, baseline_mobile_overflow_px: baselineOverflow, checks, page_errors: pageErrors, console_errors: consoleErrors, api }, null, 2));
    const failed = checks.filter((entry) => !entry.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
    process.exitCode = failed.length ? 1 : 0;
  } catch (error) {
    console.error('HARNESS ERROR', error);
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify({ error: String(error), checks, page_errors: pageErrors, console_errors: consoleErrors, api }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser?.close();
    for (const child of children) { try { child.kill(); } catch {} }
  }
})();
