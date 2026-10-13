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
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', BACKEND_URL: backendUrl, MPLCONFIGDIR: path.join(root, '.cache/matplotlib'), PYTHONUNBUFFERED: '1',
  // Own data dir: another backend (the developer's own on port 8000) shares backend/data
  // by default and its janitor deletes GLBs it has no session for, which would 404 ours.
  MORPH_DATA_DIR: path.join(root, '.cache/manual-qa-data') };

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

/** Downscaled ink probe: ~10x cheaper than canvasInk, for sampling during a drag. */
async function canvasInkFast(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.scan-stage canvas');
    if (!canvas) return null;
    const copy = document.createElement('canvas');
    copy.width = 240;
    copy.height = 196;
    const context = copy.getContext('2d');
    context.drawImage(canvas, 0, 0, copy.width, copy.height);
    const { data } = context.getImageData(0, 0, copy.width, copy.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 10 && data[i] < 170 && data[i + 1] < 190) ink++;
    return { width: copy.width, height: copy.height, ink, total: copy.width * copy.height };
  });
}

/**
 * Move one adjust band between two values and read the drawn mesh at each, all inside a
 * single page evaluation.
 *
 * Everything stays in the page: the two readings are a couple of animation frames apart,
 * far inside the 700 ms commit debounce, so nothing the service rebuilds can be mistaken
 * for the browser's own preview deformation. Doing this from Node was the source of the
 * flakiness — a CDP round-trip for each reading could outlast the debounce.
 */
async function previewMovement(page, band, from, to) {
  return page.evaluate(
    async ({ band, from, to }) => {
      const input = document.querySelector(`#adjust-${band}`);
      const canvas = document.querySelector('.scan-stage canvas');
      if (!input || !canvas) return null;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const ink = () => {
        const copy = document.createElement('canvas');
        copy.width = 240;
        copy.height = 196;
        const context = copy.getContext('2d');
        context.drawImage(canvas, 0, 0, copy.width, copy.height);
        const { data } = context.getImageData(0, 0, copy.width, copy.height);
        let count = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 10 && data[i] < 170 && data[i + 1] < 190) count++;
        return count;
      };
      const drive = async (value, previous) => {
        setter.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        // Give React, R3F's invalidate() and the repaint a few frames before the reading —
        // reading in the same tick only ever sees the previous state.
        let shot = 0;
        for (let attempt = 0; attempt < 16; attempt++) {
          await frame();
          shot = ink();
          if (previous == null) {
            if (attempt >= 2) break;
            continue;
          }
          if (Math.abs(shot - previous) > Math.max(8, previous * 0.005)) break;
        }
        return shot;
      };
      const narrow = await drive(from, null);
      const wide = await drive(to, narrow);
      return { narrow, wide };
    },
    { band, from, to },
  );
}

async function rows(page) {
  return page.$$eval('.scan-rows .scan-row', (nodes) =>
    nodes.map((node) => {
      const pick = node.querySelector('.scan-row-pick');
      const stepper = node.querySelector('.scan-row-stepper input');
      return {
        label: node.querySelector('.scan-row-pick span')?.firstChild?.textContent?.trim(),
        source: node.querySelector('.scan-row-pick span small')?.textContent?.trim(),
        // A fitted row edits its number in place; any other row just prints it.
        value: node.querySelector('b')?.textContent?.trim() ?? stepper?.value ?? '',
        // The list disables a row when the service returned no section to draw for it.
        disabled: Boolean(pick?.disabled),
      };
    })
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
    fs.rmSync(env.MORPH_DATA_DIR, { recursive: true, force: true });
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
    check('an unfilled band stays labelled as the model\'s', value('Vòng đùi trái')?.source === 'Theo mẫu 3D');
    check('the bands the form no longer asks for read as computed, not as the user\'s', ['Vòng cổ', 'Vòng đầu'].every((label) => value(label)?.source === 'Hệ thống tự tính'));
    check('size advice was produced from the entered measurements', await page.locator('.scan-advice-success').count() === 1, (await page.textContent('.scan-size-panel')).slice(0, 120).replace(/\s+/g, ' '));

    const adviceText = await page.textContent('.scan-advice-success');
    const suggested = /Gợi ý: Size ([A-Z0-9, ]+)/.exec(adviceText)?.[1];
    const modelCalls = api.filter((entry) => /\/model$/.test(entry.url));
    check('the GLB model endpoint served the avatar', modelCalls.length >= 1 && modelCalls.every((entry) => entry.status === 200), JSON.stringify(modelCalls));

    // A fresh build's baseline IS its own measurements, so the bands the service computed
    // must come back with a near-zero residual here — the check that the avatar really
    // renders the numbers that went in, not merely that they were recorded.
    await page.waitForSelector('.scan-accuracy .accuracy-row', { timeout: 30000 });
    const freshAccuracy = await page.$$eval('.accuracy-row:not(.accuracy-head)', (nodes) =>
      nodes.map((node) => {
        const cells = [...node.querySelectorAll(':scope > span')].map((span) => span.textContent.trim());
        return { label: cells[0] || '', reference: cells[1] || '', model: cells[2] || '', diff: cells[3] || '' };
      }),
    );
    const freshResidual = (label) => {
      const entry = freshAccuracy.find((row) => row.label.startsWith(label));
      if (!entry || entry.reference === '—' || entry.model === 'không có') return null;
      return Math.abs(parseFloat(entry.diff) || 0);
    };
    check('a fresh build matches the numbers it computed for the derived trio',
      ['Vòng cổ', 'Vòng đầu', 'Vòng cổ chân'].every((label) => { const r = freshResidual(label); return r !== null && r <= 1.5; }),
      JSON.stringify(freshAccuracy.filter((row) => /Vòng cổ|Vòng đầu|Vòng ngực/.test(row.label))));

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
    const steps = await page.$$eval('.manual-fields input[type=number]', (nodes) => nodes.map((node) => node.step));
    check('every manual field steps one whole centimetre', steps.length === 9 && steps.every((step) => step === '1'), steps.join(','));
    check('the storefront carries the FITY brand, not MORPH', (await page.locator('.shop-logo:has-text("FITY")').count()) > 0 && (await page.locator('text=MORPH').count()) === 0, await page.textContent('.shop-logo'));

    const supporting = { height_cm: '170', chest_cm: '90', waist_cm: '74', hip_cm: '96', thigh_cm: '54', calf_cm: '35', shoulder_width_cm: '40', arm_length_cm: '59', inseam_cm: '78' };
    for (const [field, value] of Object.entries(supporting)) await page.fill(`#manual-${field}`, value);
    await page.click('.manual-actions button:has-text("Dựng mô hình từ số đo")');
    await page.waitForSelector('h2:has-text("Hình thể 3D của bạn")', { timeout: 60000 });
    await page.waitForSelector('.scan-stage canvas', { timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(out, 'manual-supporting-desktop.png'), fullPage: true });

    const supportingPost = JSON.parse(posts[posts.length - 1]);
    check('every entered band is sent, and the derived trio is left for the service to compute', Object.entries(supporting).every(([field, value]) => String(supportingPost[field]) === value) && ['neck_cm', 'head_cm', 'ankle_cm'].every((field) => supportingPost[field] === null), JSON.stringify(supportingPost));
    const supportingInk = await canvasInk(page);
    check('the body is still rendered with all the supporting bands fitted', supportingInk && supportingInk.ink > supportingInk.total * 0.02 && supportingInk.box.height > supportingInk.box.width, supportingInk && `${supportingInk.ink} mesh px, box ${supportingInk.box.width}x${supportingInk.box.height}`);

    const supportingRows = await rows(page);
    const row = (label) => supportingRows.find((entry) => entry.label === label);
    check('typed girths read as the user\'s own input; the derived trio says it was computed', ['Vòng đùi trái', 'Vòng bắp chân trái'].every((label) => row(label)?.source === 'Bạn nhập') && ['Vòng cổ', 'Vòng đầu', 'Vòng cổ chân trái'].every((label) => row(label)?.source?.startsWith('Hệ thống tự tính')), JSON.stringify(supportingRows.map((entry) => `${entry.label}=${entry.value}(${entry.source})`)));
    check('numbers that were only recorded say so', row('Rộng vai')?.source === 'Bạn nhập · không dựng vào mô hình' && row('Dài trong chân')?.source === 'Bạn nhập · không dựng vào mô hình', `${row('Rộng vai')?.source} / ${row('Dài trong chân')?.source}`);
    const sectionRows = await page.$$eval('.scan-rows .scan-row', (nodes) => nodes.map((node) => ({ label: node.querySelector('.scan-row-pick span')?.firstChild?.textContent?.trim(), disabled: Boolean(node.querySelector('.scan-row-pick')?.disabled) })));
    const clickable = (label) => sectionRows.find((entry) => entry.label === label)?.disabled === false;
    check('the typed and computed girths have a real section to draw on the avatar', ['Vòng cổ', 'Vòng đầu', 'Vòng đùi trái', 'Vòng bắp chân trái', 'Vòng cổ chân trái'].every(clickable), JSON.stringify(sectionRows));
    const blocked = (label) => sectionRows.find((entry) => entry.label === label)?.disabled === true;
    check('numbers that were only recorded have no section to draw', ['Rộng vai', 'Dài tay', 'Dài trong chân'].every(blocked), JSON.stringify(sectionRows));
    check('the note describes what was fitted and what was only recorded', (await page.textContent('.scan-source-note')).includes('chỉ được ghi lại'), (await page.textContent('.scan-source-note')).slice(0, 200));

    // A reload must not lose the measurements the avatar was built from.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('h2:has-text("Hình thể 3D của bạn")', { timeout: 60000 });
    await page.waitForSelector('.scan-stage canvas', { timeout: 60000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(out, 'manual-restored-after-reload.png'), fullPage: true });
    const afterReload = await rows(page);
    const restoredRow = (label) => afterReload.find((entry) => entry.label === label);
    check('a reload restores the saved measurements and the rebuilt model', restoredRow('Ngực')?.value?.startsWith('90') && restoredRow('Vòng đùi trái')?.value?.startsWith('54') && restoredRow('Vòng cổ chân trái')?.source?.startsWith('Hệ thống tự tính'), JSON.stringify(afterReload.map((entry) => `${entry.label}=${entry.value}(${entry.source})`)));
    const restoredInk = await canvasInk(page);
    check('the restored session really renders the avatar again', restoredInk && restoredInk.ink > restoredInk.total * 0.02, restoredInk && `${restoredInk.ink} mesh px`);

    // The form re-opens on those numbers, so an edit starts from what was saved.
    await page.click('button:has-text("Sửa số đo")');
    await page.waitForSelector('.manual-entry');
    const restoredDraft = await page.evaluate(() => ['height_cm', 'chest_cm', 'thigh_cm', 'calf_cm', 'inseam_cm'].map((key) => document.querySelector(`#manual-${key}`).value));
    check('the form re-opens on the saved numbers after a reload', restoredDraft.join('/') === '170/90/54/35/78', restoredDraft.join('/'));
    await page.click('.manual-actions button:has-text("Hủy")');
    await page.waitForSelector('.scan-rows');

    // ── Reference vs model, then an adjustment that really rebuilds the avatar ──
    const accuracyRows = () =>
      page.$$eval('.accuracy-row:not(.accuracy-head)', (nodes) =>
        nodes.map((node) => {
          const cells = [...node.querySelectorAll(':scope > span')].map((span) => span.textContent.trim());
          return {
            label: cells[0] || '', reference: cells[1] || '', model: cells[2] || '', diff: cells[3] || '', percent: cells[4] || '',
            flagged: node.className.includes('accuracy-row-flagged'), partial: node.className.includes('accuracy-row-partial'),
          };
        }),
      );
    await page.waitForSelector('.scan-accuracy .accuracy-row', { timeout: 30000 });
    const compared = await accuracyRows();
    const near = (text, expected) => Math.abs(parseFloat(text) - expected) <= 1.5;
    /** Wait until the measurement list itself shows the rebuilt value, rather than
     *  racing a fixed timeout against the old view still being mounted. */
    const waitForMeasured = (label, value) =>
      page.waitForFunction(
        ({ label, value }) => {
          const row = [...document.querySelectorAll('.scan-rows .scan-row')].find(
            (node) => (node.querySelector('.scan-row-pick span')?.firstChild?.textContent || '').trim() === label,
          );
          const shown = row?.querySelector('b')?.textContent || row?.querySelector('.scan-row-stepper input')?.value || '';
          return String(shown).startsWith(String(value));
        },
        { label, value },
        { timeout: 60000 },
      );
    const chestRow = compared.find((entry) => entry.label.startsWith('Vòng ngực'));
    check('the comparison keeps the original baseline and reports the model separately',
      near(chestRow?.reference, 96) && near(chestRow?.model, 90) && Math.abs(parseFloat(chestRow?.diff || '0') - 6) <= 1.5,
      JSON.stringify(chestRow));
    check('a computed band is compared against the number the service computed, not treated as model-only',
      ['Vòng cổ', 'Vòng đầu', 'Vòng cổ chân'].every((label) => {
        const entry = compared.find((e) => e.label.startsWith(label));
        return entry && entry.reference !== '—' && entry.model !== 'không có' && entry.percent !== '—';
      }),
      JSON.stringify(compared.filter((e) => /Vòng cổ|Vòng đầu/.test(e.label))));
    check('the session fit residual is reported separately from the change vs the baseline',
      (await page.textContent('.scan-accuracy')).includes('Sai lệch khớp lớn nhất'), 'fit-error line present');

    const limitsCalled = api.some((entry) => entry.url.includes('/api/measurements/limits'));
    const bounded = await page.$eval('#adjust-chest_cm', (node) => ({ min: node.min, max: node.max, value: node.value }));
    check('the inline adjust input is bounded by the template range the service reports, not the wide form bounds', limitsCalled && Number(bounded.min) > 40 && Number(bounded.max) < 220 && Number(bounded.min) < Number(bounded.value) && Number(bounded.value) < Number(bounded.max), JSON.stringify(bounded));

    // ── The live controls: steppers, and movement in the browser before any rebuild ──
    // The stepper is checked first, while no debounced commit is pending: a commit that
    // lands mid-test re-seeds the panel from the new job and would undo the click.
    const chestBefore = await page.$eval('#adjust-chest_cm', (node) => node.value);
    await page.click('.scan-row:has(#adjust-chest_cm) .adjust-step:last-child');
    // The panel coalesces updates to one animation frame, so read after that frame, not
    // in the same tick as the click.
    await page.waitForTimeout(150);
    const chestStepped = await page.$eval('#adjust-chest_cm', (node) => node.value);
    check(
      'the stepper moves one centimetre and shows the current value',
      Number(chestStepped) === Number(chestBefore) + 1,
      `${chestBefore} -> ${chestStepped}`,
    );
    // Let that debounced commit land before sampling the canvas, so the readings below are
    // taken on one settled mesh rather than across a rebuild.
    await waitForMeasured('Ngực', 91);
    // Let the replacement GLB finish loading before sampling the canvas, or the first
    // sample lands on an empty frame.
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.scan-stage canvas');
      if (!canvas) return false;
      const copy = document.createElement('canvas');
      copy.width = 240; copy.height = 196;
      const context = copy.getContext('2d');
      context.drawImage(canvas, 0, 0, copy.width, copy.height);
      const { data } = context.getImageData(0, 0, copy.width, copy.height);
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 10 && data[i] < 170 && data[i + 1] < 190) ink++;
      return ink > 500;
    }, undefined, { timeout: 60000 });

    // Drive the waist between its extremes and read the drawn mesh at each. Nothing is sent
    // to the service during this window, so anything that moves was moved by the browser.
    const postsBeforeDrag = posts.length;
    const movement = await previewMovement(page, 'waist_cm', 56, 103);
    check(
      'the avatar moves in the browser before any rebuild is sent',
      posts.length === postsBeforeDrag && Boolean(movement) && movement.narrow > 0 && movement.wide > movement.narrow * 1.03,
      `no new POST (still ${posts.length}, was ${postsBeforeDrag}); waist 56 vs 103 -> ${movement?.narrow} / ${movement?.wide} mesh px`,
    );
    await page.screenshot({ path: path.join(out, 'manual-live-preview.png'), fullPage: true });

    // Let the debounced commit run: the numbers become an authoritative rebuild. The
    // rebuild now also fits the derived neck/head/ankle, so wait for it to settle rather
    // than racing a fixed timeout — the status line is the signal that the mesh on screen
    // is the service's, not the browser preview.
    await page.fill('#adjust-chest_cm', '102');
    await waitForMeasured('Ngực', 102);
    await page.waitForFunction(
      () => (document.querySelector('.adjust-status')?.textContent || '').includes('Đã khớp'),
      undefined,
      { timeout: 60000 },
    );
    await page.waitForSelector('.scan-stage canvas', { timeout: 60000 });
    await page.waitForSelector('.scan-accuracy .accuracy-row', { timeout: 60000 });
    await page.waitForFunction(
      () => {
        const row = [...document.querySelectorAll('.accuracy-row:not(.accuracy-head)')].find((node) =>
          (node.querySelector('span')?.textContent || '').startsWith('Vòng ngực'),
        );
        return /10[12]/.test(row?.children?.[2]?.textContent || '');
      },
      undefined,
      { timeout: 60000 },
    );
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, 'manual-adjust-accuracy.png'), fullPage: true });
    const afterAdjust = await accuracyRows();
    const chestAfter = afterAdjust.find((entry) => entry.label.startsWith('Vòng ngực'));
    check('the adjustment is sent to the service and rebuilt', JSON.parse(posts[posts.length - 1]).chest_cm === 102, `chest=${JSON.parse(posts[posts.length - 1]).chest_cm}`);
    check('the original baseline survives the rebuild', near(chestAfter?.reference, 96), JSON.stringify(chestAfter));
    check('the model column tracks the rebuilt geometry, not the baseline', near(chestAfter?.model, 102), JSON.stringify(chestAfter));
    check('a dimension that deviates from the baseline is highlighted', chestAfter?.flagged === true && Math.abs(parseFloat(chestAfter?.diff || '0') - 6) <= 1.5, JSON.stringify(chestAfter));
    const inkAdjusted = await canvasInk(page);
    check('the viewer shows the regenerated avatar', inkAdjusted && inkAdjusted.ink > inkAdjusted.total * 0.02, inkAdjusted && `${inkAdjusted.ink} mesh px`);
    const reportBelow = await page.evaluate(() => {
      const report = document.querySelector('.scan-accuracy');
      const workspace = document.querySelector('.scan-workspace');
      if (!report || !workspace) return null;
      return report.getBoundingClientRect().top >= workspace.getBoundingClientRect().bottom - 1;
    });
    check('the deviation report sits below the 3D viewer as a small report', reportBelow === true, String(reportBelow));

    // The preview must not linger once the service has rebuilt: the panel says so, which
    // means the browser-side deformation has been dropped in favour of the real mesh.
    const settled = (await page.textContent('.adjust-status')).trim();
    check('the preview is handed over to the rebuilt model', settled.includes('Đã khớp'), settled);

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
    await page.waitForSelector('.fit-modal', { timeout: 30000 });
    // The saved measurements restore the previous model straight into the modal, so
    // reset first: this block is meant to test building one from the product page.
    // Wait until the modal has settled on something — the restored session's result or
    // the entry switch — before deciding whether a reset is needed. A fixed delay here
    // raced the restore and made this block flaky.
    // The saved measurements may restore the previous model straight into the modal, so
    // reset first: this block is meant to test building one from the product page.
    await page.waitForSelector('.fit-modal .scan-entry-switch, .fit-modal .scan-rows', { timeout: 30000 });
    // Let the localStorage restore land before deciding. Deciding on the first paint is
    // what made this block race: a restore that arrived late replaced the form the toggle
    // had just opened, so the click below could never take.
    await page.waitForTimeout(1500);
    if ((await page.locator('.fit-modal .scan-rows').count()) > 0) {
      await page.locator('.fit-modal button:has-text("Nhập lại")').click();
    }
    await page.waitForSelector('.fit-modal .scan-entry-switch', { timeout: 60000 });

    // The onboarding must actually settle. When a reset let the shared store re-adopt the
    // session that was just cleared, this subtree kept remounting and the switch below
    // could never be clicked. The same node instance after 400ms proves it is stable.
    await page.waitForTimeout(600);
    const settledOnboarding = await page.evaluate(async () => {
      const node = document.querySelector('.fit-modal .scan-entry-switch');
      const first = node?.getBoundingClientRect().top;
      await new Promise((resolve) => setTimeout(resolve, 400));
      const later = document.querySelector('.fit-modal .scan-entry-switch');
      return { sameNode: later === node, top: first, after: later?.getBoundingClientRect().top };
    });
    check(
      'the onboarding settles after a reset (no remount churn)',
      settledOnboarding.sameNode === true && settledOnboarding.top === settledOnboarding.after,
      JSON.stringify(settledOnboarding),
    );

    // This one click is retried: the modal subtree re-renders often enough that Playwright's
    // actionability check intermittently sees a moving or replaced target, even though the
    // onboarding node itself is stable. A dispatched click is used as the fallback.
    const manualToggle = '.fit-modal .scan-entry-switch button:has-text("Nhập số đo thủ công")';
    let manualFormOpen = false;
    for (let attempt = 0; attempt < 10 && !manualFormOpen; attempt++) {
      try {
        await page.click(manualToggle, { timeout: 4000 });
      } catch {
        await page.locator(manualToggle).dispatchEvent('click').catch(() => {});
      }
      manualFormOpen = (await page.locator('.fit-modal .manual-entry').count()) > 0;
      if (!manualFormOpen) await page.waitForTimeout(500);
    }
    check('the modal switches to manual entry', manualFormOpen, `after ${manualFormOpen ? 'a click' : '10 attempts'}`);
    await page.waitForSelector('.fit-modal .manual-entry', { timeout: 30000 });
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

    // ── A camera-derived session must be adjustable too ──
    const photoForm = new FormData();
    photoForm.append('front', new Blob([fs.readFileSync(path.join(__dirname, 'qa/upper-front.png'))], { type: 'image/png' }), 'front.png');
    photoForm.append('side', new Blob([fs.readFileSync(path.join(__dirname, 'qa/upper-side.png'))], { type: 'image/png' }), 'side.png');
    photoForm.append('height_cm', '170');
    photoForm.append('consent', 'true');
    photoForm.append('capture_mode', 'upper_body');
    const photoCreated = await fetch(`${backendUrl}/api/scans`, { method: 'POST', body: photoForm });
    const photoJob = await photoCreated.json();
    let photoDone = null;
    for (let attempt = 0; attempt < 240; attempt++) {
      const state = await (await fetch(`${backendUrl}/api/scans/${photoJob.id}`)).json();
      if (state.status === 'completed' || state.status === 'failed') { photoDone = state; break; }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    check('a real photo scan completes, for the camera adjust test', photoDone?.status === 'completed', `${photoDone?.status} ${photoDone?.error || ''}`);

    if (photoDone?.status === 'completed') {
      // Adopt it exactly the way the app does after a scan, then reload.
      await page.evaluate(({ id, values }) => {
        localStorage.setItem('fity-manual-measurements-v1', JSON.stringify({ jobId: id, values }));
      }, { id: photoDone.id, values: photoDone.measurements });
      await page.goto(`${frontendUrl}/scan`, { waitUntil: 'networkidle' });
      await page.waitForSelector('h2:has-text("Hình thể 3D của bạn")', { timeout: 60000 });
      await page.waitForTimeout(2500);
      check('a camera session offers both the inline adjust controls and the comparison', (await page.locator('#adjust-chest_cm').count()) === 1 && (await page.locator('.scan-accuracy').count()) === 1, (await page.textContent('.scan-source-note')).slice(0, 90));
      const cameraRows = await accuracyRows();
      const hipRow = cameraRows.find((entry) => entry.label.startsWith('Vòng mông'));
      check('a camera band with no reference is marked, not given a percentage', hipRow?.reference === '—' && hipRow?.percent === '—' && hipRow?.partial === true, JSON.stringify(hipRow));
      const shoulderRow = cameraRows.find((entry) => entry.label.startsWith('Rộng vai'));
      check('a number the 3D model does not carry is shown as absent, never invented',
        Math.abs(parseFloat(shoulderRow?.reference || '0') - 35.9) <= 0.3 && shoulderRow?.model === 'không có' && shoulderRow?.percent === '—',
        JSON.stringify(shoulderRow));

      await page.fill('#adjust-chest_cm', '95');
      await waitForMeasured('Ngực', 95);
      await page.waitForFunction(
        () => (document.querySelector('.adjust-status')?.textContent || '').includes('Đã khớp'),
        undefined,
        { timeout: 60000 },
      );
      await page.waitForSelector('.scan-accuracy .accuracy-row', { timeout: 60000 });
      await page.waitForFunction(
        () => {
          const row = [...document.querySelectorAll('.accuracy-row:not(.accuracy-head)')].find((node) =>
            (node.querySelector('span')?.textContent || '').startsWith('Vòng ngực'),
          );
          return /9[45]/.test(row?.children?.[2]?.textContent || '');
        },
        undefined,
        { timeout: 60000 },
      );
      await page.waitForTimeout(800);
      const cameraAfter = (await accuracyRows()).find((entry) => entry.label.startsWith('Vòng ngực'));
      check('adjusting a camera session rebuilds it and keeps the scan numbers as the reference', Math.abs(parseFloat(cameraAfter?.reference || '0') - 82.6) <= 0.2 && Math.abs(parseFloat(cameraAfter?.model || '0') - 95) <= 1.5, JSON.stringify(cameraAfter));
      await page.screenshot({ path: path.join(out, 'camera-adjust-accuracy.png'), fullPage: true });
    }

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
