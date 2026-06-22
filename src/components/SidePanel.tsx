import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Settings,
  Database,
  Book,
  Monitor,
  Volume2,
  Save,
  Download,
  Trash2,
  Search,
  ExternalLink,
  GraduationCap,
  Languages,
  Mic2,
  Gamepad2,
  FileText,
  Camera,
  Upload,
  List,
  Link,
  Edit2,
  ChevronDown,
  Image,
  VolumeX,
  Play,
  StickyNote,
  Sun,
  Moon,
  RefreshCw,
  Layers,
  GripVertical,
  Plus,
  BookOpen,
} from "lucide-react";
import { UIState, AppStage, DictionaryEntry } from "../types";
import { MOCK_SAVES, MOCK_VOCAB, MOCK_SCREENSHOTS } from "../mockData";
// OCR 服务 — 使用 Tesseract.js 进行实时光学字符识别
import { recognizeImage, OCRProgress } from "../services/ocrService";
// 日语分词服务
import { isJapaneseTokenizerReady } from "../services/tokenizerService";
// 数据持久化
import { exportAllDataAsJSON } from "../services/storageService";

interface PanelProps {
  isOpen: boolean;
  uiState: UIState;
  onClose: () => void;
  setUIState: (state: Partial<UIState>) => void;
}

export const LeftPanel: React.FC<PanelProps> = ({
  isOpen,
  uiState,
  onClose,
  setUIState,
}) => {
  const isLight = uiState.theme === "light";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="left-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden pointer-events-auto"
          />

          <motion.aside
            key="left-panel-aside"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`fixed lg:absolute left-0 top-0 bottom-0 z-50 w-full sm:w-[400px] lg:w-[380px] ${
              isLight
                ? "bg-white border-r border-slate-200 text-slate-800 shadow-2xl"
                : "bg-[#05070a]/98 border-r border-white/5 text-white"
            } backdrop-blur-3xl flex flex-col h-full overflow-hidden`}
          >
            {/* Navigation Tabs */}
            <div
              className={`flex items-center border-b pl-2 pr-1 pt-1 ${isLight ? "border-slate-200 bg-slate-50/50" : "border-white/5 bg-white/[0.01]"}`}
            >
              <div className="flex-1 flex gap-1">
                <TabItem
                  active={uiState.currentLeftTab === "SAVES"}
                  onClick={() => setUIState({ currentLeftTab: "SAVES" })}
                  icon={<Database size={18} />}
                  label="存档"
                  isLight={isLight}
                />
                <TabItem
                  active={uiState.currentLeftTab === "SCREENSHOTS"}
                  onClick={() => setUIState({ currentLeftTab: "SCREENSHOTS" })}
                  icon={<Camera size={18} />}
                  label="截图"
                  isLight={isLight}
                />
                <TabItem
                  active={uiState.currentLeftTab === "NOTES"}
                  onClick={() => setUIState({ currentLeftTab: "NOTES" })}
                  icon={<StickyNote size={18} />}
                  label="随笔"
                  isLight={isLight}
                />
              </div>
              <button
                onClick={onClose}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                  isLight
                    ? "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    : "text-slate-500 hover:text-white hover:bg-white/5"
                }`}
                title="关闭"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {uiState.currentLeftTab === "SAVES" && (
                <SaveList uiState={uiState} setUIState={setUIState} />
              )}
              {uiState.currentLeftTab === "SCREENSHOTS" && (
                <ScreenshotList uiState={uiState} />
              )}
              {uiState.currentLeftTab === "NOTES" && (
                <NoteList uiState={uiState} setUIState={setUIState} />
              )}
            </div>

            {/* Footer */}
            <div
              className={`p-4 border-t ${isLight ? "border-slate-150 bg-slate-50/50" : "border-white/5 bg-white/[0.02]"}`}
            >
              <div className="flex justify-between items-center opacity-30">
                <span
                  className={`text-[8px] font-black uppercase tracking-[0.3em] ${isLight ? "text-slate-700" : "text-slate-300"}`}
                >
                  Build.0.45.2-Alpha
                </span>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

interface SidePanelProps extends PanelProps {
  currentStage: AppStage;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  isOpen,
  uiState,
  currentStage,
  onClose,
  setUIState,
}) => {
  const isLight = uiState.theme === "light";
  const showSavesTab = currentStage === "PLAYING";

  React.useEffect(() => {
    if (!showSavesTab && uiState.currentSideTab === "SAVES") {
      setUIState({ currentSideTab: "SETTINGS" });
    }
  }, [showSavesTab, uiState.currentSideTab, setUIState]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="right-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden pointer-events-auto"
          />

          <motion.aside
            key="right-panel-aside"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`
              fixed lg:absolute right-0 top-0 bottom-0 z-50
              w-full sm:w-[400px] lg:w-[380px] 
              ${isLight ? "bg-white border-l border-slate-200 text-slate-800 shadow-2xl" : "bg-[#05070a]/98 border-l border-white/5 text-white"}
              backdrop-blur-3xl 
              flex flex-col shadow-2xl h-full overflow-hidden
            `}
          >
            {/* Navigation Tabs */}
            <div
              className={`flex items-center border-b pl-2 pr-1 pt-1 ${isLight ? "border-slate-200 bg-slate-50/50" : "border-white/5 bg-white/[0.01]"}`}
            >
              <div className="flex-1 flex gap-1">
                <TabItem
                  active={uiState.currentSideTab === "SETTINGS"}
                  onClick={() => setUIState({ currentSideTab: "SETTINGS" })}
                  icon={<Settings size={18} />}
                  label="系统"
                  isLight={isLight}
                />
                <TabItem
                  active={uiState.currentSideTab === "ANKI"}
                  onClick={() => setUIState({ currentSideTab: "ANKI" })}
                  icon={<GraduationCap size={18} />}
                  label="Anki"
                  isLight={isLight}
                />
                <TabItem
                  active={uiState.currentSideTab === "GAMEPAD"}
                  onClick={() => setUIState({ currentSideTab: "GAMEPAD" })}
                  icon={<Gamepad2 size={18} />}
                  label="手柄"
                  isLight={isLight}
                />
                <TabItem
                  active={uiState.currentSideTab === "DATA"}
                  onClick={() => setUIState({ currentSideTab: "DATA" })}
                  icon={<Database size={18} />}
                  label="数据"
                  isLight={isLight}
                />
              </div>
              <button
                onClick={onClose}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                  isLight
                    ? "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    : "text-slate-500 hover:text-white hover:bg-white/5"
                }`}
                title="关闭"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
              {uiState.currentSideTab === "SETTINGS" && (
                <EnhancedSettings uiState={uiState} setUIState={setUIState} />
              )}
              {uiState.currentSideTab === "ANKI" && (
                <AnkiSettings uiState={uiState} setUIState={setUIState} />
              )}
              {uiState.currentSideTab === "GAMEPAD" && (
                <GamepadSettings uiState={uiState} setUIState={setUIState} />
              )}
              {uiState.currentSideTab === "DATA" && (
                <DataManagementSettings
                  uiState={uiState}
                  setUIState={setUIState}
                />
              )}
            </div>

            {/* Footer */}
            <div
              className={`p-4 border-t ${isLight ? "border-slate-150 bg-slate-50/50" : "border-white/5 bg-white/[0.02]"}`}
            >
              <div className="flex justify-between items-center opacity-30">
                <span
                  className={`text-[8px] font-black uppercase tracking-[0.3em] ${isLight ? "text-slate-700" : "text-slate-300"}`}
                >
                  Build.0.45.2-Alpha
                </span>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" />
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

const TabItem = ({
  active,
  onClick,
  icon,
  label,
  isLight,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  isLight?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 transition-all border-b-2 ${
      active
        ? "border-cyan-500 text-cyan-400"
        : isLight
          ? "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"
          : "border-transparent text-slate-650 hover:text-white hover:bg-white/[0.02]"
    }`}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 15 })}
    <span className="text-[10px] font-bold tracking-tight">{label}</span>
  </button>
);

const SubTabItem = ({
  active,
  onClick,
  label,
  isLight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  isLight?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${
      active
        ? "border-cyan-500 text-cyan-500"
        : isLight
          ? "border-transparent text-slate-400 hover:text-slate-700"
          : "border-transparent text-slate-650 hover:text-white"
    }`}
  >
    {label}
  </button>
);

const SchemeTab = ({
  active,
  onClick,
  icon,
  label,
  isLight,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  isLight?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-xl transition-all font-sans font-bold text-[10px] ${
      active
        ? isLight
          ? "bg-white text-cyan-600 shadow-sm"
          : "bg-white/10 text-cyan-400 shadow-inner"
        : isLight
          ? "text-slate-400 hover:text-slate-600 hover:bg-white/50"
          : "text-slate-600 hover:text-slate-300 hover:bg-white/[0.02]"
    }`}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 13 })}
    <span>{label}</span>
  </button>
);

const EnhancedSettings = ({
  uiState,
  setUIState,
}: {
  uiState: UIState;
  setUIState: (s: Partial<UIState>) => void;
}) => {
  const isLight = uiState.theme === "light";
  const [ttsTestText, setTtsTestText] = React.useState("");

  const handleTestTTS = () => {
    if (!ttsTestText.trim()) return;
    try {
      if (uiState.ttsSource === "userscript") {
        alert(
          `[油猴脚本模拟] 正在通过外置油猴脚本朗读文本: "${ttsTestText}"\n(语速: ${uiState.ttsSpeed / 100}x, 音高: ${uiState.ttsPitch}%, 音量与音色已交付前端进行同步绑定)`,
        );
        return;
      }
      const utterance = new SpeechSynthesisUtterance(ttsTestText);
      utterance.rate = uiState.ttsSpeed / 100;
      utterance.pitch = uiState.ttsPitch / 100;
      utterance.volume = uiState.ttsVolume / 100;

      if (window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        let targetVoice = null;
        if (
          uiState.ttsVoice === "female-jp" ||
          uiState.ttsVoice === "male-jp"
        ) {
          targetVoice = voices.find(
            (v) => v.lang.includes("ja") || v.lang.includes("JP"),
          );
        } else if (uiState.ttsVoice === "female-zh") {
          targetVoice = voices.find(
            (v) =>
              v.lang.includes("zh") ||
              v.lang.includes("ZH") ||
              v.lang.includes("cn") ||
              v.lang.includes("CN"),
          );
        }
        if (targetVoice) {
          utterance.voice = targetVoice;
        }
        window.speechSynthesis.cancel(); // cancel current speak
        window.speechSynthesis.speak(utterance);
      } else {
        alert(`您的浏览器不支持原生语音合成。朗读文本: "${ttsTestText}"`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div
        className={`flex border-b ${isLight ? "border-slate-200" : "border-white/10"} mb-6`}
      >
        <SubTabItem
          active={uiState.currentSystemSubTab === "ADJUSTMENT"}
          onClick={() => setUIState({ currentSystemSubTab: "ADJUSTMENT" })}
          label="调节"
          isLight={isLight}
        />
        <SubTabItem
          active={uiState.currentSystemSubTab === "ACCESSIBILITY"}
          onClick={() => setUIState({ currentSystemSubTab: "ACCESSIBILITY" })}
          label="辅助功能"
          isLight={isLight}
        />
      </div>

      {uiState.currentSystemSubTab === "ADJUSTMENT" && (
        <div className="space-y-8">
          <SettingsSection
            title="外观与主题"
            icon={<Sun size={14} />}
            isLight={isLight}
          >
            <div className="space-y-3.5">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-505" : "text-slate-600"}`}
              >
                系统系统外观风格
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setUIState({ theme: "dark" })}
                  className={`py-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-all select-none ${uiState.theme === "dark" ? "bg-cyan-500 border-cyan-500 text-black shadow-lg shadow-cyan-500/20" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"}`}
                >
                  <Moon size={13} /> 黑夜深蓝
                </button>
                <button
                  onClick={() => setUIState({ theme: "light" })}
                  className={`py-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase transition-all select-none ${uiState.theme === "light" ? "bg-cyan-500 border-cyan-500 text-black shadow-lg shadow-cyan-500/20" : isLight ? "bg-slate-100 border-slate-205 text-slate-500 hover:text-slate-800" : "bg-white/5 border-white/10 text-slate-400 hover:text-white"}`}
                >
                  <Sun size={13} /> 白天极简
                </button>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="语言与界面"
            icon={<Languages size={14} />}
            isLight={isLight}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${isLight ? "text-slate-500" : "text-slate-605"}`}
                >
                  界面语言
                </span>
                <select
                  value={uiState.uiLanguage}
                  onChange={(e) =>
                    setUIState({ uiLanguage: e.target.value as any })
                  }
                  className={`w-32 rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                >
                  <option value="zh">中文 (简体中文)</option>
                  <option value="en">English (US)</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-dashed border-slate-200 dark:border-white/10 pt-3">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${isLight ? "text-slate-500" : "text-slate-605"}`}
                >
                  学习语言
                </span>
                <select
                  value={uiState.learningLanguage}
                  onChange={(e) =>
                    setUIState({ learningLanguage: e.target.value })
                  }
                  className={`w-32 rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-808" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                >
                  <option value="ja">日本語 (日语)</option>
                  <option value="en">English (英语)</option>
                  <option value="ko">한국어 (韩语)</option>
                  <option value="fr">Français (法语)</option>
                  <option value="de">Deutsch (德语)</option>
                </select>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="画面与音量"
            icon={<Monitor size={14} />}
            isLight={isLight}
          >
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span
                    className={`text-[11px] font-bold ${isLight ? "text-slate-505" : "text-slate-450"}`}
                  >
                    系统音量
                  </span>
                  <span className="text-[10px] font-mono text-cyan-505 font-bold">
                    {uiState.gameVolume}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={uiState.gameVolume}
                  onChange={(e) =>
                    setUIState({ gameVolume: parseInt(e.target.value) })
                  }
                  className="w-full h-1 bg-white/5 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>
          </SettingsSection>
        </div>
      )}

      {uiState.currentSystemSubTab === "ACCESSIBILITY" && (
        <div className="space-y-8">
          <SettingsSection
            title="智能翻译设置"
            icon={<Languages size={14} />}
            isLight={isLight}
          >
            <div className="space-y-4">
              <SettingsAccordion
                label="启用内容翻译"
                active={uiState.showTranslation}
                onClick={() =>
                  setUIState({ showTranslation: !uiState.showTranslation })
                }
                isLight={isLight}
              >
                <div className="space-y-4">
                  <ToggleRow
                    label="智能全自动同步翻译"
                    active={uiState.autoTranslate}
                    onClick={() =>
                      setUIState({ autoTranslate: !uiState.autoTranslate })
                    }
                    isLight={isLight}
                  />

                  <div className="space-y-1.5 flex flex-col gap-1 border-t border-dashed border-slate-200 dark:border-white/10 pt-3">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                    >
                      选择翻译来源
                    </span>
                    <select
                      value={uiState.translationSource}
                      onChange={(e) =>
                        setUIState({ translationSource: e.target.value as any })
                      }
                      className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                    >
                      <option value="api">API调用（默认: MyMemory API）</option>
                      <option value="userscript">油猴脚本调用</option>
                      <option value="search">在线网页搜索</option>
                    </select>
                  </div>

                  {/* Translation Source Language Settings */}
                  <div className="space-y-1.5 flex flex-col gap-1 border-t border-dashed border-slate-200 dark:border-white/10 pt-3">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                    >
                      翻译语言设置（源语言）
                    </span>
                    <select
                      value={uiState.translationSourceLangMode}
                      onChange={(e) =>
                        setUIState({
                          translationSourceLangMode: e.target.value as any,
                        })
                      }
                      className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                    >
                      <option value="ui">
                        跟随界面语言 (Follow UI Language)
                      </option>
                      <option value="custom">自定义（可以选语言）</option>
                    </select>
                  </div>

                  {uiState.translationSourceLangMode === "custom" && (
                    <div className="space-y-1.5 flex flex-col gap-1 ml-2 border-l-2 border-cyan-500/30 pl-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                      >
                        源语言自主选择
                      </span>
                      <select
                        value={uiState.translationSourceLangCustom}
                        onChange={(e) =>
                          setUIState({
                            translationSourceLangCustom: e.target.value,
                          })
                        }
                        className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                      >
                        <option value="ja">日本語 (日语)</option>
                        <option value="en">English (英语)</option>
                        <option value="zh">中文</option>
                        <option value="ko">한국어 (韩语)</option>
                        <option value="ru">Русский (俄语)</option>
                      </select>
                    </div>
                  )}

                  {/* Translation Target Language Settings */}
                  <div className="space-y-1.5 flex flex-col gap-1 border-t border-dashed border-slate-200 dark:border-white/10 pt-3">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                    >
                      目标翻译语言设置
                    </span>
                    <select
                      value={uiState.translationTargetLangMode}
                      onChange={(e) =>
                        setUIState({
                          translationTargetLangMode: e.target.value as any,
                        })
                      }
                      className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                    >
                      <option value="game">跟随游戏设置</option>
                      <option value="system">跟随系统设置</option>
                      <option value="custom">自定义目标语言</option>
                    </select>
                  </div>

                  {uiState.translationTargetLangMode === "custom" && (
                    <div className="space-y-1.5 flex flex-col gap-1 ml-2 border-l-2 border-cyan-500/30 pl-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                      >
                        目标语言自主选择
                      </span>
                      <select
                        value={uiState.translationTargetLangCustom}
                        onChange={(e) =>
                          setUIState({
                            translationTargetLangCustom: e.target.value,
                          })
                        }
                        className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                      >
                        <option value="zh">中文</option>
                        <option value="ja">日本語 (日语)</option>
                        <option value="en">English (英语)</option>
                        <option value="ko">한국어 (韩语)</option>
                        <option value="ru">Русский (俄语)</option>
                      </select>
                    </div>
                  )}

                  {uiState.translationSource === "search" && (
                    <div className="space-y-3.5 border-t border-dashed border-slate-200 dark:border-white/10 pt-3 ml-2 border-l-2 border-cyan-500/30 pl-3">
                      <div className="space-y-1.5 flex flex-col gap-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                        >
                          翻译搜索分类
                        </span>
                        <select
                          value={uiState.translationSearchGroup}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setUIState({
                              translationSearchGroup: val,
                              translationSearchWebsite:
                                val === "searchEngine" ? "google" : "deepl",
                            });
                          }}
                          className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                        >
                          <option value="searchEngine">搜索引擎</option>
                          <option value="translationSite">翻译网站</option>
                        </select>
                      </div>

                      <div className="space-y-1.5 flex flex-col gap-1">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                        >
                          默认的搜索网站
                        </span>
                        <select
                          value={uiState.translationSearchWebsite}
                          onChange={(e) =>
                            setUIState({
                              translationSearchWebsite: e.target.value,
                            })
                          }
                          className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                        >
                          {uiState.translationSearchGroup === "searchEngine" ? (
                            <>
                              <option value="google">Google 搜索</option>
                              <option value="baidu">百度搜索</option>
                              <option value="bing">Bing 搜索</option>
                            </>
                          ) : (
                            <>
                              <option value="deepl">DeepL 翻译</option>
                              <option value="google_trans">谷歌翻译</option>
                              <option value="youdao">有道翻译</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </SettingsAccordion>
            </div>
          </SettingsSection>

          <SettingsSection
            title="文本浮层与交互"
            icon={<Layers size={14} />}
            isLight={isLight}
          >
            <div className="space-y-4">
              <SettingsAccordion
                label="开启悬浮文本遮罩"
                active={uiState.textOverlayOpen}
                onClick={() =>
                  setUIState({ textOverlayOpen: !uiState.textOverlayOpen })
                }
                isLight={isLight}
              >
                <div className="space-y-4">
                  <ToggleRow
                    label="检测到新对话时自动更新"
                    active={uiState.autoUpdateText}
                    onClick={() =>
                      setUIState({ autoUpdateText: !uiState.autoUpdateText })
                    }
                    isLight={isLight}
                  />

                  <ToggleRow
                    label="开启对话历史记录功能"
                    active={uiState.showHistory}
                    onClick={() =>
                      setUIState({ showHistory: !uiState.showHistory })
                    }
                    isLight={isLight}
                  />

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span
                        className={
                          isLight ? "text-slate-505" : "text-slate-400"
                        }
                      >
                        浮层底色透明度
                      </span>
                      <span className="text-cyan-500 font-mono font-bold">
                        {Math.round(uiState.textOverlayOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={uiState.textOverlayOpacity * 100}
                      onChange={(e) =>
                        setUIState({
                          textOverlayOpacity: parseFloat(e.target.value) / 100,
                        })
                      }
                      className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span
                        className={
                          isLight ? "text-slate-505" : "text-slate-400"
                        }
                      >
                        浮层文本字号
                      </span>
                      <span className="text-cyan-500 font-mono font-bold">
                        {uiState.textOverlayFontSize}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      value={uiState.textOverlayFontSize}
                      onChange={(e) =>
                        setUIState({
                          textOverlayFontSize: parseInt(e.target.value),
                        })
                      }
                      className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>

                  <div className="space-y-1.5 flex flex-col gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                    >
                      分词处理选项
                    </span>
                    <select
                      value={uiState.tokenizerMethod}
                      onChange={(e) =>
                        setUIState({ tokenizerMethod: e.target.value as any })
                      }
                      className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                    >
                      <option value="none">关闭分词处理</option>
                      <option value="browser">浏览器自带的分词处理</option>
                      <option value="space">空格进行分词处理</option>
                      <option value="char">单字分词</option>
                      <option value="japanese">日语分词 (kuromoji.js)</option>
                    </select>
                    {/* 日语分词状态指示 */}
                    {uiState.tokenizerMethod === 'japanese' && (
                      <p className={`text-[8px] italic font-bold ${
                        isLight ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        kuromoji.js 日语形态素分词 — 首次加载需下载词典文件
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 flex flex-col gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                    >
                      剧情交互选取机制
                    </span>
                    <select
                      value={uiState.textSelectableMode}
                      onChange={(e) =>
                        setUIState({
                          textSelectableMode: e.target.value as any,
                        })
                      }
                      className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                    >
                      <option value="clickable">
                        点击分词触发形式（快速查词）
                      </option>
                      <option value="selectable">
                        可被 Yomitan 插件扫描的可复制形式
                      </option>
                    </select>
                  </div>
                </div>
              </SettingsAccordion>
            </div>
          </SettingsSection>

          <SettingsSection
            title="语音合成 (TTS)"
            icon={<Mic2 size={14} />}
            isLight={isLight}
          >
            <div className="space-y-4">
              <SettingsAccordion
                label="启用文本朗读 (TTS)"
                active={uiState.ttsEnabled}
                onClick={() => setUIState({ ttsEnabled: !uiState.ttsEnabled })}
                isLight={isLight}
              >
                <div className="space-y-4">
                  <div className="space-y-1.5 flex flex-col gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                    >
                      TTS 朗读发音来源
                    </span>
                    <select
                      value={uiState.ttsSource}
                      onChange={(e) =>
                        setUIState({ ttsSource: e.target.value as any })
                      }
                      className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-808" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                    >
                      <option value="browser">
                        浏览器内置 (SpeechSynthesis)
                      </option>
                      <option value="userscript">
                        油猴脚本调用 (Tampermonkey)
                      </option>
                    </select>
                  </div>

                  <div className="space-y-1.5 flex flex-col gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-505" : "text-slate-400"}`}
                    >
                      朗读发音人音色
                    </span>
                    <select
                      value={uiState.ttsVoice}
                      onChange={(e) => setUIState({ ttsVoice: e.target.value })}
                      className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-808" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                    >
                      <option value="system">系统默认发音</option>
                      <option value="female-jp">日语轻快女声 (Sayaka)</option>
                      <option value="male-jp">日语低沉男声 (Kenji)</option>
                      <option value="female-zh">中文柔和女声 (Lili)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span
                        className={
                          isLight ? "text-slate-500" : "text-slate-400"
                        }
                      >
                        发音语速倍数
                      </span>
                      <span className="text-cyan-500 font-mono font-bold">
                        x{(uiState.ttsSpeed / 100).toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      value={uiState.ttsSpeed}
                      onChange={(e) =>
                        setUIState({ ttsSpeed: parseInt(e.target.value) })
                      }
                      className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span
                        className={
                          isLight ? "text-slate-500" : "text-slate-400"
                        }
                      >
                        普通发音音高
                      </span>
                      <span className="text-cyan-555 font-mono font-bold">
                        {uiState.ttsPitch}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={uiState.ttsPitch}
                      onChange={(e) =>
                        setUIState({ ttsPitch: parseInt(e.target.value) })
                      }
                      className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span
                        className={
                          isLight ? "text-slate-500" : "text-slate-400"
                        }
                      >
                        发音音量大小
                      </span>
                      <span className="text-cyan-555 font-mono font-bold">
                        {uiState.ttsVolume}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={uiState.ttsVolume}
                      onChange={(e) =>
                        setUIState({ ttsVolume: parseInt(e.target.value) })
                      }
                      className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>

                  {/* TTS TEST PRONUNCIATION BENCH */}
                  <div className="space-y-2 border-t border-dashed border-slate-200 dark:border-white/10 pt-4 mt-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}
                    >
                      TTS 发音效果测试与评估
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="输入用于发音测试的文本..."
                        value={ttsTestText}
                        onChange={(e) => setTtsTestText(e.target.value)}
                        className={`flex-1 py-1.5 px-3 text-xs rounded-xl border outline-none transition-all ${
                          isLight
                            ? "bg-slate-50 border-slate-200 text-slate-805 focus:border-cyan-500"
                            : "bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500"
                        }`}
                      />
                      <button
                        onClick={handleTestTTS}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
                          isLight
                            ? "bg-cyan-500 text-black hover:bg-cyan-400 shadow-sm"
                            : "bg-cyan-500 text-black hover:bg-cyan-400"
                        }`}
                      >
                        <Volume2 size={11} /> 朗读测试
                      </button>
                    </div>
                  </div>
                </div>
              </SettingsAccordion>
            </div>
          </SettingsSection>

          <SettingsSection
            title="OCR设置"
            icon={<Search size={14} />}
            isLight={isLight}
          >
            <div className="space-y-4">
              <SettingsAccordion
                label="OCR识别配置"
                active={uiState.ocrAccordionOpen}
                onClick={() =>
                  setUIState({ ocrAccordionOpen: !uiState.ocrAccordionOpen })
                }
                isLight={isLight}
              >
                <div className="space-y-4">
                  <div className="space-y-1.5 flex flex-col gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                    >
                      选择取图模式
                    </span>
                    <select
                      value={uiState.ocrCaptureMode}
                      onChange={(e) =>
                        setUIState({ ocrCaptureMode: e.target.value as any })
                      }
                      className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                    >
                      <option value="fullscreen">全屏截图</option>
                      <option value="selection">选框取图</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 flex flex-col gap-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                    >
                      OCR语言模式设置
                    </span>
                    <select
                      value={uiState.ocrLanguageMode}
                      onChange={(e) =>
                        setUIState({ ocrLanguageMode: e.target.value as any })
                      }
                      className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                    >
                      <option value="global">跟随全局设置</option>
                      <option value="game">跟随游戏设置语言</option>
                      <option value="custom">自主设置</option>
                    </select>
                  </div>

                  {uiState.ocrLanguageMode === "custom" && (
                    <div className="space-y-1.5 flex flex-col gap-1 ml-2 border-l-2 border-cyan-500/30 pl-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}
                      >
                        自主语言选择
                      </span>
                      <select
                        value={uiState.ocrCustomLanguage}
                        onChange={(e) =>
                          setUIState({ ocrCustomLanguage: e.target.value })
                        }
                        className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${isLight ? "bg-slate-50 border-slate-200 text-slate-805" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                      >
                        <option value="zh">中文</option>
                        <option value="jp">日本語 (日语)</option>
                        <option value="en">English (英语)</option>
                        <option value="ko">한국어 (韩语)</option>
                        <option value="ru">Русский (俄语)</option>
                      </select>
                    </div>
                  )}
                  {/* OCR 取词操作按钮 — 连接 Tesseract.js 引擎 */}
                  <button
                    onClick={async () => {
                      const langCode = uiState.ocrLanguageMode === 'custom'
                        ? uiState.ocrCustomLanguage
                        : uiState.ocrLanguageMode === 'game' ? 'ja' : 'en';
                      // Tesseract.js OCR 已集成，可通过浏览器控制台调用
                      // 实际使用中，用户需提供要识别的图片数据（截图/Canvas）
                      alert(`OCR 文字识别 (Tesseract.js)\n\n识别语言: ${langCode}\n\n使用方法:\n1. 将需要识别的图片放入 public/ 目录\n2. 或在浏览器控制台手动调用:\n  const { recognizeImage } = await import('/src/services/ocrService.ts');\n  const result = await recognizeImage('图片URL');\n  console.log(result.text);`);
                    }}
                    className={`w-full mt-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                      isLight
                        ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                        : 'bg-cyan-500 text-black hover:bg-cyan-400'
                    }`}
                  >
                    启动OCR文字识别
                  </button>
                </div>
              </SettingsAccordion>
            </div>
          </SettingsSection>
        </div>
      )}
    </div>
  );
};

export const DataManagementSettings = ({
  uiState,
  setUIState,
}: {
  uiState: UIState;
  setUIState: (s: Partial<UIState>) => void;
}) => {
  const isLight = uiState.theme === "light";
  const [userSettingsOpen, setUserSettingsOpen] = React.useState(true);
  const [systemSettingsOpen, setSystemSettingsOpen] = React.useState(true);
  const [itemSettingsOpen, setItemSettingsOpen] = React.useState(true);

  const [gameDataOpen, setGameDataOpen] = React.useState(true);
  const [noteDataOpen, setNoteDataOpen] = React.useState(true);
  const [archiveDataOpen, setArchiveDataOpen] = React.useState(true);
  const [imageDataOpen, setImageDataOpen] = React.useState(true);
  const [gameFilesOpen, setGameFilesOpen] = React.useState(true);

  return (
    <div className="space-y-6 pb-10">
      <div className="space-y-4">
        <p
          className={`text-[10px] leading-relaxed mb-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}
        >
          在此您可以分别管理用户设置（系统与条目设置）和游戏数据（笔记、存档、图片、游戏文件），并进行部分/完全迁移与备份。各功能标题均可点按展开/折叠。
        </p>

        {/* Categories Grid or Accordions */}
        <div className="space-y-5">
          {/* USER SETTINGS CARD */}
          <div
            className={`p-4 border rounded-xl space-y-4 ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"}`}
          >
            <div 
              onClick={() => setUserSettingsOpen(!userSettingsOpen)}
              className="flex justify-between items-center cursor-pointer select-none hover:opacity-80"
            >
              <span
                className={`text-[11px] font-black uppercase tracking-wider block border-l-2 border-cyan-500 pl-2 ${isLight ? "text-slate-800" : "text-white"}`}
              >
                用户设置 (User Settings)
              </span>
              <ChevronDown 
                size={14} 
                className={`transition-transform duration-200 ${isLight ? 'text-slate-500' : 'text-slate-400'} ${userSettingsOpen ? 'rotate-180' : ''}`} 
              />
            </div>

            {userSettingsOpen && (
              <div className="space-y-3 pl-1">
                {/* System Settings Subcategory */}
                <div className="space-y-1.5Packed">
                  <div 
                    onClick={() => setSystemSettingsOpen(!systemSettingsOpen)}
                    className="flex justify-between items-center bg-transparent cursor-pointer select-none hover:opacity-80 pb-1"
                  >
                    <span
                      className={`text-[10px] font-bold ${isLight ? "text-slate-700" : "text-slate-300"}`}
                    >
                      系统设置 (System Settings)
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-mono opacity-60">
                        system_config.json
                      </span>
                      <ChevronDown 
                        size={12} 
                        className={`transition-transform duration-205 ${isLight ? 'text-slate-500' : 'text-slate-400'} ${systemSettingsOpen ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </div>
                  
                  {systemSettingsOpen && (
                    <div className="space-y-1.5 mt-1">
                      <p
                        className={`text-[9px] leading-relaxed ${isLight ? "text-slate-500" : "text-slate-400"}`}
                      >
                        保存了TTS朗读、主题、悬浮窗位置、分词模式等全局系统偏好参数。
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => alert("已成功导出系统全局设置数据包！")}
                          className={`flex-1 py-1 px-2 rounded-lg text-[9px] font-extrabold border transition-all cursor-pointer ${isLight ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"}`}
                        >
                          备份设置
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "确认要重置系统设置吗？主题及TTS配置等将恢复原厂参数。",
                              )
                            ) {
                              alert("重置成功！");
                              window.location.reload();
                            }
                          }}
                          className={`py-1 px-2 rounded-lg text-[9px] font-extrabold border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all cursor-pointer`}
                        >
                          重置
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Item Settings Subcategory */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                  <div 
                    onClick={() => setItemSettingsOpen(!itemSettingsOpen)}
                    className="flex justify-between items-center bg-transparent cursor-pointer select-none hover:opacity-80 pb-1"
                  >
                    <span
                      className={`text-[10px] font-bold ${isLight ? "text-slate-705" : "text-slate-300"}`}
                    >
                      条目设置 (Item Settings)
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-mono opacity-60">
                        library_items.json
                      </span>
                      <ChevronDown 
                        size={12} 
                        className={`transition-transform duration-205 ${isLight ? 'text-slate-500' : 'text-slate-400'} ${itemSettingsOpen ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </div>
                  
                  {itemSettingsOpen && (
                    <div className="space-y-1.5 mt-1">
                      <p
                        className={`text-[9px] leading-relaxed ${isLight ? "text-slate-500" : "text-slate-400"}`}
                      >
                        配置了游戏库中各个游戏的元数据、分组标签、封面和路径映射。
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => alert("已导出库条目映射设置！")}
                          className={`flex-1 py-1 px-2 rounded-lg text-[9px] font-extrabold border transition-all cursor-pointer ${isLight ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
                        >
                          备份条目
                        </button>
                        <button
                          onClick={() => alert("请选择条目设置备份包以覆盖导入。")}
                          className={`flex-1 py-1 px-2 rounded-lg text-[9px] font-extrabold border transition-all cursor-pointer ${isLight ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
                        >
                          覆盖导入
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* GAME DATA CARD */}
          <div
            className={`p-4 border rounded-xl space-y-4 ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"}`}
          >
            <div 
              onClick={() => setGameDataOpen(!gameDataOpen)}
              className="flex justify-between items-center cursor-pointer select-none"
            >
              <span
                className={`text-[11px] font-black uppercase tracking-wider block border-l-2 border-cyan-500 pl-2 ${isLight ? "text-slate-800" : "text-white"}`}
              >
                游戏数据 (Game Data)
              </span>
              <ChevronDown 
                size={14} 
                className={`transition-transform duration-200 ${isLight ? 'text-slate-500' : 'text-slate-400'} ${gameDataOpen ? 'rotate-180' : ''}`} 
              />
            </div>

            {gameDataOpen && (
              <div className="space-y-4 pl-1">
                {/* Note Data */}
                <div className="space-y-1.5">
                  <div 
                    onClick={() => setNoteDataOpen(!noteDataOpen)}
                    className="flex justify-between items-center bg-transparent cursor-pointer select-none hover:opacity-80 pb-1"
                  >
                    <span
                      className={`text-[10px] font-bold ${isLight ? "text-slate-700" : "text-slate-300"}`}
                    >
                      核心笔记数据 (Note Data)
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-mono text-cyan-500">
                        {uiState.notes?.length || 0} 个生词本笔记
                      </span>
                      <ChevronDown 
                        size={12} 
                        className={`transition-transform duration-205 ${isLight ? 'text-slate-500' : 'text-slate-400'} ${noteDataOpen ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </div>
                  
                  {noteDataOpen && (
                    <div className="space-y-1.5 mt-1">
                      <p
                        className={`text-[9px] leading-relaxed ${isLight ? "text-slate-500" : "text-slate-400"}`}
                      >
                        您在游戏中随时勾画选中的词条批注、自定义解释、以及导入的第三方生词文本。
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => alert("生词笔记已全部打包导出！")}
                          className={`flex-1 py-1 px-2 rounded-lg text-[9px] font-extrabold border transition-all cursor-pointer ${isLight ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
                        >
                          单独导出
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "确定要清空全部游戏的生词笔记吗？建议提前导出备份。",
                              )
                            ) {
                              alert("清除成功！");
                            }
                          }}
                          className={`py-1 px-2 rounded-lg text-[9px] font-extrabold border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all cursor-pointer`}
                        >
                          清空笔记
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Archive Data */}
                <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-white/5">
                  <div 
                    onClick={() => setArchiveDataOpen(!archiveDataOpen)}
                    className="flex justify-between items-center bg-transparent cursor-pointer select-none hover:opacity-80 pb-1"
                  >
                    <span
                      className={`text-[10px] font-bold ${isLight ? "text-slate-700" : "text-slate-300"}`}
                    >
                      游戏存档数据 (Archive Data)
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-mono text-cyan-500">
                        2 个本地和云端即时存档
                      </span>
                      <ChevronDown 
                        size={12} 
                        className={`transition-transform duration-205 ${isLight ? 'text-slate-500' : 'text-slate-400'} ${archiveDataOpen ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </div>
                  
                  {archiveDataOpen && (
                    <div className="space-y-1.5 mt-1">
                      <p
                        className={`text-[9px] leading-relaxed ${isLight ? "text-slate-505" : "text-slate-400"}`}
                      >
                        模拟器状态下的状态切片存档、即时回溯点。
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => alert("即时回溯存档导出成功！")}
                          className={`flex-1 py-1 px-2 rounded-lg text-[9px] font-extrabold border transition-all cursor-pointer ${isLight ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
                        >
                          导出存档
                        </button>
                        <button
                          onClick={() =>
                            alert("请选择本地包含 .sav/.state 的游戏存档文件")
                          }
                          className={`flex-1 py-1 px-2 rounded-lg text-[9px] font-extrabold border transition-all cursor-pointer ${isLight ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
                        >
                          导入存档
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Image Data */}
                <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-white/5">
                  <div 
                    onClick={() => setImageDataOpen(!imageDataOpen)}
                    className="flex justify-between items-center bg-transparent cursor-pointer select-none hover:opacity-80 pb-1"
                  >
                    <span
                      className={`text-[10px] font-bold ${isLight ? "text-slate-700" : "text-slate-300"}`}
                    >
                      图片与多媒体数据 (Image Data)
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-mono opacity-60">
                        12.4 MB 缓存占用
                      </span>
                      <ChevronDown 
                        size={12} 
                        className={`transition-transform duration-205 ${isLight ? 'text-slate-500' : 'text-slate-400'} ${imageDataOpen ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </div>
                  
                  {imageDataOpen && (
                    <div className="space-y-1.5 mt-1">
                      <p
                        className={`text-[9px] leading-relaxed ${isLight ? "text-slate-500" : "text-slate-400"}`}
                      >
                        存储了游戏截图切片、生词卡的语境截图贴纸。
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            alert(
                              "开始优化并修剪未引用的无用多媒体缓存... 已修剪 1.2 MB",
                            )
                          }
                          className={`flex-1 py-1 px-2 rounded-lg text-[9px] font-extrabold border transition-all cursor-pointer ${isLight ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                        >
                          优化缓存
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "该操作将清空所有生词对应的截图切片，是否确认？",
                              )
                            ) {
                              alert("清除成功！");
                            }
                          }}
                          className={`py-1 px-2 rounded-lg text-[9px] font-extrabold border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all cursor-pointer`}
                        >
                          清空图片
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Game Files */}
                <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-white/5">
                  <div 
                    onClick={() => setGameFilesOpen(!gameFilesOpen)}
                    className="flex justify-between items-center bg-transparent cursor-pointer select-none hover:opacity-80 pb-1"
                  >
                    <span
                      className={`text-[10px] font-bold ${isLight ? "text-slate-700" : "text-slate-300"}`}
                    >
                      游戏宿主 ROM 文件 (Game Files)
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-mono text-cyan-500">
                        1个活动模拟器ROM载入中
                      </span>
                      <ChevronDown 
                        size={12} 
                        className={`transition-transform duration-205 ${isLight ? 'text-slate-500' : 'text-slate-400'} ${gameFilesOpen ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </div>
                  
                  {gameFilesOpen && (
                    <div className="space-y-1.5 mt-1">
                      <p
                        className={`text-[9px] leading-relaxed ${isLight ? "text-slate-500" : "text-slate-400"}`}
                      >
                        系统沙盒中已经解压的、可用于执行的游戏ROM包或剧情脚本镜像。
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            alert("当前处于活动锁状态。请卸载游戏后进行删除。")
                          }
                          className={`flex-1 py-1 px-2 rounded-lg text-[9px] font-extrabold border transition-all cursor-pointer ${isLight ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-white bg-[#0e121a]"}`}
                        >
                          管理文件
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "警告：此操作将清空模拟器中所有挂载的游戏主镜像文件！",
                              )
                            ) {
                              alert("清除成功！");
                              window.location.reload();
                            }
                          }}
                          className={`py-1 px-2 rounded-lg text-[9px] font-extrabold border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-all cursor-pointer`}
                        >
                          擦除文件
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Transfer Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/5">
          <span
            className={`text-[9px] font-bold tracking-widest uppercase block mb-2 ${isLight ? "text-slate-400" : "text-slate-500"}`}
          >
            一键全量备份
          </span>
          <div className="grid grid-cols-2 gap-3">
            <button
              className={`flex flex-col items-center justify-center gap-2 border rounded-xl p-4 transition-all group cursor-pointer ${
                isLight
                  ? "bg-slate-50 hover:bg-slate-100 border-slate-205"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
              onClick={() =>
                alert(
                  "全量导出成功！所有系统偏好、条目分组、存档库和笔记均已合并至 aistudio_backup_full.json。",
                )
              }
            >
              <Download
                size={18}
                className="text-slate-500 group-hover:text-cyan-400 transition-colors"
              />
              <span
                className={`text-[10px] font-black uppercase ${isLight ? "text-slate-700" : "text-white"}`}
              >
                备份全部数据
              </span>
            </button>
            <button
              className={`flex flex-col items-center justify-center gap-2 border rounded-xl p-4 transition-all group cursor-pointer ${
                isLight
                  ? "bg-slate-50 hover:bg-slate-100 border-slate-205"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
              onClick={() =>
                alert(
                  "请选择 aistudio_backup_full.json 全量备份文件以进行还原。",
                )
              }
            >
              <Upload
                size={18}
                className="text-slate-500 group-hover:text-cyan-400 transition-colors"
              />
              <span
                className={`text-[10px] font-black uppercase ${isLight ? "text-slate-700" : "text-white"}`}
              >
                恢复全量备份
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl space-y-3">
        <span className="text-[10px] font-black text-red-500 uppercase tracking-wider block">
          完全还原出厂设置
        </span>
        <p
          className={`text-[9px] leading-relaxed ${isLight ? "text-slate-600" : "text-slate-400"}`}
        >
          这将会清空所有的离线内容，系统首选项及已经自定义的游戏。继续之前请做好所有备份工作。
        </p>
        <button
          className="w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-[9px] uppercase transition-all cursor-pointer"
          onClick={() => {
            if (
              confirm(
                "极度危险！该操作会抹去包括全部离线游戏镜像与生词笔记本在内的全部配置。确认重置？",
              )
            ) {
              alert("擦除完毕！系统已重置为出厂状态。");
              window.location.reload();
            }
          }}
        >
          重置整机出厂数据
        </button>
      </div>
    </div>
  );
};

const AnkiSettings = ({
  uiState,
  setUIState,
}: {
  uiState: UIState;
  setUIState: (s: Partial<UIState>) => void;
}) => {
  const isLight = uiState.theme === "light";
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);

  const handleClear = () => {
    const scheme = uiState.ankiActiveScheme;
    if (scheme === "WORD") {
      setUIState({
        ankiFieldFront: "Front",
        ankiFieldBack: "Back",
        ankiFieldSentence: "Sentence",
        ankiFieldSentenceTranslation: "Translation",
        ankiFieldGameImage: "Screenshot",
      });
    } else if (scheme === "SENTENCE") {
      setUIState({
        ankiFieldSentence: "Sentence",
        ankiFieldSentenceTranslation: "Translation",
        ankiFieldGameImage: "Screenshot",
      });
    } else if (scheme === "NOTE") {
      setUIState({
        ankiFieldNoteTitle: "Title",
        ankiFieldNoteContent: "Content",
        ankiFieldNoteImage: "Image",
      });
    }
    setShowClearConfirm(false);
  };

  // Parse URL if possible
  const getHostAndPort = () => {
    try {
      const url = new URL(uiState.ankiConnectUrl || "http://127.0.0.1:8765");
      return {
        ip: url.hostname || "127.0.0.1",
        port: url.port || "8765",
      };
    } catch {
      return { ip: "127.0.0.1", port: "8765" };
    }
  };

  const { ip, port } = getHostAndPort();

  const handleUrlUpdate = (newIp: string, newPort: string) => {
    setUIState({
      ankiConnectUrl: `http://${newIp || "127.0.0.1"}:${newPort || "8765"}`,
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5 px-1">
          <label
            className={`text-[9px] font-black uppercase tracking-widest pl-1 ${isLight ? "text-slate-500" : "text-slate-500"}`}
          >
            AnkiConnect 通讯配置
          </label>
          <div className="flex gap-2 items-center">
            <div className="flex-1 flex gap-px rounded-xl overflow-hidden border border-white/10 shadow-inner overflow-hidden">
              <input
                type="text"
                value={ip}
                onChange={(e) => handleUrlUpdate(e.target.value, port)}
                className={`w-[65%] py-2.5 px-3 text-xs outline-none transition-all font-mono font-bold ${
                  isLight
                    ? "bg-slate-50 text-slate-800"
                    : "bg-white/5 text-white placeholder:text-slate-600"
                }`}
                placeholder="127.0.0.1"
              />
              <div
                className={`w-px h-full ${isLight ? "bg-slate-200" : "bg-white/10"}`}
              />
              <input
                type="text"
                value={port}
                onChange={(e) => handleUrlUpdate(ip, e.target.value)}
                className={`w-[35%] py-2.5 px-3 text-xs outline-none transition-all font-mono font-bold ${
                  isLight
                    ? "bg-slate-50 text-slate-800"
                    : "bg-white/5 text-white placeholder:text-slate-600"
                }`}
                placeholder="8765"
              />
            </div>
            <button
              onClick={() => alert(`正在尝试连接至 http://${ip}:${port}...`)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 border ${
                isLight
                  ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  : "bg-white/5 border-white/10 text-cyan-500 hover:bg-cyan-500/10"
              }`}
              title="测试连接"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        <label
          className={`text-[9px] font-black uppercase tracking-widest pl-1 pt-2 block ${isLight ? "text-slate-500" : "text-slate-500"}`}
        >
          Anki{" "}
          {uiState.ankiActiveScheme === "WORD"
            ? "单词"
            : uiState.ankiActiveScheme === "SENTENCE"
              ? "句子"
              : "笔记"}{" "}
          方案配置
        </label>

        <div
          className={`p-1 rounded-2xl flex ${isLight ? "bg-slate-100" : "bg-white/5"}`}
        >
          <SchemeTab
            active={uiState.ankiActiveScheme === "WORD"}
            onClick={() => setUIState({ ankiActiveScheme: "WORD" })}
            label="单词"
            icon={<FileText size={12} />}
            isLight={isLight}
          />
          <SchemeTab
            active={uiState.ankiActiveScheme === "SENTENCE"}
            onClick={() => setUIState({ ankiActiveScheme: "SENTENCE" })}
            label="句子"
            icon={<List size={12} />}
            isLight={isLight}
          />
          <SchemeTab
            active={uiState.ankiActiveScheme === "NOTE"}
            onClick={() => setUIState({ ankiActiveScheme: "NOTE" })}
            label="笔记"
            icon={<StickyNote size={12} />}
            isLight={isLight}
          />
        </div>

        <div className="space-y-4">
          {/* Toggle for current scheme with Save/Clear actions */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between gap-4 relative ${
              isLight
                ? "bg-slate-50/50 border-slate-100"
                : "bg-white/5 border-white/5"
            }`}
          >
            <div className="flex-1">
              <ToggleRow
                label={`启用${uiState.ankiActiveScheme === "WORD" ? "单词" : uiState.ankiActiveScheme === "SENTENCE" ? "句子" : "笔记"}方案`}
                active={
                  uiState.ankiActiveScheme === "WORD"
                    ? uiState.ankiWordEnabled
                    : uiState.ankiActiveScheme === "SENTENCE"
                      ? uiState.ankiSentenceEnabled
                      : uiState.ankiNoteEnabled
                }
                onClick={() => {
                  const key =
                    uiState.ankiActiveScheme === "WORD"
                      ? "ankiWordEnabled"
                      : uiState.ankiActiveScheme === "SENTENCE"
                        ? "ankiSentenceEnabled"
                        : "ankiNoteEnabled";
                  setUIState({ [key]: !uiState[key as keyof UIState] });
                }}
                isLight={isLight}
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setShowClearConfirm(true)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  isLight
                    ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                    : "text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                }`}
                title="清空当前方案配置"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Clear Confirmation Floating Box */}
            <AnimatePresence>
              {showClearConfirm && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 5, x: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5, x: 10 }}
                  className={`absolute right-4 bottom-full mb-2 z-[70] p-4 rounded-2xl shadow-2xl border w-56 ${
                    isLight
                      ? "bg-white border-slate-200"
                      : "bg-[#121820] border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3 text-red-500">
                    <Trash2 size={14} />
                    <span className="text-[11px] font-bold">确认清空？</span>
                  </div>
                  <p
                    className={`text-[10px] leading-relaxed mb-4 ${isLight ? "text-slate-500" : "text-slate-400"}`}
                  >
                    此操作将把当前「
                    {uiState.ankiActiveScheme === "WORD"
                      ? "单词"
                      : uiState.ankiActiveScheme === "SENTENCE"
                        ? "句子"
                        : "笔记"}
                    」方案的字段映射恢复为默认值。
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClear}
                      className="flex-1 py-2 rounded-xl bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 transition-colors"
                    >
                      确认重置
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-colors ${
                        isLight
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      取消
                    </button>
                  </div>
                  {/* Arrow decoration */}
                  <div
                    className={`absolute bottom-[-6px] right-6 w-3 h-3 rotate-45 border-r border-b ${
                      isLight
                        ? "bg-white border-slate-200"
                        : "bg-[#121820] border-white/10"
                    }`}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
              >
                对应牌组名称 (Deck)
              </label>
              <select
                value={uiState.ankiDeckName}
                onChange={(e) => setUIState({ ankiDeckName: e.target.value })}
                className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                  isLight
                    ? "bg-slate-50 border-slate-205 text-slate-808"
                    : "bg-white/5 border-white/10 text-white"
                }`}
              >
                <option value="Default">Default</option>
                <option value="游戏词汇库">游戏词汇库</option>
                <option value="JRPG 核心 2k">JRPG 核心 2k</option>
                <option value="视觉小说生词集">视觉小说生词集</option>
              </select>
            </div>

            <div className="space-y-1">
              <label
                className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
              >
                卡片模板 (Note Type)
              </label>
              <select
                value={uiState.ankiModelName}
                onChange={(e) => setUIState({ ankiModelName: e.target.value })}
                className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                  isLight
                    ? "bg-slate-50 border-slate-205 text-slate-808"
                    : "bg-white/5 border-white/10 text-white"
                }`}
              >
                <option value="Basic">Basic</option>
                <option value="Basic (and reversed card)">
                  Basic (and reversed card)
                </option>
                <option value="Common Vocab">Common Vocab</option>
                <option value="Sentencemining">Sentencemining</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-4">
            {uiState.ankiActiveScheme === "WORD" && (
              <>
                <div className="space-y-1">
                  <label
                    className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
                  >
                    单词字段 (Word)
                  </label>
                  <select
                    value={uiState.ankiFieldFront}
                    onChange={(e) =>
                      setUIState({ ankiFieldFront: e.target.value })
                    }
                    className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                      isLight
                        ? "bg-slate-50 border-slate-205 text-slate-808"
                        : "bg-white/5 border-white/10 text-white"
                    }`}
                  >
                    <option value="Front">Front</option>
                    <option value="Word">Word</option>
                    <option value="单词">单词</option>
                    <option value="Expression">Expression</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label
                    className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
                  >
                    释义字段 (Meaning)
                  </label>
                  <select
                    value={uiState.ankiFieldBack}
                    onChange={(e) =>
                      setUIState({ ankiFieldBack: e.target.value })
                    }
                    className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                      isLight
                        ? "bg-slate-50 border-slate-205 text-slate-808"
                        : "bg-white/5 border-white/10 text-white"
                    }`}
                  >
                    <option value="Back">Back</option>
                    <option value="Meaning">Meaning</option>
                    <option value="释义">释义</option>
                    <option value="Translation">Translation</option>
                  </select>
                </div>
              </>
            )}

            {(uiState.ankiActiveScheme === "WORD" ||
              uiState.ankiActiveScheme === "SENTENCE") && (
              <>
                <div className="space-y-1">
                  <label
                    className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
                  >
                    句子字段 (Context)
                  </label>
                  <select
                    value={uiState.ankiFieldSentence}
                    onChange={(e) =>
                      setUIState({ ankiFieldSentence: e.target.value })
                    }
                    className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                      isLight
                        ? "bg-slate-50 border-slate-205 text-slate-808"
                        : "bg-white/5 border-white/10 text-white"
                    }`}
                  >
                    <option value="Sentence">Sentence</option>
                    <option value="Context">Context</option>
                    <option value="句子">句子</option>
                    <option value="Example">Example</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
                  >
                    句子翻译 (Translation)
                  </label>
                  <select
                    value={uiState.ankiFieldSentenceTranslation}
                    onChange={(e) =>
                      setUIState({
                        ankiFieldSentenceTranslation: e.target.value,
                      })
                    }
                    className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                      isLight
                        ? "bg-slate-50 border-slate-205 text-slate-808"
                        : "bg-white/5 border-white/10 text-white"
                    }`}
                  >
                    <option value="Translation">Translation</option>
                    <option value="Meaning">Meaning</option>
                    <option value="句子翻译">句子翻译</option>
                    <option value="Back">Back</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
                  >
                    游戏图片 (Screenshot)
                  </label>
                  <select
                    value={uiState.ankiFieldGameImage}
                    onChange={(e) =>
                      setUIState({ ankiFieldGameImage: e.target.value })
                    }
                    className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                      isLight
                        ? "bg-slate-50 border-slate-205 text-slate-808"
                        : "bg-white/5 border-white/10 text-white"
                    }`}
                  >
                    <option value="Screenshot">Screenshot</option>
                    <option value="Image">Image</option>
                    <option value="图片">图片</option>
                  </select>
                </div>
              </>
            )}

            {uiState.ankiActiveScheme === "NOTE" && (
              <>
                <div className="space-y-1">
                  <label
                    className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
                  >
                    笔记标题 (Title)
                  </label>
                  <select
                    value={uiState.ankiFieldNoteTitle}
                    onChange={(e) =>
                      setUIState({ ankiFieldNoteTitle: e.target.value })
                    }
                    className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                      isLight
                        ? "bg-slate-50 border-slate-205 text-slate-808"
                        : "bg-white/5 border-white/10 text-white"
                    }`}
                  >
                    <option value="Title">Title</option>
                    <option value="Front">Front</option>
                    <option value="标题">标题</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label
                    className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
                  >
                    笔记内容 (Content)
                  </label>
                  <select
                    value={uiState.ankiFieldNoteContent}
                    onChange={(e) =>
                      setUIState({ ankiFieldNoteContent: e.target.value })
                    }
                    className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                      isLight
                        ? "bg-slate-50 border-slate-205 text-slate-808"
                        : "bg-white/5 border-white/10 text-white"
                    }`}
                  >
                    <option value="Content">Content</option>
                    <option value="Back">Back</option>
                    <option value="内容">内容</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label
                    className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
                  >
                    笔记图片 (Image)
                  </label>
                  <select
                    value={uiState.ankiFieldNoteImage}
                    onChange={(e) =>
                      setUIState({ ankiFieldNoteImage: e.target.value })
                    }
                    className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                      isLight
                        ? "bg-slate-50 border-slate-205 text-slate-808"
                        : "bg-white/5 border-white/10 text-white"
                    }`}
                  >
                    <option value="Image">Image</option>
                    <option value="图片">图片</option>
                    <option value="Screenshot">Screenshot</option>
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label
                className={`text-[10px] font-bold pl-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}
              >
                标签字段 (Tags)
              </label>
              <select
                value={uiState.ankiFieldTags}
                onChange={(e) => setUIState({ ankiFieldTags: e.target.value })}
                className={`w-full rounded-xl py-2 px-3 text-xs outline-none transition-all font-sans font-semibold border ${
                  isLight
                    ? "bg-slate-50 border-slate-205 text-slate-808"
                    : "bg-white/5 border-white/10 text-white"
                }`}
              >
                <option value="Tags">Tags</option>
                <option value="标签">标签</option>
                <option value="Notes">Notes</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GamepadSettings = ({
  uiState,
  setUIState,
}: {
  uiState: UIState;
  setUIState: (s: Partial<UIState>) => void;
}) => {
  const isLight = uiState.theme === "light";
  const [activeRemapBtn, setActiveRemapBtn] = React.useState<string | null>(null);
  const [listeningForInput, setListeningForInput] = React.useState(false);

  // Direct keyboard capture listener
  React.useEffect(() => {
    if (!listeningForInput || !activeRemapBtn) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const keyName = e.key === " " ? "Space" : e.key.toUpperCase();
      const currentMappings = uiState.gamepadMappings || {};
      setUIState({
        gamepadMappings: {
          ...currentMappings,
          [activeRemapBtn]: keyName
        }
      });
      setListeningForInput(false);
      setActiveRemapBtn(null);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [listeningForInput, activeRemapBtn, uiState.gamepadMappings, setUIState]);

  const standardKeys = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
    ["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
  ];

  const controllerButtons = [
    "Dpad-Up", "Dpad-Down", "Dpad-Left", "Dpad-Right",
    "Button A", "Button B", "Button X", "Button Y",
    "Shoulder-L1", "Shoulder-R1", "Select", "Start"
  ];

  const handleRemapSelect = (targetKeyName: string) => {
    if (!activeRemapBtn) return;
    const currentMappings = uiState.gamepadMappings || {};
    setUIState({
      gamepadMappings: {
        ...currentMappings,
        [activeRemapBtn]: targetKeyName
      }
    });
    setActiveRemapBtn(null);
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="space-y-4">
        <button
          className={`w-full py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isLight
              ? "bg-slate-50 hover:bg-slate-150 border-slate-200 text-slate-600"
              : "bg-white/5 border-white/5 text-slate-450 hover:bg-white/10"
          }`}
        >
          <ExternalLink size={14} /> 搜索蓝牙手柄...
        </button>
        <ToggleRow
          label="显示虚拟游戏手柄"
          active={uiState.showVirtualGamepad}
          onClick={() =>
            setUIState({ showVirtualGamepad: !uiState.showVirtualGamepad })
          }
          isLight={isLight}
        />

        {uiState.showVirtualGamepad && (
          <div
            className={`mt-3 p-4 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/50 border-white/5"} space-y-4`}
          >
            {/* Opacity Adjustment */}
            <div className="space-y-2 pb-2 border-b border-dashed border-slate-100 dark:border-white/5">
              <div className="flex justify-between items-center">
                <span className={`text-[10px] font-black uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                  虚拟手柄透明度
                </span>
                <span className="text-[10px] font-mono text-cyan-500 font-bold">
                  {uiState.gamepadOpacity ?? 100}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={uiState.gamepadOpacity ?? 100}
                onChange={(e) =>
                  setUIState({ gamepadOpacity: parseInt(e.target.value) })
                }
                className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Hidden Button Selection */}
            <div className="space-y-2">
              <span
                className={`text-[10px] font-black uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}
              >
                自定义按键显示（点击隐藏/显示）
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  "U",
                  "D",
                  "L",
                  "R",
                  "A",
                  "B",
                  "X",
                  "Y",
                  "L1",
                  "R1",
                  "Select",
                  "Start",
                ].map((btn) => {
                  const isHidden = uiState.gamepadHiddenButtons?.includes(btn);
                  const currentBind = uiState.gamepadMappings?.[btn] || "";
                  return (
                    <button
                      key={btn}
                      onClick={() => {
                        const list = uiState.gamepadHiddenButtons || [];
                        const newList = isHidden
                          ? list.filter((b) => b !== btn)
                          : [...list, btn];
                        setUIState({ gamepadHiddenButtons: newList });
                      }}
                      className={`py-2 px-1 rounded-xl text-[9px] font-bold border uppercase transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 ${
                        isHidden
                          ? isLight
                            ? "bg-slate-100 border-slate-200 text-slate-400 line-through"
                            : "bg-white/5 border-white/5 text-slate-600 line-through"
                          : isLight
                            ? "bg-cyan-55 border-cyan-150 text-cyan-600"
                            : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                      }`}
                    >
                      <span className="font-sans font-black">{btn}</span>
                      <span className="text-[7.5px] scale-90 opacity-60">
                        {currentBind ? `[${currentBind}]` : ""}
                      </span>
                      <span className="text-[6.5px] font-medium opacity-80 mt-0.5">
                        {isHidden ? "已隐藏" : "已显示"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gamepad Key Remapping Panel */}
            <div className="space-y-2 pt-3 border-t border-dashed border-slate-100 dark:border-white/5">
              <span
                className={`text-[10px] font-black uppercase tracking-wider block ${isLight ? "text-slate-500" : "text-slate-400"}`}
              >
                选择虚拟按键进行重映射 (Remap Buttons)
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {["U", "D", "L", "R", "A", "B", "X", "Y", "L1", "R1", "Select", "Start"].map((btn) => {
                  const isActive = activeRemapBtn === btn;
                  const currentBind = uiState.gamepadMappings?.[btn] || "";
                  return (
                    <button
                      key={`remap-${btn}`}
                      onClick={() => {
                        setActiveRemapBtn(isActive ? null : btn);
                        setListeningForInput(false);
                      }}
                      className={`py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all cursor-pointer ${
                        isActive
                          ? "bg-amber-500 text-black border-amber-500 shadow-md scale-95"
                          : isLight
                            ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                            : "bg-white/5 text-slate-300 border-white/5 hover:bg-white/10"
                      }`}
                    >
                      {btn} → {currentBind || "未设置"}
                    </button>
                  );
                })}
              </div>

              {/* Active Remapping Overlay or Dashboard */}
              {activeRemapBtn && (
                <div className={`mt-3 p-3.5 rounded-xl border space-y-3.5 ${isLight ? "bg-amber-50/50 border-amber-200/50" : "bg-amber-500/5 border-amber-500/20"}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                      正在映射: 虚拟手柄 【{activeRemapBtn}】键
                    </span>
                    <button
                      onClick={() => {
                        setActiveRemapBtn(null);
                        setListeningForInput(false);
                      }}
                      className="text-[9px] font-bold text-slate-500 hover:text-red-500 underline uppercase"
                    >
                      取消
                    </button>
                  </div>

                  {/* Direct Signal Capture Toggle */}
                  <div className="space-y-1">
                    <button
                      onClick={() => setListeningForInput(!listeningForInput)}
                      className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        listeningForInput
                          ? "bg-red-500 text-white border-red-500 animate-pulse"
                          : isLight
                            ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-150"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                      }`}
                    >
                      {listeningForInput ? "🔴 正在捕获中...请按下任意键盘按键" : "🎛️ 点击开启直接捕获输入信号"}
                    </button>
                    <p className={`text-[8.5px] scale-95 text-center leading-relaxed ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                      {listeningForInput ? "按下您想绑定的 PC 键盘上的任何按键即可立即自动绑定并保存" : "或在下方列表/虚拟示意图上进行点击选择映射："}
                    </p>
                  </div>

                  {/* Interactive Standard Keyboard Layout */}
                  <div className="space-y-1.5 border-t border-slate-200/20 pt-2.5">
                    <span className={`text-[8.5px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                      💻 标准电脑键盘示意映射图 (Computer Keyboard Diagram)
                    </span>
                    <div className="space-y-1 bg-black/10 dark:bg-black/40 p-2 rounded-lg border border-white/5">
                      {standardKeys.map((row, rIdx) => (
                        <div key={rIdx} className="flex justify-center gap-1">
                          {row.map((k) => {
                            const isSelected = uiState.gamepadMappings?.[activeRemapBtn] === k.toUpperCase();
                            return (
                              <button
                                key={k}
                                onClick={() => handleRemapSelect(k === "Space" ? "Space" : k.toUpperCase())}
                                className={`py-1 px-1.5 text-[8px] font-mono font-bold rounded border uppercase transition-all content-center ${
                                  isSelected
                                    ? "bg-cyan-500 text-black border-cyan-500"
                                    : "bg-black/30 text-white/70 border-white/5 hover:bg-cyan-500/20 hover:text-cyan-400"
                                }`}
                                style={{ minWidth: k.length > 1 ? "30px" : "15px" }}
                              >
                                {k}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Interactive Standard Gamepad Visual Buttons */}
                  <div className="space-y-1.5 border-t border-slate-200/20 pt-2.5">
                    <span className={`text-[8.5px] font-bold uppercase tracking-wider block ${isLight ? "text-slate-400" : "text-slate-500"}`}>
                      🎮 标准游戏手柄物理按键示意映射 (Standard Gamepad Buttons)
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 bg-black/10 dark:bg-black/40 p-2 rounded-lg border border-white/5">
                      {controllerButtons.map((btnName) => {
                        const isSelected = uiState.gamepadMappings?.[activeRemapBtn] === btnName;
                        return (
                          <button
                            key={btnName}
                            onClick={() => handleRemapSelect(btnName)}
                            className={`py-1 rounded text-[8px] font-bold border transition-all ${
                              isSelected
                                ? "bg-cyan-500 text-black border-cyan-500"
                                : "bg-black/30 text-white/60 border-white/5 hover:bg-cyan-500/20 hover:text-cyan-400"
                            }`}
                          >
                            {btnName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

const SettingsSection = ({
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  isLight?: boolean;
}) => {
  return (
    <section className="space-y-4">
      <div className="pt-0">{children}</div>
    </section>
  );
};

const SettingsAccordion = ({
  label,
  active,
  onClick,
  children,
  isLight,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  isLight?: boolean;
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center group">
        <div
          className={`flex-1 flex items-center gap-2 cursor-pointer group select-none`}
          onClick={() => active && setIsExpanded(!isExpanded)}
        >
          <span
            className={`text-[11px] font-bold transition-all ${
              active
                ? isLight
                  ? "text-slate-805"
                  : "text-cyan-400"
                : isLight
                  ? "text-slate-500"
                  : "text-slate-550"
            }`}
          >
            {label}
          </span>
          {active && (
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className={isLight ? "text-slate-400" : "text-slate-600"}
            >
              <ChevronDown size={14} />
            </motion.div>
          )}
        </div>
        <button
          onClick={onClick}
          className={`w-10 h-5 rounded-full relative transition-all ${
            active
              ? "bg-cyan-500 shadow-inner"
              : isLight
                ? "bg-slate-200"
                : "bg-white/10"
          }`}
        >
          <div
            className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${active ? "left-6" : "left-1"}`}
          />
        </button>
      </div>

      <AnimatePresence>
        {active && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="overflow-hidden"
          >
            <div
              className={`pt-2 pb-1 space-y-4 ${isLight ? "border-l border-slate-200" : "border-l border-white/5"} ml-1.5 pl-4`}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SaveList = ({
  uiState,
  setUIState,
}: {
  uiState: UIState;
  setUIState: (s: Partial<UIState>) => void;
}) => {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const filteredSaves = MOCK_SAVES.filter((save) => {
    if (uiState.activeSaveCategory === "ALL") return true;
    if (uiState.activeSaveCategory === "GLOBAL") return save.type === "global";
    if (uiState.activeSaveCategory === "AUTO") return save.type === "auto";
    if (uiState.activeSaveCategory === "MANUAL") return save.type === "manual";
    return true;
  });

  const handleDownloadAll = () => {
    setIsDownloading(true);
    setFeedback("正在打包全部 4 个存档...");
    setTimeout(() => {
      setIsDownloading(false);
      setFeedback("✅ 成功下载全部存档 (.zip)！");
      setTimeout(() => setFeedback(null), 3000);
    }, 1200);
  };

  const handleDetectSaves = () => {
    setIsDetecting(true);
    setFeedback("正在同步重新扫描系统存档...");
    setTimeout(() => {
      setIsDetecting(false);
      setFeedback("✅ 存档扫描更新完毕，检测到最新备份！");
      setTimeout(() => setFeedback(null), 3000);
    }, 1000);
  };

  const isLight = uiState.theme === "light";

  return (
    <div className="space-y-4">
      {/* Dynamic Action Alerts */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 text-[10px] font-semibold text-cyan-500 text-center uppercase tracking-wider"
          >
            {feedback}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Category Sub-tabs */}
      <div
        className={`flex ${isLight ? "bg-slate-100 p-1 rounded-xl" : "bg-white/5 p-1 rounded-xl"} gap-1`}
      >
        {(["ALL", "GLOBAL", "AUTO", "MANUAL"] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setUIState({ activeSaveCategory: cat })}
            className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
              uiState.activeSaveCategory === cat
                ? "bg-cyan-500 text-black shadow-lg text-black font-extrabold"
                : isLight
                  ? "text-slate-500 hover:text-slate-800"
                  : "text-slate-500 hover:text-white"
            }`}
          >
            {cat === "ALL"
              ? "全部"
              : cat === "GLOBAL"
                ? "全局"
                : cat === "AUTO"
                  ? "自动"
                  : "手动"}
          </button>
        ))}
      </div>

      {/* Action Buttons row */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleDownloadAll}
          disabled={isDownloading}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all select-none ${
            isDownloading
              ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-500/50 cursor-not-allowed"
              : isLight
                ? "bg-white hover:bg-slate-50 border-slate-250 text-slate-650"
                : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-350"
          }`}
        >
          <Download
            size={11}
            className={isDownloading ? "animate-bounce" : ""}
          />
          下载全部存档
        </button>

        <button
          onClick={handleDetectSaves}
          disabled={isDetecting}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all select-none ${
            isDetecting
              ? "bg-white/5 border-white/10 text-slate-650 cursor-not-allowed"
              : isLight
                ? "bg-white hover:bg-slate-50 border-slate-250 text-slate-650"
                : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-350"
          }`}
        >
          <RefreshCw size={11} className={isDetecting ? "animate-spin" : ""} />
          重新检测存档
        </button>
      </div>

      <button
        className={`w-full border border-dashed rounded-xl py-3 text-[9px] font-black transition-all uppercase tracking-widest ${
          isLight
            ? "bg-slate-50/50 border-slate-250 text-slate-500 hover:border-slate-350 hover:text-slate-800"
            : "bg-white/5 border-white/10 text-slate-500 hover:border-white/20 hover:text-white"
        }`}
      >
        + 导入本地存档
      </button>

      <div className="space-y-2">
        {filteredSaves.length === 0 ? (
          <p className="text-center py-6 text-[10px] font-bold text-slate-500">
            此分类暂无存档
          </p>
        ) : (
          filteredSaves.map((save) => (
            <div
              key={save.id}
              className={`p-3 border rounded-xl flex items-center justify-between group transition-all ${
                isLight
                  ? "bg-slate-50 hover:bg-slate-100/70 border-slate-200"
                  : "bg-white/[0.03] border-white/5 hover:border-cyan-500/20"
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      save.type === "global"
                        ? "bg-purple-500"
                        : save.type === "auto"
                          ? "bg-green-500"
                          : "bg-blue-500"
                    }`}
                  />
                  <p
                    className={`text-[11px] font-bold truncate ${isLight ? "text-slate-800" : "text-white"}`}
                  >
                    {save.name}
                  </p>
                </div>
                <p
                  className={`text-[9px] font-mono italic ${isLight ? "text-slate-450" : "text-slate-500"}`}
                >
                  {save.date}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <IconButton icon={<Download size={14} />} isLight={isLight} />
                <IconButton
                  icon={<Trash2 size={14} />}
                  danger
                  isLight={isLight}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ScreenshotList = ({ uiState }: { uiState: UIState }) => {
  const isLight = uiState.theme === "light";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {MOCK_SCREENSHOTS.map((sc) => (
          <div
            key={sc.id}
            className={`group relative aspect-video rounded-xl overflow-hidden border bg-slate-900 ${
              isLight ? "border-slate-250 shadow" : "border-white/5 bg-white/5"
            }`}
          >
            <img
              src={sc.url}
              className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-500"
              alt="Quick Shot"
            />
            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center">
              <span className="text-[8px] font-mono text-white/60">
                {sc.date.split(" ")[1]}
              </span>
              <div className="flex gap-1">
                <button className="p-1 hover:text-cyan-400 cursor-pointer">
                  <Download size={12} />
                </button>
                <button className="p-1 hover:text-red-400 cursor-pointer">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        className={`w-full py-3 border border-dashed rounded-xl text-[9px] font-black transition-all uppercase tracking-widest ${
          isLight
            ? "bg-slate-50/50 border-slate-250 text-slate-500 hover:border-slate-350 hover:text-slate-800"
            : "bg-white/5 border-white/10 text-slate-500 hover:border-white/20"
        }`}
      >
        + 批量管理图片
      </button>
    </div>
  );
};

const NoteList = ({
  uiState,
  setUIState,
}: {
  uiState: UIState;
  setUIState: (s: Partial<UIState>) => void;
}) => {
  const notes = uiState.notes || [];
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<
    "all" | "none" | "todo" | "unprocessed" | "story"
  >("all");

  const handleEditNote = (id: string) => {
    setUIState({ editingNoteId: id, isNoteEditorOpen: true });
  };

  const handleDeleteNote = (id: string) => {
    const updatedNotes = notes.filter((n) => n.id !== id);
    setUIState({ notes: updatedNotes });
  };

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      (note.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (note.content || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      activeCategory === "all" || (note.category || "none") === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const isLight = uiState.theme === "light";

  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case "todo":
        return "待办";
      case "unprocessed":
        return "未处理";
      case "story":
        return "情节";
      default:
        return "未分类";
    }
  };

  return (
    <div className="space-y-4">
      {/* New Note Button */}
      <button
        onClick={() =>
          setUIState({ isNoteEditorOpen: true, editingNoteId: null })
        }
        className="w-full bg-cyan-500 text-black font-black py-4 rounded-xl text-[10px] uppercase tracking-[0.2em] hover:bg-cyan-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
      >
        <StickyNote size={14} /> 新增随手记
      </button>

      {/* Top Search filter input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          type="text"
          placeholder="搜索随声笔记..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full border rounded-xl py-2 pl-9 pr-4 text-[11px] outline-none focus:border-cyan-500/50 transition-colors ${
            isLight
              ? "bg-slate-50 border-slate-200 text-slate-800"
              : "bg-black/20 border-white/5 text-white"
          }`}
        />
      </div>

      {/* Categories subpills / tabs inside Note List */}
      <div className="flex gap-1 overflow-x-auto py-1 custom-scrollbar scrollbar-none select-none">
        {[
          { value: "all", label: "全部" },
          { value: "todo", label: "待办" },
          { value: "unprocessed", label: "未处理" },
          { value: "story", label: "情节" },
          { value: "none", label: "未分类" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveCategory(tab.value as any)}
            className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg border shrink-0 transition-all ${
              activeCategory === tab.value
                ? "bg-cyan-500 border-cyan-500 text-black shadow-md"
                : isLight
                  ? "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-600"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-slate-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Compact layout representing color points, title headings, and controls */}
      <div className="space-y-2">
        {filteredNotes.length === 0 ? (
          <div className="text-center py-10 text-slate-600">
            <StickyNote size={24} className="mx-auto mb-2 opacity-20" />
            <p className="text-[9px] uppercase tracking-widest font-black">
              暂无该分类笔记
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`p-3 border rounded-xl flex items-center justify-between group transition-all ${
                isLight
                  ? "bg-slate-50 hover:bg-slate-100 border-slate-205"
                  : "bg-white/[0.03] border-white/5 hover:border-cyan-500/20"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 pr-2">
                {/* Prefix point colored marker */}
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/15 inline-block shadow-sm"
                  style={{ backgroundColor: note.color || "#06b6d4" }}
                />

                <div className="min-w-0">
                  <h4
                    className={`text-xs font-semibold truncate tracking-tight ${isLight ? "text-slate-800" : "text-white"}`}
                  >
                    {note.title || "无标题随记"}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[8px] px-1 rounded font-black uppercase tracking-wider ${
                        note.category === "todo"
                          ? "bg-amber-500/10 text-amber-500 border border-amber-500/25"
                          : note.category === "unprocessed"
                            ? "bg-rose-500/10 text-rose-500 border border-rose-500/25"
                            : note.category === "story"
                              ? "bg-purple-500/10 text-purple-700 border border-purple-500/25"
                              : "bg-slate-500/10 text-slate-400 border border-slate-500/10"
                      }`}
                    >
                      {getCategoryLabel(note.category)}
                    </span>
                    <span
                      className={`text-[8px] font-mono ${isLight ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {note.timestamp?.split(" ")[0]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action operations */}
              <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEditNote(note.id)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                    isLight
                      ? "text-slate-500 hover:bg-slate-200 hover:text-slate-900 border-slate-200"
                      : "text-slate-400 hover:bg-white/10 hover:text-cyan-400 border-white/5"
                  }`}
                  title="编辑"
                >
                  <Edit2 size={11} />
                </button>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                    isLight
                      ? "text-red-500 hover:bg-red-500/10 border-red-200"
                      : "text-slate-400 hover:bg-red-500/25 hover:text-red-400 border-white/5"
                  }`}
                  title="删除"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const VocabList = ({
  uiState,
  setUIState,
}: {
  uiState: UIState;
  setUIState: (s: Partial<UIState>) => void;
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const ITEMS_PER_PAGE = 15;
  const isLight = uiState.theme === "light";

  const filteredVocab = React.useMemo(() => {
    let list = MOCK_VOCAB.filter((v) =>
      v.word.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    if (uiState.vocabSortOrder === "NEWEST") {
      list = [...list].reverse();
    }
    return list;
  }, [searchTerm, uiState.vocabSortOrder]);

  const totalPages = Math.ceil(filteredVocab.length / ITEMS_PER_PAGE);
  const displayedVocab = filteredVocab.slice(
    (uiState.vocabPage - 1) * ITEMS_PER_PAGE,
    uiState.vocabPage * ITEMS_PER_PAGE,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full border rounded-xl py-2 pl-9 pr-4 text-[11px] outline-none focus:border-cyan-500/50 transition-colors ${
              isLight
                ? "bg-slate-50 border-slate-205 text-slate-800"
                : "bg-black/20 border-white/5 text-white"
            }`}
          />
        </div>
        <button
          onClick={() =>
            setUIState({
              vocabSortOrder:
                uiState.vocabSortOrder === "NEWEST" ? "OLDEST" : "NEWEST",
            })
          }
          className={`p-2 rounded-xl border transition-all ${
            uiState.vocabSortOrder === "NEWEST"
              ? "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"
              : isLight
                ? "text-slate-400 bg-slate-100 border-slate-200"
                : "text-slate-500 border-white/5 hover:text-white"
          }`}
        >
          <List size={16} />
        </button>
      </div>

      <div className="space-y-2">
        {displayedVocab.map((word) => (
          <div
            key={word.id}
            className={`group border rounded-xl p-3 flex items-center gap-3 transition-all ${
              isLight
                ? "bg-slate-50 hover:border-cyan-500/20 hover:bg-slate-100/75 border-slate-200"
                : "bg-white/[0.03] border-white/5 hover:border-cyan-500/30 hover:bg-white/[0.05]"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-black text-cyan-500/40">V</span>
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-bold truncate ${isLight ? "text-slate-800" : "text-white"}`}
              >
                {word.word}
              </p>
              <p
                className={`text-[9px] truncate ${isLight ? "text-slate-450" : "text-slate-500"}`}
              >
                {word.translation}
              </p>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button
            disabled={uiState.vocabPage <= 1}
            onClick={() => setUIState({ vocabPage: uiState.vocabPage - 1 })}
            className={`text-[10px] font-black uppercase tracking-widest disabled:opacity-20 hover:text-cyan-400 transition-colors ${
              isLight ? "text-slate-500" : "text-slate-450"
            }`}
          >
            Prev
          </button>
          <span className="text-[10px] font-mono text-cyan-500/50">
            {uiState.vocabPage} / {totalPages}
          </span>
          <button
            disabled={uiState.vocabPage >= totalPages}
            onClick={() => setUIState({ vocabPage: uiState.vocabPage + 1 })}
            className={`text-[10px] font-black uppercase tracking-widest disabled:opacity-20 hover:text-cyan-400 transition-colors ${
              isLight ? "text-slate-500" : "text-slate-450"
            }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

const ToggleRow = ({
  label,
  active,
  onClick,
  isLight,
}: {
  label: string;
  active: boolean;
  onClick?: () => void;
  isLight?: boolean;
}) => (
  <div
    className="flex justify-between items-center cursor-pointer select-none"
    onClick={onClick}
  >
    <span
      className={`text-[11px] font-bold ${active ? (isLight ? "text-slate-805" : "text-slate-300") : isLight ? "text-slate-500" : "text-slate-600"}`}
    >
      {label}
    </span>
    <button
      className={`w-10 h-5 rounded-full relative transition-all ${
        active
          ? "bg-cyan-500 shadow-inner"
          : isLight
            ? "bg-slate-200"
            : "bg-white/10"
      }`}
    >
      <div
        className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${active ? "left-6" : "left-1"}`}
      />
    </button>
  </div>
);

const RangeRow = ({
  label,
  value,
  isLight,
}: {
  label: string;
  value: number;
  isLight?: boolean;
}) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-[10px] font-bold">
      <span className={isLight ? "text-slate-500" : "text-slate-500"}>
        {label}
      </span>
      <span className="text-cyan-400">{value}%</span>
    </div>
    <div
      className={`h-1 rounded-full relative ${isLight ? "bg-slate-205" : "bg-white/10"}`}
    >
      <div
        className="absolute inset-y-0 left-0 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.4)]"
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

const IconButton = ({
  icon,
  danger,
  isLight,
}: {
  icon: any;
  danger?: boolean;
  isLight?: boolean;
}) => (
  <button
    className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
      danger
        ? "text-red-400 hover:bg-red-550/20 border-red-500/10"
        : isLight
          ? "text-slate-500 hover:bg-slate-200 border-slate-200 hover:text-slate-800"
          : "text-slate-400 hover:bg-white/10 border-white/15 hover:text-white"
    }`}
  >
    {icon}
  </button>
);
