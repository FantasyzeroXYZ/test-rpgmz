# 剧情模拟器词典系统 - 技术架构与开发全量指南

本文档提供“剧情模拟器与多语言学习系统”的完整技术规格说明，涵盖从底层状态管理到高层 UI 交互的全量逻辑，旨在指导后续开发者进行功能扩充或生产环境接入。

---

## 1. 系统概览 (System Overview)

本系统是一个基于 **React 18 + Vite + Tailwind CSS** 构建的高性能单页应用 (SPA)。其核心定位是一个集成了“剧情播放”、“实时划词”、“多源词典检索”及“学习进度同步”的综合工作台。

### 核心技术栈
- **框架**: React (Functional Components)
- **状态管理**: 级联状态提升 (State Lifting) + 原子化 UIState 接口。
- **动画**: Framer Motion (motion/react)。
- **样式**: Tailwind CSS (JIT 引擎)。
- **查词接口**: Free Dictionary API (v2)。

---

## 2. 全局状态管理 (`uiState`)

项目的灵魂位于 `/src/types.ts` 定义的 `UIState` 接口。整个应用的运行由 `App.tsx` 中的 `uiState` 驱动。

### 关键配置项说明
| 配置项 | 类型 | 说明 |
| :--- | :--- | :--- |
| `lookupMode` | `click` \| `yomitan` | **click**: 极速智能分词；**yomitan**: 浏览器扩展兼容。 |
| `clickLookupSource` | `local` \| `api` \| `all` | 查词时搜索来源的优先级设定。 |
| `segmentationMode` | `none` \| `browser` \| `space` \| `char` | 控制剧情文本如何被切分为可点击的单元。 |
| `lemmatizationEnabled` | `boolean` | 是否开启单词原型还原（如 `studying` -> `study`）。 |
| `autoCopyToClipboard` | `boolean` | 查词成功后是否自动写入系统剪贴板。 |

---

## 3. 词典查词链路 (Lookup Workflow)

系统的查词逻辑是高度异步且支持多路并行的。

### 3.1 核心处理器：`handleWordLookup`
位于 `App.tsx`。当用户在 `EmulatorView` 或侧边栏手动搜索时被调用。

1. **预处理**: 对输入字符串进行正则清洗（去除标点）、转小写及两端去空格。
2. **分支判断**: 根据 `uiState.clickLookupSource` 决定执行路径：
   - **Local Only**: 仅查询 `/src/components/DictionarySidebar.tsx` 中的 `OFFLINE_DICTIONARY`。
   - **API Only**: 调用 `fetch` 请求 `dictionaryapi.dev`。
   - **All (Dual)**: **并发执行**。先展示本地结果并进入 Loading 状态，待 API 返回后通过字符串拼接合并内容。
3. **渲染触发**: 更新 `lookupResult` 并将 `isLookupCardOpen` 置为 `true`。

### 3.2 悬浮卡片展示 (`FloatingLookupCard`)
- 自动识别 `definition` 中的预设标识符（如 `【Yomitan 本地词典】`）。
- 若检测到多源标识，卡片会动态渲染为 **双栏/多块布局**，并配以不同的视觉强调（如本地源使用 `cyan` 边框，API源使用 `pulse` 呼吸灯动画）。

---

## 4. 词典系统与高级管理

### 4.1 本地词典库 (`OFFLINE_DICTIONARY`)
目前硬编码在 `DictionarySidebar.tsx` 中。
- **扩展方式**: 开发者可以直接在 `OFFLINE_DICTIONARY` 对象中通过 Key-Value 形式追加常备词条。
- **数据结构**: `Record<string, string>`，Value 支持 `\n` 换行。

### 4.2 词典管理器 (`DictionaryManager`)
位于侧边栏底部的第二个折叠面板（默认折叠）：
- **排序**: 支持通过 `GripVertical` 图标拖拽（逻辑上通过 `order` 字段重新分配）调整词典优先级。
- **过滤**: 支持按语言 (Japanese/English) 或类型 (TAG/MEANING) 进行界面过滤。

### 4.3 还原规则 (Lemmatization Rules)
支持外部规则 JSON 导入。
- **逻辑**: 当 `lemmatizationEnabled` 为真，系统在查词前会遍历 `lemmatizationExternalRules`。
- **生产接入**: 建议接入 `WASM` 版本的形态分析器以实现语素级拆解。

---

## 5. 剧情互动与模拟器视图 (`EmulatorView`)

这是系统最大的交互入口：
- **`TextOverlay`**: 实际上是一个透明/半透明的交互层，覆盖在模拟器画面上。
- **分词逻辑**: 
  - `clickable`: 将文本按 `tokenizerMethod` 拆分为多个列表项（`span` 或 `button`）。
  - 每个组件绑定 `onWordClick` 回调，直接透传选中的原始文本。

---

## 6. 生词本与 Anki 同步 (`ANKI_SYNC`)

### 6.1 生词捕获
在查词卡片中点击“添加生词”，会将 `lookupWord` 和 `definition` 封装为 `VocabWord` 对象存入 `uiState.vocab`。

### 6.2 Anki 数据方案
同步时会读取 `uiState` 下的一系列 `ankiField*` 配置（如 `ankiFieldFront`, `ankiFieldBack`）。
- **同步模型**: 默认支持 WORD (单词), SENTENCE (句子), NOTE (笔记) 三种 Scheme。
- **接口位置**: `App.tsx` 中的 `handleAddToAnki`。

---

## 7. 开发调试与临时内容说明 (Crucial!)

**注意：下述模块目前包含 Mock/临时逻辑，上线前需按需替换。**

| 模块 | 位置 | 临时实现方案 | 生产建议 |
| :--- | :--- | :--- | :--- |
| **持久化存储** | `App.tsx` | 内存状态，刷新即消失 | 接入 `Firebase Firestore` 或 `localStorage` |
| **Anki 接口** | `handleAddToAnki` | 仅输出 `console.log` 和弹窗 | 异步请求 `AnkiConnect` (HTTP POST) |
| **API 词典** | `handleWordLookup` | 免费公用接口，无频次保障 | 接入企业级翻译 API (如 DeepL, Google Cloud) |
| **用户脚本** | `tampermonkey` | 仅展示面板占位 | 完善 `window.postMessage` 安全握手协议 |
| **生词本数据** | `mockData.ts` | 预定义的死数据 | 实时从数据库拉取真正的用户词库 |

---

## 8. 文档维护建议

1. **样式更改**: 统一在 `Tailwind` 框架下修改，避免直接操作内联样式。
2. **新增图标**: 必须从 `lucide-react` 引用。
3. **动画调节**: 全局受控于 `framer-motion`，如需调整卡片弹出速度，请修改 `transition={{ duration: ... }}` 参数。

---
*文档版本: 2.0 (全量技术规格版)*
*开发者: AI Studio Build Agent*
*最后更新日期: 2026-06-21*
