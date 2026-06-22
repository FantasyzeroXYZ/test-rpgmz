/**
 * emulatorBridge.ts — 完整的游戏模拟器桥接服务
 * ============================================================================
 * 从旧项目（WASM VFS Runner）迁移所有核心 JavaScript 运行逻辑：
 * - WASM VFS 初始化与文件管理
 * - IndexedDB 游戏库（存储 ZIP 原始数据与元数据）
 * - ZIP 文件加载 + NW.js 文件过滤
 * - RPG Maker 加密检测与密钥推导
 * - 完整的沙箱 iframe（fetch/XHR/Image.src 拦截器）
 * - 游戏文本捕获（用于翻译/查词）
 * - 存档导入/导出
 *
 * 防御式编程：所有 WASM 操作使用 try-catch 包裹，加载失败时提供明确错误信息。
 */

import { GameEntry } from '../types';
// 旧项目依赖的全局库（wasm_vfs.js 使用这些全局变量）
import JSZip from 'jszip';
import localforage from 'localforage';

// 将 JSZip 和 localforage 注入全局作用域（wasm_vfs.js 期望它们作为全局变量）
(globalThis as any).JSZip = JSZip;
(globalThis as any).localforage = localforage;

// 从 test-rpgmz-main 原始项目搬运的沙箱 IIFE 代码（内联加载，保证同步执行）
// @ts-ignore - Vite raw import
import sandboxCode from "../../public/sandbox.js?raw";


// 扩展 Window 类型以支持游戏文本捕获
declare global {
  interface Window {
    captureGameText?: () => string;
    __vfsRef?: any;
  }
}

// ============================================================================
// 内部类型
// ============================================================================

interface LibraryEntry {
  id: string;
  name: string;
  fileCount: number;
  gameId: string;
  zipSize: number;
  zipData: ArrayBuffer;
  thumbnail: string;
  hasEncryption: boolean;
  encryptionKey: string;
  addedAt: number;
  lastPlayed: number;
}

export interface EmulatorState {
  isInitialized: boolean;
  isGameLoaded: boolean;
  currentGameId: string | null;
  loadProgress: number;
  loadMessage: string;
  error: string | null;
  fileCount: number;
  fileCountTotal: number;
}

// ============================================================================
// 内部状态
// ============================================================================

let emulatorState: EmulatorState = {
  isInitialized: false,
  isGameLoaded: false,
  currentGameId: null,
  loadProgress: 0,
  loadMessage: '',
  error: null,
  fileCount: 0,
  fileCountTotal: 0,
};

let vfsInstance: any = null;

// ============================================================================
// IndexedDB 游戏库（从旧项目 GameLibrary 迁移）
// ============================================================================

const DB_NAME = 'rm-vfs-games';
const DB_VERSION = 1;

function openLibraryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('games')) {
        db.createObjectStore('games', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function libraryAdd(id: string, meta: Record<string, any>, zipData: ArrayBuffer): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('games', 'readwrite');
    tx.objectStore('games').put({ id, ...meta, zipData, addedAt: Date.now(), lastPlayed: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function libraryGetAll(): Promise<LibraryEntry[]> {
  try {
    const db = await openLibraryDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('games', 'readonly');
      const req = tx.objectStore('games').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[emulatorBridge] IndexedDB 读取失败:', e);
    return [];
  }
}

export async function libraryGet(id: string): Promise<LibraryEntry | undefined> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction('games', 'readonly').objectStore('games').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function libraryDelete(id: string): Promise<void> {
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('games', 'readwrite');
    tx.objectStore('games').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function libraryUpdate(id: string, updates: Record<string, any>): Promise<void> {
  const entry = await libraryGet(id);
  if (!entry) return;
  const db = await openLibraryDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('games', 'readwrite');
    tx.objectStore('games').put({ ...entry, ...updates });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================================
// WASM VFS 初始化
// ============================================================================

async function loadVfsDriver(): Promise<any | null> {
  try {
    // 使用 new Function() 构造动态 import，绕过 Rollup 构建时的静态分析
    // wasm_vfs.js 和 pkg/ 文件存放在 public/ 目录，由 Vite 作为静态文件服务
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>;
    const vfsModule = await dynamicImport('/wasm_vfs.js');
    return vfsModule.WasmVFS;
  } catch (e) {
    console.warn('[emulatorBridge] WasmVFS 驱动加载失败，模拟器不可用:', e);
    return null;
  }
}

export async function initEmulator(): Promise<boolean> {
  // 如果已成功初始化，直接返回
  if (emulatorState.isInitialized && vfsInstance) return true;

  try {
    emulatorState.loadMessage = '正在初始化 WASM 虚拟机...';

    const WasmVFSClass = await loadVfsDriver();
    if (!WasmVFSClass) {
      emulatorState.loadMessage = 'WASM 模块不可用 — 请确认 pkg/ 目录存在';
      emulatorState.error = 'WASM 模块加载失败';
      // 不标记 isInitialized，允许重试
      return false;
    }

    vfsInstance = new WasmVFSClass();
    await vfsInstance.initialize();

    emulatorState.isInitialized = true;
    emulatorState.loadMessage = 'WASM 虚拟机就绪';
    emulatorState.error = null;
    return true;
  } catch (error: any) {
    console.error('[emulatorBridge] 初始化失败:', error);
    emulatorState.error = `初始化失败: ${error.message}`;
    emulatorState.loadMessage = 'WASM 初始化失败，将重试';
    // 不标记 isInitialized，允许下次调用时重试
    return false;
  }
}

// ============================================================================
// 从游戏库加载并启动游戏（核心流程，从旧项目迁移）
// ============================================================================

export async function loadAndBootGame(
  libraryId: string,
  containerElement: HTMLElement,
  onProgress?: (pct: number, msg: string) => void
): Promise<{ success: boolean; error?: string; iframe?: HTMLIFrameElement }> {
  // 1. 初始化 VFS
  if (!emulatorState.isInitialized) {
    const ok = await initEmulator();
    if (!ok || !vfsInstance) {
      return { success: false, error: 'WASM 虚拟机初始化失败' };
    }
  }

  // 2. 读取游戏库条目
  const game = await libraryGet(libraryId);
  if (!game) {
    return { success: false, error: '游戏数据不存在' };
  }

  onProgress?.(5, `正在加载 ${game.name}...`);

  try {
    // 3. 传入预存储的加密密钥（如果已知）
    const preKey = (game.encryptionKey && game.encryptionKey.length >= 32) ? game.encryptionKey : null;

    // 4. 加载 ZIP 到 WASM VFS
    onProgress?.(10, '解压资源文件...');
    const meta = await vfsInstance.loadZip(
      new Blob([game.zipData]),
      (cur: number, total: number, entryName: string) => {
        const pct = 10 + Math.round((cur / total) * 70);
        onProgress?.(pct, entryName || '加载中...');
      },
      preKey
    );

    onProgress?.(85, '初始化引擎...');

    // 5. 获取游戏 HTML，构建沙箱文档
    const gameHtml = vfsInstance.getIndexHtml();
    if (!gameHtml) {
      return { success: false, error: '压缩包中未找到 index.html' };
    }

    const sandboxedHtml = buildFullSandboxDocument(gameHtml, vfsInstance);

    // 6. 创建 iframe 并注入沙箱 HTML
    // allow-same-origin 是必需的：srcdoc iframe 需要它才能访问 parent window、加载 blob URL
    const iframe = document.createElement('iframe');
    iframe.id = 'game-iframe';
    iframe.style.cssText = 'border:none;background:#000;width:100%;height:100%;display:block;image-rendering:pixelated;';
    iframe.sandbox.add('allow-scripts');
    iframe.sandbox.add('allow-same-origin');
    iframe.srcdoc = sandboxedHtml;

    // 将 VFS 实例暴露给 iframe 访问（需要 allow-same-origin）
    window.__vfsRef = vfsInstance;

    containerElement.innerHTML = '';
    containerElement.appendChild(iframe);

    // 等待 iframe 加载完成
    await new Promise<void>(resolve => {
      iframe.addEventListener('load', () => resolve(), { once: true });
    });

    // 7. 更新最后游玩时间
    await libraryUpdate(libraryId, { lastPlayed: Date.now() });

    emulatorState.isGameLoaded = true;
    emulatorState.currentGameId = libraryId;
    emulatorState.fileCount = meta.fileCount;
    emulatorState.error = null;
    onProgress?.(100, `✅ ${game.name} 运行中`);

    return { success: true, iframe };
  } catch (error: any) {
    console.error('[emulatorBridge] 加载失败:', error);
    emulatorState.error = `加载失败: ${error.message}`;
    (window as any).__emuError = error.message;
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 完整沙箱文档构建（从旧项目 buildSandboxDocument 迁移）
// ============================================================================

/** 从 VFS 中提取所有字体文件，生成内联 @font-face CSS（保留原始文件名） */
function buildFontFaceCSS(vfs: any): string {
  try {
    const allPaths = vfs.list_paths ? vfs.list_paths() : [];
    let css = '';
    for (const p of allPaths) {
      if (!/\.(ttf|otf|woff|woff2)$/i.test(p)) continue;
      try {
        const data = vfs.readRawFile(p);
        if (!data || data.length < 100) continue;
        // base64 编码字体二进制数据
        let binary = '';
        for (let i = 0; i < data.length; i += 8192) {
          binary += String.fromCharCode.apply(null, data.subarray(i, Math.min(i + 8192, data.length)));
        }
        const b64 = btoa(binary);
        const ext = (p.split('.').pop() || 'woff').toLowerCase();
        const mimeMap = { ttf:'truetype', otf:'opentype', woff2:'woff2', woff:'woff' };
        const mime = (mimeMap as any)[ext] || 'woff';
        // 保留原始文件名作为 font-family
        const origName = p.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
        css += '@font-face{font-family:"' + origName + '";src:url(data:font/' + mime + ';base64,' + b64 + ') format("' + ext + '");font-display:swap;}\n';
        // 同时为 RPG Maker MZ 内置字体名称创建别名规则
        // MZ 引擎将主字体文件映射为 rmmz-numberfont（数字字体）和 GameFont
        css += '@font-face{font-family:"rmmz-numberfont";src:url(data:font/' + mime + ';base64,' + b64 + ') format("' + ext + '");font-display:swap;}\n';
        css += '@font-face{font-family:"GameFont";src:url(data:font/' + mime + ';base64,' + b64 + ') format("' + ext + '");font-display:swap;}\n';
      } catch(e) {}
    }
    return css ? '<style>\n/* VFS Font Faces (' + (css.split('@font-face').length-1) + ' fonts) */\n' + css + '</style>' : '';
  } catch(e) { return ''; }
}

function buildFullSandboxDocument(gameHtml: string, vfs: any): string {
  // 以下代码直接从旧项目（legacy/index.html）的 buildSandboxDocument 函数搬运
  // 确保与已验证可运行的逻辑完全一致
  let rewroteHtml = gameHtml;

  // 0. 提取 VFS 字体文件，生成内联 @font-face（在游戏 CSS 加载前注入）
  const fontCSS = buildFontFaceCSS(vfs);

  // =====================================================================
  // Step 1: 重写 <script src="..."> → blob URL
  // 使用旧项目已验证的正则和替换逻辑，增加调试日志
  // =====================================================================
  let vfsTotal=0, vfsFound=0;
  rewroteHtml = rewroteHtml.replace(
    /(<script\b[^>]*\ssrc\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
    (match, before, url, after) => {
      vfsTotal++;
      const normPath = vfs.normalizePath(url);
      const found = vfs.fileExists(normPath);
      // 如果常规路径未找到，尝试使用 _resolvePath 的完整模糊匹配
      const resolved = found ? normPath : vfs._resolvePath(normPath);
      if (resolved) {
        vfsFound++;
        const blobUrl = vfs.createMediaUrl(resolved, 'application/javascript');
        if (blobUrl) {
          return before.replace('<script', '<script data-vfs-original="' + url + '"') + blobUrl + after;
        }
      }
      // 文件未找到，保留原始标签并记录警告
      console.warn('[Sandbox] Script not in VFS: ' + url + ' (norm=' + normPath + ', basePath=' + (vfs._basePath||'') + ')');
      return match;
    }
  );
  console.log('[Sandbox] Script rewrite: ' + vfsFound + '/' + vfsTotal + ' found, basePath=' + (vfs._basePath||'(root)'));

  // =====================================================================
  // Step 2: 注入 <base href> + 基础样式
  // =====================================================================
  rewroteHtml = rewroteHtml.replace(
    /(<head\b[^>]*>)/i,
    '$1\n<base href="' + window.location.origin + '/">\n' +
    '<style>html,body{margin:0;padding:0;overflow:hidden;width:100%;height:100%;}' +
    'canvas{display:block;}</style>'
  );

  // =====================================================================
  // Step 3: 重写 <link href="..."> → 内联 <style> + CSS url() 改写
  // =====================================================================
  rewroteHtml = rewroteHtml.replace(
    /(<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\shref\s*=\s*["'])([^"']+)(["'][^>]*>)/gi,
    (match, before, url, after) => {
      const normPath = vfs.normalizePath(url);
      if (vfs.fileExists(normPath)) {
        const cssText = vfs.readTextFile(normPath);
        if (cssText) {
          const rewroteCss = cssText.replace(
            /url\(["']?([^"')]+)["']?\)/g,
            (m, assetUrl) => {
              const cssDir = normPath.substring(0, normPath.lastIndexOf('/') + 1);
              let resolved = assetUrl;
              if (!/^(https?:|data:|blob:|\/)/i.test(assetUrl)) resolved = cssDir + assetUrl;
              // 尝试多种路径解析（字体可能在 CSS 目录下，也可能在游戏根目录下）
              const candidates = [
                vfs.normalizePath(resolved),
                vfs.normalizePath(assetUrl),  // 相对于游戏根目录
              ];
              for (const c of candidates) {
                if (vfs.fileExists(c)) {
                  const blobUrl = vfs.createMediaUrl(c);
                  if (blobUrl) return 'url(' + blobUrl + ')';
                }
              }
              return m;
            }
          );
          const cssBlob = new Blob([rewroteCss], { type: 'text/css' });
          const cssBlobUrl = URL.createObjectURL(cssBlob);
          vfs._activeBlobUrls.add(cssBlobUrl);
          return '<style>' + rewroteCss + '</style>';
        }
      }
      return match;
    }
  );

  // =====================================================================
  // Step 4: 注入沙箱拦截脚本（与旧项目完全一致的 IIFE）
  // =====================================================================
  // 注入：VFS 内联字体 + 多语言回退 CSS + 沙箱拦截脚本
  rewroteHtml = rewroteHtml.replace('</head>',
    fontCSS +
    '<link rel="stylesheet" href="/fonts/fallback.css">\n' +
    buildSandboxIIFE() + '\n</head>');

  return rewroteHtml;
}

function buildSandboxIIFE(): string {
  // 沙箱代码内联加载（与 test-rpgmz-main 原始项目一致）
  // 必须内联以确保拦截器在游戏脚本加载前同步安装
  return '<script>\n' + sandboxCode + '\n</scr' + 'ipt>';
}

// 游戏文本捕获
// ============================================================================

export function captureGameText(iframe: HTMLIFrameElement | null): string {
  if (!iframe?.contentWindow) return '';

  try {
    if (typeof iframe.contentWindow.captureGameText === 'function') {
      return iframe.contentWindow.captureGameText() || '';
    }
  } catch (e) { /* 跨域限制 */ }

  // 回退：直接查找消息窗口
  try {
    const body = iframe.contentDocument?.body;
    if (body) {
      const msgWindow = body.querySelector('.Window_Message');
      if (msgWindow) {
        const style = window.getComputedStyle(msgWindow);
        if (style?.display === 'none' || parseFloat(style?.opacity || '1') === 0) return '';
        const text = (msgWindow as HTMLElement).innerText?.replace(/\s+/g, ' ')?.trim() || '';
        return text;
      }
      // 不捕获 body.innerText — 避免 FPS 计数器等 UI 噪声
    }
  } catch (e) { /* 跨域限制 */ }

  return '';
}

// ============================================================================
// 模拟器控制
// ============================================================================

export function shutdownGame(): void {
  try {
    if (vfsInstance) {
      vfsInstance.shutdown();
    }
  } catch (e) {
    console.warn('[emulatorBridge] shutdown error:', e);
  }
  emulatorState.isGameLoaded = false;
  emulatorState.currentGameId = null;
  emulatorState.fileCount = 0;
}

export function getEmulatorState(): EmulatorState {
  return { ...emulatorState };
}

export function getVfsInstance(): any {
  return vfsInstance;
}

export function isEmulatorReady(): boolean {
  return emulatorState.isInitialized && emulatorState.isGameLoaded && vfsInstance !== null;
}

// ============================================================================
// 将 IndexedDB 游戏库条目转换为 UI 需要的 GameEntry 格式
// ============================================================================

export function libraryEntryToGameEntry(entry: LibraryEntry): GameEntry {
  return {
    id: entry.id,
    title: entry.name || '未命名游戏',
    system: 'rpgmz',
    coverUrl: entry.thumbnail || '',
    lastPlayed: entry.lastPlayed ? new Date(entry.lastPlayed).toLocaleDateString() : '未玩过',
    createdAt: entry.addedAt ? new Date(entry.addedAt).toISOString().split('T')[0] : '',
    fileSize: entry.zipSize ? formatSize(entry.zipSize) : '未知',
    totalPlayTime: entry.fileCount ? `${entry.fileCount} 文件` : '—',
    fileName: entry.name,
  };
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ============================================================================
// 拇指图提取（从游戏的 Title 画面截取）
// ============================================================================

export async function extractThumbnail(vfs: any): Promise<string> {
  const titleCandidates = [
    'img/titles1/Title.png_', 'img/titles1/Title.rpgmvp',
    'img/titles1/Title.png', 'img/titles/Title.png'
  ];
  for (const tc of titleCandidates) {
    try {
      let imgData = vfs.decryptFile(tc);
      if (imgData) {
        const blob = new Blob([imgData], { type: 'image/png' });
        return new Promise(r => {
          const reader = new FileReader();
          reader.onload = () => r(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
      imgData = vfs.readRawFile(tc);
      if (imgData) {
        const blob = new Blob([imgData], { type: 'image/png' });
        return new Promise(r => {
          const reader = new FileReader();
          reader.onload = () => r(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) { /* continue */ }
  }
  return '';
}
