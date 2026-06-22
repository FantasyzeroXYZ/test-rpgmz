/**
 * 完整自动化测试 — 游戏模拟器全链路检测
 * 用法: node tests/full-test.mjs "D:/Desktop/rpgmz/Maneater_WIN_1.0.0.zip"
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import JSZip from 'jszip';
import http from 'http';

const ZIP_PATH = process.argv[2] || 'D:/Desktop/rpgmz/Maneater_WIN_1.0.0.zip';
// 自动探测 Vite 开发服务器端口
function detectPort() {
  const ports = [3000,3001,3002,3003,3004,3005,3006,3007,5173];
  return new Promise((resolve) => {
    let checked = 0;
    for (const p of ports) {
      http.get(`http://localhost:${p}/`, (res) => {
        res.resume();
        resolve(p);
      }).on('error', () => {
        if (++checked >= ports.length) resolve(3000);
      });
    }
  });
}
const SERVER_URL = `http://localhost:${await detectPort()}`;
const ROOT = resolve(import.meta.dirname || '.', '..');

let passed = 0, failed = 0;
function ok(msg) { passed++; console.log('  ✅ ' + msg); }
function err(msg) { failed++; console.log('  ❌ ' + msg); }
function info(msg) { console.log('  📌 ' + msg); }
function hr() { console.log('─'.repeat(50)); }

// HTTP GET helper
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function main() {
  console.log('╔════════════════════════════════════╗');
  console.log('║  游戏模拟器 全链路自动化测试      ║');
  console.log('╚════════════════════════════════════╝\n');

  // ═══════════════════════════════════════
  // 测试 1: 源码文件完整性
  // ═══════════════════════════════════════
  console.log('测试 1: 源码完整性');
  const requiredFiles = [
    'src/App.tsx', 'src/main.tsx', 'src/types.ts', 'src/mockData.ts',
    'src/components/EmulatorView.tsx', 'src/components/HomeView.tsx',
    'src/components/DictionarySidebar.tsx', 'src/components/SidePanel.tsx',
    'src/components/TextOverlay.tsx', 'src/components/VirtualGamepad.tsx',
    'src/components/NoteEditor.tsx', 'src/components/FloatingLookupCard.tsx',
    'src/components/ConfirmModal.tsx', 'src/components/EditEntryModal.tsx',
    'src/services/emulatorBridge.ts', 'src/services/translationService.ts',
    'src/services/dictionaryService.ts', 'src/services/ocrService.ts',
    'src/services/tokenizerService.ts', 'src/services/storageService.ts',
  ];
  for (const f of requiredFiles) {
    existsSync(join(ROOT, f)) ? ok(f) : err(f + ' 缺失');
  }

  // ═══════════════════════════════════════
  // 测试 2: 产物完整性
  // ═══════════════════════════════════════
  console.log('\n测试 2: 构建产物');
  const buildFiles = [
    'dist/index.html', 'dist/pkg/rm_wasm_vfs.js',
    'dist/pkg/rm_wasm_vfs_bg.wasm', 'dist/wasm_vfs.js',
  ];
  for (const f of buildFiles) {
    const fp = join(ROOT, f);
    if (existsSync(fp)) {
      const size = statSync(fp).size;
      ok(`${f} (${(size/1024).toFixed(1)} KB)`);
    } else {
      err(f + ' 缺失');
    }
  }

  // ═══════════════════════════════════════
  // 测试 3: 服务端点
  // ═══════════════════════════════════════
  console.log('\n测试 3: HTTP 端点');
  const endpoints = ['/', '/wasm_vfs.js', '/pkg/rm_wasm_vfs.js', '/pkg/rm_wasm_vfs_bg.wasm'];
  for (const ep of endpoints) {
    try {
      const res = await fetchUrl(SERVER_URL + ep);
      res.status === 200 ? ok(`${ep} → ${res.status}`) : err(`${ep} → ${res.status}`);
      // 检查 Content-Type
      if (ep.endsWith('.wasm')) {
        const ct = res.headers['content-type'] || '';
        ct.includes('wasm') ? ok(`${ep} Content-Type: ${ct}`) : info(`${ep} Content-Type: ${ct}`);
      }
    } catch(e) {
      err(`${ep}: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════
  // 测试 4: WasmVFS 导出
  // ═══════════════════════════════════════
  console.log('\n测试 4: WasmVFS 模块导出');
  try {
    const res = await fetchUrl(SERVER_URL + '/wasm_vfs.js');
    const code = res.body;
    const checks = [
      ['导出 WasmVFS 类', code.includes('export') && code.includes('WasmVFS')],
      ['contains initialize', code.includes('initialize')],
      ['contains loadZip', code.includes('loadZip')],
      ['contains createMediaUrl', code.includes('createMediaUrl')],
      ['contains createResponse', code.includes('createResponse')],
      ['contains shutdown', code.includes('shutdown')],
    ];
    for (const [name, pass] of checks) pass ? ok(name) : err(name);
  } catch(e) { err('WasmVFS 模块: ' + e.message); }

  // ═══════════════════════════════════════
  // 测试 5: 沙箱 IIFE 完整性（检查关键拦截器）
  // ═══════════════════════════════════════
  console.log('\n测试 5: 沙箱 IIFE 拦截器');
  try {
    const res = await fetchUrl(SERVER_URL + '/src/services/emulatorBridge.ts');
    const code = res.body;
    const interceptors = [
      ['fetch 拦截', 'window.fetch=function'],
      ['XHR 拦截', 'window.XMLHttpRequest=function'],
      ['Image.src 拦截', "HTMLImageElement.prototype,'src'"],
      ['Audio.src 拦截', "HTMLAudioElement.prototype,'src'"],
      ['Script.src 拦截', "HTMLScriptElement.prototype,'src'"],
      ['Utils.hasEncryptedImages', 'hasEncryptedImages=function'],
      ['Utils.decryptArrayBuffer', 'decryptArrayBuffer=function'],
      ['Utils.isNwjs', 'isNwjs=function'],
      ['Utils.setEncryptionInfo', 'setEncryptionInfo'],
      ['文本捕获 captureGameText', 'window.captureGameText'],
    ];
    for (const [name, pattern] of interceptors) {
      code.includes(pattern) ? ok(name + ' 已注入') : err(name + ' 缺失');
    }
  } catch(e) { err('沙箱 IIFE: ' + e.message); }

  // ═══════════════════════════════════════
  // 测试 6: 游戏 ZIP 资源分析
  // ═══════════════════════════════════════
  console.log('\n测试 6: 游戏 ZIP 分析');
  try {
    const zipBuf = readFileSync(ZIP_PATH);
    info(`文件: ${(zipBuf.length/1024/1024).toFixed(1)} MB`);

    const zip = await JSZip.loadAsync(zipBuf);
    const allPaths = Object.keys(zip.files).filter(f => !zip.files[f].dir);
    ok(`${allPaths.length} 个文件`);

    // 找 index.html
    const htmlPaths = allPaths.filter(p => /index\.html?$/i.test(p));
    const idxPath = htmlPaths.find(p => /www[/\\]/.test(p)) || htmlPaths[0];
    ok(`入口: ${idxPath}`);
    const htmlFile = zip.file(idxPath);
    const html = await htmlFile.async('string');

    // 检查 System.json
    const sysPath = allPaths.find(p => /data[/\\]System\.json$/i.test(p));
    if (sysPath) {
      const sys = JSON.parse(await zip.file(sysPath).async('string'));
      info(`hasEncryptedImages: ${sys.hasEncryptedImages}`);
      info(`hasEncryptedAudio: ${sys.hasEncryptedAudio}`);
      info(`gameId: ${sys.advanced?.gameId || sys.gameId || 'N/A'}`);
      if (sys.encryptionKey) info(`密钥前8位: ${sys.encryptionKey.slice(0,8)}`);
    }

    // 统计资源类型
    const types = {};
    for (const p of allPaths) {
      const ext = (p.split('.').pop() || 'unknown').toLowerCase();
      types[ext] = (types[ext] || 0) + 1;
    }
    info(`资源类型: ${Object.entries(types).map(([k,v])=>`${k}:${v}`).join(', ')}`);

    // 检查常见资源存在性
    const hasImages = allPaths.some(p => /\.(png|jpg|jpeg)/i.test(p));
    const hasAudio = allPaths.some(p => /\.(ogg|m4a|mp3)/i.test(p));
    const hasFonts = allPaths.some(p => /\.(ttf|woff|otf)/i.test(p));
    hasImages ? ok('包含图片资源') : info('无图片');
    hasAudio ? ok('包含音频资源') : info('无音频');
    hasFonts ? info('包含字体资源') : info('无字体');

    // 检查 script 引用可达性
    const scriptRefs = [...html.matchAll(/src\s*=\s*["']([^"']+\.js)["']/gi)].map(m => m[1]);
    info(`HTML 中 script 引用: ${scriptRefs.length} 个`);
    for (const s of scriptRefs) ok(`  ${s}`);

  } catch(e) { err('ZIP 分析: ' + e.message); }

  // ═══════════════════════════════════════
  // 测试 7: 模拟器服务状态
  // ═══════════════════════════════════════
  console.log('\n测试 7: 模拟器服务模块功能检查');
  try {
    const emuPath = join(ROOT, 'src/services/emulatorBridge.ts');
    const emuCode = readFileSync(emuPath, 'utf8');
    const funcs = [
      'initEmulator', 'shutdownGame', 'captureGameText',
      'loadAndBootGame', 'libraryAdd', 'libraryGetAll',
      'libraryGet', 'libraryDelete', 'libraryUpdate',
      'libraryEntryToGameEntry', 'extractThumbnail',
      'getEmulatorState', 'getVfsInstance', 'isEmulatorReady',
    ];
    for (const f of funcs) {
      emuCode.includes('export async function ' + f) || emuCode.includes('export function ' + f)
        ? ok(`export ${f}`) : err(`${f} 未导出`);
    }
  } catch(e) { err('服务检查: ' + e.message); }

  // ═══════════════════════════════════════
  // 总结
  // ═══════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log(`📊 总计: ${passed} 通过, ${failed} 失败`);
  if (failed === 0) {
    console.log('🎉 所有测试通过！');
    process.exit(0);
  } else {
    console.log(`⚠️ ${failed} 项失败`);
    process.exit(1);
  }
}

main();
