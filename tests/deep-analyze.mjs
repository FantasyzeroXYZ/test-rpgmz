/**
 * 深度游戏ZIP分析 — 检查所有可能影响游戏运行的因素
 */
import { readFileSync } from 'fs';
import JSZip from 'jszip';

const ZIP = process.argv[2] || 'D:/Desktop/rpgmz/ISLANDSOFSPRINGSBluelike1.0018.zip';

const zip = await JSZip.loadAsync(readFileSync(ZIP));
const paths = Object.keys(zip.files).filter(f => !zip.files[f].dir);
console.log('══════════════════════════════════════════');
console.log('  深度游戏分析:', ZIP.replace(/.*[\\/]/, ''));
console.log('══════════════════════════════════════════\n');

// 1. 基本统计
console.log('📦 基本信息');
console.log('  总文件数:', paths.length);
const byExt = {};
paths.forEach(p => { const e = p.split('.').pop().toLowerCase(); byExt[e] = (byExt[e] || 0) + 1; });
console.log('  文件类型:', Object.entries(byExt).map(([k, v]) => `${k}:${v}`).join(', '));

// 2. 目录结构
console.log('\n📁 目录结构');
const dirs = new Set();
paths.forEach(p => {
  const parts = p.split('/');
  for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
});
[...dirs].sort().forEach(d => console.log('  ' + d + '/'));

// 3. 入口文件
console.log('\n📄 入口文件');
const htmls = paths.filter(p => /\.html?$/i.test(p) && !p.includes('__MACOSX'));
for (const h of htmls) {
  const content = await zip.file(h).async('string');
  console.log(`  ${h} (${content.length} bytes)`);
  // 提取所有 script/link 引用
  const scripts = [...content.matchAll(/<script[^>]*src\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  const links = [...content.matchAll(/<link[^>]*href\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  console.log('    Script引用:', scripts.join(', '));
  console.log('    Link引用:', links.join(', '));
}

// 4. 检查 main.js 中的插件/脚本加载
console.log('\n📜 main.js 分析');
const mainJs = paths.find(p => /\/?main\.js$/i.test(p) && !p.includes('libs'));
if (mainJs) {
  const content = await zip.file(mainJs).async('string');
  console.log('  路径:', mainJs, '(' + content.length + ' bytes)');
  // 提取 PluginManager 注册
  const plugins = content.match(/PluginManager\._scripts\s*=\s*\[([^\]]+)\]/);
  if (plugins) console.log('  PluginManager._scripts:', plugins[1].slice(0, 200));
  // 提取所有 .js 引用
  const jsRefs = [...new Set((content.match(/["'][^"']+\.js["']/g) || []).map(r => r.replace(/["']/g, '')))];
  console.log('  动态JS引用 (' + jsRefs.length + '):');
  jsRefs.forEach(r => {
    const fullPath = r.startsWith('js/') ? r : 'js/' + r.replace(/^\.\//, '');
    const exists = paths.some(p => p === fullPath || p.endsWith('/' + r.replace(/^.*[\\/]/, '')));
    console.log('    ' + (exists ? '✅' : '❌') + ' ' + r);
  });
}

// 5. 检查所有 CSS 中的 url() 引用
console.log('\n🎨 CSS url() 引用');
for (const p of paths.filter(f => /\.css$/i.test(f))) {
  const content = await zip.file(p).async('string');
  const urls = content.match(/url\([^)]+\)/gi) || [];
  if (urls.length > 0) {
    console.log('  ' + p + ':');
    urls.forEach(u => console.log('    ' + u));
  }
  // 检查 @font-face
  const ff = content.match(/@font-face[^}]*\}/gi) || [];
  if (ff.length > 0) {
    console.log('  @font-face in ' + p + ':');
    ff.forEach(f => console.log('    ' + f.slice(0, 120)));
  }
}

// 6. 检查字体文件
console.log('\n🔤 字体文件');
const fonts = paths.filter(f => /\.(ttf|otf|woff|woff2)$/i.test(f));
if (fonts.length === 0) {
  console.log('  ⚠️ 此游戏不包含任何字体文件！');
  console.log('  游戏将依赖系统字体或引擎内置字体。');
} else {
  fonts.forEach(f => console.log('  ' + f));
}

// 7. 检查 System.json
console.log('\n⚙️ System.json');
const sysP = paths.find(p => /data\/System\.json$/i.test(p));
if (sysP) {
  const sys = JSON.parse(await zip.file(sysP).async('string'));
  console.log('  加密图片:', sys.hasEncryptedImages);
  console.log('  加密音频:', sys.hasEncryptedAudio);
  console.log('  游戏标题:', sys.gameTitle);
  console.log('  游戏ID:', sys.advanced?.gameId || sys.gameId);
  if (sys.encryptionKey) console.log('  密钥:', sys.encryptionKey.slice(0, 8) + '...');
  // 检查字体设置
  if (sys.advanced?.fontFamilies) console.log('  字体家族:', sys.advanced.fontFamilies);
  if (sys.fontFamilies) console.log('  字体家族:', sys.fontFamilies);
}

// 8. 检查 plugins.js
console.log('\n🔌 插件列表');
const pluginsP = paths.find(p => /\/?plugins\.js$/i.test(p));
if (pluginsP) {
  const content = await zip.file(pluginsP).async('string');
  try {
    const plugins = JSON.parse(content);
    console.log('  插件数:', plugins.length);
    plugins.forEach(p => console.log('  ' + (p.status ? '✅' : '❌') + ' ' + p.name));
  } catch (e) {
    console.log('  (非JSON格式)');
  }
}

// 9. 检查 NW.js 文件
console.log('\n🪟 NW.js 残留文件');
const nwFiles = paths.filter(p => /\.(exe|dll|pak|dat|bin)$/i.test(p) && !p.includes('data/'));
if (nwFiles.length > 0) {
  console.log('  ⚠️ 包含 ' + nwFiles.length + ' 个 NW.js 文件（将被 VFS 自动过滤）');
  nwFiles.slice(0, 5).forEach(f => console.log('  ' + f));
  if (nwFiles.length > 5) console.log('  ... 还有 ' + (nwFiles.length - 5) + ' 个');
} else {
  console.log('  ✅ 无 NW.js 残留');
}

// 10. 音频文件状态
console.log('\n🔊 音频文件');
const audios = paths.filter(f => /\.(ogg|m4a|mp3|wav)$/i.test(f));
console.log('  音频文件:', audios.length);
const encAudio = audios.filter(f => f.endsWith('_') || f.endsWith('.rpgmvo'));
console.log('  加密音频:', encAudio.length);

// 总结
console.log('\n══════════════════════════════════════════');
console.log('📊 分析完成');
console.log('══════════════════════════════════════════');
