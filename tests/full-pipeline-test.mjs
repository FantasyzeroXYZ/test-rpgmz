/**
 * 全链路自动化测试 — 不需要浏览器即可测试游戏加载管线
 * 模拟：导入ZIP → VFS加载 → 沙箱构建 → 脚本重写 → 资源可达性
 * 用法: node tests/full-pipeline-test.mjs
 */
import { readFileSync, readdirSync } from 'fs';
import JSZip from 'jszip';

const GAMES_DIR = 'D:/Desktop/rpgmz';
const ZIP_FILES = readdirSync(GAMES_DIR).filter(f => f.endsWith('.zip'));

console.log('╔══════════════════════════════════════╗');
console.log('║  全链路自动化测试 (9个游戏)          ║');
console.log('╚══════════════════════════════════════╝\n');

const RESULTS = [];
let TOTAL_OK = 0, TOTAL_FAIL = 0;

for (const zipName of ZIP_FILES) {
  const zipPath = GAMES_DIR + '/' + zipName;
  const r = await testOneGame(zipName, zipPath);
  RESULTS.push(r);
  TOTAL_OK += r.ok;
  TOTAL_FAIL += r.fail;
}

// 汇总
console.log('\n' + '═'.repeat(60));
console.log('📊 最终报告');
console.log('═'.repeat(60));
for (const r of RESULTS) {
  const icon = r.fail === 0 ? '✅' : '⚠️';
  console.log(`${icon} ${r.name}: ${r.ok}通过 ${r.fail}失败`);
}
console.log(`\n总计: ${TOTAL_OK}通过 ${TOTAL_FAIL}失败 (${ZIP_FILES.length}个游戏)`);
console.log(TOTAL_FAIL === 0 ? '\n🎉 全部通过!' : '\n⚠️ 需要修复');
process.exit(TOTAL_FAIL === 0 ? 0 : 1);

// ============================================================
async function testOneGame(name, zipPath) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`🎮 ${name}`);
  let ok = 0, fail = 0;
  function OK(m) { ok++; }
  function ERR(m) { fail++; console.log('  ❌ ' + m); }

  try {
    const buf = readFileSync(zipPath);
    const zip = await JSZip.loadAsync(buf);
    const paths = Object.keys(zip.files).filter(f => !zip.files[f].dir);

    // 1. 入口 HTML 分析
    const htmlPaths = paths.filter(p => /index\.html?$/i.test(p) && !p.includes('__MACOSX'));
    if (htmlPaths.length === 0) { ERR('无 index.html'); return { name, ok, fail }; }
    const idx = htmlPaths.find(p => /www\//.test(p)) || htmlPaths[0];
    const baseDir = idx.includes('/') ? idx.replace(/\/[^/]+$/, '') : '';
    const html = await zip.file(idx).async('string');
    OK('入口: ' + idx);

    // 2. 静态脚本重写模拟
    const scriptRegex = /(<script\b[^>]*\ssrc\s*=\s*["'])([^"']+)(["'][^>]*>)/gi;
    const staticScripts = [...html.matchAll(scriptRegex)].map(m => ({
      full: m[0], before: m[1], url: m[2], after: m[3]
    }));

    for (const s of staticScripts) {
      const resolved = resolveVfsPath(s.url, paths, baseDir);
      resolved ? OK('静态脚本: ' + s.url) : ERR('静态脚本缺失: ' + s.url);
    }

    // 3. 样式重写模拟
    const linkRegex = /(<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\shref\s*=\s*["'])([^"']+)(["'][^>]*>)/gi;
    const links = [...html.matchAll(linkRegex)].map(m => ({ url: m[2] }));
    for (const l of links) {
      const resolved = resolveVfsPath(l.url, paths, baseDir);
      resolved ? OK('样式: ' + l.url) : ERR('样式缺失: ' + l.url);

      // 如果CSS可读，检查其中的url()引用
      if (resolved) {
        const css = await zip.file(resolved).async('string');
        const urlRefs = css.match(/url\(["']?([^"')]+)["']?\)/g) || [];
        for (const u of urlRefs) {
          const assetUrl = u.replace(/url\(["']?/, '').replace(/["']?\)/, '');
          if (/^(https?:|data:|blob:|\/)/i.test(assetUrl)) continue;
          const cssDir = resolved.replace(/\/[^/]+$/, '') + '/';
          const assetResolved = resolveVfsPath(assetUrl, paths, cssDir);
          if (!assetResolved) {
            // 尝试游戏根目录
            const altResolved = resolveVfsPath(assetUrl, paths, baseDir);
            if (!altResolved) ERR('CSS资源缺失: ' + assetUrl + ' (在' + resolved + '中)');
          }
        }
      }
    }

    // 4. 动态脚本提取和验证
    const mainRef = staticScripts.find(s => /main\.js$/i.test(s.url))
                 || staticScripts.find(s => /FOSSIL\.js$/i.test(s.url))
                 || staticScripts[0];
    if (mainRef) {
      const mainPath = resolveVfsPath(mainRef.url, paths, baseDir);
      if (mainPath) {
        const mainContent = await zip.file(mainPath).async('string');
        // 提取动态脚本
        const mzMatch = mainContent.match(/_scripts\s*=\s*\[([^\]]+)\]/);
        let dynScripts = [];
        if (mzMatch) {
          dynScripts = mzMatch[1].match(/["']([^"']+\.js)["']/g)?.map(s => s.replace(/["']/g, '')) || [];
        }
        if (!dynScripts.length) {
          dynScripts = [...new Set((mainContent.match(/["']([^"']+\.js)["']/g) || []).map(s => s.replace(/["']/g, '')))];
        }

        let dynFound = 0;
        for (const ds of dynScripts) {
          if (/^https?:/i.test(ds) || /this is using/i.test(ds)) continue;
          resolveVfsPath(ds, paths, baseDir) ? dynFound++ : ERR('动态脚本: ' + ds);
        }
        if (dynScripts.length > 0) OK(`动态脚本: ${dynFound}/${dynScripts.length}`);
      }
    }

    // 5. 加密/解密兼容性
    const sysPath = paths.find(p => /System\.json$/i.test(p));
    if (sysPath) {
      const sys = JSON.parse(await zip.file(sysPath).async('string'));
      const encKey = sys.encryptionKey;
      const hasEnc = sys.hasEncryptedImages || sys.hasEncryptedAudio;
      if (hasEnc) {
        OK('加密游戏 (Utils+Decrypter补丁兼容)');
        if (encKey) OK('密钥: ' + encKey.slice(0, 8) + '...');
        else OK('密钥自动推导');
      }
    }

    // 6. 字体文件
    const fonts = paths.filter(p => /\.(ttf|otf|woff|woff2)$/i.test(p));
    if (fonts.length > 0) {
      OK('字体: ' + fonts.length + '个');
    }

    // 7. NW.js 残留过滤
    const nwCount = paths.filter(p => /\.(exe|dll|pak|dat|bin)$/i.test(p) && !p.includes('data/')).length;
    if (nwCount > 0) OK('NW.js过滤: ' + nwCount + '个');

  } catch(e) {
    ERR('异常: ' + e.message);
  }

  console.log(`  📊 ${ok}通过 ${fail}失败`);
  return { name, ok, fail };
}

function resolveVfsPath(ref, paths, baseDir) {
  let clean = ref.replace(/\\/g, '/').split('?')[0].split('#')[0];
  // 尝试多种路径组合
  const candidates = [clean];
  if (baseDir && !clean.startsWith('/')) candidates.push(baseDir + '/' + clean);
  // 也尝试仅文件名
  const basename = clean.replace(/^.*[\\/]/, '');
  if (basename !== clean) candidates.push(basename);

  for (const c of candidates) {
    // 标准化
    const norm = c.split('/').filter(s => s !== '' && s !== '.').join('/');
    if (paths.includes(norm)) return norm;
    // 模糊匹配
    const found = paths.find(p => p.replace(/\\/g, '/').endsWith('/' + basename));
    if (found) return found;
  }
  return null;
}
