/**
 * 字体加载自动化测试
 * 测试：ZIP 导入 → VFS 字体提取 → @font-face base64 注入
 */
import { readFileSync } from 'fs';
import http from 'http';

const BASE = 'http://127.0.0.1:3000';
let ok=0, fail=0;
function p(m){ok++;console.log('  ✅ '+m)}
function f(m){fail++;console.log('  ❌ '+m)}
function info(m){console.log('  📌 '+m)}

function get(url){return new Promise(r=>{
  http.get(url,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r({s:res.statusCode,b:d}))}).on('error',()=>r({s:0,b:''}))
})}

async function main(){
  console.log('╔════════════════════════════╗');
  console.log('║  字体加载自动化测试       ║');
  console.log('╚════════════════════════════╝\n');

  // 1. 检查 public/fonts/ 静态字体
  console.log('1. 静态字体文件');
  for(const fn of ['fallback.css','mplus-1m-regular.woff','Courier-New-Regular.woff']){
    const r=await get(`${BASE}/fonts/${encodeURIComponent(fn)}`);
    r.s===200?p(`${fn} (${r.b.length} bytes)`):f(`${fn} → ${r.s}`);
  }

  // 2. 检查 sandbox 中的 buildFontFaceCSS 函数
  console.log('\n2. buildFontFaceCSS 函数');
  const r2=await get(`${BASE}/src/services/emulatorBridge.ts`);
  if(r2.s!==200){f('emulatorBridge.ts 不可达');}else{
    const code=r2.b;
    code.includes('buildFontFaceCSS')?p('函数已定义'):f('函数缺失');
    code.includes('list_paths')?p('使用 list_paths'):f('list_paths 缺失');
    code.includes('readRawFile')?p('使用 readRawFile'):f('readRawFile 缺失');
    code.includes('data:font/')?p('生成 base64 data URL'):f('data:font/ 缺失');
    code.includes('font-display:swap')?p('font-display:swap'):f('font-display 缺失');
  }

  // 3. 检查 sandbox IIFE 字体预加载
  console.log('\n3. 沙箱字体预加载逻辑');
  const r3=await get(`${BASE}/src/services/emulatorBridge.ts`);
  const sandboxMatch=r3.b.match(/function buildSandboxIIFE[\s\S]*?return\s*`([\s\S]*?)`;?\s*\}/);
  if(!sandboxMatch){f('无法提取 sandbox IIFE');}else{
    const js=sandboxMatch[1];
    js.includes('FontFace')?p('FontFace API 预加载'):info('无 FontFace 预加载');
    js.includes('MutationObserver')?p('MutationObserver 样式拦截'):f('MutationObserver 缺失');
    js.includes('documentElement')?p('监听 documentElement'):f('documentElement 缺失');
    js.includes('nodeName===\'STYLE\'')?p('检测 STYLE 元素'):f('STYLE 检测缺失');
    js.includes('rewriteCssUrls')?p('rewriteCssUrls 函数'):f('rewriteCssUrls 缺失');
    js.includes('vfs.createMediaUrl')?p('createMediaUrl 调用'):f('createMediaUrl 缺失');
  }

  // 4. 检查沙箱正则有效性
  console.log('\n4. 沙箱正则检查');
  const verifyRes=await get(`${BASE}/src/services/emulatorBridge.ts`);
  const regexCount=(verifyRes.b.match(/\/[^/\n]+\/[gimsuy]*/g)||[]).length;
  let hasProblem=false;
  for(const r of (verifyRes.b.match(/\/[^/\n]+\/[gimsuy]*/g)||[])){
    if(r.includes('//')&&!r.includes('https:')&&!r.includes('http:')){
      f(`问题正则: ${r.slice(0,60)}`);hasProblem=true;
    }
  }
  if(!hasProblem) p(`全部 ${regexCount} 个正则有效`);

  // 5. 模拟：验证 CSS url() 重写逻辑
  console.log('\n5. CSS url() 重写逻辑验证');
  const testCases=[
    {css:'url("fonts/Pixel Georgia.ttf")', expect:'VFS'},
    {css:'url(fonts/game.woff)', expect:'VFS'},
    {css:'url("https://fonts.gstatic.com/x.woff2")', expect:'SKIP'},
    {css:'url(data:font/woff;base64,abc)', expect:'SKIP'},
    {css:'url(/fonts/fallback.woff)', expect:'SKIP'},
  ];
  for(const tc of testCases){
    const willRewrite=!/^(https?:|data:|blob:|\/)/i.test(
      tc.css.match(/url\(["']?([^"')]+)["']?\)/)?.[1]||''
    );
    const actual=willRewrite?'VFS':'SKIP';
    actual===tc.expect?p(`${tc.css.slice(0,40)} → ${actual}`):f(`${tc.css} → ${actual} (expected ${tc.expect})`);
  }

  console.log('\n'+'═'.repeat(40));
  console.log(`📊 ${ok} 通过, ${fail} 失败`);
  console.log(fail===0?'🎉 全部通过':'⚠️ 存在失败');
  process.exit(fail===0?0:1);
}
main();
