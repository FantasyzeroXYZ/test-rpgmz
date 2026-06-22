import { readFileSync } from 'fs';
import JSZip from 'jszip';
const ZIP = process.argv[2] || 'D:/Desktop/rpgmz/ISLANDSOFSPRINGSBluelike1.0018.zip';

const zip = await JSZip.loadAsync(readFileSync(ZIP));
const paths = Object.keys(zip.files).filter(f=>!zip.files[f].dir);

console.log('文件总数:', paths.length);
const fonts = paths.filter(f=>/\\.(ttf|otf|woff|woff2)$/i.test(f));
console.log('字体:', fonts);
const sysP = paths.find(f=>/System\\.json$/i.test(f));
if(sysP){ const sys=JSON.parse(await zip.file(sysP).async('string')); console.log('加密:',sys.hasEncryptedImages,sys.hasEncryptedAudio); }
const html=await zip.file(paths.find(f=>/index\\.html$/i.test(f))).async('string');
console.log('HTML script标签:', (html.match(/<script[^>]+src=/gi)||[]).length);
console.log('HTML link标签:', (html.match(/<link[^>]+>/gi)||[]).length);
// Check for font references in all files
let refs = new Set();
for(const p of paths.filter(f=>/\\.(css|js|json)$/i.test(f))) {
  try { const c=await zip.file(p).async('string'); for(const m of c.match(/font-family\\s*:\\s*["']([^"']+)["']/gi)||[]) refs.add(m.replace(/font-family\\s*:\\s*["']/i,'').replace(/["']/,'')); } catch(e){}
}
console.log('font-family引用:', [...refs].join(', '));
