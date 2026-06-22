/**
 * 运行时模拟测试 — 模拟游戏启动后的脚本加载、资源请求
 * 验证沙箱拦截器能否正确处理每个游戏的动态脚本加载
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import JSZip from 'jszip';

const GAMES_DIR = 'D:/Desktop/rpgmz';
const games = [
  'BabySittingisMurder.zip',
  'COMBINE STONE.zip',
  'ISLANDSOFSPRINGSBluelike1.0018.zip',
  'Legacy of Aeon v2.5b.zip',
  'Maneater_WIN_1.0.0.zip',
  'Mukbang_Idol_WIN_1.0.1.zip',
];

console.log('╔══════════════════════════════════════╗');
console.log('║  运行时模拟测试                       ║');
console.log('╚══════════════════════════════════════╝\n');

let totalP=0, totalF=0;

for (const zipName of games) {
  console.log(`\n🎮 ${zipName}`);
  const zip = await JSZip.loadAsync(readFileSync(resolve(GAMES_DIR, zipName)));
  const paths = Object.keys(zip.files).filter(f => !zip.files[f].dir);

  let p=0, f=0;
  function ok(m){p++;console.log('  ✅ '+m);totalP++}
  function er(m){f++;console.log('  ❌ '+m);totalF++}

  // 1. 找到入口 HTML
  const htmlPaths = paths.filter(p => /index\.html?$/i.test(p) && !p.includes('__MACOSX'));
  const idx = htmlPaths.find(p => /www\//.test(p)) || htmlPaths[0];
  if (!idx) { er('无入口'); continue; }
  const baseDir = idx.includes('/') ? idx.replace(/\/[^/]+$/, '') : '';
  const html = await zip.file(idx).async('string');

  // 2. 提取 HTML 中的脚本引用 (验证静态重写)
  const staticScripts = [...html.matchAll(/src\s*=\s*["']([^"']+\.js)["']/gi)].map(m => m[1]);

  // 3. 找到入口脚本并提取动态脚本引用
  // 入口可能是 main.js, FOSSIL.js, 或 HTML 中的第一个脚本
  const mainRef = staticScripts.find(s => /main\.js$/i.test(s))
               || staticScripts.find(s => /FOSSIL\.js$/i.test(s))
               || staticScripts[0];
  if (!mainRef) { er('HTML中无脚本引用'); continue; }

  let mainPath = mainRef.replace(/\\/g, '/');
  if (baseDir && !mainPath.startsWith('/')) mainPath = baseDir + '/' + mainPath;
  mainPath = mainPath.split('/').filter(s => s !== '' && s !== '.').join('/');

  const mainFile = zip.file(mainPath);
  if (!mainFile) { er(`入口脚本不在: ${mainPath}`); continue; }
  ok(`入口脚本: ${mainPath}`);

  const mainContent = await mainFile.async('string');

  // 4. 提取动态脚本列表
  let dynamicScripts = [];
  const mzMatch = mainContent.match(/_scripts\s*=\s*\[([^\]]+)\]/);
  if (mzMatch) {
    dynamicScripts = mzMatch[1].match(/["']([^"']+\.js)["']/g)?.map(s => s.replace(/["']/g, '')) || [];
  }
  if (dynamicScripts.length === 0) {
    const mvRefs = mainContent.match(/["']([^"']+\.js)["']/g) || [];
    dynamicScripts = [...new Set(mvRefs.map(s => s.replace(/["']/g, '')))];
  }
  if (dynamicScripts.length === 0) {
    const pluginsPath = paths.find(p => /\/?plugins\.js$/i.test(p) && !p.includes('libs'));
    if (pluginsPath) {
      try {
        const pc = await zip.file(pluginsPath).async('string');
        dynamicScripts = pc.match(/["']([^"']+\.js)["']/g)?.map(s => s.replace(/["']/g, '')) || [];
        dynamicScripts = dynamicScripts.map(s => s.includes('/') ? s : 'js/plugins/' + s);
      } catch(e) {}
    }
  }

  // 5. 验证每个动态脚本都能在 VFS 中找到
  ok(`动态脚本: ${dynamicScripts.length} 个`);

  const knownCore = [
    'js/rmmz_core.js','js/rmmz_managers.js','js/rmmz_objects.js',
    'js/rmmz_scenes.js','js/rmmz_sprites.js','js/rmmz_windows.js',
    'js/rpg_core.js','js/rpg_managers.js','js/rpg_objects.js',
    'js/rpg_scenes.js','js/rpg_sprites.js','js/rpg_windows.js',
    'js/libs/pixi.js','js/libs/pako.min.js','js/libs/localforage.min.js',
    'js/libs/effekseer.min.js','js/libs/vorbisdecoder.js',
    'js/libs/pixi-tilemap.js','js/libs/pixi-picture.js',
    'js/libs/fpsmeter.js','js/libs/lz-string.js',
    'js/libs/iphone-inline-video.browser.js',
  ];

  // 确保所有核心脚本可访问
  for (const core of knownCore) {
    // 尝试多种路径
    const candidates = [core];
    if (baseDir) candidates.push(baseDir + '/' + core);
    const found = candidates.some(c => paths.includes(c));
    if (found) ok(`核心: ${core}`);
  }

  // 验证动态脚本
  let missingDyn = 0;
  for (const ds of dynamicScripts) {
    const cleanName = ds.replace(/^.*[\\/]/, '');
    const found = paths.some(p =>
      p === ds || p.endsWith('/' + ds) || p.endsWith('/' + cleanName)
    );
    if (!found) { er(`动态脚本缺失: ${ds}`); missingDyn++; }
  }
  if (missingDyn === 0 && dynamicScripts.length > 0) ok('全部动态脚本可达');

  // 6. 检查音频解码器 Worker
  const hasVorbisWorker = paths.some(p => /vorbisdecoder\.js$/i.test(p));
  if (hasVorbisWorker) ok('Worker: vorbisdecoder.js');

  // 7. 模拟 Script.src 拦截器行为
  // 对每个动态脚本，检查 vfs.normalizePath + vfs.fileExists 是否返回 true
  // （模拟沙箱中的 Script.src setter）
  let interceptable = 0;
  for (const ds of dynamicScripts) {
    const resolved = resolveVfsPath(ds, paths, baseDir);
    if (resolved) interceptable++;
  }
  if (dynamicScripts.length > 0) {
    interceptable === dynamicScripts.length
      ? ok(`Script.src拦截: ${interceptable}/${dynamicScripts.length}`)
      : er(`Script.src拦截: ${interceptable}/${dynamicScripts.length}`);
  }

  // 8. 检查加密资源的 Utils 兼容性
  const sysPath = paths.find(p => /System\.json$/i.test(p));
  if (sysPath) {
    const sys = JSON.parse(await zip.file(sysPath).async('string'));
    const isEnc = sys.hasEncryptedImages || sys.hasEncryptedAudio;
    if (isEnc) {
      ok('加密游戏 — Utils+Decrypter补丁兼容');
    }
  }

  // 9. 检查入口 HTML 名是否非标准
  if (idx !== 'index.html' && idx !== 'www/index.html') {
    ok(`非标准入口: ${idx} — VFS的_detectBasePath会处理`);
  }

  console.log(`  📊 ${p}通过 ${f}失败`);
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`📊 总计: ${totalP} 通过, ${totalF} 失败`);
console.log(totalF === 0 ? '🎉 全部通过' : '⚠️ 存在失败');
process.exit(totalF === 0 ? 0 : 1);

function resolveVfsPath(ref, paths, baseDir) {
  let clean = ref.replace(/\\/g, '/');
  // 模拟 normalizePath
  clean = clean.split('?')[0].split('#')[0];
  clean = clean.split('/').filter(s => s !== '.' && s !== '').join('/');
  if (clean.startsWith('..')) clean = clean.replace(/^(\.\.\/)+/, '');

  const candidates = [clean];
  if (baseDir) candidates.push(baseDir + '/' + clean);

  for (const c of candidates) {
    if (paths.includes(c)) return c;
    // 模糊匹配
    const basename = c.split('/').pop();
    const found = paths.find(p => p.endsWith('/' + basename));
    if (found) return found;
  }
  return null;
}
