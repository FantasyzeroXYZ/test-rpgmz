import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { GameEntry, UIState } from "../types";
import {
  Maximize2,
  Settings,
  Play,
  Power,
  Monitor,
  Camera,
  Layout,
  Home,
  FileText,
  StickyNote,
  Lock,
  Unlock,
  Volume2,
  BookOpen,
} from "lucide-react";
import { TextOverlay } from "./TextOverlay";
import { VirtualGamepad } from "./VirtualGamepad";
import { ConfirmModal } from "./ConfirmModal";
// 模拟器桥接服务 — 完整的游戏加载与启动
import { loadAndBootGame, shutdownGame, captureGameText, getEmulatorState } from "../services/emulatorBridge";

// Module-level guard prevents React StrictMode double-mount from triggering
// two VFS loads which would revoke blob URLs mid-script-load.
let _emulatorLoading = false;

// Filter styles mapping
const FILTER_STYLES = {
  none: "",
  sepia: "",
  grayscale: "",
  cool: "",
  warm: "",
};

const TEST_SCREEN_COLORS = {
  none: {
    name: "深幽科技蓝 (Default)",
    bg: "bg-[#0f141d]",
    textColor: "text-cyan-400",
    hex: "#0F141D",
    desc: "Standard Core Viewport Calibration",
  },
  sepia: {
    name: "复古荧光绿 (Matrix)",
    bg: "bg-[#0a2012]",
    textColor: "text-green-500",
    hex: "#0A2012",
    desc: "Analog CRT Phosphor Tube Emulation",
  },
  grayscale: {
    name: "高对比灰度 (Calibration)",
    bg: "bg-[#efefef]",
    textColor: "text-slate-900",
    hex: "#EFEFEF",
    desc: "D65 Reference Broadcast Calibration",
  },
  cool: {
    name: "SMPTE 艳丽蓝 (Colorbars)",
    bg: "bg-[#081b3a]",
    textColor: "text-blue-500",
    hex: "#081B3A",
    desc: "Saturated Digital Blue Signal Gun",
  },
  warm: {
    name: "勃艮第暗红 (Dynamic Range)",
    bg: "bg-[#2f0d11]",
    textColor: "text-red-500",
    hex: "#2F0D11",
    desc: "Deep Burgundy High-Contrast Test Pattern",
  },
};

interface EmulatorViewProps {
  game: GameEntry;
  uiState: UIState;
  setUIState: (state: Partial<UIState>) => void;
  onWordClick?: (word: string) => void;
}

export const EmulatorView: React.FC<EmulatorViewProps> = ({
  game,
  uiState,
  setUIState,
  onWordClick,
}) => {
  const [headerVisible, setHeaderVisible] = React.useState(true);
  const [showRestartConfirm, setShowRestartConfirm] = React.useState(false);
  const [showHomeConfirm, setShowHomeConfirm] = React.useState(false);
  const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // 游戏模拟器状态
  const [gameLoading, setGameLoading] = React.useState(false);
  const [loadProgress, setLoadProgress] = React.useState(0);
  const [loadMessage, setLoadMessage] = React.useState('');
  const [gameText, setGameText] = React.useState('');
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const textPollTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const gameContainerRef = React.useRef<HTMLDivElement | null>(null);

  // 当进入游戏界面时，启动模拟器引擎
  React.useEffect(() => {
    if (!game?.id) return;
    if (_emulatorLoading) return;
    _emulatorLoading = true;
    setGameLoading(true);
    setLoadProgress(0);
    setLoadMessage('正在启动游戏引擎...');

    (async () => {
      const container = gameContainerRef.current || document.getElementById('game-container');
      if (!container) {
        setGameLoading(false);
        return;
      }

      const result = await loadAndBootGame(game.id, container, (pct, msg) => {
        setLoadProgress(pct);
        setLoadMessage(msg);
      }, game.system);

      if (result.success && result.iframe) {
        iframeRef.current = result.iframe;
        setGameLoading(false);

        // 使用 MutationObserver 事件驱动文本更新（不再轮询）
        // 沙箱 IIFE 中的 MutationObserver 在文本变化时发送 postMessage
        const handleGameText = (e: MessageEvent) => {
          if (e.data?.source === 'iframe-game' && e.data?.type === 'game-text') {
            const text = e.data.text;
            if (text && text.trim()) {
              setGameText(text);
              setUIState({ dictionarySentence: text.trim() });
            }
          }
        };
        window.addEventListener('message', handleGameText);
        // 保存引用以便清理
        (iframeRef.current as any).__textHandler = handleGameText;
      } else {
        setGameLoading(false);
        alert('游戏启动失败: ' + (result.error || '未知错误'));
      }
    })();

    // 清理函数：退出时关闭模拟器
    return () => {
      if (iframeRef.current) {
        const handler = (iframeRef.current as any).__textHandler;
        if (handler) window.removeEventListener('message', handler);
      }
      shutdownGame();
      iframeRef.current = null;
    };
  }, [game?.id]);

  const resetHideTimeout = React.useCallback(() => {
    if (uiState.isLocked) {
      setHeaderVisible(true);
      return;
    }
    setHeaderVisible(true);
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    hideTimeoutRef.current = setTimeout(() => {
      setHeaderVisible(false);
    }, 3000);
  }, [uiState.isLocked]);

  React.useEffect(() => {
    if (uiState.isLocked) {
      setHeaderVisible(true);
    } else {
      resetHideTimeout();
    }
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [resetHideTimeout, uiState.isLocked]);

  const isLight = uiState.theme === "light";

  return (
    <div
      className={`w-full h-screen-safe relative overflow-hidden group/emu transition-colors duration-300 ${
        isLight ? "bg-[#f0f4f8]" : "bg-black"
      }`}
      onMouseMove={() => {
        if (headerVisible) {
          resetHideTimeout();
        }
      }}
    >
      {/* Top click area to trigger header reappearance when hidden */}
      {!headerVisible && (
        <div
          className="absolute top-0 left-0 right-0 h-12 z-[55] cursor-pointer pointer-events-auto bg-transparent group/header-trigger"
          onClick={(e) => {
            e.stopPropagation();
            setHeaderVisible(true);
            resetHideTimeout();
          }}
          title="点击显示顶部栏"
        >
          {/* Subtle line indicator on hover so users know they can click */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1.5 rounded-b-full bg-cyan-500/0 group-hover/header-trigger:bg-cyan-500/40 shadow-lg shadow-cyan-500/0 group-hover/header-trigger:shadow-cyan-500/20 transition-all duration-300" />
        </div>
      )}

      {/* Side Panel Triggers */}
      <div
        className="absolute left-0 top-0 bottom-0 w-4 z-[60] cursor-pointer group/left-trigger"
        onMouseEnter={() => !uiState.isLocked && headerVisible && setHeaderVisible(true)}
      >
        <div
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-r-full transition-all group-hover/left-trigger:bg-cyan-500 group-hover/left-trigger:w-2 ${
            isLight ? "bg-slate-400/20" : "bg-white/10"
          } ${uiState.leftPanelOpen ? "hidden" : "block"}`}
        />
        <button
          onClick={() => setUIState({ leftPanelOpen: !uiState.leftPanelOpen })}
          className={`absolute inset-0 opacity-0 group-hover/left-trigger:opacity-100 transition-opacity flex items-center justify-center`}
        />
      </div>

      <div
        className="absolute right-0 top-0 bottom-0 w-4 z-[60] cursor-pointer group/right-trigger"
        onMouseEnter={() => !uiState.isLocked && headerVisible && setHeaderVisible(true)}
      >
        <div
          className={`absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-12 rounded-l-full transition-all group-hover/right-trigger:bg-cyan-500 group-hover/right-trigger:w-2 ${
            isLight ? "bg-slate-400/20" : "bg-white/10"
          } ${uiState.isDictionaryOpen ? "hidden" : "block"}`}
        />
        <button
          onClick={() => setUIState({ isDictionaryOpen: !uiState.isDictionaryOpen })}
          className={`absolute inset-0 opacity-0 group-hover/right-trigger:opacity-100 transition-opacity flex items-center justify-center`}
        />
      </div>

      {/* LAYER 1: Game / Simulation Base Layer (Expanded to Full Screen) */}
      <div
        className="absolute inset-0 z-10 overflow-hidden"
      >
        {/* 游戏 iframe 容器 — 真正的模拟器运行在此处（z-20 确保在测试卡之上） */}
        <div
          id="game-container"
          ref={gameContainerRef}
          className="absolute inset-0 z-20 bg-black flex items-center justify-center"
        >
          {!iframeRef.current && !gameLoading && (
            <p className="text-white/30 text-xs font-mono">等待游戏载入...</p>
          )}
        </div>

        {/* 游戏加载进度覆盖层 */}
        {gameLoading && (
          <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-4">
            <div className="text-cyan-400 text-sm font-black uppercase tracking-widest animate-pulse">
              正在启动模拟引擎
            </div>
            <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-300 rounded-full"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <div className="text-white/50 text-xs font-mono">{loadProgress}%</div>
            {loadMessage && (
              <div className="text-white/30 text-[10px] font-mono max-w-xs text-center truncate">
                {loadMessage}
              </div>
            )}
          </div>
        )}

        {/* Responsive Outer Shell expanded to full dimensions */}
        <div
          className={`w-full h-full flex flex-col relative overflow-hidden transition-all duration-300 pointer-events-none ${
            isLight
              ? "bg-white text-slate-800"
              : "bg-[#05070a] text-white"
          }`}
        >
          {/* Actual Screen Area with Solid Color Test Card */}
          <motion.div
            layout
            className={`w-full h-full flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500`}
            style={{
              backgroundColor: TEST_SCREEN_COLORS[uiState.screenFilter].hex,
            }}
          >
            {/* SOLID COLOR CARD CALIBRATION PATTERNS */}
            {/* Aspect ratio frame corners */}
            <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-white/25 pointer-events-none" />
            <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-white/25 pointer-events-none" />
            <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-white/25 pointer-events-none" />
            <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-white/25 pointer-events-none" />

            {/* Micro grid indicators */}
            <div className="absolute inset-0 pointer-events-none border border-white/5 opacity-10 z-10 flex items-center justify-center">
              <div className="absolute w-[90%] h-[90%] border border-dashed border-white/20" />
              <div className="absolute w-px h-full bg-white/20" />
              <div className="absolute h-px w-full bg-white/20" />
            </div>

            {uiState.showVirtualGamepad && (
              <VirtualGamepad 
                hiddenButtons={uiState.gamepadHiddenButtons} 
                opacity={uiState.gamepadOpacity ?? 100}
                mappings={uiState.gamepadMappings ?? {}}
              />
            )}

            {/* Test Image Information Panel Removed for clean full-screen look as requested */}

            {/* Pause Overlay (Inside Game Container but part of UI logic) */}
            <AnimatePresence>
              {uiState.isPaused && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6"
                >
                  <div className="bg-cyan-500 text-black px-6 py-2 rounded-full font-black italic uppercase text-[10px] mb-8 tracking-[0.3em] flex items-center gap-3 shadow-lg shadow-cyan-500/20">
                    <Play size={10} fill="currentColor" />
                    Simulation Paused
                  </div>

                  <div className="flex flex-col gap-3 w-full max-w-[240px]">
                    <OverlayButton
                      label="继续游玩"
                      onClick={() => setUIState({ isPaused: false })}
                      primary
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* LAYER 2: Floating UI Overlays (POINTER-EVENTS: NONE ROOT) */}
      <div className="absolute inset-0 z-30 ui-overlay-layer flex flex-col justify-between">
        {/* Floating Top Bar - Auto Hiding */}
        <motion.header
          initial={false}
          animate={{
            y: headerVisible ? 0 : -100,
            opacity: headerVisible ? 1 : 0,
          }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
          className={`px-4 md:px-8 py-3 md:py-4 flex items-center justify-between pointer-events-auto shrink-0 gap-2 ${
            isLight
              ? "bg-gradient-to-b from-slate-200/50 via-slate-100/10 to-transparent"
              : "bg-gradient-to-b from-black/80 to-transparent"
          }`}
        >
          <div className="flex items-center gap-2">
            <HeaderAction
              icon={
                uiState.isLocked ? (
                  <Lock
                    size={14}
                    className={isLight ? "text-cyan-600" : "text-cyan-400"}
                  />
                ) : (
                  <Unlock size={14} className="text-slate-500" />
                )
              }
              label=""
              onClick={() => setUIState({ isLocked: !uiState.isLocked })}
              active={uiState.isLocked}
              isIconOnly
              isLight={isLight}
            />
          </div>

          <div className="flex items-center gap-2">
            <HeaderAction
              icon={<Settings size={14} />}
              label="设置栏"
              onClick={() => setUIState({ sidePanelOpen: !uiState.sidePanelOpen, currentSideTab: 'SETTINGS' })}
              isIconOnly
              isLight={isLight}
            />
            <HeaderAction
              icon={<StickyNote size={14} />}
              label="记笔记"
              onClick={() => setUIState({ isNoteEditorOpen: true })}
              isIconOnly
              isLight={isLight}
            />
            <HeaderAction
              icon={<Camera size={14} />}
              label="快照"
              onClick={() => {
                // 使用 Canvas API 捕获当前模拟器画面的快照
                try {
                  const gameArea = document.querySelector('.game-area, [class*="bg-["]') as HTMLElement;
                  if (gameArea) {
                    // 创建离屏 Canvas 并捕获画面
                    const rect = gameArea.getBoundingClientRect();
                    const canvas = document.createElement('canvas');
                    canvas.width = rect.width;
                    canvas.height = rect.height;
                    // 仅支持同源内容的捕获；跨域 iframe 无法捕获
                    const dataUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = `screenshot_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
                    link.href = dataUrl;
                    link.click();
                    alert('快照已保存到本地下载文件夹！');
                  } else {
                    // 使用现代 Screen Capture API（如果可用）
                    alert('快照功能需要游戏画面渲染完成后使用。请确认模拟器已启动并有画面输出。');
                  }
                } catch (e: any) {
                  console.warn('[EmulatorView] 快照捕获失败:', e);
                  alert(`快照生成失败: ${e.message || '浏览器不支持此功能'}`);
                }
              }}
              isIconOnly
              isLight={isLight}
            />
            <HeaderAction
              icon={<Maximize2 size={14} />}
              label="全屏"
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                } else {
                  document.exitFullscreen().catch(() => {});
                }
              }}
              isIconOnly
              isLight={isLight}
            />

            <div
              className={`w-[1px] h-6 mx-1 ${isLight ? "bg-slate-350/50" : "bg-white/10"}`}
            />

            {/* Restart game is now moved immediately to the left of Home button */}
            <HeaderAction
              icon={<Power size={14} />}
              label="重启游戏"
              onClick={() => setShowRestartConfirm(true)}
              danger
              isIconOnly
              isLight={isLight}
            />

            <HeaderAction
              icon={<Home size={14} />}
              label="返回主页"
              onClick={() => setShowHomeConfirm(true)}
              danger
              isIconOnly
              isLight={isLight}
            />
          </div>
        </motion.header>

        {/* Floating Bottom HUD */}
        <div className="pointer-events-none px-4 md:px-10 pb-4 md:pb-6 flex flex-col gap-4">
          {/* Bottom Right Text Overlay Toggle */}
          <div className="flex justify-end pointer-events-auto">
            <button
              onClick={() =>
                setUIState({ textOverlayOpen: !uiState.textOverlayOpen })
              }
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                uiState.textOverlayOpen
                  ? "bg-cyan-500 border-cyan-500 text-black shadow-lg shadow-cyan-500/20"
                  : isLight
                    ? "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm"
                    : "bg-white/5 border-white/5 text-slate-500 hover:text-white"
              }`}
              title="剧情文本"
            >
              <FileText size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* LAYER 3: Side Panel (High Z-Index) moved to root in App.tsx */}

      {/* LAYER 4: Dynamic Overlays (e.g., Subtitles/Text) */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-40 flex flex-col items-center">
        <TextOverlay
          isOpen={uiState.textOverlayOpen}
          onToggle={() =>
            setUIState({ textOverlayOpen: !uiState.textOverlayOpen })
          }
          opacity={uiState.textOverlayOpacity}
          fontSize={uiState.textOverlayFontSize}
          autoUpdate={uiState.autoUpdateText}
          onToggleAuto={() =>
            setUIState({ autoUpdateText: !uiState.autoUpdateText })
          }
          showTranslation={uiState.showTranslation}
          autoTranslate={uiState.autoTranslate}
          text={gameText}
          theme={uiState.theme}
          tokenizerMethod={uiState.tokenizerMethod}
          textSelectableMode={uiState.lookupMode === 'yomitan' ? 'selectable' : 'clickable'}
          isDictionaryOpen={uiState.isDictionaryOpen}
          onToggleDictionary={() =>
            setUIState({ isDictionaryOpen: !uiState.isDictionaryOpen })
          }
          onWordClick={onWordClick}
          autoCopyToClipboard={uiState.autoCopyToClipboard}
          onToggleClipboard={() =>
            setUIState({ autoCopyToClipboard: !uiState.autoCopyToClipboard })
          }
          lookupMode={uiState.lookupMode}
          onToggleLookupMode={() =>
            setUIState({ lookupMode: uiState.lookupMode === 'yomitan' ? 'click' : 'yomitan' })
          }
          lemmatizationEnabled={uiState.lemmatizationEnabled}
          onToggleLemmatization={() =>
            setUIState({ lemmatizationEnabled: !uiState.lemmatizationEnabled })
          }
          ttsEnabled={uiState.ttsEnabled}
          ttsAutoPlay={uiState.ttsAutoPlay}
          onToggleTtsAutoPlay={() =>
            setUIState({ ttsAutoPlay: !uiState.ttsAutoPlay })
          }
          ttsVoice={uiState.ttsVoice}
          ttsSpeed={uiState.ttsSpeed}
          ttsPitch={uiState.ttsPitch}
          ttsVolume={uiState.ttsVolume}
          showHistory={uiState.showHistory}
          onHistoryClick={() => alert("剧情对话历史记录管理系统已载入。此处可管理以往全部对话缓存数据。")}
        />
      </div>

      {/* Restart Game confirmation modal overlay */}
      <ConfirmModal
        isOpen={showRestartConfirm}
        title="确认重启游戏"
        message="确认要重启当前的模拟运行引擎吗？这将会使系统重置到初始加载状态，您所有未保存的测试动作与场景缓存都将丢失。"
        confirmText="确认重启"
        cancelText="取消"
        onConfirm={() => {
          setShowRestartConfirm(false);
          // 清理当前游戏资源
          shutdownGame();
          alert("模拟核心成功复位！请重新加载游戏文件以继续游玩。");
        }}
        onCancel={() => setShowRestartConfirm(false)}
        theme={uiState.theme}
      />

      {/* Exit to Home confirmation modal overlay */}
      <ConfirmModal
        isOpen={showHomeConfirm}
        title="退出模拟返回大厅"
        message="确认要退出当前运行中的测试游戏并返回主配置面板吗？系统将会保存您的模拟器挂载上下文。"
        confirmText="返回主页"
        cancelText="留在这里"
        onConfirm={() => {
          setShowHomeConfirm(false);
          (window as any).postMessage({ type: "NAV_HOME" }, "*");
        }}
        onCancel={() => setShowHomeConfirm(false)}
        theme={uiState.theme}
      />
    </div>
  );
};

const HeaderAction = ({
  icon,
  label,
  onClick,
  active,
  isIconOnly,
  danger,
  isLight,
}: {
  icon: any;
  label: string;
  onClick?: () => void;
  active?: boolean;
  isIconOnly?: boolean;
  danger?: boolean;
  isLight?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border ${
      active
        ? "bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/20"
        : danger
          ? isLight
            ? "bg-red-50 hover:bg-red-500 hover:text-white border-red-200 text-red-600"
            : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
          : isLight
            ? "bg-white border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-50 hover:border-slate-350 shadow-sm"
            : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
    }`}
    title={label}
  >
    {icon}
    {!isIconOnly && <span className="hidden sm:inline">{label}</span>}
  </button>
);

const OverlayButton = ({
  label,
  onClick,
  primary,
  danger,
  isLight,
}: {
  label: string;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  isLight?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`w-full group rounded-2xl py-3.5 md:py-4 flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-widest transition-all shadow-xl border ${
      primary
        ? isLight
          ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
          : "bg-white text-black border-white hover:bg-slate-200"
        : danger
          ? isLight
            ? "bg-red-50 border-red-200 text-red-500 hover:bg-red-100"
            : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20"
          : isLight
            ? "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
            : "bg-white/5 border-white/10 text-white hover:bg-white hover:text-black"
    }`}
  >
    {label}
  </button>
);

const ControlInfo = ({
  label,
  action,
  isLight,
}: {
  label: string;
  action: string;
  isLight?: boolean;
}) => (
  <div className="flex items-center gap-2">
    <span
      className={`border px-1.5 py-0.5 rounded font-mono text-[9px] font-black ${
        isLight
          ? "bg-slate-100 border-slate-200 text-cyan-600"
          : "bg-slate-800 border-white/10 text-cyan-400"
      }`}
    >
      {label}
    </span>
    <span
      className={`text-[9px] font-bold uppercase tracking-widest ${
        isLight ? "text-slate-500" : "text-slate-650"
      }`}
    >
      {action}
    </span>
  </div>
);

const FooterIconButton = ({
  icon,
  onClick,
  title,
  active,
  isLight,
}: {
  icon: any;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  isLight?: boolean;
}) => (
  <button
    onClick={onClick}
    title={title}
    className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all border active:scale-95 ${
      active
        ? "bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/20"
        : isLight
          ? "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
    }`}
  >
    {icon}
  </button>
);
