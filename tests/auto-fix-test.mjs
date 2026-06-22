/**
 * 自动化修复测试 — 导入游戏 → 运行 → 收集控制台错误 → 修复 → 重复
 * 用法: node tests/auto-fix-test.mjs [zip路径]
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ZIP = process.argv[2] || 'D:/Desktop/rpgmz/Legacy of Aeon v2.5b.zip';
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const ZIP_NAME = basename(ZIP, '.zip');

if (!existsSync(ZIP)) { console.error('ZIP not found:', ZIP); process.exit(1); }
if (!existsSync(CHROME)) { console.error('Chrome not found'); process.exit(1); }

let errors = [];
let warnings = [];

function log(prefix, msg) {
  const line = `[${prefix}] ${msg}`;
  console.log(line.slice(0, 200));
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['vite', '--host=0.0.0.0'], {
      cwd: ROOT, stdio: 'pipe', shell: true
    });
    const t = setTimeout(() => reject(new Error('Server timeout')), 30000);
    const onData = (d) => {
      const t = d.toString().replace(/\x1b\[[0-9;]*m/g, '');
      if (t.includes('Local:')) {
        clearTimeout(t);
        const m = t.match(/localhost:(\d+)(\/\S+)/);
        if (m) {
          resolve({ proc, url: `http://localhost:${m[1]}${m[2].replace(/\/$/, '')}` });
        }
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', reject);
  });
}

async function runTest() {
  console.log('══════════════════════════════════════════════');
  console.log(`  自动测试: ${ZIP_NAME}`);
  console.log('══════════════════════════════════════════════\n');

  // Start server
  console.log('[1/5] Starting dev server...');
  const { proc: server, url } = await startServer();
  console.log(`  Server: ${url}\n`);

  // Launch browser
  console.log('[2/5] Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  try {
    const page = await browser.newPage();
    errors = [];
    warnings = [];

    // Collect ALL console messages
    page.on('console', msg => {
      const t = msg.text();
      if (msg.type() === 'error') {
        errors.push(t);
        if (!t.includes('favicon') && !t.includes('net::ERR_')) {
          console.log(`  🔴 ERROR: ${t.slice(0, 200)}`);
        }
      } else if (msg.type() === 'warning') {
        warnings.push(t);
        if (!t.includes('deprecated')) console.log(`  ⚠️ WARN: ${t.slice(0, 200)}`);
      } else if (msg.type() === 'log') {
        console.log(`  📝 LOG: ${t.slice(0, 250)}`);
      }
    });
    page.on('pageerror', e => {
      errors.push('[PAGE] ' + e.message);
      console.log(`  💥 PAGE: ${e.message.slice(0, 200)}`);
    });

    // Navigate
    console.log('[3/5] Loading app...');
    await page.goto(url + '/', { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#root', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    console.log(`  Page loaded. ${errors.length} errors so far.\n`);

    // Upload ZIP by clicking "+" button → file chooser dialog (standard Puppeteer flow)
    console.log('[4/5] Uploading game ZIP...');

    // Click the "+" Add Game button to trigger the hidden file input
    const addBtn = await page.$('button[title="添加游戏"]');
    if (!addBtn) { console.log('  ERROR: Add Game button not found'); return { ok: false }; }

    // Wait for file chooser dialog and accept the zip
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 10000 }),
      addBtn.click(),
    ]);
    await fileChooser.accept([ZIP]);
    console.log(`  File selected: ${ZIP_NAME}.zip`);

    console.log('  Waiting for import...');

    // Wait for import to complete (poll for "导入完成" text)
    const startTime = Date.now();
    let importDone = false;
    while (Date.now() - startTime < 600000) {
      await new Promise(r => setTimeout(r, 3000));
      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      if (bodyText.includes('导入完成')) {
        importDone = true;
        console.log(`  Import done in ${((Date.now()-startTime)/1000).toFixed(1)}s`);
        break;
      }
      if (bodyText.includes('导入失败')) {
        console.log('  Import FAILED');
        break;
      }
      // Print progress
      const pct = bodyText.match(/(\d+)%/);
      if (pct) process.stdout.write(`\r  Progress: ${pct[0]}`);
    }
    if (!importDone) {
      console.log('\n  Import did not complete. Checking errors...');
    }
    console.log(`  ${errors.length} errors so far.\n`);

    // Click the game card to enter EmulatorView
    console.log('[5/5] Launching game...');
    // Wait for import overlay to fully disappear
    try {
      await page.waitForFunction(() => {
        const body = document.body;
        return body && !body.innerText.includes('导入完成') && !body.innerText.includes('正在导入');
      }, { timeout: 30000 });
    } catch { console.log('  Overlay wait timed out, continuing...'); }
    await new Promise(r => setTimeout(r, 2000));

    // Find and click the game card (the div with cover image, the outermost clickable box)
    let gameLaunched = false;

    // Try 1: Click the ▶ Play button
    const playBtn = await page.$('button[title="启动"]');
    if (playBtn) {
      console.log('  Found ▶ Play button, clicking...');
      await playBtn.click();
      gameLaunched = true;
    }

    // Try 2: Click the game cover card
    if (!gameLaunched) {
      // Find game cards - these have an img and the card itself is clickable
      const card = await page.$('[class*="aspect-\\[3\\/4\\]"]');
      if (card) {
        // Click the parent clickable area
        const clickable = await card.evaluateHandle(el => el.closest('[class*="cursor-pointer"]') || el.parentElement);
        await clickable.click();
        gameLaunched = true;
        console.log('  Clicked game cover card');
      }
    }

    // Try 3: Click first play overlay button
    if (!gameLaunched) {
      const overlayBtn = await page.$('[class*="bg-cyan-500"]');
      if (overlayBtn) {
        await overlayBtn.click();
        gameLaunched = true;
        console.log('  Clicked play overlay button');
      }
    }

    if (!gameLaunched) {
      console.log('  ERROR: No clickable game element found');
      // Debug: log what's visible
      const visibleText = await page.evaluate(() => {
        return document.body?.innerText?.slice(0, 500) || 'no text';
      });
      console.log('  Page text:', visibleText.slice(0, 300));
      return { ok: false, errors };
    }

    // Wait for EmulatorView to render (the game loading progress or iframe)
    console.log('  Waiting for EmulatorView...');
    const stageChanged = await Promise.race([
      page.waitForFunction(() => {
        // Check if we left HOME stage (game card list disappears)
        const cards = document.querySelectorAll('[class*="aspect-\\[3\\/4\\]"]');
        return cards.length === 0;
      }, { timeout: 10000 }).then(() => true).catch(() => false),
      page.waitForSelector('iframe', { timeout: 15000 })
        .then(() => 'iframe').catch(() => false),
    ]);

    if (stageChanged === 'iframe') {
      console.log('  Game iframe detected');
    } else if (stageChanged) {
      console.log('  Stage changed (left HOME view)');
    } else {
      console.log('  Stage may not have changed');
    }

    // Wait for game init — check periodically for loading progress
    console.log('  Polling game state (up to 90s)...');
    let gameRunning = false;
    let lastState = '';
    const pollStart = Date.now();

    while (Date.now() - pollStart < 90000) {
      await new Promise(r => setTimeout(r, 3000));

      // Check game state via iframe
      const state = await page.evaluate(() => {
        const iframe = document.querySelector('iframe');
        if (!iframe) return 'NO_IFRAME';
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const canvas = doc.querySelector('canvas');
          const spinner = doc.getElementById('loadingSpinner');
          const errPrinter = doc.getElementById('errorPrinter');
          const errName = doc.getElementById('errorName');
          const allDivs = doc.querySelectorAll('div');
          // Get visible text
          const bodyText = (doc.body?.innerText || '').slice(0, 100);
          if (errPrinter && errName && errName.textContent) return 'ERR:' + errName.textContent.slice(0,60);
          if (spinner && spinner.offsetParent !== null) return 'SPINNER(c:' + (canvas?canvas.width+'x'+canvas.height:'?') + ')';
          if (canvas && canvas.width > 0) return 'RUN:' + canvas.width + 'x' + canvas.height;
          return 'BODY:' + bodyText.slice(0, 60);
        } catch(e) { return 'XORIGIN'; }
      }).catch(() => 'ERR');

      if (state !== lastState) {
        console.log(`  [${((Date.now()-pollStart)/1000).toFixed(0)}s] ${state}`);
        lastState = state;
      }

      if (state.startsWith('CANVAS:')) {
        gameRunning = true;
        console.log('  ✅ Game running!');
        break;
      }
      if (state.startsWith('ERROR:')) {
        console.log('  ❌ Game error detected');
        break;
      }
    }

    if (!gameRunning && lastState.includes('LOADING')) {
      console.log('  ⚠️ Game stuck at loading screen');
    }

    // Collect results
    const realErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('net::ERR_') &&
      !e.includes('404 (Not Found)')
    );

    console.log('\n══════════════════════════════════════════════');
    console.log(`  RESULTS: ${realErrors.length} real errors`);
    realErrors.forEach((e, i) => console.log(`  ${i+1}. ${e.slice(0, 300)}`));
    console.log('══════════════════════════════════════════════\n');

    return { ok: realErrors.length === 0, errors: realErrors };
  } finally {
    await browser.close();
    server.kill('SIGTERM');
    try { process.kill(-server.pid, 'SIGTERM'); } catch(_) {}
  }
}

const result = await runTest();
process.exit(result.ok ? 0 : 1);
