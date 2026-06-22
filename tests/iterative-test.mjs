/**
 * 迭代测试：导入游戏 → 检查 VFS 字体 → 验证注入 → 重复
 * npm run dev 启动后运行: node tests/iterative-test.mjs "游戏.zip"
 */
import { readFileSync } from 'fs';
import http from 'http';

const ZIP = process.argv[2] || 'D:/Desktop/rpgmz/Maneater_WIN_1.0.0.zip';
const BASE = 'http://127.0.0.1:3000';
let pass=0, fail=0;
function ok(m){pass++;console.log('  ✅ '+m)}
function err(m){fail++;console.log('  ❌ '+m)}
function info(m){console.log('  📌 '+m)}

function get(url){return new Promise(r=>{
  http.get(url,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r({s:res.statusCode,b:d}))}).on('error',e=>r({s:0,b:'',e:e.message}))
})}

async function main(){
  console.log('╔══════════════════════════════════════╗');
  console.log('║  迭代测试脚本                        ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. 服务器检查
  console.log('1. 服务器');
  const s1 = await get(BASE+'/');
  s1.s===200 ? ok('主页 OK') : err('主页 '+s1.s);

  // 2. WASM 模块
  console.log('\n2. WASM');
  for(const u of ['/wasm_vfs.js','/pkg/rm_wasm_vfs.js','/pkg/rm_wasm_vfs_bg.wasm']){
    const r=await get(BASE+u);
    r.s===200?ok(u):err(u+' '+r.s);
  }

  // 3. 读取 emulatorBridge 源码分析字体处理
  console.log('\n3. 字体处理链路分析');
  const emu=await get(BASE+'/src/services/emulatorBridge.ts');
  if(emu.s!==200){err('源码不可达');return;}
  const code=emu.b;

  // 检查 buildFontFaceCSS
  info('buildFontFaceCSS 函数:');
  code.includes('buildFontFaceCSS') ? ok('已定义') : err('缺失');
  code.includes('list_paths') ? ok('list_paths 调用') : err('list_paths 缺失');
  code.includes('readRawFile') ? ok('readRawFile 调用') : err('readRawFile 缺失');

  // 提取沙箱 IIFE
  const m=code.match(/function buildSandboxIIFE[\s\S]*?return `([\s\S]*?)`;?\s*\}/);
  if(!m){err('无法提取沙箱 IIFE'); return;}
  const sandbox=m[1];

  // 检查字体相关拦截
  info('沙箱字体拦截:');
  sandbox.includes('MutationObserver') ? ok('MutationObserver') : err('MutationObserver 缺失');
  sandbox.includes('nodeName===\'STYLE\'') ? ok('STYLE 检测') : err('STYLE 检测缺失');
  sandbox.includes('rewriteCssUrls') ? ok('rewriteCssUrls') : err('rewriteCssUrls 缺失');
  sandbox.includes('createMediaUrl') ? ok('createMediaUrl') : err('createMediaUrl 缺失');
  sandbox.includes('FontFace') ? ok('FontFace API') : err('FontFace 缺失');
  sandbox.includes('font-display') ? ok('font-display') : info('font-display 缺失');

  // 检查是否有 base64 字体注入
  info('字体 base64 注入:');
  sandbox.includes('data:font/') ? ok('data:font/ URL') : info('无 data:font/ 在沙箱中');
  code.includes('buildFontFaceCSS') ? ok('buildFontFaceCSS 注入到 head') : err('buildFontFaceCSS 未注入');

  // 4. 正则验证
  console.log('\n4. 正则语法');
  const regexes=code.match(/\/[^/\n]+\/[gimsuy]*/g)||[];
  let broken=0;
  for(const r of regexes){
    if(r.includes('//') && !r.includes('https:') && !r.includes('http:')){err('含未转义 //: '+r.slice(0,60));broken++;}
  }
  broken===0 ? ok(`全部 ${regexes.length} 个正则有效`) : null;

  // 5. 检查 fallback.css
  console.log('\n5. 回退字体');
  const fb=await get(BASE+'/fonts/fallback.css');
  fb.s===200 ? ok(`fallback.css (${fb.b.length} bytes)`) : err('fallback.css '+fb.s);
  if(fb.s===200){
    fb.b.includes('Microsoft YaHei') ? ok('中文回退') : err('中文回退缺失');
    fb.b.includes('Meiryo') ? ok('日文回退') : err('日文回退缺失');
    fb.b.includes('Malgun Gothic') ? ok('韩文回退') : err('韩文回退缺失');
    fb.b.includes('Segoe UI') ? ok('英文/俄文回退') : err('英文回退缺失');
  }

  // 6. 检查游戏 ZIP 中的字体
  console.log('\n6. 游戏 ZIP 字体分析');
  try{
    const { default: JSZip } = await import('jszip');
    const buf=readFileSync(ZIP);
    const zip=await JSZip.loadAsync(buf);
    const paths=Object.keys(zip.files).filter(f=>!zip.files[f].dir);
    const fontPaths=paths.filter(f=>/\.(ttf|otf|woff|woff2)$/i.test(f));
    info(`找到 ${fontPaths.length} 个字体文件:`);
    fontPaths.forEach(p=>info('  '+p));

    // 检查 game.css 中的 @font-face
    const cssFile=zip.file('css/game.css');
    if(cssFile){
      const css=await cssFile.async('string');
      const fontFaces=css.match(/@font-face[^}]*\}/gi)||[];
      info(`css/game.css 中有 ${fontFaces.length} 个 @font-face 规则`);
    }

    // 搜索所有文件中的 url() 字体引用
    let fontUrls=[];
    for(const p of paths.filter(f=>/\.(css|js|json)$/i.test(f))){
      try{
        const content=await zip.file(p).async('string');
        const urls=content.match(/url\(["']?([^"')]*(?:ttf|otf|woff|woff2)[^"')]*)["']?\)/gi)||[];
        urls.forEach(u=>fontUrls.push(p+': '+u));
      }catch(e){}
    }
    if(fontUrls.length>0){
      info(`找到 ${fontUrls.length} 个字体 URL 引用:`);
      fontUrls.slice(0,15).forEach(u=>info('  '+u));
    } else {
      info('未在 CSS/JS 中找到字体 URL 引用（字体可能由游戏引擎动态注入）');
    }
  } catch(e) { err('ZIP 分析: '+e.message); }

  // 总结
  console.log('\n'+'═'.repeat(50));
  console.log(`📊 ${pass} 通过, ${fail} 失败`);
  if(fail===0) console.log('🎉 全部通过！');
  else console.log('⚠️ 请修复以上失败项');
  process.exit(fail===0?0:1);
}
main();
