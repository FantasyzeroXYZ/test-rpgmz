# rm-wasm-vfs — RPG Maker MV/MZ Browser Runner

基于 Rust WebAssembly 的 RPG Maker MV/MZ H5 游戏全静态网页运行器，支持游戏库管理、存档导入导出、剧情文本提取、生词本、截图、蓝牙手柄、虚拟手柄等功能。

---

## 快速开始

```bash
git clone https://github.com/你的用户名/rm-wasm-vfs.git   # ⬅️ 改这里
cd rm-wasm-vfs
npm run dev
```

浏览器打开 `http://127.0.0.1:8080/index.html`。

---

## GitHub Pages 部署

### 一键部署

1. Fork 或 Push 本项目到你的 GitHub 仓库
2. GitHub 仓库 → **Settings** → **Pages**
3. Source 选择 **GitHub Actions**
4. Push 代码到 `main` 或 `master` 分支，自动触发部署
5. 部署完成后访问 `https://你的用户名.github.io/rm-wasm-vfs/`  <!-- ⬅️ 改这里 -->

### 需要修改的地方

| 位置 | 当前值 | 需要改成 |
|------|--------|---------|
| **README.md** 本文件 | `你的用户名` | 你的 GitHub 用户名 |
| **README.md** 本文件 | `rm-wasm-vfs` | 你的仓库名（如果不同） |
| **GitHub 仓库 Settings → Pages** | — | Source: GitHub Actions |

> 其他无需修改。`<base href>` 自动使用 `window.location.origin` 适配任意域名。

### 离线部署 / 静态服务器

项目是纯静态文件，编译好的 WASM 已内置。放在任意 HTTP 服务器根目录即可：

```bash
# Nginx
cp -r rm-wasm-vfs /var/www/
# Apache
cp -r rm-wasm-vfs /var/www/html/
# 或直接用 npm run dev
```

---

## 本地开发

### 安装 Rust + wasm-pack

修改 `src/lib.rs` 后重新编译 WASM：

```bash
cargo install wasm-pack
cd rm-wasm-vfs
wasm-pack build --target web
# 产出: pkg/rm_wasm_vfs.js + pkg/rm_wasm_vfs_bg.wasm
```

### 文件结构

```
rm-wasm-vfs/
├── index.html              # 主页面（全部 UI + 沙盒拦截）
├── wasm_vfs.js             # WasmVFS 驱动类
├── pkg/                    # WASM 编译产物（wasm-pack build 生成）
│   ├── rm_wasm_vfs.js
│   └── rm_wasm_vfs_bg.wasm
├── libs/                   # 离线 CDN 依赖
│   ├── jszip.min.js
│   └── localforage.min.js
├── fonts/                  # 字体文件（游戏提取）
├── Cargo.toml              # Rust 项目配置
├── src/lib.rs              # Rust WASM 源码
├── package.json            # npm scripts
├── .github/workflows/      # GitHub Actions 自动部署
└── .gitignore
```

---

## 功能

- 游戏库管理（IndexedDB 持久存储，九宫格/列表视图）
- 支持 RPG Maker MV 和 MZ（自动检测）
- NW.js 加密部署版自动解密
- 存档导入/导出/删除（MZ: localforage, MV: localStorage）
- 剧情文本提取（手动/自动，事件驱动无轮询）
- 浮动文本面板 + 对话历史
- 生词本 + Google Translate 翻译 + CSV 导出
- Anki 制卡（AnkiConnect API）
- Yomitan 词典导入查词
- 截图（WebGL PIXI 提取 + 预览/保存/设为封面）
- 蓝牙手柄支持（Gamepad API）
- 虚拟触屏手柄（移动端横竖屏自适应）
- 浏览器 TTS 语音朗读（发音人选择）
- 全屏模式 + 工具栏自动隐藏
- 响应式布局（桌面/平板/手机）
- GitHub Pages 一键部署

## License

MIT
