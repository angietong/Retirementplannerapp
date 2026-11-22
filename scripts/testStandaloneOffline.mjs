import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';

const STANDALONE_DIR = path.resolve(process.cwd(), 'standalone');
const TEST_PORT = 3457;

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${TEST_PORT}${urlPath}`, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error(`Request timeout: ${urlPath}`));
    });
  });
}

async function waitForServer(retries = 25) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await httpGet('/');
      if (res.statusCode === 200) return;
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('serve.cjs did not become ready in time');
}

async function main() {
  console.log('===============================================================');
  console.log('STANDALONE OFFLINE & LOCAL SERVER VERIFICATION');
  console.log('===============================================================\n');

  // 1. Verify standalone directory exists and has core files
  assert(fs.existsSync(STANDALONE_DIR), '/standalone directory does not exist');
  const indexHtmlPath = path.join(STANDALONE_DIR, 'index.html');
  assert(fs.existsSync(indexHtmlPath), '/standalone/index.html missing');

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  // 2. Verify ZERO external CDN/font/script requests in HTML, CSS, SW
  const forbiddenExternalPatterns = [
    /fonts\.googleapis\.com/i,
    /fonts\.gstatic\.com/i,
    /cdn\.jsdelivr\.net/i,
    /unpkg\.com/i,
    /cdnjs\.cloudflare\.com/i,
    /https?:\/\/[^"'\s]+\.(js|css|woff2?|ttf|png|jpg|svg)/i,
  ];

  for (const pat of forbiddenExternalPatterns) {
    assert(!pat.test(indexHtml), `External network reference found in standalone/index.html: ${pat}`);
  }
  console.log('  [PASS] standalone/index.html has zero external network/CDN references');

  // Check duplicate manifest link is gone
  const manifestLinks = indexHtml.match(/rel=["']manifest["']/g) || [];
  assert(manifestLinks.length === 1, `Expected exactly 1 manifest link in index.html, found ${manifestLinks.length}`);
  console.log('  [PASS] standalone/index.html has exactly 1 canonical manifest link');

  // Check all CSS files in standalone/assets for external URLs
  const assetsDir = path.join(STANDALONE_DIR, 'assets');
  const assetFiles = fs.readdirSync(assetsDir);
  const cssFiles = assetFiles.filter(f => f.endsWith('.css'));
  const jsFiles = assetFiles.filter(f => f.endsWith('.js'));
  const fontFiles = assetFiles.filter(f => /\.woff2?$/.test(f));

  assert(cssFiles.length >= 1, 'Expected at least 1 CSS bundle in standalone/assets');
  assert(jsFiles.length >= 1, 'Expected at least 1 JS bundle in standalone/assets');
  assert(fontFiles.length >= 4, `Expected self-hosted woff/woff2 fonts in standalone/assets, found ${fontFiles.length}`);

  for (const cssFile of cssFiles) {
    const cssText = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
    const cssWithoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    assert(!/https?:\/\//i.test(cssWithoutComments), `External resource URL found in CSS bundle ${cssFile}`);
  }
  for (const jsFile of jsFiles) {
    const jsText = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
    assert(!/fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com/i.test(jsText), `External CDN URL found in JS bundle ${jsFile}`);
  }
  console.log(`  [PASS] CSS & JS bundles have zero external resource URLs and ${fontFiles.length} local font files are bundled`);

  // 3. Verify every href/src local path referenced in standalone/index.html exists on disk
  const localRefs = [...indexHtml.matchAll(/(?:src|href)=["'](\/[^"']+)["']/g)].map(m => m[1]);
  assert(localRefs.length > 0, 'No local asset references found in index.html');
  for (const ref of localRefs) {
    const diskPath = path.join(STANDALONE_DIR, ref.replace(/^\//, ''));
    assert(fs.existsSync(diskPath), `Referenced asset missing in /standalone: ${ref}`);
  }
  console.log(`  [PASS] All ${localRefs.length} assets referenced by standalone/index.html exist on disk`);

  // 4. Verify PWA manifest & icons exist on disk
  const manifestPath = path.join(STANDALONE_DIR, 'manifest.webmanifest');
  assert(fs.existsSync(manifestPath), 'manifest.webmanifest missing in /standalone');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const icon of manifest.icons || []) {
    const iconDisk = path.join(STANDALONE_DIR, icon.src.replace(/^\//, ''));
    assert(fs.existsSync(iconDisk), `Manifest icon missing: ${icon.src}`);
  }
  console.log(`  [PASS] manifest.webmanifest valid and all ${(manifest.icons || []).length} icons present`);

  // 5. Verify Service Worker precache includes index.html, JS, CSS, and fonts
  const swPath = path.join(STANDALONE_DIR, 'sw.js');
  assert(fs.existsSync(swPath), 'sw.js missing in /standalone');
  const swContent = fs.readFileSync(swPath, 'utf8');
  assert(swContent.includes('index.html'), 'sw.js must precache index.html');
  assert(swContent.includes(jsFiles[0]), `sw.js must precache JS bundle ${jsFiles[0]}`);
  assert(swContent.includes(cssFiles[0]), `sw.js must precache CSS bundle ${cssFiles[0]}`);
  assert(swContent.includes('.woff2'), 'sw.js must precache self-hosted .woff2 fonts');
  console.log('  [PASS] sw.js precaches index.html, JS bundle, CSS bundle, and local .woff2 fonts');

  // 6. Boot node serve.cjs against /standalone and verify live HTTP serving + security
  const serverProc = spawn(process.execPath, ['serve.cjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer();

    // Test root HTML
    const rootRes = await httpGet('/');
    assert(rootRes.statusCode === 200, `GET / expected 200, got ${rootRes.statusCode}`);
    assert(String(rootRes.headers['content-type']).includes('text/html'), 'GET / wrong Content-Type');
    assert(rootRes.body.toString('utf8').includes('<div id="root"></div>'), 'GET / missing root div');

    // Test JS bundle
    const jsRes = await httpGet(`/assets/${jsFiles[0]}`);
    assert(jsRes.statusCode === 200, `GET JS expected 200, got ${jsRes.statusCode}`);
    assert(String(jsRes.headers['content-type']).includes('application/javascript'), 'JS wrong Content-Type');
    assert(jsRes.body.length > 100_000, 'JS bundle unexpectedly small');

    // Test CSS bundle
    const cssRes = await httpGet(`/assets/${cssFiles[0]}`);
    assert(cssRes.statusCode === 200, `GET CSS expected 200, got ${cssRes.statusCode}`);
    assert(String(cssRes.headers['content-type']).includes('text/css'), 'CSS wrong Content-Type');

    // Test self-hosted woff2 font
    const woff2File = fontFiles.find(f => f.endsWith('.woff2')) || fontFiles[0];
    const fontRes = await httpGet(`/assets/${woff2File}`);
    assert(fontRes.statusCode === 200, `GET font expected 200, got ${fontRes.statusCode}`);
    assert(String(fontRes.headers['content-type']).includes('font/'), `Font wrong Content-Type: ${fontRes.headers['content-type']}`);

    // Test manifest & SW
    const manRes = await httpGet('/manifest.webmanifest');
    assert(manRes.statusCode === 200, 'GET /manifest.webmanifest failed');
    const swRes = await httpGet('/sw.js');
    assert(swRes.statusCode === 200, 'GET /sw.js failed');

    // Test SPA fallback
    const spaRes = await httpGet('/some/deep/route');
    assert(spaRes.statusCode === 200 && spaRes.body.toString('utf8').includes('<div id="root"></div>'), 'SPA fallback failed');

    // Test path traversal protection (must NOT serve package.json)
    const travRes = await httpGet('/%2e%2e/package.json');
    assert(!travRes.body.toString('utf8').includes('"dependencies"'), 'Path traversal leaked package.json!');

    console.log('  [PASS] node serve.cjs serves /standalone cleanly (HTML, JS, CSS, WOFF2, SW, manifest, SPA fallback, traversal-safe)');
  } finally {
    serverProc.kill('SIGTERM');
  }

  console.log('\n===============================================================');
  console.log('ALL STANDALONE OFFLINE CHECKS PASSED (100% INTERNET-FREE)');
  console.log('===============================================================\n');
}

main().catch(err => {
  console.error('\n[FAIL] Standalone verification failed:', err?.message || err);
  process.exit(1);
});
