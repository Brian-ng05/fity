const { chromium } = require('C:/Users/Phan Trinh Tien Dat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const root = 'D:/MORPH-AI';
const out = path.join(root, 'output/playwright/storefront-20261012');

const env = {
  ...process.env,
  MORPH_REVIEW: '1',
  NEXT_TELEMETRY_DISABLED: '1',
  BACKEND_URL: 'http://127.0.0.1:8007',
};

async function ready(url) {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  throw Error('Not ready ' + url);
}

(async () => {
  console.log('Starting frontend on 3107...');
  const server = spawn(
    process.execPath,
    [path.join(root, 'frontend/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3107'],
    { cwd: path.join(root, 'frontend'), env, windowsHide: true, stdio: 'ignore' }
  );

  try {
    await ready('http://127.0.0.1:3107');

    const browser = await chromium.launchPersistentContext(path.join(root, '.cache/storefront-browser'), {
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
      viewport: { width: 1440, height: 1024 },
    });

    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:3107/', { waitUntil: 'networkidle' });

    // Open Color Dropdown
    console.log('Opening color dropdown...');
    await page.locator('.custom-dropdown-trigger', { hasText: 'Tông màu' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, '10-dropdown-color-open.png'), fullPage: false });

    // Select a color (e.g. Xanh forest)
    console.log('Selecting color Xanh forest...');
    await page.locator('.dropdown-option-item', { hasText: 'Xanh forest' }).click();
    await page.waitForTimeout(300);

    // Open Price Dropdown
    console.log('Opening price dropdown...');
    await page.locator('.custom-dropdown-trigger', { hasText: 'Khoảng giá' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, '11-dropdown-price-open.png'), fullPage: false });

    // Open Size Dropdown
    console.log('Opening size dropdown...');
    await page.locator('.custom-dropdown-trigger', { hasText: 'Kích cỡ' }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, '12-dropdown-size-open.png'), fullPage: false });

    await browser.close();
    console.log('DONE CAPTURING DROPDOWNS');
  } finally {
    server.kill();
  }
})();
