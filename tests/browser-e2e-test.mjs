/**
 * 浏览器端到端自动化测试 — 模拟游戏导入+运行全流程
 * 用法: node tests/browser-e2e-test.mjs "D:/Desktop/rpgmz/Legacy of Aeon v2.5b.zip"
 *
 * 测试流程:
 * 1. 启动 Vite 开发服务器
 * 2. 打开浏览器 → 上传 ZIP 文件
 * 3. 等待导入完成 → 点击游戏卡片启动
 * 4. 等待游戏加载 → 收集所有控制台错误
 * 5. 无报错则通过，有报错则修复并重复
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import puppeteer from 'puppeteer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ZIP_PATH = process.argv[2] || 'D:/Desktop/rpgmz/Legacy of Aeon v2.5b.zip';
const CHROME_PATH = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
let PORT = 0;  // Auto-detect
let BASE = '';
let APP_URL = '';

// ── Test state ──
let pass = 0, fail = 0;
function ok(m)  { pass++; console.log('  ✅ ' + m); }
function no(m)  { fail++; console.log('  ❌ ' + m); }
function info(m) { console.log('  📌 ' + m); }
function hr()   { console.log('─'.repeat(60)); }

// ── Console error collector ──
const consoleErrors = [];
const consoleWarnings = [];
const consoleLogs = [];

// ═══════════════════════════════════════════════════════════════
// MAIN TEST
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  浏览器 E2E 测试: 游戏导入 → 运行              ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ── Pre-check ──
  if (!existsSync(ZIP_PATH)) {
    console.error(`❌ ZIP 不存在: ${ZIP_PATH}`);
    process.exit(1);
  }
  if (!existsSync(CHROME_PATH)) {
    console.error(`❌ Chrome 不存在: ${CHROME_PATH}`);
    process.exit(1);
  }

  // ── Start dev server ──
  console.log('【步骤 1】启动开发服务器');
  const http = await import('http');

  // Start Vite and parse the port from its output
  info('启动 Vite 开发服务器...');
  let serverProcess = spawn('npx', ['vite', '--host=0.0.0.0'], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: true,
  });

  // Parse port from "Local: http://localhost:PORT/path"
  const portReady = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout (30s)')), 30000);
    const onData = (chunk) => {
      const text = chunk.toString();
      // Strip ANSI escape codes for reliable parsing
      const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
      process.stdout.write('  [vite] ' + clean.split('\n')[0] + '\n');
      const m = clean.match(/Local:\s+http:\/\/localhost:(\d+)(\/\S+)/);
      if (m) {
        clearTimeout(timeout);
        PORT = parseInt(m[1]);
        BASE = `http://localhost:${PORT}`;
        APP_URL = `http://localhost:${PORT}${m[2].replace(/\/$/, '')}`;
        resolve();
      }
    };
    serverProcess.stdout.on('data', onData);
    serverProcess.stderr.on('data', onData);
    serverProcess.on('error', reject);
  });

  try {
    await portReady;
    ok(`Vite 服务器已启动: ${APP_URL}`);
  } catch(e) {
    no(`服务启动失败: ${e.message}`);
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  }

  // ── Launch browser ──
  console.log('\n【步骤 2】启动浏览器');
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false,  // Use visible Chrome for reliable file uploads
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--allow-file-access-from-files',
        '--disable-web-security',
        `--window-size=1280,800`,
      ],
    });
    ok('浏览器已启动');
  } catch (e) {
    no(`浏览器启动失败: ${e.message}`);
    serverProcess.kill();
    process.exit(1);
  }

  let allPassed = false;
  try {
    const page = await browser.newPage();

    // ── Collect console messages ──
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    consoleLogs.length = 0;

    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      if (type === 'error') {
        consoleErrors.push(text);
        console.log('  🔴 [console.error] ' + text);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
      } else if (type === 'log' && (text.includes('[Sandbox]') || text.includes('[emulatorBridge]') || text.includes('WasmVFS') || text.includes('[App]') || text.includes('[HomeView]'))) {
        consoleLogs.push(text);
        console.log('  📝 [console.log] ' + text.slice(0, 150));
      }
    });

    page.on('pageerror', error => {
      consoleErrors.push('[PAGE ERROR] ' + error.message);
      console.log('  💥 [pageerror] ' + error.message);
    });

    // ── Navigate to app ──
    console.log('\n【步骤 3】加载应用页面');
    await page.goto(APP_URL + '/', { waitUntil: 'networkidle2', timeout: 30000 });
    ok('页面加载完成');

    // Wait for React to render
    await page.waitForSelector('#root', { timeout: 10000 });
    ok('React 根节点已渲染');

    // Wait a moment for WASM init
    await new Promise(r => setTimeout(r, 2000));

    // Check console errors during page load
    if (consoleErrors.length === 0) {
      ok('页面加载阶段无报错');
    } else {
      no(`页面加载阶段有 ${consoleErrors.length} 个错误`);
    }

    // ── Upload ZIP file ──
    console.log('\n【步骤 4】上传游戏 ZIP 文件');
    hr();

    const zipBuffer = readFileSync(ZIP_PATH);
    info(`ZIP 已读取: ${(zipBuffer.length/1024/1024).toFixed(1)} MB`);

    const fileInput = await page.$('input[type="file"][accept=".zip"]');
    if (!fileInput) {
      no('未找到文件上传 input');
    } else {
      ok('找到 ZIP 上传 input');

      // Use standard uploadFile — works in non-headless Chrome
      await fileInput.uploadFile(ZIP_PATH);
      ok(`已上传: ${ZIP_PATH.split(/[\\/]/).pop()}`);

      // Wait for the import progress overlay to appear
      await new Promise(r => setTimeout(r, 2000));

      // Wait for import to complete
      console.log('  等待导入完成 (大文件可能需要较长时间)...');
      const startTime = Date.now();
      const maxWait = 600000;

      await new Promise((resolve, reject) => {
        const check = async () => {
          try {
            if (Date.now() - startTime > maxWait) {
              reject(new Error('导入超时 (10min)'));
              return;
            }
            // Check for completion text in body
            const doneText = await page.evaluate(() => {
              return document.body ? document.body.innerText.includes('导入完成') : false;
            });
            if (doneText) {
              info(`导入耗时: ${((Date.now() - startTime)/1000).toFixed(1)}s`);
              resolve();
              return;
            }
            // Check for error text
            const hasError = await page.evaluate(() => {
              return document.body ? document.body.innerText.includes('导入失败') : false;
            });
            if (hasError) {
              reject(new Error('导入失败 — 页面显示错误'));
              return;
            }
            setTimeout(check, 3000);
          } catch(e) {
            reject(e);
          }
        };
        setTimeout(check, 3000);
      });

      ok('游戏导入完成');
    }

    // ── Check console after import ──
    console.log('\n【步骤 5】导入后控制台检查');
    if (consoleErrors.length === 0) {
      ok('导入过程无报错');
    } else {
      no(`导入后有 ${consoleErrors.length} 个错误`);
    }

    // ── Click game to start ──
    console.log('\n【步骤 6】启动游戏');
    hr();

    // Wait for the import overlay to disappear
    await new Promise(r => setTimeout(r, 3000));

    // Find and click the game card (first game card with play button)
    const playButton = await page.$('button[title="启动"]');
    if (!playButton) {
      // Try alternative: click on the game card directly
      const gameCard = await page.$('[class*="group relative"]');
      if (gameCard) {
        await gameCard.click();
        ok('已点击游戏卡片');
      } else {
        no('未找到游戏卡片或启动按钮');
      }
    } else {
      await playButton.click();
      ok('已点击"启动"按钮');
    }

    // Wait for game to load (EmulatorView renders, iframe appears)
    console.log('  等待游戏加载...');
    await new Promise(r => setTimeout(r, 3000));

    // Try to wait for the game iframe
    try {
      await page.waitForSelector('#game-iframe, iframe[id="game-iframe"]', { timeout: 15000 });
      ok('游戏 iframe 已创建');
    } catch {
      // Check if there's an error message
      const errorMsg = await page.evaluate(() => {
        const el = document.querySelector('[class*="error"]');
        return el ? el.textContent : null;
      });
      if (errorMsg) {
        no(`游戏加载失败: ${errorMsg}`);
      } else {
        info('未检测到游戏 iframe (可能使用其他容器)');
      }
    }

    // Wait for game to fully initialize
    console.log('  等待游戏引擎初始化...');
    await new Promise(r => setTimeout(r, 5000));

    // ── Final console check ──
    console.log('\n【步骤 7】游戏运行控制台检查');
    hr();

    const gameErrors = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource: the server responded with a status of 404') &&
      !e.includes('net::ERR_FILE_NOT_FOUND')
    );

    if (gameErrors.length === 0) {
      ok('游戏运行阶段无报错');
    } else {
      for (const e of gameErrors) {
        no(`错误: ${e.slice(0, 200)}`);
      }
    }

    // Show game-related console logs
    const gameLogs = consoleLogs.filter(l =>
      l.includes('[Sandbox]') || l.includes('WasmVFS') || l.includes('VFS')
    );
    if (gameLogs.length > 0) {
      info(`游戏相关日志 (${gameLogs.length} 条):`);
      for (const l of gameLogs.slice(0, 10)) {
        console.log('     ' + l.slice(0, 150));
      }
    }

    // ── Take screenshot for visual verification ──
    await page.screenshot({ path: resolve(ROOT, 'tests/screenshots/e2e-final.png'), fullPage: false });
    info('已保存截图: tests/screenshots/e2e-final.png');

    allPassed = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('net::ERR_FILE_NOT_FOUND')
    ).length === 0;

  } catch (e) {
    no(`测试异常: ${e.message}`);
    console.error(e);
  } finally {
    // ── Cleanup ──
    if (browser) await browser.close();
    // Only kill the server if we started it
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      try { process.kill(-serverProcess.pid, 'SIGTERM'); } catch(_) {}
    }
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(60));
  const realErrors = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('Failed to load resource: the server responded with a status of 404') &&
    !e.includes('net::ERR_FILE_NOT_FOUND')
  );
  console.log(`📊 ${pass} 通过, ${fail} 失败`);
  console.log(`🔴 实际错误: ${realErrors.length} 个`);
  if (realErrors.length > 0) {
    console.log('错误详情:');
    realErrors.forEach((e, i) => console.log(`  ${i+1}. ${e.slice(0, 300)}`));
  }
  if (consoleWarnings.length > 0) {
    console.log(`⚠️ 警告: ${consoleWarnings.length} 个`);
  }
  console.log(allPassed ? '🎉 全部通过' : '⚠️ 存在错误需修复');
  process.exit(allPassed ? 0 : 1);
}

main().catch(e => { console.error('测试异常:', e); process.exit(1); });
