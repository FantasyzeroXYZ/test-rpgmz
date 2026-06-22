/**
 * 自动测试脚本 — 加载游戏 ZIP 并测试所有资源可达性
 * 用法: node tests/auto-test.mjs "D:/Desktop/rpgmz/Maneater_WIN_1.0.0.zip"
 */
import { readFileSync } from 'fs';
import JSZip from 'jszip';

const ZIP_PATH = process.argv[2] || 'D:/Desktop/rpgmz/Maneater_WIN_1.0.0.zip';

console.log('╔══════════════════════════════════════╗');
console.log('║  游戏 ZIP 资源自动检测              ║');
console.log('╚══════════════════════════════════════╝\n');

async function main() {
  // 1. 读取 ZIP
  console.log(`📦 读取: ${ZIP_PATH}`);
  let zipBuffer;
  try {
    zipBuffer = readFileSync(ZIP_PATH);
    console.log(`   ✅ 文件大小: ${(zipBuffer.length/1024/1024).toFixed(1)} MB\n`);
  } catch(e) {
    console.error(`   ❌ 无法读取: ${e.message}`);
    process.exit(1);
  }

  // 2. 解压 ZIP
  console.log('📂 解压 ZIP...');
  const zip = await JSZip.loadAsync(zipBuffer);
  const allPaths = Object.keys(zip.files).filter(f => !zip.files[f].dir);
  console.log(`   ✅ ${allPaths.length} 个文件\n`);

  // 3. 查找 index.html
  console.log('🔍 查找 index.html...');
  const htmlCandidates = allPaths.filter(p => /index\.html?$/i.test(p) && !p.includes('__MACOSX'));
  if (htmlCandidates.length === 0) {
    console.error('   ❌ 未找到 index.html！');
    process.exit(1);
  }
  // 优先选择 www/ 下的或最短路径的
  const wwwHtml = htmlCandidates.find(p => /www[/\\]index\.html$/i.test(p));
  const indexHtml = wwwHtml || htmlCandidates.sort((a,b) => a.split('/').length - b.split('/').length)[0];
  console.log(`   ✅ 入口: ${indexHtml}\n`);

  // 4. 检测基础路径
  const baseDir = indexHtml.replace(/[/\\]?index\.html$/i, '');
  console.log(`📁 基础路径: "${baseDir}"\n`);

  // 5. 读取 index.html 内容
  console.log('📄 读取 index.html...');
  const htmlFile = zip.file(indexHtml);
  if (!htmlFile) {
    console.error('   ❌ 无法读取 index.html');
    process.exit(1);
  }
  const htmlContent = await htmlFile.async('string');
  console.log(`   ✅ HTML 长度: ${htmlContent.length} 字节\n`);

  // 6. 提取所有 <script src> 引用
  console.log('🔍 提取 <script src> 引用...');
  const scriptRegex = /<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi;
  const staticScripts = [...htmlContent.matchAll(scriptRegex)].map(m => m[1]);
  console.log(`   静态引用: ${staticScripts.length} 个`);
  for (const s of staticScripts) {
    console.log(`     - ${s}`);
  }

  // 7. 提取 <link href> 样式表引用
  console.log('\n🔍 提取 <link> 样式表引用...');
  const linkRegex = /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\shref\s*=\s*["']([^"']+)["']/gi;
  const staticLinks = [...htmlContent.matchAll(linkRegex)].map(m => m[1]);
  console.log(`   样式表引用: ${staticLinks.length} 个`);
  for (const l of staticLinks) {
    console.log(`     - ${l}`);
  }

  // 8. 解析每个静态脚本中动态引用的脚本（RPG Maker 的插件列表）
  // 通常 main.js 或 plugins.js 中包含了所有插件和核心脚本的列表
  console.log('\n🔍 查找动态脚本引用（plugins.js / main.js）...');
  const mainJsPath = staticScripts.find(s => /main\.js$/i.test(s));
  const pluginsJsPath = staticScripts.find(s => /plugins\.js$/i.test(s));

  let dynamicScripts = [];

  if (pluginsJsPath) {
    const resolvedPlugins = resolvePath(pluginsJsPath, baseDir);
    const pluginsFile = zip.file(resolvedPlugins);
    if (pluginsFile) {
      const content = await pluginsFile.async('string');
      // 提取文件名模式: "PluginName" 或 'PluginName'
      const pluginNames = content.match(/["']([^"']+\.js)["']/g);
      if (pluginNames) {
        dynamicScripts = [...new Set(pluginNames.map(p => p.replace(/["']/g, '').trim()))];
      }
    }
  }

  // 如果 plugins.js 没有明确列出，尝试从 main.js 中提取
  if (dynamicScripts.length === 0 && mainJsPath) {
    const resolvedMain = resolvePath(mainJsPath, baseDir);
    const mainFile = zip.file(resolvedMain);
    if (mainFile) {
      const content = await mainFile.async('string');
      // 找 loadScript / scriptUrl 等模式
      const allJsRefs = content.match(/["']([^"']+\.js)["']/g) || [];
      dynamicScripts = [...new Set(allJsRefs.map(r => r.replace(/["']/g, '').trim()))];
    }
  }

  // 9. 合并所有引用
  const allRefs = [...new Set([
    ...staticScripts,
    ...staticLinks,
    ...dynamicScripts
  ])];
  console.log(`   总计引用: ${allRefs.length} 个\n`);

  // 10. 解析并检查每个引用是否存在于 ZIP 中
  console.log('═'.repeat(40));
  console.log('📊 资源可达性检测\n');

  let found = 0, missing = 0;
  const missingList = [];

  for (const ref of allRefs) {
    // 跳过外部 URL
    if (/^https?:/.test(ref)) {
      console.log(`   ⏭ ${ref} (外部URL)`);
      continue;
    }

    const resolved = resolvePath(ref, baseDir);
    if (zip.file(resolved)) {
      found++;
    } else {
      // 尝试去除 baseDir 前缀再查找
      const withoutBase = ref.replace(new RegExp('^' + baseDir + '/?'), '');
      if (zip.file(withoutBase)) {
        found++;
        continue;
      }
      // 尝试加密变体
      const encVariants = [resolved + '_', resolved.replace(/\.png$/i, '.rpgmvp').replace(/\.ogg$/i, '.rpgmvo')];
      let encFound = false;
      for (const ev of encVariants) {
        if (zip.file(ev)) {
          found++;
          console.log(`   ✅ ${ref} → ${ev} (加密)`);
          encFound = true;
          break;
        }
      }
      if (!encFound) {
        missing++;
        missingList.push(ref);
        console.log(`   ❌ ${ref}`);
      }
    }
  }

  // 11. 检测加密状态
  const systemJsonPath = baseDir ? `${baseDir}/data/System.json` : 'data/System.json';
  const systemFile = zip.file(systemJsonPath);
  let hasEncryption = false;
  if (systemFile) {
    const sysContent = await systemFile.async('string');
    try {
      const sys = JSON.parse(sysContent);
      hasEncryption = sys.hasEncryptedImages || sys.hasEncryptedAudio;
      console.log(`\n🔐 加密: ${hasEncryption ? '是' : '否'}`);
      if (sys.encryptionKey) console.log(`   密钥: ${sys.encryptionKey.slice(0,16)}...`);
    } catch(e) {}
  }

  // 12. 总结
  console.log('\n═'.repeat(40));
  console.log('📊 检测总结');
  console.log(`   ✅ 可访问: ${found}`);
  console.log(`   ❌ 不可访问: ${missing}`);
  console.log(`   📦 总文件: ${allPaths.length}`);
  console.log(`   🔐 加密: ${hasEncryption ? '是' : '否'}`);
  console.log(`   📜 静态脚本: ${staticScripts.length}`);
  console.log(`   🎨 样式表: ${staticLinks.length}`);
  console.log(`   🔄 动态脚本: ${dynamicScripts.length}`);

  if (missing === 0) {
    console.log('\n🎉 所有游戏资源均可访问！');
  } else {
    console.log(`\n⚠️ ${missing} 个资源无法在 ZIP 中找到:`);
    for (const m of missingList) {
      console.log(`   - ${m}`);
    }
    // 建议：搜索 ZIP 中相似的文件
    console.log('\n💡 ZIP 中可能相关的文件:');
    for (const m of missingList) {
      const basename = m.split('/').pop();
      const matches = allPaths.filter(p => p.endsWith(basename) || p.toLowerCase().endsWith(basename.toLowerCase()));
      if (matches.length > 0) {
        console.log(`   ${m} → ${matches.slice(0,3).join(', ')}`);
      }
    }
  }

  return missing === 0;
}

function resolvePath(ref, baseDir) {
  if (!ref || ref.startsWith('data:') || ref.startsWith('blob:') || ref.startsWith('http')) return ref;
  // 标准化路径
  let path = ref.replace(/\\/g, '/').replace(/\/\.\//g, '/');
  // 去除 ? 和 # 后的部分
  path = path.split('?')[0].split('#')[0];
  // 如果是相对路径，加上基础路径
  if (!path.startsWith('/') && baseDir) {
    path = baseDir + '/' + path;
  }
  // 折叠 ..
  const segs = path.split('/');
  const result = [];
  for (const s of segs) {
    if (s === '..') result.pop();
    else if (s !== '.' && s !== '') result.push(s);
  }
  return result.join('/');
}

main().catch(e => { console.error('测试异常:', e); process.exit(1); });
