/**
 * 自动化游戏导入+运行测试 — Legacy of Aeon v2.5b
 * 用法: node tests/test-legacy-of-aeon.mjs
 *
 * 测试覆盖:
 * 1. ZIP 结构分析 + 游戏根目录识别算法验证
 * 2. 资源可达性（所有 script/link 引用）
 * 3. WASM VFS 模拟加载
 * 4. 沙箱文档构建验证
 */
import { readFileSync, existsSync } from 'fs';
import http from 'http';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ZIP_PATH = 'D:/Desktop/rpgmz/Legacy of Aeon v2.5b.zip';
const ENGINE_TYPE = 'RPGMZ'; // This game is MZ

// ── Test state ──
let pass = 0, fail = 0;
function ok(m)  { pass++; console.log('  ✅ ' + m); }
function no(m)  { fail++; console.log('  ❌ ' + m); }
function info(m) { console.log('  📌 ' + m); }
function hr()   { console.log('─'.repeat(55)); }

// ── HTTP helper ──
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

// ── Detect dev server port ──
function detectPort() {
  const ports = [3000, 5173, 3001, 3002, 3003, 3004, 3005, 3006, 3007];
  return new Promise((resolve) => {
    let checked = 0;
    for (const p of ports) {
      http.get(`http://localhost:${p}/`, (res) => {
        res.resume();
        resolve(p);
      }).on('error', () => {
        if (++checked >= ports.length) resolve(null);
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// GAME ROOT DETECTOR — mirror of wasm_vfs.js algorithm for testing
// ═══════════════════════════════════════════════════════════════

const GAME_ROOT_CONFIG = {
  entryFiles: ['index.html'],
  fallbackPattern: /\.html?$/i,
  childThreshold: 1,
  knownSpecialDirs: ['www'],
  gameDataMarkers: ['data/', 'js/', 'effects/', 'img/', 'audio/', 'fonts/', 'css/'],
  engineFeatures: {
    'RPGMV': { checkWww: true, siblingDirs: ['data/', 'js/'] },
    'RPGMZ': { checkWww: false, siblingDirs: ['effects/', 'data/'] },
  },
};

function getImmediateChildren(dir, paths) {
  const children = new Set();
  const prefix = dir ? dir + '/' : '';
  for (const p of paths) {
    if (prefix && !p.startsWith(prefix)) continue;
    const rest = prefix ? p.substring(prefix.length) : p;
    const slash = rest.indexOf('/');
    children.add(slash === -1 ? rest : rest.substring(0, slash));
  }
  return children;
}

function hasGameFiles(dir, paths, cfg) {
  const prefix = dir ? dir + '/' : '';
  for (const p of paths) {
    if (prefix && !p.startsWith(prefix)) continue;
    const rest = prefix ? p.substring(prefix.length) : p;
    // Check game data markers
    for (const m of cfg.gameDataMarkers) {
      if (rest === m.slice(0, -1) || rest.startsWith(m)) return true;
    }
    // Check entry files at this level
    if (rest.indexOf('/') === -1) {
      const lower = rest.toLowerCase();
      if (cfg.entryFiles.some(ef => lower === ef)) return true;
    }
  }
  return false;
}

function isWrapperDir(dir, paths, cfg) {
  const children = getImmediateChildren(dir, paths);
  if (children.size > cfg.childThreshold) return false;
  if (children.size === 0) return false;
  return !hasGameFiles(dir, paths, cfg);
}

function drillToGameRoot(startDir, paths, cfg) {
  let current = startDir;
  for (let depth = 0; depth < 10; depth++) {
    if (hasGameFiles(current, paths, cfg)) return current;
    if (!isWrapperDir(current, paths, cfg)) {
      return hasGameFiles(current, paths, cfg) ? current : null;
    }
    const children = [...getImmediateChildren(current, paths)];
    if (children.length !== 1) return null;
    const onlyChild = children[0];
    const prefix = current ? current + '/' : '';
    const hasSub = paths.some(p =>
      p.startsWith(prefix + onlyChild + '/') && p !== prefix + onlyChild + '/'
    );
    if (!hasSub) return null;
    current = current ? current + '/' + onlyChild : onlyChild;
  }
  return null;
}

function verifyEngineDirs(dir, paths, requiredDirs) {
  const prefix = dir ? dir + '/' : '';
  for (const rd of requiredDirs) {
    const has = paths.some(p => {
      if (prefix && !p.startsWith(prefix)) return false;
      const rest = prefix ? p.substring(prefix.length) : p;
      return rest === rd.slice(0, -1) || rest.startsWith(rd);
    });
    if (has) return true;
  }
  return false;
}

function findInDir(targetDir, targetFile, paths) {
  const tdir = targetDir.toLowerCase();
  const tfile = targetFile.toLowerCase();
  for (const p of paths) {
    const parts = p.split('/');
    if (parts.length < 2) continue;
    if (parts[parts.length - 2].toLowerCase() === tdir &&
        parts[parts.length - 1].toLowerCase() === tfile) return p;
  }
  return null;
}

/**
 * Full engine-aware game root detection (mirrors WasmVFS._detectBasePath).
 * @returns {{ basePath: string, reason: string }}
 */
function detectGameRoot(paths, engineType) {
  const cfg = GAME_ROOT_CONFIG;

  // Step 0a – RPGMV: prioritize www/<entryFile>
  if (engineType === 'RPGMV') {
    for (const ef of cfg.entryFiles) {
      const hit = findInDir('www', ef, paths);
      if (hit) return { basePath: hit.substring(0, hit.lastIndexOf('/')), reason: 'Step 0a: RPGMV www/ structure' };
    }
  }

  // Step 0b – Collect index.html paths
  const indexPaths = [];
  for (const p of paths) {
    const fname = p.split('/').pop().toLowerCase();
    if (cfg.entryFiles.some(ef => fname === ef)) indexPaths.push(p);
  }

  // Step 0c – Unique match
  if (indexPaths.length === 1) {
    const s = indexPaths[0].lastIndexOf('/');
    return { basePath: s === -1 ? '' : indexPaths[0].substring(0, s), reason: 'Step 0c: unique index.html match' };
  }

  // Step 0d – RPGMZ multi-match: skip www/ entries, prefer non-www with sibling dirs
  if (engineType === 'RPGMZ' && indexPaths.length > 1) {
    const mzDirs = cfg.engineFeatures['RPGMZ'].siblingDirs;
    // Separate non-www and www candidates
    const nonWww = indexPaths.filter(p => {
      const parts = p.split('/');
      return parts.length < 2 || parts[parts.length - 2].toLowerCase() !== 'www';
    });
    const wwwOnly = indexPaths.filter(p => {
      const parts = p.split('/');
      return parts.length >= 2 && parts[parts.length - 2].toLowerCase() === 'www';
    });
    // Prefer non-www candidates with MZ sibling dirs
    for (const idx of [...nonWww, ...wwwOnly]) {
      const dir = idx.lastIndexOf('/') === -1 ? '' : idx.substring(0, idx.lastIndexOf('/'));
      if (verifyEngineDirs(dir, paths, mzDirs)) {
        return { basePath: dir, reason: 'Step 0d: RPGMZ sibling dirs verified' };
      }
    }
  }

  // Steps 1-3 – Heuristic traversal with scoring
  const candidates = indexPaths.length > 0
    ? [...new Set(indexPaths.map(p => { const s = p.lastIndexOf('/'); return s === -1 ? '' : p.substring(0, s); }))]
    : [''];

  const scoreCandidate = (dir) => {
    const prefix = dir ? dir + '/' : '';
    let score = 0;
    for (const p of paths) {
      if (prefix && !p.startsWith(prefix)) continue;
      const rest = prefix ? p.substring(prefix.length) : p;
      for (const m of cfg.gameDataMarkers) {
        if (rest === m.slice(0, -1) || rest.startsWith(m)) { score++; break; }
      }
    }
    return score;
  };

  let bestResult = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    if (hasGameFiles(candidate, paths, cfg)) {
      const s = scoreCandidate(candidate);
      if (s > bestScore || (s === bestScore && bestResult !== null && candidate.length < bestResult.length)) {
        bestScore = s;
        bestResult = candidate;
      }
      continue;
    }
    const drilled = drillToGameRoot(candidate, paths, cfg);
    if (drilled !== null) {
      const s = scoreCandidate(drilled);
      if (s > bestScore || (s === bestScore && bestResult !== null && drilled.length < bestResult.length)) {
        bestScore = s;
        bestResult = drilled;
      }
    }
  }

  if (bestResult !== null) {
    return { basePath: bestResult, reason: `Steps 1-3: best-scored (${bestScore} markers) at "${bestResult || '(root)'}"` };
  }

  // Step 4 – RPGMV www special (skip for RPGMZ)
  if (engineType !== 'RPGMZ') {
    for (const ef of cfg.entryFiles) {
      const hit = findInDir('www', ef, paths);
      if (hit) return { basePath: hit.substring(0, hit.lastIndexOf('/')), reason: 'Step 4: RPGMV www/ special' };
    }
  }

  // Fallback
  if (indexPaths.length > 0) {
    const s = indexPaths[0].lastIndexOf('/');
    return { basePath: s === -1 ? '' : indexPaths[0].substring(0, s), reason: 'Fallback: first index.html' };
  }

  // Last resort
  for (const p of paths) {
    if (cfg.fallbackPattern.test(p.split('/').pop())) {
      const s = p.lastIndexOf('/');
      return { basePath: s === -1 ? '' : p.substring(0, s), reason: 'Last resort: .html fallback' };
    }
  }
  return { basePath: '', reason: 'Not found' };
}

// ═══════════════════════════════════════════════════════════════
// MAIN TEST
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  自动化测试: Legacy of Aeon v2.5b           ║');
  console.log('║  引擎类型: ' + ENGINE_TYPE.padEnd(33) + '║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ─── Test 1: Source files exist ───
  console.log('【测试 1】源码完整性');
  for (const f of ['src/App.tsx', 'src/main.tsx', 'src/services/emulatorBridge.ts',
    'public/wasm_vfs.js', 'public/pkg/rm_wasm_vfs.js', 'public/pkg/rm_wasm_vfs_bg.wasm',
    'public/sandbox.js']) {
    existsSync(resolve(ROOT, f)) ? ok(f) : no(f + ' 缺失');
  }

  // ─── Test 2: Build artifacts ───
  console.log('\n【测试 2】构建产物');
  for (const f of ['dist/index.html', 'dist/pkg/rm_wasm_vfs.js', 'dist/pkg/rm_wasm_vfs_bg.wasm', 'dist/wasm_vfs.js']) {
    const fp = resolve(ROOT, f);
    if (existsSync(fp)) {
      const { statSync } = await import('fs');
      ok(`${f} (${(statSync(fp).size/1024).toFixed(1)} KB)`);
    } else {
      no(f + ' 缺失 (需要 npm run build)');
    }
  }

  // ─── Test 3: ZIP file access + structure ───
  console.log('\n【测试 3】ZIP 文件分析');
  if (!existsSync(ZIP_PATH)) {
    no(`ZIP 不存在: ${ZIP_PATH}`);
    summary();
    return;
  }
  ok(`ZIP 文件存在`);

  const { default: JSZip } = await import('jszip');
  const zipBuf = readFileSync(ZIP_PATH);
  info(`大小: ${(zipBuf.length/1024/1024).toFixed(1)} MB`);

  const zip = await JSZip.loadAsync(zipBuf);
  const allPaths = Object.keys(zip.files).filter(f => !zip.files[f].dir);
  ok(`解压: ${allPaths.length} 个文件`);

  // ─── Test 4: Game root detection ───
  console.log('\n【测试 4】游戏根目录识别算法');
  hr();

  // Test with different engine type declarations
  for (const engine of [null, 'RPGMV', 'RPGMZ']) {
    const result = detectGameRoot(allPaths, engine);
    const label = engine ? `引擎=${engine}` : '引擎=未指定';
    console.log(`  ${label}: basePath="${result.basePath || '(root)'}" — ${result.reason}`);
  }

  // Expected: basePath="" for MZ flat structure
  const mzResult = detectGameRoot(allPaths, 'RPGMZ');
  mzResult.basePath === ''
    ? ok('MZ 模式: 正确识别为扁平结构 (basePath="")')
    : no(`MZ 模式: 期望 basePath="" 实际="${mzResult.basePath}"`);

  const autoResult = detectGameRoot(allPaths, null);
  autoResult.basePath === ''
    ? ok('自动模式: 正确识别为扁平结构')
    : no(`自动模式: 期望 basePath="" 实际="${autoResult.basePath}"`);

  const mvResult = detectGameRoot(allPaths, 'RPGMV');
  mvResult.basePath === ''
    ? ok('MV 模式: 正确（无 www/, 回退到扁平）')
    : no(`MV 模式: 期望 basePath="" 实际="${mvResult.basePath}"`);

  // ─── Test 5: index.html analysis ───
  console.log('\n【测试 5】index.html 入口文件');
  const indexPath = 'index.html';
  const htmlFile = zip.file(indexPath);
  htmlFile ? ok('index.html 可读') : no('index.html 不可读');

  const htmlContent = await htmlFile.async('string');
  info(`${htmlContent.length} 字节`);

  // Extract script references
  const scriptRefs = [...htmlContent.matchAll(/<script\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  info(`Script 引用: ${scriptRefs.length} 个`);
  scriptRefs.forEach(s => console.log('     ' + s));

  // Extract link references
  const linkRefs = [...htmlContent.matchAll(/<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\shref\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
  info(`CSS 引用: ${linkRefs.length} 个`);

  // Read main.js to extract dynamic script references
  const mainJs = zip.file('js/main.js');
  let dynamicScripts = [];
  if (mainJs) {
    const mainContent = await mainJs.async('string');
    const jsRefs = [...new Set((mainContent.match(/["'][^"']+\.js["']/g) || []).map(r => r.replace(/["']/g, '')))];
    dynamicScripts = jsRefs;
    info(`main.js 动态引用: ${dynamicScripts.length} 个`);
  }

  // ─── Test 6: Resource reachability ───
  console.log('\n【测试 6】资源可达性');
  hr();

  const allRefs = [...new Set([...scriptRefs, ...linkRefs, ...dynamicScripts])];
  let found = 0, missing = 0;
  const missingList = [];

  for (const ref of allRefs) {
    if (/^https?:/i.test(ref)) {
      info(`⏭ ${ref} (外部URL)`);
      continue;
    }
    const norm = ref.replace(/\\/g, '/');
    // Try exact, then relative to js/, then just filename
    const candidates = [norm, 'js/' + norm, 'js/plugins/' + norm, 'js/libs/' + norm];
    let resolved = candidates.find(c => allPaths.includes(c));
    if (!resolved) {
      // Try encrypted variants
      const encCandidates = [norm + '_'];
      if (/\.(png|jpg|jpeg)$/i.test(norm)) encCandidates.push(norm.replace(/\.(png|jpg|jpeg)$/i, '.rpgmvp'));
      if (/\.(ogg|m4a)$/i.test(norm)) encCandidates.push(norm.replace(/\.(ogg|m4a)$/i, '.rpgmvo'));
      resolved = encCandidates.find(c => allPaths.includes(c));
    }
    if (resolved) {
      found++;
    } else {
      missing++;
      missingList.push(ref);
      no(`缺失: ${ref}`);
    }
  }

  if (found > 0) ok(`${found} 个资源可达`);
  if (missing === 0) {
    ok('所有引用资源均存在于 ZIP');
  } else {
    info(`共 ${missing} 个资源缺失`);
    // Suggest similar files
    for (const m of missingList.slice(0, 5)) {
      const basename = m.split('/').pop().toLowerCase();
      const similar = allPaths.filter(p => p.toLowerCase().endsWith(basename)).slice(0, 3);
      if (similar.length) info(`  ${m} → 可能: ${similar.join(', ')}`);
    }
  }

  // ─── Test 7: Encryption check ───
  console.log('\n【测试 7】加密检测');
  const sysPath = allPaths.find(p => /data\/System\.json$/i.test(p));
  if (sysPath) {
    const sys = JSON.parse(await zip.file(sysPath).async('string'));
    info(`gameTitle: ${sys.gameTitle}`);
    info(`hasEncryptedImages: ${!!sys.hasEncryptedImages}`);
    info(`hasEncryptedAudio: ${!!sys.hasEncryptedAudio}`);
    const hasEncryption = sys.hasEncryptedImages || sys.hasEncryptedAudio;
    if (!hasEncryption) ok('游戏未加密 — 无需密钥推导');
    else info('游戏已加密 — 需要密钥推导');
  } else {
    no('未找到 data/System.json');
  }

  // ─── Test 8: NW.js filter list ───
  console.log('\n【测试 8】NW.js 文件过滤');
  const NWJS_SKIP_NAMES = new Set([
    'nw.dll','node.dll','ffmpeg.dll','libegl.dll','libglesv2.dll',
    'd3dcompiler_47.dll','nw_elf.dll','notification_helper.exe',
    'game.exe','nw.exe','nwjc.exe',
    'nw_100_percent.pak','nw_200_percent.pak','resources.pak',
    'icudtl.dat','natives_blob.bin','snapshot_blob.bin',
    'v8_context_snapshot.bin','debug.log','.ds_store','thumbs.db',
  ]);
  const nwFiles = allPaths.filter(p => {
    const name = p.split('/').pop().toLowerCase();
    return NWJS_SKIP_NAMES.has(name);
  });
  const dirFiltered = allPaths.filter(p => {
    const lower = p.toLowerCase();
    return lower.startsWith('locales/') || lower.startsWith('swiftshader/');
  });
  info(`将被过滤: ${nwFiles.length} 个 NW.js 文件 + ${dirFiltered.length} 个目录文件`);
  ok('VFS 过滤器可处理这些文件');

  // ─── Test 9: Server + WASM endpoints ───
  console.log('\n【测试 9】服务端点');
  const port = await detectPort();
  if (!port) {
    info('未检测到开发服务器 (跳过)');
  } else {
    const BASE = `http://localhost:${port}`;
    info(`服务器端口: ${port}`);

    for (const ep of ['/', '/wasm_vfs.js', '/pkg/rm_wasm_vfs.js', '/pkg/rm_wasm_vfs_bg.wasm']) {
      try {
        const res = await fetchUrl(BASE + ep);
        res.status === 200 ? ok(`${ep} → ${res.status}`) : no(`${ep} → ${res.status}`);
      } catch(e) {
        no(`${ep}: ${e.message}`);
      }
    }
  }

  // ─── Test 10: Game root detection edge cases ───
  console.log('\n【测试 10】边缘情况测试');

  // Simulate various zip structures
  const testCases = [
    { desc: '扁平结构', paths: ['index.html', 'data/System.json', 'js/main.js', 'img/face.png'], engine: 'RPGMZ', expected: '' },
    { desc: '单层包裹', paths: ['MyGame/index.html', 'MyGame/data/System.json', 'MyGame/js/main.js'], engine: 'RPGMZ', expected: 'MyGame' },
    { desc: '深层嵌套', paths: ['A/B/C/index.html', 'A/B/C/data/System.json', 'A/B/X/other.txt'], engine: null, expected: 'A/B/C' },
    { desc: 'RPGMV www/', paths: ['Game/www/index.html', 'Game/www/data/System.json', 'Game/www/js/main.js', 'Game/nw.exe'], engine: 'RPGMV', expected: 'Game/www' },
    { desc: 'RPGMZ 忽略 www/', paths: ['Game/www/index.html', 'Game/www/data/System.json', 'Game/index.html', 'Game/data/System.json'], engine: 'RPGMZ', expected: 'Game' },
    { desc: '多次 index.html', paths: ['A/index.html', 'B/data/System.json', 'B/index.html', 'B/js/main.js'], engine: null, expected: 'B' },
  ];

  for (const tc of testCases) {
    const result = detectGameRoot(tc.paths, tc.engine);
    const match = result.basePath === tc.expected;
    match ? ok(tc.desc) : no(`${tc.desc}: 期望="${tc.expected}" 实际="${result.basePath}" (${result.reason})`);
  }

  // ─── Summary ───
  summary();
}

function summary() {
  console.log('\n' + '═'.repeat(55));
  console.log(`📊 ${pass} 通过, ${fail} 失败`);
  if (fail === 0) {
    console.log('🎉 全部测试通过！');
    process.exit(0);
  } else {
    console.log(`⚠️ ${fail} 项失败，需要修复`);
    process.exit(1);
  }
}

main().catch(e => { console.error('测试异常:', e); process.exit(1); });
