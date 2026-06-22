/**
 * 批量游戏兼容性测试
 * 测试 D:\Desktop\rpgmz\ 下所有 ZIP 的资源可达性、加密处理、沙箱兼容性
 */
import { readFileSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import JSZip from 'jszip';

const GAMES_DIR = 'D:/Desktop/rpgmz';
const ZIP_FILES = readdirSync(GAMES_DIR).filter(f => f.endsWith('.zip'));

console.log('╔══════════════════════════════════════════╗');
console.log('║  批量游戏兼容性测试                       ║');
console.log('╚══════════════════════════════════════════╝\n');
console.log(`找到 ${ZIP_FILES.length} 个游戏:\n`);

let totalPass = 0, totalFail = 0;

for (const zipName of ZIP_FILES) {
  const zipPath = resolve(GAMES_DIR, zipName);
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🎮 ${zipName}`);
  console.log('═'.repeat(50));

  let gamePass = 0, gameFail = 0;
  function ok(m) { gamePass++; console.log('  ✅ ' + m); }
  function err(m) { gameFail++; console.log('  ❌ ' + m); }
  function info(m) { console.log('  📌 ' + m); }

  try {
    const buf = readFileSync(zipPath);
    info(`大小: ${(buf.length/1024/1024).toFixed(1)} MB`);

    const zip = await JSZip.loadAsync(buf);
    const paths = Object.keys(zip.files).filter(f => !zip.files[f].dir);
    ok(`${paths.length} 个文件`);

    // 1. 入口检查
    const htmlPaths = paths.filter(p => /index\.html?$/i.test(p) && !p.includes('__MACOSX'));
    if (htmlPaths.length === 0) {
      err('未找到 index.html');
    } else {
      const idx = htmlPaths.find(p => /www\//.test(p)) || htmlPaths[0];
      ok(`入口: ${idx}`);
      const html = await zip.file(idx).async('string');

      // 2. 脚本引用检查
      const scriptRefs = [...html.matchAll(/src\s*=\s*["']([^"']+\.js)["']/gi)].map(m => m[1]);
      info(`HTML中 ${scriptRefs.length} 个脚本引用`);

      // 验证每个引用
      for (const ref of scriptRefs) {
        const resolved = resolvePath(ref, idx.replace(/\/[^/]+$/, ''));
        const found = paths.includes(resolved) || paths.some(p =>
          p === ref || p.endsWith('/' + ref) || p === resolved ||
          p === ref + '_' || p.endsWith('/' + ref.replace(/\.[^.]+$/, '') + '.rpgmvp')
        );
        found ? ok(`脚本: ${ref}`) : err(`脚本缺失: ${ref}`);
      }

      // 3. 样式引用检查（匹配所有 href 指向 .css 的引用）
      const cssRefs = [...html.matchAll(/href\s*=\s*["']([^"']+\.css)["']/gi)].map(m => m[1]);
      for (const ref of cssRefs) {
        // 精确匹配或末尾匹配
        const found = paths.includes(ref) || paths.some(p => p.endsWith('/' + ref) || p === ref);
        found ? ok(`样式: ${ref}`) : err(`样式缺失: ${ref} (ZIP中有${paths.filter(p=>p.endsWith('.css')).join(',')})`);
      }
    }

    // 4. System.json 检查
    const sysPath = paths.find(p => /data\/System\.json$/i.test(p));
    if (sysPath) {
      try {
        const sys = JSON.parse(await zip.file(sysPath).async('string'));
        const encImages = sys.hasEncryptedImages === true;
        const encAudio = sys.hasEncryptedAudio === true;
        info(`加密: 图片=${encImages} 音频=${encAudio}`);
        info(`游戏ID: ${sys.advanced?.gameId || sys.gameId || 'N/A'}`);
        if (sys.encryptionKey) info(`密钥: ${sys.encryptionKey.slice(0,8)}...`);
      } catch(e) { err('System.json 解析失败'); }
    } else {
      info('未加密游戏 (无 System.json 加密配置)');
    }

    // 5. 核心脚本检测
    const coreScripts = ['js/rmmz_core.js', 'js/rmmz_managers.js', 'js/rmmz_objects.js',
                         'js/rmmz_scenes.js', 'js/rmmz_sprites.js', 'js/rmmz_windows.js',
                         'js/main.js', 'js/plugins.js'];
    const mvScripts = ['js/rpg_core.js', 'js/rpg_managers.js', 'js/rpg_objects.js',
                       'js/rpg_scenes.js', 'js/rpg_sprites.js', 'js/rpg_windows.js',
                       'js/main.js', 'js/plugins.js'];
    const allCore = [...coreScripts, ...mvScripts];
    let foundCore = 0;
    for (const s of allCore) {
      if (paths.some(p => p === s || p.endsWith('/' + s))) foundCore++;
    }
    foundCore > 0 ? ok(`核心脚本: ${foundCore} 个`) : err('无核心脚本');

    // 6. 图片资源
    const imgs = paths.filter(p => /\.(png|jpg|jpeg)/i.test(p));
    const encImgs = paths.filter(p => /\.(png_|rpgmvp|jpg_)$/i.test(p));
    info(`图片: ${imgs.length} (加密: ${encImgs.length})`);

    // 7. 音频资源
    const audios = paths.filter(p => /\.(ogg|m4a|mp3|wav)/i.test(p));
    const encAudios = paths.filter(p => /\.(ogg_|rpgmvo|m4a_)$/i.test(p));
    info(`音频: ${audios.length} (加密: ${encAudios.length})`);

    // 8. 字体文件
    const fonts = paths.filter(p => /\.(ttf|otf|woff|woff2)$/i.test(p));
    if (fonts.length > 0) {
      ok(`字体: ${fonts.length} 个`);
      fonts.forEach(f => ok(`  ${f}`));
    } else {
      info('无内置字体 (使用系统字体/引擎默认)');
    }

    // 9. NW.js 残留
    const nwFiles = paths.filter(p => /\.(exe|dll|pak|dat|bin)$/i.test(p) && !p.includes('data/'));
    if (nwFiles.length > 0) info(`NW.js残留: ${nwFiles.length} 个 (VFS自动过滤)`);

    // 10. 加密资源可达性
    if (encImgs.length > 0 || encAudios.length > 0) {
      const sysP2 = paths.find(p => /data\/System\.json$/i.test(p));
      if (sysP2) {
        const sys2 = JSON.parse(await zip.file(sysP2).async('string'));
        if (sys2.encryptionKey) ok('加密密钥已配置');
        else info('加密密钥将自动推导');
      }
    }

  } catch(e) {
    err(`分析异常: ${e.message}`);
  }

  console.log(`  📊 ${gamePass}通过 ${gameFail}失败`);
  totalPass += gamePass;
  totalFail += gameFail;
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`📊 总计: ${totalPass} 通过, ${totalFail} 失败 (${ZIP_FILES.length} 个游戏)`);
console.log(totalFail === 0 ? '🎉 全部通过' : '⚠️ 存在失败');
process.exit(totalFail === 0 ? 0 : 1);

function resolvePath(ref, baseDir) {
  if (!ref || ref.startsWith('http')) return ref;
  let path = ref.replace(/\\/g, '/');
  path = path.split('?')[0].split('#')[0];
  if (!path.startsWith('/') && baseDir) path = baseDir + '/' + path;
  const segs = path.split('/');
  const result = [];
  for (const s of segs) {
    if (s === '..') result.pop();
    else if (s !== '.' && s !== '') result.push(s);
  }
  return result.join('/');
}
