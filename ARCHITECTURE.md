# RPGMZ Player Pro — 游戏解析运行逻辑说明

## 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                     父页面 (Parent Window)                    │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  WasmVFS 实例 (wasm_vfs.js + WASM VFS)                │   │
│  │  ├─ init_fs() / write_file() / read_file()            │   │
│  │  ├─ read_file_decrypted()  ← Rust 侧 16 字节 XOR 解密  │   │
│  │  ├─ createMediaUrl()       ← Blob URL 创建            │   │
│  │  ├─ _resolvePath()        ← 路径模糊匹配               │   │
│  │  └─ loadZip()             ← ZIP 加载 + 自动解密流程    │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  GameLibrary (IndexedDB)                               │   │
│  │  存储导入的游戏 ZIP + 元数据 (加密密钥、缩略图等)        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  iframe (沙箱 / 子窗口)                                 │   │
│  │  ├─ 沙箱拦截器 (fetch / XHR / Image.src / Audio.src)   │   │
│  │  ├─ Utils/Decrypter 方法覆盖 (禁用引擎双重解密)          │   │
│  │  ├─ data: URL 本地创建 (避免跨上下文 Blob URL 问题)      │   │
│  │  └─ 游戏引擎 (rmmz_core.js / SceneManager)             │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## 游戏加载流程

### 1. ZIP 导入

```
用户上传 ZIP → vfs.loadZip(file, onProgress, preKey)
  ├─ shutdown() → 清空 VFS
  ├─ JSZip.loadAsync() → 解压 ZIP
  ├─ NW.js 运行时文件过滤 (nw.dll, .exe, .pak 等)
  ├─ 逐文件写入 WASM VFS: write_file(path, data)
  ├─ _detectBasePath() → 自动检测游戏目录深度
  ├─ _detectGameId() → 读取 data/System.json 提取 gameId + 密钥
  ├─ _deriveEncryptionKey() → 从加密 PNG 推导密钥 (已有密钥则跳过)
  └─ _patchSystemJson() → 修正 System.json (详见下方)
```

### 2. System.json 修正

`_patchSystemJson()` 在加载时修正 `data/System.json` 的内容:

| 字段 | 原始值 | 修正后 | 原因 |
|------|--------|--------|------|
| `hasEncryptedImages` | `true` | `true` (保持不变) | 引擎正常加载 |
| `hasEncryptedAudio` | `true` | `true` (保持不变) | 引擎正常加载 |
| `encryptionKey` | 原始密钥 | 已知正确密钥 | 确保解密可用 |

注: 沙箱会在运行时覆盖 `Utils.hasEncryptedImages()` 返回 `false`。

### 3. 启动游戏

```
bootGame()
  ├─ vfs.getIndexHtml() → 读取游戏 index.html
  ├─ buildSandboxDocument(html) → 重写 HTML
  │   ├─ <script src> → Blob URL (保持 document.currentScript.src 兼容)
  │   ├─ <link href> → 内联 <style> (仅 rel="stylesheet")
  │   ├─ <base href> 注入
  │   └─ 沙箱脚本注入 (最新版本)
  ├─ iframe.srcdoc = 重写后的 HTML
  └─ 沙箱 IIFE 自动执行
```

## 加密游戏资源加载

### RPG Maker MZ 加密格式

```
┌─────────────┬──────────────────────────────────────────┐
│ RPGMV 头    │ 16 字节: 52 50 47 4D 56 00 ... 00 03 01 │
├─────────────┼──────────────────────────────────────────┤
│ 文件体      │ body[0..16]  ← XOR 加密 (16 字节密钥)   │
│             │ body[16..]   ← 明文                      │
└─────────────┴──────────────────────────────────────────┘
```

- 加密覆盖：图片文件 (`.png_`, `.jpg_`, `.rpgmvp`) 和音频文件 (`.ogg_`, `.m4a_`, `.rpgmvo`)
- 解密方式: 去除 16 字节 RPGMV 头，文件体**前 16 字节** XOR 16 字节密钥
- 文件体 16 字节之后为**明文**，不加密

### WASM 侧解密 (Rust)

`read_file_decrypted(path, hex_key)` 函数:

1. 从 VFS HashMap 读取文件字节
2. 检查前 16 字节是否为 RPGMV 头 (`52 50 47 4D 56 ...`)
3. 如果是加密文件：
   - 去除 16 字节头
   - 仅 XOR 解密 body[0..16]（匹配引擎行为）
   - 返回干净的 `Vec<u8>`
4. 如果不是加密文件，直接返回原始数据

### 沙箱拦截器 (iframe 内)

#### Utils 方法覆盖

沙箱 IIFE 使用 `setInterval` 轮询等待 `Utils` 对象就绪，然后覆盖：

| 原始方法 | 沙箱覆盖 | 原因 |
|---------|---------|------|
| `Utils.hasEncryptedImages()` | 返回 `false` | 引擎使用 Image.src 路径 |
| `Utils.hasEncryptedAudio()` | 返回 `false` | 引擎使用 Fetch/XHR 路径 |
| `Utils.decryptArrayBuffer()` | 返回原值 (无操作) | VFS 已解密，防双重解密 |
| `Utils.setEncryptionInfo()` | 强制 `_hasEncryptedImages=false` | 防引擎自动解密 |
| `Utils.isNwjs()` | 返回 `false` | 禁用 NW.js 特定逻辑 |

#### 图片加载路径

```
Engine: Bitmap._startLoading()
  → hasEncryptedImages() = false
  → this._image.src = this._url  (如 "img/system/ButtonSet.png")
  ↓
沙箱 Image.src 拦截器:
  → normalizePath("img/system/ButtonSet.png")
  → fileExists? NO
  → try "ButtonSet.png_" → YES
  → vfs.readRawFile("img/system/ButtonSet.png_")
    → _readFileData() → read_file_decrypted() → Rust 解密
  → 返回解密后的 PNG 字节 (Uint8Array)
  → btoa() 转换为 data:image/png;base64,...
  → _set.call(this, dataUrl)   ← 在 iframe 内创建 data URL
  → 图片正常加载 ✅
```

**关键**: data URL 在 iframe **本地**创建，避免跨上下文 Blob URL 访问限制。

#### XHR 加载路径 (音频 / 数据文件)

```
Engine: WebAudio._startLoading()
  → hasEncryptedAudio() = false
  → fetch(url) / XHR.open(url)
  ↓
沙箱拦截器:
  → normalizePath(url)
  → 尝试 url → url + "_" → url.rpgmvo 等变体
  → vfs.readRawFile() → 解密数据
  → 创建 Response / 设置 XHR 响应
  → 引擎正常处理 ✅
```

#### Fetch 拦截器 (脚本 / 字体 / CSS)

同样通过 `vfs.readRawFile()` → 解密数据 → `new Response()` 返回。

## 非加密游戏资源加载

非加密游戏不受任何影响：

- `_readFileData()` 调用 `read_file_decrypted()` → Rust 检查无 RPGMV 头 → 直接返回原始数据
- `read_file_decrypted` 对非加密文件是透传 (`Some(data.clone())`)
- 沙箱的 Utils 覆盖对无加密引擎无影响
- 所有拦截器在找不到加密变体时回退到原始请求

## 路径解析

`_resolvePath(path)` 按以下顺序查找：

1. **精确匹配**: VFS 中是否直接存在该路径
2. **basePath 前缀**: 加上 `_basePath/` 前缀重试（用于嵌套 ZIP 结构）
3. **模糊匹配**: 大小写不敏感 → 仅文件名匹配
4. **加密变体**: 追加 `_` 后缀 → 替换 `.png` → `.rpgmvp` 等

## 加密密钥

加密密钥来源优先级：

1. **System.json**: 读取 `data/System.json` 中的 `encryptionKey` 字段
2. **自动推导**: 从加密 PNG 前 32 字节 XOR PNG 签名 => 密钥
3. **手动设置**: 用户在游戏库界面手动输入 32 字符 hex 密钥

## ZIP 结构处理

### 目录自动检测 (`_detectBasePath`)

支持多种 ZIP 结构:

| ZIP 结构 | 检测结果 | 示例 |
|---------|---------|------|
| 根目录直接放游戏文件 | basePath = `""` | MZ 直接导出 |
| 单层包裹目录 | basePath = 目录名 | `MyGame/` |
| NW.js 包裹 | basePath = `www` | `MyGame/www/index.html` |
| package.json main | basePath = main 目录 | `package.json` → `"main": "www/index.html"` |

### NW.js 文件过滤

自动跳过以下无用文件以节省存储:

- `nw.dll`, `node.dll`, `ffmpeg.dll`, `libEGL.dll`, `libGLESv2.dll`
- `d3dcompiler_47.dll`, `nw_elf.dll`
- `Game.exe`, `nw.exe`, `notification_helper.exe`
- `nw_100_percent.pak`, `nw_200_percent.pak`, `resources.pak`
- `icudtl.dat`, `v8_context_snapshot.bin`, `debug.log`
- `locales/`, `swiftshader/` 目录

## 已知扩展名映射

```
.rpgmvp → image/png      .png_ → image/png
.rpgmvo → audio/ogg      .ogg_ → audio/ogg
.jpg_   → image/jpeg      .m4a_ → audio/mp4
.jpeg_  → image/jpeg
```

## Blob / Data URL 策略

| 资源类型 | URL 类型 | 创建位置 | 原因 |
|---------|---------|---------|------|
| 加密图片 | `data:image/...` | iframe 内 | 避免跨上下文 Blob URL 不兼容 |
| 加密音频 | Response (XHR/Fetch) | iframe 内 | 通过拦截器直接返回数据 |
| 非加密图片 | `blob:http://...` | 父页面 | 性能更好，大文件适用 |
| 脚本/样式/CSS | `blob:http://...` | 父页面 | 传统方式，兼容性好 |

## WASM (Rust) 函数

| 函数 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `init_fs()` | 无 | 无 | 初始化/重置 VFS |
| `write_file(path, data)` | 字符串路径, Uint8Array | 无 | 写入文件 |
| `read_file(path)` | 字符串路径 | `Uint8Array | null` | 读取原始字节 |
| `read_file_decrypted(path, hex_key)` | 路径, 32 字符 hex 密钥 | `Uint8Array | null` | 读取 + Rust 解密 (16 字节 XOR) |
| `has_file(path)` | 字符串路径 | `boolean` | 检查文件存在 |
| `clear_fs()` | 无 | 无 | 清空 VFS |
| `file_count()` | 无 | `number` | 文件数量 |
| `list_paths()` | 无 | `string[]` | 列出所有路径 |
