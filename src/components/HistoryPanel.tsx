import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Play } from 'lucide-react';

interface HistoryEntry {
  id: number;
  text: string;
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  theme?: 'light' | 'dark';
  fontSize?: number; // 0-200 percentage, same as TextOverlay
  // TTS props for sentence playback
  ttsEnabled?: boolean;
  ttsVoice?: string;
  ttsSpeed?: number;
  ttsPitch?: number;
  ttsVolume?: number;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  history,
  theme = 'dark',
  fontSize = 100,
  ttsEnabled = false,
  ttsVoice = '',
  ttsSpeed = 100,
  ttsPitch = 100,
  ttsVolume = 80,
}) => {
  const isLight = theme === 'light';
  // History panel is always fully opaque — no transparency
  const bgColor = isLight ? '#ffffff' : '#0a0d12';
  const borderColor = isLight ? 'border-slate-200' : 'border-white/10';

  // TTS playback for a history sentence
  const speakSentence = React.useCallback((text: string) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    if (ttsVoice) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find(
        v => v.name === ttsVoice || v.voiceURI === ttsVoice
      );
      if (selectedVoice) utterance.voice = selectedVoice;
    }

    const rate = ttsSpeed <= 2 ? ttsSpeed : ttsSpeed / 100;
    const pitch = ttsPitch <= 2 ? ttsPitch : ttsPitch / 100;
    const volume = ttsVolume <= 1 ? ttsVolume : ttsVolume / 100;

    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    window.speechSynthesis.speak(utterance);
  }, [ttsVoice, ttsSpeed, ttsPitch, ttsVolume]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.1 }}
          style={{ backgroundColor: bgColor }}
          className={`w-[90%] max-w-xl border rounded-t-2xl overflow-hidden pointer-events-auto shadow-2xl ${borderColor}`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-2.5 border-b ${borderColor}`}>
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className={isLight ? 'text-slate-500' : 'text-cyan-400'} />
              <span className={`text-[11px] font-black uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-cyan-300'}`}>
                对话历史记录
              </span>
              <span className={`text-[9px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                {history.length} 条
              </span>
            </div>
            <button
              onClick={onClose}
              className={`p-1 rounded-lg transition-all cursor-pointer ${
                isLight
                  ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                  : 'text-slate-400 hover:text-red-400 hover:bg-white/10'
              }`}
              title="关闭历史记录"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[50vh] overflow-y-auto overscroll-contain" style={{ fontSize: `${fontSize}%` }}>
            {history.length === 0 ? (
              <div className={`px-4 py-8 text-center text-[11px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                暂无对话记录
              </div>
            ) : (
              <div className="divide-y divide-slate-200/10 dark:divide-white/5">
                {history.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`px-4 py-3 transition-colors ${
                      isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* TTS Play button */}
                      {ttsEnabled && (
                        <button
                          onClick={(e) => { e.stopPropagation(); speakSentence(entry.text); }}
                          className={`p-1 rounded-md transition-all cursor-pointer shrink-0 mt-0.5 ${
                            isLight
                              ? 'text-slate-400 hover:text-cyan-600 hover:bg-slate-200'
                              : 'text-slate-500 hover:text-cyan-400 hover:bg-white/10'
                          }`}
                          title="朗读此句"
                        >
                          <Play size={10} />
                        </button>
                      )}
                      <span className={`text-[9px] font-mono font-bold mt-0.5 shrink-0 w-6 text-right ${
                        isLight ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        #{idx + 1}
                      </span>
                      <p className={`text-xs sm:text-sm font-semibold leading-relaxed ${
                        isLight ? 'text-slate-700' : 'text-white/90'
                      }`}>
                        {entry.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
