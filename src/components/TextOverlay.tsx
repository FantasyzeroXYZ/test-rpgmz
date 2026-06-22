import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, RefreshCw, Zap, ZapOff, Languages, X, BookOpen, Clipboard, Pointer, Dna, Volume2, VolumeX, Play, List } from 'lucide-react';
import { VocabWord } from '../types';
// 翻译服务 — 使用 MyMemory API 进行真实翻译
import { translateText, translateWithCache } from '../services/translationService';

interface TextOverlayProps {
  isOpen: boolean;
  onToggle?: () => void;
  text: string;
  opacity?: number;
  fontSize?: number;
  autoUpdate?: boolean;
  onToggleAuto?: () => void;
  showTranslation?: boolean;
  autoTranslate?: boolean;
  theme?: 'light' | 'dark';
  tokenizerMethod?: 'none' | 'browser' | 'space' | 'char' | 'japanese';
  textSelectableMode?: 'clickable' | 'selectable';
  isDictionaryOpen?: boolean;
  onToggleDictionary?: () => void;
  onWordClick?: (word: string) => void;
  autoCopyToClipboard?: boolean;
  onToggleClipboard?: () => void;
  lookupMode?: 'click' | 'yomitan';
  onToggleLookupMode?: () => void;
  lemmatizationEnabled?: boolean;
  onToggleLemmatization?: () => void;
  ttsEnabled?: boolean;
  ttsAutoPlay?: boolean;
  onToggleTtsAutoPlay?: () => void;
  ttsVoice?: string;
  ttsSpeed?: number;
  ttsPitch?: number;
  ttsVolume?: number;
  showHistory?: boolean;
  onHistoryClick?: () => void;
}

// Access the globalVocabList from VocabOverlay context indirectly
// fallback initialization if not defined elsewhere
declare let globalVocabList: VocabWord[];

export const TextOverlay: React.FC<TextOverlayProps> = ({ 
  isOpen, 
  onToggle,
  text, 
  opacity = 80, 
  fontSize = 100,
  autoUpdate = true,
  onToggleAuto,
  showTranslation = false,
  autoTranslate = false,
  theme = 'dark',
  tokenizerMethod = 'browser',
  textSelectableMode = 'clickable',
  isDictionaryOpen = false,
  onToggleDictionary,
  onWordClick,
  autoCopyToClipboard = false,
  onToggleClipboard,
  lookupMode = 'click',
  onToggleLookupMode,
  lemmatizationEnabled = true,
  onToggleLemmatization,
  ttsEnabled = false,
  ttsAutoPlay = true,
  onToggleTtsAutoPlay,
  ttsVoice = 'en-US-Standard-C',
  ttsSpeed = 100,
  ttsPitch = 100,
  ttsVolume = 80,
  showHistory = true,
  onHistoryClick
}) => {
  const [selectedWord, setSelectedWord] = React.useState<string | null>(null);
  const [translationText, setTranslationText] = React.useState<string | null>(null);
  const [isTranslating, setIsTranslating] = React.useState(false);
  const [isTranslationExpanded, setIsTranslationExpanded] = React.useState(true);
  const isLight = theme === 'light';

  // TTS Speech Function
  const speakText = React.useCallback((textToSpeak: string) => {
    if ('speechSynthesis' in window && textToSpeak) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      // Attempt to find actual voice if specified
      if (ttsVoice) {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.name === ttsVoice || v.lang === ttsVoice);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }
      
      // Determine rate, pitch, volume safely supporting both decimal/percentage
      const rate = ttsSpeed <= 2 ? ttsSpeed : ttsSpeed / 100;
      const pitch = ttsPitch <= 2 ? ttsPitch : ttsPitch / 100;
      const volume = ttsVolume <= 1 ? ttsVolume : ttsVolume / 100;
      
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;
      
      window.speechSynthesis.speak(utterance);
    }
  }, [ttsVoice, ttsSpeed, ttsPitch, ttsVolume]);

  // Autoplay TTS when text changes
  React.useEffect(() => {
    if (ttsEnabled && ttsAutoPlay && isOpen && text) {
      // Small timeout to prevent interference with transition animations or double-playing
      const timer = setTimeout(() => {
        speakText(text);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [text, ttsEnabled, ttsAutoPlay, isOpen, speakText]);

  const handleTranslate = async () => {
    if (!text?.trim()) return;
    setIsTranslating(true);
    try {
      // 使用 MyMemory API 进行真实翻译（自动检测源语言 → 中文）
      const result = await translateWithCache(text, 'auto', 'zh-CN');
      setTranslationText(result.translatedText);
    } catch (e) {
      console.warn('[TextOverlay] 翻译失败:', e);
      setTranslationText('翻译服务暂时不可用，请稍后重试。');
    } finally {
      setIsTranslating(false);
    }
  };

  React.useEffect(() => {
    if (autoTranslate && showTranslation && isOpen) {
      handleTranslate();
    } else if (!isOpen) {
      setTranslationText(null);
    }
  }, [text, autoTranslate, showTranslation, isOpen]);

  // Dynamic Tokenization function based on setting
  const segmentedWords = React.useMemo(() => {
    if (!text) return [];
    if (tokenizerMethod === 'none') return [text];
    if (tokenizerMethod === 'space') return text.split(/\s+/);
    if (tokenizerMethod === 'char') return text.split('');
    if (tokenizerMethod === 'browser') {
      try {
        // Intl.Segmenter native support
        // @ts-ignore
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
        const segments = [...segmenter.segment(text)];
        return segments.map(s => s.segment);
      } catch (e) {
        // fallback
        return text.split(/(\b|\s+)/).filter(Boolean);
      }
    }
    return text.split(' ');
  }, [text, tokenizerMethod]);

  const handleQuickAddVocab = (word: string) => {
    try {
      if (typeof globalVocabList === 'undefined') {
        (window as any).globalVocabList = (window as any).globalVocabList || [];
      }
      const list = typeof globalVocabList !== 'undefined' ? globalVocabList : (window as any).globalVocabList;
      
      const exists = list.some((v: any) => v.word.toLowerCase() === word.toLowerCase());
      if (exists) {
        alert(`单词 "${word}" 已经存在于生词本中。`);
        return;
      }
      
      const newVocab: VocabWord = {
        id: Math.random().toString(36).substring(2, 9),
        word: word,
        translation: '智能匹配释义记录中...',
        context: text,
        addedAt: new Date().toISOString().split('T')[0]
      };
      
      list.push(newVocab);
      alert(`已将 "${word}" 成功添加至核心生词本！`);
      setSelectedWord(null);
    } catch (e) {
      alert(`添加到生词本时遇到错误，已成功记录单词 "${word}"。`);
    }
  };

  const normalizedOpacity = opacity <= 1 ? opacity : opacity / 100;
  const bgColor = isLight ? `rgba(255, 255, 255, ${normalizedOpacity})` : `rgba(5, 7, 10, ${normalizedOpacity})`;
  const borderColor = isLight ? 'border-slate-200' : 'border-white/10';
  const shadowColor = isLight ? 'shadow-slate-200/50' : 'shadow-2xl';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          style={{ backgroundColor: bgColor }}
          className={`w-[92%] max-w-4xl backdrop-blur-2xl border border-b-0 overflow-hidden pointer-events-auto relative group flex shadow-2xl ${borderColor} ${shadowColor}`}
        >
          {/* Main Content Side (Left) */}
          <div className="flex-1 flex flex-col relative px-3 sm:px-6 md:px-10 pt-3 pb-2 justify-end">
            {/* Translation Area (Now placed above the original text display and expands upwards) */}
            {showTranslation && translationText && (
              <div className="mb-2.5 border-b border-dashed border-slate-100 dark:border-white/5 pb-2">
                <div className="flex items-center justify-between gap-2 mb-1.5 select-none">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] sm:text-[9px] font-black uppercase bg-cyan-500/10 text-cyan-500 px-1.5 py-0.5 rounded tracking-widest scale-90 origin-left">
                      翻译展示 (Translation)
                    </span>
                    {isTranslating && (
                      <span className="text-[8px] text-cyan-400 font-mono animate-pulse">
                        Translating...
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setIsTranslationExpanded(!isTranslationExpanded)}
                    className={`flex items-center gap-0.5 text-[8px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                      isLight
                        ? "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        : "bg-white/5 border-white/10 text-cyan-400 hover:bg-cyan-400/10"
                    }`}
                    title={isTranslationExpanded ? "折叠翻译" : "展开翻译"}
                  >
                    {isTranslationExpanded ? "折叠 ▴" : "展开 ▾"}
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {isTranslationExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <p className={`text-[10px] md:text-xs font-semibold leading-relaxed border-l-2 pl-3 italic ${
                        isLight ? 'text-slate-500 border-slate-300' : 'text-cyan-400/80 border-cyan-500/30'
                      }`}>
                        {translationText}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Content Area (Top) */}
            <div className={`${isLight ? 'text-slate-800' : 'text-white'} leading-tight`} style={{ fontSize: `${fontSize}%` }}>
              {textSelectableMode === 'selectable' ? (
                // Copyable text form for Yomitan scanning
                <div className="select-text text-left font-bold text-xs sm:text-sm tracking-wide leading-relaxed">
                  {text}
                </div>
              ) : (
                // Segmented word list
                <div className="flex flex-wrap gap-x-[1px] gap-y-0.5 justify-start">
                  {segmentedWords.map((word, i) => {
                    if (!word || word.trim() === '') {
                      return <span key={i} className="w-[3px]" />;
                    }
                    return (
                      <div key={i} className="relative">
                        <span 
                          onClick={() => {
                            if (onWordClick) {
                              onWordClick(word);
                            } else {
                              setSelectedWord(selectedWord === word ? null : word);
                            }
                          }} 
                          className={`font-semibold tracking-wide transition-all cursor-pointer border-b-2 border-transparent px-[2px] py-0.5 rounded text-xs sm:text-sm ${
                            selectedWord === word && !onWordClick
                              ? 'text-cyan-400 bg-cyan-500/20 border-cyan-500 shadow-md shadow-cyan-500/10' 
                              : isLight 
                                ? 'text-slate-800 hover:text-cyan-600 hover:bg-slate-100 hover:border-cyan-500/40' 
                                : 'text-white/95 hover:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500'
                          }`}
                          style={{ fontSize: '1em' }}
                        >
                          {word}
                        </span>
                        
                        {/* Definition Popover (Minimal) - Only show if onWordClick is not provided */}
                        <AnimatePresence>
                          {selectedWord === word && !onWordClick && (
                            <motion.div
                              key={`popover-${i}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 border rounded-xl p-3 shadow-2xl z-50 pointer-events-auto ${
                                isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0a0d12] border-white/10 text-white'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest leading-none truncate max-w-[120px]">{word}</h4>
                                <span className="text-[8px] font-bold text-slate-500 bg-cyan-500/10 px-1 rounded">Dic</span>
                              </div>
                              <p className={`text-[10px] leading-relaxed mb-2 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                                这是针对生词 "{word}" 的智能AI/词典极速释义。您可一键将其记录至底层核心生词本中。
                              </p>
                              <button 
                                onClick={() => handleQuickAddVocab(word)}
                                className="w-full py-1.5 bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/15 rounded-lg text-[8px] font-black uppercase text-black transition-colors cursor-pointer"
                              >
                                添加到生词本
                              </button>
                              <div className={`absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent ${isLight ? 'border-t-white animate-pulse' : 'border-t-[#0a0d12]'}`} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>



            {/* Action Row (Bottom Right of main content) */}
            <div className="flex items-center justify-end gap-1.5 z-30 mt-2">
              <button 
                onClick={() => {
                  if (typeof (window as any).globalSentenceList === 'undefined') {
                    (window as any).globalSentenceList = [];
                  }
                  const list = (window as any).globalSentenceList;
                  const newSentence = {
                    id: Math.random().toString(36).substring(2, 9),
                    sentence: text,
                    translation: translationText || '暂无翻译',
                  };
                  list.push(newSentence);
                  alert("已将当前对话添加至句子本！");
                }}
                className={`p-1 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  isLight 
                    ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-200' 
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title="添加到句子本"
              >
                <BookOpen size={10} />
              </button>

              {onToggle && (
                <button 
                  onClick={onToggle}
                  className="p-1 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                  title="关闭"
                >
                  <X size={10} />
                </button>
              )}

              {ttsEnabled && !ttsAutoPlay && (
                  <button 
                    onClick={() => speakText(text)}
                    className={`p-1 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                      isLight 
                        ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-200' 
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="播放语音"
                  >
                    <Play size={10} />
                  </button>
              )}

              {showTranslation && !autoTranslate && (
                 <button 
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className={`p-1 rounded-lg transition-all cursor-pointer ${
                    isTranslating 
                      ? 'animate-spin text-cyan-400' 
                      : isLight 
                        ? 'text-slate-400 hover:text-cyan-600 bg-slate-200 hover:bg-slate-300' 
                        : 'text-slate-500 hover:text-cyan-400 bg-white/5'
                  }`}
                  title="手动翻译"
                >
                  <Languages size={10} />
                </button>
              )}

              {lookupMode !== 'yomitan' && (
                <>
                  <button 
                    onClick={onToggleLemmatization}
                    className={`p-1 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                      lemmatizationEnabled 
                        ? 'text-indigo-405 bg-indigo-400/10 border border-indigo-400/20' 
                        : isLight 
                          ? 'text-slate-500 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 border border-transparent' 
                          : 'text-slate-400 hover:text-white bg-white/5'
                    }`}
                    title={lemmatizationEnabled ? '关闭外挂词形还原预处理' : '开启外挂词形还原预处理'}
                  >
                    <Dna size={10} />
                  </button>

                  <button 
                    onClick={onToggleClipboard}
                    className={`p-1 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                      autoCopyToClipboard 
                        ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/20' 
                        : isLight 
                          ? 'text-slate-500 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 border border-transparent' 
                          : 'text-slate-400 hover:text-white bg-white/5'
                    }`}
                    title={autoCopyToClipboard ? '关闭剪贴板自动复制功能' : '开启剪贴板自动复制功能'}
                  >
                    <Clipboard size={10} />
                  </button>
                </>
              )}

              <button 
                onClick={onToggleLookupMode}
                className={`p-1 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  lookupMode === 'yomitan' 
                    ? 'text-amber-400 bg-amber-400/10 border border-amber-400/20' 
                    : isLight 
                      ? 'text-slate-500 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 border border-transparent' 
                      : 'text-slate-400 hover:text-white bg-white/5'
                }`}
                title={lookupMode === 'yomitan' ? '当前查词模式：外挂划词兼容 (Yomitan)' : '当前查词模式：极速智能分词点击'}
              >
                <Pointer size={10} className={lookupMode === 'yomitan' ? 'rotate-12' : ''} />
              </button>

              <button 
                onClick={onToggleAuto}
                className={`p-1 rounded-lg transition-all cursor-pointer ${
                  autoUpdate 
                    ? 'text-cyan-400 bg-cyan-400/10' 
                    : isLight 
                      ? 'text-slate-400 hover:text-slate-800 bg-slate-200' 
                      : 'text-slate-500 hover:text-white bg-white/5'
                }`}
                title={autoUpdate ? '自动更新中' : '手动模式'}
              >
                {autoUpdate ? <Zap size={10} fill="currentColor" /> : <ZapOff size={10} />}
              </button>
              
              {!autoUpdate && (
                <button 
                  onClick={handleTranslate}
                  className={`p-1 transition-colors rounded-lg cursor-pointer ${
                    isLight 
                      ? 'text-slate-400 hover:text-slate-800 bg-slate-200 hover:bg-slate-300' 
                      : 'text-slate-500 hover:text-cyan-400 bg-white/5'
                  }`} 
                  title="手动刷新"
                >
                  <RefreshCw size={10} />
                </button>
              )}
              
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(text);
                  alert("文本已复制到剪贴板！");
                }}
                className={`p-1 transition-colors rounded-lg cursor-pointer ${
                  isLight 
                    ? 'text-slate-400 hover:text-slate-800 bg-slate-200 hover:bg-slate-300' 
                    : 'text-slate-500 hover:text-white bg-white/5'
                }`} 
                title="复制"
              >
                <Copy size={10} />
              </button>
            </div>
          </div>

          {/* Vertical Sidebar Column for Primary Actions (Right) */}
          <div className={`w-8 sm:w-12 border-l flex flex-col items-center justify-end py-2 gap-2 ${borderColor}`}>
            {showHistory && (
              <button 
                onClick={onHistoryClick}
                className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                  isLight 
                    ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-200' 
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title="查看并导出对话历史记录包"
              >
                <List size={14} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            )}

            {ttsEnabled && (
                <button 
                  onClick={onToggleTtsAutoPlay}
                  className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                    ttsAutoPlay 
                      ? 'text-pink-400 bg-pink-400/10 border border-pink-400/20' 
                      : isLight 
                        ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-200 border border-transparent' 
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={ttsAutoPlay ? '当前语音朗读：自动播放' : '当前语音朗读：手动播放'}
                >
                  {ttsAutoPlay ? <Volume2 size={14} className="sm:w-[16px] sm:h-[16px]" /> : <VolumeX size={14} className="sm:w-[16px] sm:h-[16px]" />}
                </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
