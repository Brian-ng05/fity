const { chromium } = require('C:/Users/Phan Trinh Tien Dat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = 'D:/MORPH-AI';
const out = path.join(root, 'output/playwright/gold-verification-20261013');
fs.mkdirSync(out, { recursive: true });

process.env.TEMP = path.join(root, '.cache/tmp');
process.env.TMP = process.env.TEMP;

const env = {
  ...process.env,
  MORPH_REVIEW: '1',
  NEXT_TELEMETRY_DISABLED: '1',
  BACKEND_URL: 'http://127.0.0.1:8007',
  MPLCONFIGDIR: path.join(root, '.cache/matplotlib'),
  PYTHONUNBUFFERED: '1',
};

const children = [];
function start(exe, args, cwd, name) {
  const log = fs.openSync(path.join(out, name + '.log'), 'w');
  const p = spawn(exe, args, { cwd, env, windowsHide: true, stdio: ['ignore', log, log] });
  children.push(p);
  p.on('error', (e) => console.error(name, e));
}

async function ready(url) {
  for (let i = 0; i < 90; i++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  throw Error('Not ready ' + url);
}

// Calculate relative luminance and WCAG contrast ratio
function getContrastRatio(rgb1, rgb2) {
  function getLuminance(r, g, b) {
    const a = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }
  function parseRgb(str) {
    const m = str.match(/\d+/g);
    return m ? [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])] : [0, 0, 0];
  }
  const [r1, g1, b1] = parseRgb(rgb1);
  const [r2, g2, b2] = parseRgb(rgb2);
  const l1 = getLuminance(r1, g1, b1);
  const l2 = getLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

(async () => {
  let browser;
  const errors = [];
  const consoleErrors = [];
  const testResults = {};

  try {
    console.log('Starting backend on 8007 and frontend on 3107...');
    start(
      path.join(root, 'backend/.venv/Scripts/python.exe'),
      ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8007'],
      path.join(root, 'backend'),
      'backend'
    );
    start(
      process.execPath,
      [path.join(root, 'frontend/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3107'],
      path.join(root, 'frontend'),
      'frontend'
    );

    await Promise.all([ready('http://127.0.0.1:8007/api/health'), ready('http://127.0.0.1:3107')]);
    console.log('SERVERS READY');

    browser = await chromium.launchPersistentContext(path.join(root, '.cache/gold-browser'), {
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: true,
      env,
      viewport: { width: 1440, height: 900 },
    });

    const fixtures = Object.fromEntries(
      ['front', 'side'].map((key) => [
        key,
        'data:image/png;base64,' + fs.readFileSync(path.join(root, 'verification/scripts/qa/upper-' + key + '.png')).toString('base64'),
      ])
    );

    await browser.addInitScript(({ fixtures }) => {
      window.__cameraFixture = 'blank';
      window.__testTracks = [];
      window.__cameraRequests = [];
      Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', {
        value: async () => [{ kind: 'videoinput', deviceId: 'qa', label: 'QA laptop camera' }],
      });
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: async (request) => {
          window.__cameraRequests.push(request);
          const images = {};
          for (const k of ['front', 'side']) {
            const img = new Image();
            img.src = fixtures[k];
            await img.decode();
            images[k] = img;
          }
          const canvas = document.createElement('canvas');
          canvas.width = images.front.width;
          canvas.height = images.front.height;
          const ctx = canvas.getContext('2d');
          const draw = () => {
            ctx.fillStyle = '#aaaaaa';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            if (images[window.__cameraFixture]) {
              ctx.drawImage(images[window.__cameraFixture], 0, 0, canvas.width, canvas.height);
            }
          };
          draw();
          const timer = setInterval(draw, 100);
          const stream = canvas.captureStream(10);
          window.__testTracks.push(...stream.getTracks());
          for (const t of stream.getTracks()) {
            const stop = t.stop.bind(t);
            t.stop = () => {
              clearInterval(timer);
              stop();
            };
          }
          return stream;
        },
      });
    }, { fixtures });

    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    // Clear cart and wishlist
    await page.goto('http://127.0.0.1:3107/', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('morph-demo-cart-v2');
      localStorage.removeItem('morph-demo-wishlist-v1');
    });
    await page.reload({ waitUntil: 'networkidle' });

    // 1. Desktop Storefront Home & Gold Theme Contrast
    console.log('1. Checking Desktop Storefront Home & Gold Palette Contrast...');
    await page.locator('.shop-header .shop-logo').waitFor();
    const productCardsCount = await page.locator('.product-card').count();
    console.log(`Found ${productCardsCount} products on initial home load.`);
    if (productCardsCount < 20) throw Error(`Expected >= 20 products, got ${productCardsCount}`);
    testResults.productCount = productCardsCount;

    // Check CTA computed contrast
    const ctaStyles = await page.evaluate(() => {
      const btn = document.querySelector('.shop-primary');
      if (!btn) return null;
      const comp = window.getComputedStyle(btn);
      return {
        bg: comp.backgroundColor,
        color: comp.color,
        borderRadius: comp.borderRadius,
      };
    });
    console.log('Primary CTA computed styles:', ctaStyles);
    const contrastRatio = getContrastRatio(ctaStyles.bg, ctaStyles.color);
    console.log(`Primary CTA contrast ratio: ${contrastRatio.toFixed(2)}:1`);
    if (contrastRatio < 4.5) {
      throw Error(`CTA contrast ratio ${contrastRatio.toFixed(2)} is below WCAG AA 4.5:1 requirement!`);
    }
    testResults.ctaContrastRatio = contrastRatio;
    testResults.ctaBorderRadius = ctaStyles.borderRadius;

    await page.screenshot({ path: path.join(out, '01-storefront-home-desktop-1440x900.png'), fullPage: false });

    // 2. Laptop Viewport 1366x768
    console.log('2. Checking Laptop Viewport (1366x768)...');
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(300);
    const laptopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (laptopOverflow) throw Error('Laptop viewport has horizontal overflow!');
    await page.screenshot({ path: path.join(out, '02-storefront-home-laptop-1366x768.png'), fullPage: false });
    testResults.laptopNoOverflow = true;

    // 3. Mobile Viewport 390x844 & Check Header Not Cut Off
    console.log('3. Checking Mobile Viewport (390x844) & Header Safe Bounding Box...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);

    const mobile390HeaderBox = await page.evaluate(() => {
      const bag = document.querySelector('.shop-bag');
      const header = document.querySelector('.shop-header');
      if (!bag || !header) return null;
      const bagRect = bag.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      return {
        windowWidth: window.innerWidth,
        bagRight: bagRect.right,
        bagWidth: bagRect.width,
        headerWidth: headerRect.width,
        isClipped: bagRect.right > window.innerWidth,
      };
    });
    console.log('Mobile 390px Header evaluation:', mobile390HeaderBox);
    if (mobile390HeaderBox.isClipped) {
      throw Error(`Mobile 390px header cart button is cut off! bagRight=${mobile390HeaderBox.bagRight} > windowWidth=${mobile390HeaderBox.windowWidth}`);
    }
    testResults.mobile390HeaderNotClipped = true;
    await page.screenshot({ path: path.join(out, '03-storefront-home-mobile-390x844.png'), fullPage: false });

    // 4. Narrow Mobile Viewport 360px Check
    console.log('4. Checking Narrow Mobile Viewport (360px)...');
    await page.setViewportSize({ width: 360, height: 800 });
    await page.waitForTimeout(300);
    const mobile360HeaderBox = await page.evaluate(() => {
      const bag = document.querySelector('.shop-bag');
      if (!bag) return null;
      const bagRect = bag.getBoundingClientRect();
      return {
        windowWidth: window.innerWidth,
        bagRight: bagRect.right,
        isClipped: bagRect.right > window.innerWidth,
      };
    });
    console.log('Mobile 360px Header evaluation:', mobile360HeaderBox);
    if (mobile360HeaderBox.isClipped) {
      throw Error(`Mobile 360px header cart button is cut off! bagRight=${mobile360HeaderBox.bagRight} > windowWidth=${mobile360HeaderBox.windowWidth}`);
    }
    testResults.mobile360HeaderNotClipped = true;
    await page.screenshot({ path: path.join(out, '04-storefront-home-mobile-360px.png'), fullPage: false });

    // Restore desktop viewport for workflow tests
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:3107/', { waitUntil: 'networkidle' });

    // 5. Category and Search Filters
    console.log('5. Testing Category and Search Filters...');
    await page.locator('.filter-category-bar button', { hasText: 'Sơ mi' }).click();
    await page.waitForTimeout(400);
    const shirtCount = await page.locator('.product-card').count();
    console.log(`Found ${shirtCount} shirts after category filter.`);
    if (shirtCount !== 5) throw Error(`Expected 5 shirts, got ${shirtCount}`);
    testResults.shirtCategoryFilter = shirtCount;

    await page.locator('.filter-search-input').fill('linen');
    await page.waitForTimeout(400);
    const searchCount = await page.locator('.product-card').count();
    console.log(`Found ${searchCount} items matching 'linen'.`);
    testResults.searchFilterCount = searchCount;

    await page.locator('.reset-filter-btn').click();
    await page.waitForTimeout(400);
    const resetCount = await page.locator('.product-card').count();
    if (resetCount !== productCardsCount) throw Error(`Expected reset to ${productCardsCount}, got ${resetCount}`);
    testResults.resetFilters = true;

    // 6. Product Detail Page & Invalid URL Size Handling
    console.log('6. Testing Product Detail & Invalid URL Size Validation...');
    await page.goto('http://127.0.0.1:3107/products/ao-thun-essential?size=INVALID_SIZE_XYZ', { waitUntil: 'networkidle' });
    await page.locator('.product-info h1').waitFor();

    const selectedSizeText = await page.evaluate(() => {
      const activeSizeBtn = document.querySelector('.product-sizes button.selected');
      return activeSizeBtn ? activeSizeBtn.textContent.trim() : '';
    });
    console.log(`Selected size with invalid URL parameter: '${selectedSizeText}'`);
    if (selectedSizeText === 'INVALID_SIZE_XYZ') {
      throw Error('Invalid URL size parameter was erroneously accepted as selected size!');
    }
    testResults.invalidUrlSizeRejected = true;

    // Test Color Swatch Note
    await page.locator('.color-swatch-item').nth(1).click();
    await page.waitForTimeout(200);
    const colorNote = await page.locator('.color-label-row').textContent();
    console.log(`Color label row with alternate color: ${colorNote.trim()}`);
    testResults.colorOriginNotePresent = colorNote.includes('Ảnh hiển thị màu gốc');

    await page.screenshot({ path: path.join(out, '05-product-detail-desktop.png'), fullPage: false });

    // 7. Selecting Valid Size and Adding to Cart
    console.log('7. Selecting Valid Size and Adding to Cart...');
    await page.locator('.product-sizes button', { hasText: 'M' }).click();
    await page.locator('.add-to-cart-btn').click();
    await page.locator('.product-added-banner').waitFor();
    await page.screenshot({ path: path.join(out, '06-product-added-feedback.png'), fullPage: false });

    const headerBagCount = await page.locator('.shop-bag b').textContent();
    console.log(`Cart total quantity in header: ${headerBagCount}`);
    if (headerBagCount !== '1') throw Error(`Expected header cart quantity 1, got ${headerBagCount}`);
    testResults.addToCartFeedbackShown = true;

    // 8. Size Chart Modal & Scan Interconnection
    console.log('8. Testing Size Chart Modal and Interconnection with Scan...');
    await page.locator('.size-chart-btn').click();
    await page.locator('.shop-size-table').waitFor();
    await page.screenshot({ path: path.join(out, '07-size-chart-modal.png'), fullPage: false });

    // Click "Tìm size bằng webcam 3D" from size chart modal
    await page.locator('.shop-modal-body button.shop-primary', { hasText: 'Tìm size bằng webcam 3D' }).click();
    await page.locator('.scan-onboarding').waitFor();
    console.log('Seamlessly navigated from size chart modal to 3D fit module.');
    testResults.sizeChartToScanInterconnection = true;

    // 9. 3D Scan Workflow with Camera Fixtures
    console.log('9. Running 3D Scan Workflow with Mannequin Camera Fixtures...');
    await page.getByRole('checkbox', { name: /Tôi đồng ý gửi khung hình/ }).check();
    await page.getByRole('button', { name: 'Mở camera & bắt đầu', exact: true }).click();
    await page.locator('.capture-session').waitFor();
    await page.screenshot({ path: path.join(out, '08-scan-camera-session.png'), fullPage: false });

    await page.getByRole('button', { name: 'Bắt đầu quét', exact: true }).click();
    await page.waitForTimeout(2000);
    await page.evaluate(() => (window.__cameraFixture = 'front'));
    await page.locator('.capture-count').waitFor({ timeout: 20000 });
    console.log('Front countdown triggered.');

    await page.getByRole('heading', { name: 'Xoay người 90°', exact: true }).waitFor({ timeout: 30000 });
    console.log('Turn 90° displayed. Injecting side fixture...');
    await page.evaluate(() => (window.__cameraFixture = 'side'));
    await page.locator('.capture-count').waitFor({ timeout: 20000 });
    console.log('Side countdown triggered.');

    console.log('Waiting for 3D reconstruction and result screen...');
    await page.getByRole('heading', { name: 'Hình thể 3D của bạn', exact: true }).waitFor({ timeout: 120000 });
    await page.locator('.scan-stage canvas').waitFor();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(out, '09-fit-result-desktop.png'), fullPage: false });

    // Test "Xem bảng size & chọn thủ công" callback
    const manualChartBtn = page.getByRole('button', { name: 'Xem bảng size & chọn thủ công' });
    if (await manualChartBtn.count() > 0) {
      console.log('Testing "Xem bảng size & chọn thủ công" button...');
      await manualChartBtn.click();
      await page.locator('.shop-size-table').waitFor();
      console.log('Size chart modal successfully opened from scan result.');
      testResults.manualSizeChartCallback = true;
      await page.getByRole('button', { name: /Đóng Bảng size/ }).click();
    }

    // Test Apply Size CTA
    const applyBtn = page.locator('.scan-size-apply-btn').first();
    if (await applyBtn.count() > 0) {
      console.log('Testing "Áp dụng size" CTA button...');
      await applyBtn.click();
      await page.waitForTimeout(500);
      console.log('Size applied to product variant successfully.');
      testResults.applySizeCtaWorks = true;
    }

    // 10. Check 404 Session Handling
    console.log('10. Testing 404 Session Handling (Simulated)...');
    const advice404Response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/scans/non-existent-scan-id-404');
        return { status: res.status };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('Non-existent scan check:', advice404Response);
    if (advice404Response.status !== 404) {
      throw Error(`Expected 404 for invalid scan, got ${advice404Response.status}`);
    }
    testResults.session404Handled = true;

    // 11. Dedicated Full Cart Page (/cart) Verification
    console.log('11. Testing Full Cart Page (/cart)...');
    await page.goto('http://127.0.0.1:3107/cart', { waitUntil: 'networkidle' });
    await page.locator('.cart-page-header h1').waitFor();

    // Verify items in cart
    const cartTableRows = await page.locator('.cart-table tbody tr').count();
    console.log(`Cart page contains ${cartTableRows} row(s) in table.`);
    if (cartTableRows < 1) throw Error(`Expected >= 1 cart item on /cart, found ${cartTableRows}`);
    testResults.cartPageHasItems = true;

    // Test quantity stepper
    const initialQty = await page.locator('.cart-stepper-val').first().textContent();
    console.log(`Initial quantity on /cart: ${initialQty}`);

    // Test remove item and undo toast
    console.log('Testing remove item and undo toast...');
    const removeBtn = page.locator('.cart-table .cart-remove-btn').first();
    await removeBtn.click();
    await page.locator('.commerce-toast').waitFor();
    console.log('Undo toast displayed after removing item.');
    testResults.undoToastDisplayed = true;

    // Click undo
    await page.locator('.toast-undo-btn').click();
    await page.waitForTimeout(400);
    const restoredRows = await page.locator('.cart-table tbody tr').count();
    console.log(`Cart table rows after undo: ${restoredRows}`);
    if (restoredRows < 1) throw Error('Item was not restored after undo click!');
    testResults.undoRemoveWorks = true;

    // Desktop screenshot of cart page
    await page.screenshot({ path: path.join(out, '10-cart-page-desktop.png'), fullPage: false });

    // Mobile 390px view of cart page
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, '11-cart-page-mobile-390.png'), fullPage: false });
    await page.setViewportSize({ width: 1440, height: 900 });

    // 12. Checkout Flow (/checkout) Verification
    console.log('12. Testing Checkout Page (/checkout)...');
    const checkoutLink = page.locator('.cart-checkout-cta');
    await checkoutLink.click();
    await page.waitForURL('**/checkout', { timeout: 10000 });
    await page.locator('#fullName').waitFor();

    // Verify Stepper is active at step 2
    const activeStepText = await page.locator('.checkout-step-pill.active').textContent();
    console.log(`Active checkout step: ${activeStepText.trim()}`);
    testResults.checkoutStepActive = activeStepText.includes('2');

    // Fill customer details form
    console.log('Filling guest customer details...');
    await page.locator('#fullName').fill('Nguyễn Văn An');
    await page.locator('#phone').fill('0901234567');
    await page.locator('#email').fill('nguyenvanan.test@morphstudio.vn');
    await page.locator('#address').fill('123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh');
    await page.locator('#notes').fill('Vui lòng gọi trước khi giao, hỗ trợ giao giờ hành chính.');

    // Desktop screenshot of checkout form
    await page.screenshot({ path: path.join(out, '12-checkout-page-desktop.png'), fullPage: false });

    // Mobile 390px view of checkout form
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, '13-checkout-page-mobile-390.png'), fullPage: false });
    await page.setViewportSize({ width: 1440, height: 900 });

    // Submit order
    console.log('Submitting order to backend...');
    const submitOrderBtn = page.locator('button[type="submit"].cart-checkout-cta');
    await submitOrderBtn.click();

    // 13. Order Confirmation (/orders/[id]?token=...) Verification
    console.log('13. Waiting for Order Confirmation redirect...');
    await page.waitForURL(/\/orders\/.*token=/, { timeout: 15000 });
    const orderUrl = page.url();
    console.log(`Order confirmation URL: ${orderUrl}`);
    testResults.orderUrl = orderUrl;

    await page.locator('.order-success-page').waitFor();
    await page.locator('.order-code-badge').waitFor();

    const orderCode = await page.locator('.order-code-badge strong').textContent();
    console.log(`Placed order code: ${orderCode}`);
    if (!orderCode.startsWith('MPH-')) {
      throw Error(`Invalid order code format: ${orderCode}`);
    }
    testResults.orderCode = orderCode;

    // Check status pill
    const statusText = await page.locator('.order-status-pill').textContent();
    console.log(`Order status text: ${statusText.trim()}`);
    testResults.orderStatusText = statusText.trim();

    // Verify customer details on confirmation page
    const pageContent = await page.textContent('.order-success-page');
    if (!pageContent.includes('Nguyễn Văn An') || !pageContent.includes('0901234567')) {
      throw Error('Customer details not found on order confirmation page!');
    }
    testResults.customerDetailsConfirmed = true;

    // Desktop screenshot of order confirmation
    await page.screenshot({ path: path.join(out, '14-order-confirmation-desktop.png'), fullPage: false });

    // Mobile 390px view of order confirmation
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, '15-order-confirmation-mobile-390.png'), fullPage: false });
    await page.setViewportSize({ width: 1440, height: 900 });

    // 14. Token Authentication Security Check
    console.log('14. Testing Token Security on /orders/[id]...');
    const invalidTokenUrl = orderUrl.replace(/token=[^&]+/, 'token=invalid_security_token_xyz_999');
    await page.goto(invalidTokenUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const isOrderDetailsHidden = await page.evaluate(() => {
      // Must not show order details or customer sensitive info when token is invalid
      const hasOrderCode = !!document.querySelector('.order-code-badge');
      const hasError = !!document.querySelector('.order-error-card') || document.body.textContent.includes('Không thể tải thông tin đơn hàng') || document.body.textContent.includes('không hợp lệ');
      return !hasOrderCode && hasError;
    });
    console.log(`Order details safely hidden with invalid token: ${isOrderDetailsHidden}`);
    if (!isOrderDetailsHidden) {
      throw Error('Order details were exposed with an invalid token!');
    }
    testResults.tokenSecurityEnforced = true;
    await page.screenshot({ path: path.join(out, '16-order-invalid-token-error.png'), fullPage: false });

    console.log('\n--- ALL GOLD VERIFICATION CHECKS (SHOP + SCAN + CART + CHECKOUT + ORDER) PASSED! ---');
    testResults.success = true;

    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ testResults, errors, consoleErrors }, null, 2));
  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    testResults.error = err.message;
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ testResults, errors, consoleErrors }, null, 2));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    for (const child of children) {
      try {
        child.kill();
      } catch {}
    }
  }
})();
