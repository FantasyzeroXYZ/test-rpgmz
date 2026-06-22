/**
 * 自动化浏览器测试 — 导入游戏 + 点击开始 + 捕获JS报错
 * 用法: node tests/auto-browser-test.mjs
 */
import puppeteer from 'puppeteer-core';
import { readdirSync } from 'fs';

const GAMES_DIR = 'D:/Desktop/rpgmz';
const ZIP_FILES = readdirSync(GAMES_DIR).filter(f => f.endsWith('.zip'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

// Find active dev server port (try reverse order, newest first)
let PORT = 3000;
for (let p = 3020; p >= 3000; p--) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500);
    const res = await fetch(`http://127.0.0.1:${p}/`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) { PORT = p; break; }
  } catch(e) {}
}
const BASE = `http://127.0.0.1:${PORT}`;
console.log(`Server: ${BASE}\n`);

const allErrors = [];

async function testGame(browser, zipName, zipPath) {
  const name = zipName.replace('.zip','');
  console.log(`\n🎮 ${zipName}`);
  const page = await browser.newPage();
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('[' + msg.type() + '] ' + msg.text());
    else if (msg.text().includes('404') || msg.text().includes('Failed')) errors.push('[warn] ' + msg.text());
  });
  // Capture ALL network requests and their status
  const failedUrls = [];
  page.on('response', response => {
    if (response.status() >= 400) {
      failedUrls.push(`[${response.status()}] ${response.url()}`);
    }
  });
  // Also save for later reporting
  page.__failedUrls = failedUrls;
  page.on('pageerror', err => errors.push(err.message));

  try {
    // 1. Navigate
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('button', { timeout: 10000 });
    console.log('  1. ✅ 页面加载');

    // 2. Upload ZIP
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) { console.log('  2. ❌ 无file input'); return; }
    await fileInput.uploadFile(zipPath);
    console.log('  2. ✅ ZIP已选择');

    // 3. Wait for import to complete (progress disappears)
    try {
      await page.waitForFunction(() => {
        for (const el of document.querySelectorAll('*')) {
          if (el.textContent?.includes('导入完成')) return true;
        }
        return false;
      }, { timeout: 120000 });
      console.log('  3. ✅ 导入完成');
    } catch(e) {
      console.log('  3. ⚠️ 导入超时');
    }

    await new Promise(r => setTimeout(r, 2000));

    // 4. Click the game card IMAGE to start game (the card click triggers onGameSelect)
    const clicked = await page.evaluate(() => {
      // Strategy: find all game card containers and click the image/title area
      const allDivs = document.querySelectorAll('div[class*="rounded-2xl"], div[class*="rounded-xl"]');
      for (const div of allDivs) {
        // Look for game title text followed by "rpgmz" system tag
        const text = div.textContent || '';
        if (text.includes('rpgmz') || text.includes('RPGMZ')) {
          // Find the play button (should be the rightmost or highlighted one)
          const btns = div.querySelectorAll('button');
          // Find play button: cyan bg + Play icon
          for (let i = 0; i < btns.length; i++) {
            const b = btns[i];
            const cls = b.className || '';
            const hasCyan = cls.includes('cyan');
            const hasBg = cls.includes('bg-');
            // Play button has bg-cyan-500 and not red (delete)
            if ((hasCyan || hasBg) && !cls.includes('red') && !cls.includes('slate')) {
              b.click();
              return 'play-btn-' + i;
            }
          }
          // Last resort: click the card image area
          const img = div.querySelector('img');
          if (img) { img.click(); return 'card-img'; }
          div.click();
          return 'card-click';
        }
      }
      return false;
    });
    console.log(`  4. ${clicked ? '✅ 点击播放('+clicked+')' : '⚠️ 未找到'}`);

    // 5. Wait for game to load and debug
    await new Promise(r => setTimeout(r, 10000));
    // Take screenshot to see what's on screen
    await page.screenshot({ path: `tests/screenshots/${name}.png` }).catch(()=>{});
    // Check for loading overlay or error messages
    const pageText = await page.evaluate(() => document.body?.innerText?.slice(0,500) || '');
    console.log(`  5. 页面文本: ${pageText.slice(0,150)}...`);
    const iframe = await page.$('iframe');
    console.log(iframe ? '  5. ✅ iframe已创建' : '  5. ❌ 无iframe');
    // Check loadAndBootGame errors via console
    const emuErrors = await page.evaluate(() => {
      return window.__emuError || 'no emu error captured';
    });
    console.log(`  5b. Emu状态: ${emuErrors}`);

    // 6. Check iframe console
    if (iframe) {
      const frameErrors = await page.evaluate(() => {
        // Check for sandbox log
        const logs = [];
        if (typeof window.__vfsRef !== 'undefined') logs.push('VFS accessible');
        return logs;
      });
      frameErrors.forEach(l => console.log('  6. 📋 ' + l));
    }

    // 7. Report errors
    // Collect failed URLs from network monitoring
    errors.push(...failedUrls.map(u => '[404NET] ' + u));
    const gameErrs = errors.filter(e =>
      e.includes('404') || e.includes('Failed') || e.includes('Uncaught') ||
      e.includes('Error') || e.includes('SyntaxError') || e.includes('Unexpected')
    );
    if (gameErrs.length === 0) {
      console.log(`  ✅ 0个错误`);
    } else {
      console.log(`  ❌ ${gameErrs.length}个错误:`);
      gameErrs.forEach(e => {
        console.log(`    - ${e.slice(0,120)}`);
        allErrors.push(`${name}: ${e.slice(0,100)}`);
      });
    }

  } catch(e) {
    console.log(`  ❌ 异常: ${e.message}`);
    allErrors.push(`${name}: ${e.message}`);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('╔══════════════════════════════╗');
  console.log('║  自动化浏览器测试            ║');
  console.log('╚══════════════════════════════╝');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: EDGE,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-web-security'],
  });

  for (const zipName of ZIP_FILES.slice(0, 3)) { // Test first 3 games
    await testGame(browser, zipName, `${GAMES_DIR}/${zipName}`);
  }

  await browser.close();

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`📊 总计错误: ${allErrors.length}`);
  if (allErrors.length > 0) {
    console.log('错误列表:');
    allErrors.forEach(e => console.log(`  ❌ ${e}`));
  }
  process.exit(allErrors.length === 0 ? 0 : 1);
}
main();
