/**
 * 浏览器自动化测试 — 模拟导入游戏 + 点击开始 + 捕获控制台报错
 * 用法: node tests/browser-test.mjs
 * 前提: npm run dev 已启动在 3000 端口
 */
import puppeteer from 'puppeteer';

const BASE = 'http://127.0.0.1:3010';
const GAMES = [
  'D:/Desktop/rpgmz/Maneater_WIN_1.0.0.zip',
  'D:/Desktop/rpgmz/ISLANDSOFSPRINGSBluelike1.0018.zip',
  'D:/Desktop/rpgmz/Legacy of Aeon v2.5b.zip',
];

const errors = [];
const warnings = [];

async function main() {
  console.log('╔══════════════════════════════════╗');
  console.log('║  浏览器自动化测试                ║');
  console.log('╚══════════════════════════════════╝\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: 'C:/Users/10352/.cache/puppeteer/chrome/win64-149.0.7827.22/chrome-win64/chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });

  for (const gameZip of GAMES) {
    console.log(`\n🎮 ${gameZip.replace(/.*[\\/]/, '')}`);
    await testGame(browser, gameZip);
  }

  await browser.close();
  console.log(`\n${'═'.repeat(40)}`);
  console.log(`📊 错误: ${errors.length} | 警告: ${warnings.length}`);
  for (const e of errors) console.log(`  ❌ ${e}`);
  process.exit(errors.length === 0 ? 0 : 1);
}

async function testGame(browser, zipPath) {
  const page = await browser.newPage();
  const gameErrors = [];
  const gameWarnings = [];

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') gameErrors.push(text);
    else if (msg.type() === 'warning') gameWarnings.push(text);

    if (msg.type() === 'error' || text.includes('404') || text.includes('Failed') || text.includes('Uncaught')) {
      console.log(`  [${msg.type()}] ${text.slice(0, 120)}`);
    }
  });

  page.on('pageerror', err => {
    gameErrors.push(err.message);
    console.log(`  [PAGE ERROR] ${err.message.slice(0, 120)}`);
  });

  try {
    // 1. 打开主页
    console.log('  1. 打开主页...');
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('button', { timeout: 10000 });

    // 2. 点击 + 按钮触发文件选择
    console.log('  2. 导入游戏...');
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) { console.log('  ❌ 未找到文件上传输入'); return; }

    await fileInput.uploadFile(zipPath);
    console.log('  ✅ 文件已选择');

    // 3. 等待导入进度完成
    console.log('  3. 等待导入...');
    await page.waitForFunction(() => {
      const eles = document.querySelectorAll('*');
      for (const el of eles) {
        if (el.textContent?.includes('导入完成') || el.textContent?.includes('已添加')) return true;
      }
      return false;
    }, { timeout: 120000 }).catch(() => console.log('  ⚠️ 导入超时，继续尝试...'));

    // 4. 等待游戏卡片出现
    await new Promise(r => setTimeout(r, 2000));
    console.log('  4. 等待游戏卡片...');
    await page.waitForSelector('[class*="game-card"], [class*="rounded-2xl"]', { timeout: 30000 }).catch(() => {});

    // 5. 点击播放按钮
    console.log('  5. 点击播放...');
    const playBtn = await page.$('[class*="Play"], button:has(svg)');
    if (playBtn) {
      await playBtn.click();
    } else {
      // 点击第一个游戏卡片的播放按钮
      const allBtns = await page.$$('button');
      for (const btn of allBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text?.includes('▶') || text?.includes('Play')) {
          await btn.click();
          break;
        }
      }
    }

    // 6. 等待游戏加载
    console.log('  6. 等待游戏加载 (15秒)...');
    await new Promise(r => setTimeout(r, 15000));

    // 7. 检查iframe
    const iframeExists = await page.$('iframe');
    if (iframeExists) console.log('  ✅ iframe 已创建');
    else console.log('  ⚠️ 未找到 iframe');

    // 8. 收集错误
    if (gameErrors.length > 0) {
      console.log(`  📋 ${gameErrors.length} 个错误:`);
      errors.push(...gameErrors.map(e => `${zipPath.replace(/.*[\\/]/, '')}: ${e.slice(0, 80)}`));
    } else {
      console.log('  ✅ 无错误');
    }

  } catch(e) {
    console.log(`  ❌ 测试异常: ${e.message}`);
    errors.push(`${zipPath.replace(/.*[\\/]/, '')}: ${e.message}`);
  } finally {
    await page.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
