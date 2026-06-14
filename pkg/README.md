# rm-wasm-vfs — RPG Maker MZ WASM Virtual File System

基于 Rust WebAssembly 的 RPG Maker MZ H5 游戏全静态网页运行器，实现零内存残留的大文件流畅运行、游戏画面文本秒级提取，以及外部 `.rmmzsave` 存档的无缝导入。

---

## 目录

- [项目结构](#项目结构)
- [环境要求](#环境要求)
- [快速开始（5 分钟）](#快速开始5-分钟)
- [详细编译指南](#详细编译指南)
- [部署方式](#部署方式)
- [准备游戏 Zip 包](#准备游戏-zip-包)
- [完整使用流程](#完整使用流程)
- [离线部署（无 CDN）](#离线部署无-cdn)
- [故障排查](#故障排查)
- [技术架构](#技术架构)
- [核心功能详解](#核心功能详解)
- [依赖说明](#依赖说明)

---

## 项目结构

```
rm-wasm-vfs/
├── Cargo.toml              # Rust 项目配置
├── src/
│   └── lib.rs              # WASM 虚拟文件系统核心（5 个导出函数 + 单元测试）
├── wasm_vfs.js             # ES6 前端驱动类（WasmVFS）
├── index.html              # 沙盒宿主页面（完整 UI + iframe 劫持）
└── README.md               # 本文件
```

编译后新增（由 `wasm-pack build` 生成）：

```
rm-wasm-vfs/
└── pkg/
    ├── rm_wasm_fs.js       # JS ↔ WASM 胶水层（wasm-bindgen 自动生成）
    ├── rm_wasm_fs_bg.wasm  # 编译后的 WASM 二进制
    ├── rm_wasm_fs.d.ts     # TypeScript 类型声明（可选）
    └── package.json        # npm 包元数据
```

---

## 环境要求

### 最低要求

| 组件 | 版本 | 用途 | 检查命令 |
|------|------|------|----------|
| Rust | ≥ 1.70.0 | 编译 WASM | `rustc --version` |
| wasm-pack | ≥ 0.12.0 | WASM 打包工具 | `wasm-pack --version` |
| Node.js（可选） | ≥ 18.0 | npm serve 部署 | `node --version` |
| Python（可选） | ≥ 3.7 | http.server 部署 | `python3 --version` |

### 浏览器要求

| 浏览器 | 最低版本 | 关键特性 |
|--------|----------|----------|
| Chrome / Edge | ≥ 90 | WebAssembly, IndexedDB, blob: URL, srcdoc iframe |
| Firefox | ≥ 88 | 同上 |
| Safari | ≥ 15.4 | 同上（Safari 15.4 修复了 IndexedDB 在 srcdoc iframe 中的 bug） |

> **注意**：不兼容 IE 11 或任何不支持 WebAssembly 的浏览器。

---

## 快速开始（5 分钟）

### 第一步：安装 Rust 和 wasm-pack

```bash
# Windows（推荐使用 Rustup）
# 访问 https://rustup.rs 下载 rustup-init.exe 并安装

# macOS / Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 重启终端后安装 wasm-pack
cargo install wasm-pack
```

### 第二步：编译 WASM

```bash
cd rm-wasm-vfs
wasm-pack build --target web
```

如果一切正常，你将看到：

```
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: ✅  Your wasm pkg is ready to publish at .../pkg
```

### 第三步：启动本地服务器

```bash
# 方式 A：Python（Windows/macOS/Linux 通用）
python3 -m http.server 8080

# 方式 B：Node.js npx（无需安装）
npx serve . -p 8080

# 方式 C：如果你已经安装了 Node.js
npx http-server . -p 8080
```

### 第四步：打开浏览器

在浏览器地址栏输入：

```
http://localhost:8080/index.html
```

此时你应该看到加载界面，WASM 运行时就绪提示显示在顶部状态栏。

---

## 详细编译指南

### Windows 用户

```powershell
# 1. 安装 Visual Studio Build Tools（C++ 构建工具）
#    下载地址：https://visualstudio.microsoft.com/visual-cpp-build-tools/
#    安装时勾选"使用 C++ 的桌面开发"工作负载

# 2. 安装 Rust（PowerShell 管理员模式）
Invoke-WebRequest -Uri https://win.rustup.rs -OutFile rustup-init.exe
.\rustup-init.exe
# 选择 "1) Proceed with installation (default)"

# 3. 安装 wasm target
rustup target add wasm32-unknown-unknown

# 4. 安装 wasm-pack
cargo install wasm-pack

# 5. 编译
cd D:\Desktop\rpgmz\rm-wasm-vfs
wasm-pack build --target web
```

### macOS 用户

```bash
# 1. 安装 Xcode Command Line Tools
xcode-select --install

# 2. 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 3. 安装 wasm target 和 wasm-pack
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# 4. 编译
cd rm-wasm-vfs
wasm-pack build --target web
```

### Linux (Debian/Ubuntu) 用户

```bash
# 1. 安装构建依赖
sudo apt update
sudo apt install -y build-essential pkg-config libssl-dev curl

# 2. 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 3. 安装 wasm target 和 wasm-pack
rustup target add wasm32-unknown-unknown
cargo install wasm-pack

# 4. 编译
cd rm-wasm-vfs
wasm-pack build --target web
```

### 编译选项

```bash
# 开发构建（快速编译，未优化）
wasm-pack build --target web --dev

# 发布构建（体积最小，优化全开）
wasm-pack build --target web --release

# 运行单元测试
wasm-pack test --node

# 查看编译产物体积
ls -lh pkg/rm_wasm_fs_bg.wasm
```

编译产物参考大小：
- Debug 模式：~100–300 KB
- Release 模式：~20–50 KB（含 LTO + strip）

---

## 部署方式

### 方式一：Python http.server（开发推荐）

```bash
cd rm-wasm-vfs
python3 -m http.server 8080 --bind 127.0.0.1
```

- ✅ 零依赖（Python 系统自带）
- ✅ 支持 Range 请求（音频 seek 需要）
- ❌ 无 gzip 压缩

### 方式二：Node.js serve / http-server（生产推荐）

```bash
# 安装
npm install -g serve

# 启动（自动开启 gzip、CORS、SPA fallback）
cd rm-wasm-vfs
serve . -p 8080 --single
```

关键参数说明：
- `-p 8080`：监听端口
- `--single`：所有路径回退到 index.html（SPA 模式）
- `--cors`：允许跨域（如果游戏需要加载外部资源）
- `--no-clipboard`：不自动复制 URL 到剪贴板

### 方式三：Nginx（生产环境）

```nginx
server {
    listen 80;
    server_name game.example.com;

    root /var/www/rm-wasm-vfs;
    index index.html;

    # WASM 文件正确的 MIME 类型
    types {
        application/wasm wasm;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源强缓存
    location ~* \.(wasm|js|png|jpg|ogg|m4a)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 开启 gzip（跳过 .wasm — 它已是二进制压缩格式）
    gzip on;
    gzip_types text/html text/css application/javascript application/json;
    gzip_vary on;
}
```

### 方式四：部署到 GitHub Pages / Vercel / Netlify

**GitHub Pages**：

```bash
# 项目根目录
git init
git add -A
git commit -m "deploy rm-wasm-vfs"

# 推送到 GitHub
git remote add origin git@github.com:USERNAME/rm-wasm-vfs.git
git push -u origin main

# Settings → Pages → Source: main branch, / (root)
```

**Vercel / Netlify**：直接将 `rm-wasm-vfs/` 文件夹拖拽到部署面板，无需额外配置。

### 方式五：Docker

```dockerfile
# Dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```bash
docker build -t rm-wasm-vfs .
docker run -p 8080:80 rm-wasm-vfs
```

---

## 准备游戏 Zip 包

### 方法 A：从已部署的 Web 版打包

RPG Maker MZ 的「文件 → 部署 → Web 浏览器」导出的文件夹即为所需格式：

```
MyGame/
├── index.html
├── package.json
├── css/
│   └── game.css
├── js/
│   ├── main.js
│   ├── rmmz_core.js
│   ├── rmmz_managers.js
│   ├── rmmz_objects.js
│   ├── rmmz_scenes.js
│   ├── rmmz_sprites.js
│   ├── rmmz_windows.js
│   ├── plugins.js
│   ├── libs/
│   │   ├── pixi.js
│   │   ├── pako.min.js
│   │   ├── localforage.min.js
│   │   ├── effekseer.min.js
│   │   ├── effekseer.wasm
│   │   └── vorbisdecoder.js
│   └── plugins/
│       ├── ...
├── data/
│   ├── Actors.json
│   ├── System.json
│   └── ...
├── audio/
│   ├── bgm/
│   ├── bgs/
│   └── se/
├── img/
│   ├── characters/
│   ├── faces/
│   ├── parallaxes/
│   ├── pictures/
│   ├── sv_actors/
│   ├── system/
│   ├── tilesets/
│   └── titles1/
├── fonts/
└── icon/
```

**压缩命令**：

```bash
# Windows（在文件资源管理器中）
# 选中所有文件和文件夹 → 右键 → 发送到 → 压缩(zipped)文件夹

# macOS / Linux
cd MyGame
zip -r ../MyGame.zip ./*
```

### 方法 B：从 NW.js 部署版打包

如果你只有 `.exe` 版本的 NW.js 部署（如本项目的 `Maneater_WIN_1.0.0`）：

```bash
cd Maneater_WIN_1.0.0
# 移除 NW.js 运行时文件（减小体积）
zip -r ../Maneater.zip \
    index.html package.json \
    css/ js/ data/ audio/ img/ fonts/ icon/ \
    credits.html effects/ -x "*.exe" "*.dll" "*.bin" "*.dat" "*.pak"
```

> **说明**：NW.js 专属文件（`.exe`, `.dll`, `.bin`, `.dat`, `.pak`）在浏览器环境中不需要，可以安全排除。务必保留 `index.html`、`package.json`、`css/`、`js/`、`data/`、`audio/`、`img/` 等 Web 资源目录。

### ⚠️ 关键要求

| 检查项 | 说明 |
|--------|------|
| `index.html` 必须在压缩包内 | 系统通过它定位 `basePath` |
| `data/System.json` 必须存在 | 用于提取 `gameId`（存档键名依赖） |
| `js/` 目录必须完整 | 缺少核心脚本游戏无法运行 |
| 确保是 **RPG Maker MZ**（非 MV） | MV 使用不同的存档格式（`.rpgsave`）和脚本结构 |
| 压缩包不要加密 | JSZip 无法处理加密 Zip |

---

## 完整使用流程

### 流程总览

```
加载 WASM 运行时 → 上传 Zip → 游戏启动 → 上传存档（可选）→ 游玩 + 文本提取
```

### 详细步骤

#### 步骤 1：加载 WASM 运行时

打开 `index.html` 后，页面会自动初始化 WASM。顶部状态栏显示：

```
✅ WASM 运行时就绪 — 请加载游戏 Zip 文件
```

若显示错误，请参考 [故障排查](#故障排查)。

#### 步骤 2：加载游戏 Zip

点击工具栏的 **「📦 加载游戏 Zip」** 按钮，选择一个 `.zip` 文件。

或直接将 `.zip` 文件拖拽到游戏区域。

加载过程中你可以看到：
- 状态栏实时显示解压进度：`解压中… 247/1563  img/faces/Actor1.png`
- 底部进度条填充

加载完成后：

```
✅ 已加载 1563 个文件
```

右侧信息面板同步更新：文件数、BasePath、GameId。

#### 步骤 3：导入存档（可选）

如果你有之前的 `.rmmzsave` 存档文件（位于游戏目录的 `save/` 文件夹内）：

1. 点击 **「💾 导入存档」**
2. 选择 `.rmmzsave` 文件（如 `file1.rmmzsave`）
3. 系统自动解析存档中的 `gameId`，写入 to IndexedDB

成功提示：

```
✅ 存档 "file1.rmmzsave" 已导入！刷新存档列表…
```

此时游戏内 **「继续游戏」** 按钮会变为可用。

你也可以在游戏运行过程中随时导入新存档。

#### 步骤 4：游玩 + 文本提取

- **进行游戏**：正常在 iframe 内操作 RPG Maker MZ 游戏
- **提取文本**：当屏幕上出现对话时，点击 **「📝 提取当前文本」**，右侧面板立即显示经转义清洗后的纯文本
- **切换游戏**：重新上传新的 Zip 文件，旧数据自动清除

#### 步骤 5：管理存档

右侧面板「存档管理」区域实时显示当前游戏的所有存档：

- 点击存档旁边的 **「删除」** 按钮可移除单个存档
- 存档数据存储在浏览器的 IndexedDB 中，关闭页面不会丢失

---

## 离线部署（无 CDN）

默认 `index.html` 通过 CDN 引入 `JSZip` 和 `localforage`：

```html
<script src="https://stuk.github.io/jszip/dist/jszip.min.js"></script>
<script src="https://localforage.github.io/localForage/localforage.min.js"></script>
```

要在完全离线的环境中运行，将这些文件下载到本地：

```bash
cd rm-wasm-vfs
mkdir -p libs

# 下载 JSZip
curl -L -o libs/jszip.min.js \
  https://stuk.github.io/jszip/dist/jszip.min.js

# 下载 localforage
curl -L -o libs/localforage.min.js \
  https://localforage.github.io/localForage/localforage.min.js
```

然后修改 `index.html` 中的引用：

```html
<!-- 将 CDN 引用 -->
<script src="https://stuk.github.io/jszip/dist/jszip.min.js"></script>
<script src="https://localforage.github.io/localForage/localforage.min.js"></script>

<!-- 替换为本地引用 -->
<script src="libs/jszip.min.js"></script>
<script src="libs/localforage.min.js"></script>
```

---

## 故障排查

### 问题 1：wasm-pack build 失败

**错误信息**：`error: failed to run custom build command for '...'`

**解决方案**：

```bash
# 确认 wasm target 已安装
rustup target add wasm32-unknown-unknown

# 更新 wasm-pack 到最新版本
cargo install wasm-pack --force

# 清理缓存重试
cargo clean
wasm-pack build --target web
```

### 问题 2：页面打开后状态栏一直显示「正在加载 WASM 运行时…」

**可能原因**：
1. `pkg/` 目录不存在或路径错误
2. 浏览器不支持 WebAssembly

**解决方案**：

```bash
# 确认 pkg/ 存在
ls -la pkg/

# 确认文件结构正确 — pkg/ 必须在 rm-wasm-vfs/ 内
# 正确: rm-wasm-vfs/pkg/rm_wasm_fs.js
# 错误: rm-wasm-vfs/../pkg/rm_wasm_fs.js
```

浏览器控制台（F12）查看具体错误信息。

### 问题 3：上传 Zip 后游戏黑屏 / 白屏

**可能原因**：
1. Zip 内没有 `index.html`
2. `js/main.js` 加载失败
3. 游戏是 RPG Maker MV（非 MZ）版本

**调试方法**：

打开浏览器开发者工具（F12），在 Console 中输入：

```javascript
// 检查 VFS 中是否有文件
await window.__vfs ? console.log('VFS ready') : console.log('VFS not ready');

// 列出 VFS 中的所有文件
window.__vfs && console.log(window.__vfs._findIndexHtml());
```

### 问题 4：存档导入后游戏内看不到

**可能原因**：
1. `gameId` 不匹配
2. 存档文件损坏（不是有效的 pako-deflated 数据）
3. IndexedDB 写入失败

**调试方法**：

```javascript
// 在浏览器 Console 中查看 localforage 中所有的键
localforage.keys().then(keys => console.log('localforage keys:', keys));

// 尝试读取特定存档
localforage.getItem('rmmzsave.mv.file1').then(data => {
    console.log('Save data length:', data ? data.length : 0);
});
```

### 问题 5：音频播放不正常 / 突然中断

**可能原因**：浏览器的自动播放策略阻止了音频

**解决方案**：
1. 确保 iframe 包含 `allow="autoplay"` 属性（已内置）
2. 在游戏中先进行一次鼠标点击交互
3. 检查浏览器音频权限设置

### 问题 6：无法使用 file:// 协议打开

将 `index.html` 直接在文件管理器中双击打开（`file://` URL）将**无法工作**。

必须通过 HTTP 服务器访问，原因：
1. `file://` 协议下 IndexedDB 行为不一致（Chrome 禁用）
2. iframe `srcdoc` 在 `file://` 下受同源策略限制
3. WebAssembly 的 `instantiateStreaming` 需要 HTTP Content-Type 头

### 问题 7：Safari 中 iframe 白屏

Safari 15.4 之前的版本在 `srcdoc` iframe 中使用 IndexedDB 存在 bug。请升级到 Safari ≥ 15.4。

### 收集诊断信息

如果你需要提交 bug，请在浏览器 Console 中运行以下诊断脚本：

```javascript
(async () => {
    const info = {
        userAgent: navigator.userAgent,
        wasmSupported: typeof WebAssembly !== 'undefined',
        indexedDBSupported: !!window.indexedDB,
        vfsInitialized: window.__vfs ? window.__vfs._initialized : false,
        gameLoaded: typeof gameLoaded !== 'undefined' ? gameLoaded : false,
        pkgExists: false,
    };

    try {
        const resp = await fetch('./pkg/rm_wasm_fs.js');
        info.pkgExists = resp.ok;
    } catch(e) {
        info.pkgExists = false;
    }

    console.table(info);
})();
```

---

## 技术架构

```
┌──────────────────────────────────────────┐
│               index.html                 │
│  ┌─────────────┐  ┌───────────────────┐  │
│  │  Toolbar UI  │  │   Side Panel      │  │
│  │  (zip/save)  │  │  (text/save list) │  │
│  └─────────────┘  └───────────────────┘  │
│  ┌──────────────────────────────────────┐ │
│  │            <iframe srcdoc>           │ │
│  │  ┌────────────────────────────────┐  │ │
│  │  │  Sandbox Injection Script     │  │ │
│  │  │  • fetch/XHR 拦截              │  │ │
│  │  │  • img/audio/video src 拦截    │  │ │
│  │  │  • script/link createElement   │  │ │
│  │  │  • captureGameText() API       │  │ │
│  │  │  • StorageManager 存档同步     │  │ │
│  │  └────────────────────────────────┘  │ │
│  │  ┌────────────────────────────────┐  │ │
│  │  │  RPG Maker MZ Game Engine      │  │ │
│  │  │  (scripts from blob: URLs)     │  │ │
│  │  └────────────────────────────────┘  │ │
│  └──────────────────────────────────────┘ │
└──────────────┬───────────────────────────┘
               │  import
┌──────────────▼───────────────────────────┐
│           wasm_vfs.js                    │
│  ┌────────────────────────────────────┐  │
│  │  WasmVFS class                     │  │
│  │  • loadZip() — JSZip → WASM       │  │
│  │  • createResponse() — fetch应答    │  │
│  │  • createMediaUrl() — blob: URLs   │  │
│  │  • injectSaveFile() — 存档注入     │  │
│  │  • getGameCurrentText() — 文本提取 │  │
│  │  • shutdown() — 内存清零           │  │
│  └────────────────────────────────────┘  │
└──────────────┬───────────────────────────┘
               │  import init, { init_fs, ... }
┌──────────────▼───────────────────────────┐
│           Rust WASM (src/lib.rs)         │
│  ┌────────────────────────────────────┐  │
│  │  Mutex<Option<HashMap<K, Vec<u8>>> │  │
│  │  • init_fs()    — 初始化/重置      │  │
│  │  • write_file() — 写入字节流       │  │
│  │  • has_file()   — 高速检索         │  │
│  │  • read_file()  — 克隆读取         │  │
│  │  • clear_fs()   — 强制释放内存     │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## 核心功能详解

### 1. 零内存残留大文件运行

- 游戏所有文件以 `Vec<u8>` 存储在 WASM 线性内存中
- 图片加载到 GPU 纹理后，CPU 侧 `blob:` URL 立即通过 `revokeMediaUrl()` 销毁
- 音频 blob 延后销毁（仅在 `.src` 切换时，防止背景音乐中途断音）
- `shutdown()` 调用 Rust `clear_fs()` 执行 `take() + drop()` 强制释放所有堆内存
- 切换游戏无需刷新页面，旧文件系统的 WASM 内存自动清零

### 2. 游戏画面文本秒级提取

- 注入 `window.captureGameText()` 全局 API
- 调用 `$gameMessage.allText()` 获取原始文本
- 通过 `Window_Base.prototype.convertEscapeCharacters()` 清洗转义字符（`\V[n]` → 变量值、`\N[n]` → 角色名、`\C[n]` → 去除颜色码）
- 回退方案：纯 JS 正则手动清洗所有 RGSS 控制字符
- 父页面点击按钮即返回纯文本，无需任何后端处理

### 3. 外部存档无缝导入

- 解析 `.rmmzsave` 文件（pako-deflated JSON 字符串）
- 自动检测 `data/System.json` 中的 `advanced.gameId`
- 或从现有 localforage 键中推断 gameId
- 直接写入 localforage（IndexedDB），键格式：`rmmzsave.<gameId>.<saveName>`
- StorageManager 被拦截以保持游戏内存档与宿主页面的双向同步
- 支持 `global`、`config`、`file1`–`fileN` 等所有标准存档类型

---

## 依赖说明

### 运行时依赖（CDN 或本地引入）

| 库 | 版本 | 大小 | 用途 |
|----|------|------|------|
| [JSZip](https://stuk.github.io/jszip/) | ≥ 3.10 | ~96 KB (gzip) | Zip 解压，在浏览器内存中处理 |
| [localforage](https://github.com/localForage/localForage) | ≥ 1.10 | ~9 KB (gzip) | IndexedDB 封装，存档读写后端 |

### 编译依赖（仅用于构建）

| Crate | 版本 | 用途 |
|-------|------|------|
| [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen) | 0.2 | Rust ↔ JavaScript 互操作 |

### 游戏引擎内置（来自 RPG Maker MZ 部署）

| 文件 | 用途 |
|------|------|
| `js/libs/pako.min.js` | JSON ↔ deflate 压缩（存档格式） |
| `js/libs/pixi.js` | WebGL 2D 渲染引擎 |
| `js/libs/effekseer.min.js` + `effekseer.wasm` | 粒子特效引擎 |
| `js/libs/vorbisdecoder.js` | OGG Vorbis 音频解码 |

---

## License

MIT
