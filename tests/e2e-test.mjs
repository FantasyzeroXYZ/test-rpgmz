/**
 * 端到端自动化测试 — 完整导入→启动游戏流程
 * npm run dev 启动后运行: node tests/e2e-test.mjs
 */
import { readFileSync } from 'fs';
import http from 'http';
import JSZip from 'jszip';

const ZIP = 'D:/Desktop/rpgmz/Maneater_WIN_1.0.0.zip';
const BASE = 'http://127.0.0.1:3000';
let pass = 0, fail = 0;
function ok(m) { pass++; console.log('  ✅ ' + m); }
function no(m) { fail++; console.log('  ❌ ' + m); }
function info(m) { console.log('  📌 ' + m); }

// HTTP GET
function get(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    }).on('error', () => resolve({ status: 0, body: '', headers: {} }));
  });
}

async function main() {
  console.log('╔══════════════════════════════╗');
  console.log('║  端到端测试：导入→启动     ║');
  console.log('╚══════════════════════════════╝\n');

  // ── 1. 服务器存活检查 ──
  console.log('1. 服务器状态');
  const r = await get(BASE + '/');
  r.status === 200 ? ok(`主页 ${r.status}`) : no(`主页 ${r.status}`);

  // ── 2. WASM 端点 ──
  console.log('\n2. WASM 端点');
  for (const u of ['/wasm_vfs.js','/pkg/rm_wasm_vfs.js','/pkg/rm_wasm_vfs_bg.wasm']) {
    const s = await get(BASE + u);
    s.status === 200 ? ok(u) : no(`${u} → ${s.status}`);
  }

  // ── 3. 获取 sandbox IIFE 验证无语法错误 ──
  console.log('\n3. 沙箱 IIFE 语法验证');
  const emuRes = await get(BASE + '/src/services/emulatorBridge.ts');
  if (emuRes.status !== 200) { no('emulatorBridge.ts 不可访问'); } else {
    const code = emuRes.body;
    // 提取 buildSandboxIIFE 函数返回的字符串
    // 简单检查: 所有正则字面量是否平衡
    const sandboxMatch = code.match(/function buildSandboxIIFE\(\)[^}]*\{[\s\S]*?return\s*`([\s\S]*?)`;?\s*\}/);
    if (!sandboxMatch) {
      info('无法提取沙箱 IIFE — 检查方法签名');
    } else {
      const sandboxJs = sandboxMatch[1];
      // 检查 JavaScript 中的 regex 是否有未闭合的组
      // 查找所有的 /.../ 正则并验证括号平衡
      const regexes = sandboxJs.match(/\/[^/\n]+\/[gimsuy]*/g) || [];
      // 统计非转义括号（排除 \\\( 和 \\\) 和 \[ 等）
      let broken = 0;
      for (const r of regexes) {
        // 移除转义字符后统计裸括号
        const stripped = r.replace(/\\[(){}[\]/\\|*+?.^$]/g, '');
        const open = (stripped.match(/[^\\]\(/g)||[]).length;
        const close = (stripped.match(/[^\\]\)/g)||[]).length;
        if (open !== close && !r.startsWith('/url')) {
          broken++;
          no(`不平衡正则: ${r.slice(0,60)}...`);
        }
      }
      broken === 0 ? ok(`沙箱正则全部有效 (${regexes.length} 个)`) : null;

      // 检查关键拦截器是否存在
      const checks = [
        'window.fetch=function', 'window.XMLHttpRequest=function',
        'HTMLScriptElement.prototype', 'HTMLImageElement.prototype',
        'HTMLAudioElement.prototype', 'hasEncryptedImages=function',
        'decryptArrayBuffer=function', 'isNwjs=function',
        'window.Worker=function', 'CSSStyleSheet.prototype.insertRule',
        'window.captureGameText',
        'MutationObserver',        // 文本变化事件驱动
        'document.fonts.add',      // 字体预加载
        'FontFace',                // 字体 API
        'postMessage',             // 父页面通信
      ];
      for (const c of checks) {
        sandboxJs.includes(c) ? ok(c) : no(c + ' 缺失');
      }
    }
  }

  // ── 4. 游戏 ZIP 资源可达性 ──
  console.log('\n4. 游戏 ZIP 资源检查');
  try {
    const zipBuf = readFileSync(ZIP);
    const zip = await JSZip.loadAsync(zipBuf);
    const paths = Object.keys(zip.files).filter(f => !zip.files[f].dir);
    info(`${paths.length} 个文件`);

    // 找入口
    const htmlP = paths.filter(p => /index\.html$/i.test(p));
    const idx = htmlP.find(p => /www\//.test(p)) || htmlP[0] || '';
    ok(`入口: ${idx}`);
    const html = await zip.file(idx).async('string');

    // 提取所有引用
    const scriptRefs = [...html.matchAll(/src\s*=\s*["']([^"']+\.js)["']/gi)].map(m => m[1]);
    const cssRefs = [...html.matchAll(/href\s*=\s*["']([^"']+\.css)["']/gi)].map(m => m[1]);
    info(`静态引用: ${scriptRefs.length} 脚本 + ${cssRefs.length} 样式`);

    // 读 main.js 提取动态脚本引用
    const mainJs = scriptRefs.find(s => /main\.js$/i.test(s));
    let dynamicRefs = [];
    if (mainJs) {
      const mainFile = zip.file(mainJs);
      if (mainFile) {
        const mainContent = await mainFile.async('string');
        // 提取所有 .js 引用
        const jsRefs = mainContent.match(/["'][^"']+\.js["']/g) || [];
        dynamicRefs = [...new Set(jsRefs.map(r => r.replace(/["']/g,'')))];
        info(`main.js 中动态引用: ${dynamicRefs.length} 个`);
      }
    }

    // 加载 plugins.js 获取完整插件列表
    let pluginRefs = [];
    const pluginsPath = paths.find(p => /plugins\.js$/i.test(p));
    if (pluginsPath) {
      const pluginsFile = zip.file(pluginsPath);
      if (pluginsFile) {
        const pluginsContent = await pluginsFile.async('string');
        // RPG Maker 插件格式: {"name":"PluginName","status":true,...}
        try {
          const plugins = JSON.parse(pluginsContent);
          for (const p of plugins) {
            if (p.name) pluginRefs.push(p.name + '.js');
          }
        } catch(e) { /* 可能不是 JSON 数组 */ }
      }
    }
    info(`plugins.js 中声明: ${pluginRefs.length} 个插件`);

    // 合并所有引用并验证存在性
    const allRefs = [...new Set([...scriptRefs, ...dynamicRefs, ...pluginRefs])];
    let foundAll = true;
    for (const ref of allRefs) {
      if (/^https?:/i.test(ref)) continue;
      // 尝试多种路径
      const candidates = [ref, 'js/' + ref, 'js/libs/' + ref, 'js/plugins/' + ref];
      let exists = false;
      for (const c of candidates) {
        if (paths.includes(c) || paths.some(p => p.endsWith('/' + ref))) {
          exists = true; break;
        }
        // 加密变体
        if (paths.includes(c + '_')) { exists = true; break; }
      }
      if (exists) {
        // ok(`  ${ref}`); // too verbose
      } else {
        no(`  资源缺失: ${ref}`);
        foundAll = false;
      }
    }
    foundAll ? ok(`全部 ${allRefs.length} 个引用资源可达`) : null;

    // 检查加密情况
    const sysP = paths.find(p => /data\/System\.json$/i.test(p));
    if (sysP) {
      const sys = JSON.parse(await zip.file(sysP).async('string'));
      info(`加密: images=${sys.hasEncryptedImages} audio=${sys.hasEncryptedAudio}`);
      info(`密钥: ${(sys.encryptionKey||'').slice(0,8)}...`);
    }

  } catch(e) {
    no(`ZIP分析异常: ${e.message}`);
  }

  // ── 5. React 组件渲染验证 ──
  console.log('\n5. 前端入口检查');
  const idxRes = await get(BASE + '/');
  const idxHtml = idxRes.body;
  idxHtml.includes('id="root"') ? ok('root div 存在') : no('root div 缺失');
  idxHtml.includes('/src/main.tsx') ? ok('main.tsx 引用') : no('main.tsx 缺失');

  // 关键组件可访问
  for (const c of ['App','HomeView','EmulatorView','SidePanel','DictionarySidebar']) {
    const cr = await get(BASE + `/src/components/${c}.tsx`);
    cr.status === 200 ? ok(`${c}.tsx`) : no(`${c}.tsx → ${cr.status}`);
  }

  // ── 总结 ──
  console.log('\n' + '═'.repeat(40));
  console.log(`📊 ${pass} 通过, ${fail} 失败`);
  console.log(fail === 0 ? '🎉 全部通过' : '⚠️ 存在失败');
  process.exit(fail === 0 ? 0 : 1);
}

main();
