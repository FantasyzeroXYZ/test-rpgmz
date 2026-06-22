import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Zap, BookOpen } from 'lucide-react';
import { UIState } from '../types';

interface FloatingLookupCardProps {
  uiState: UIState;
  setUIState: (state: Partial<UIState>) => void;
  onAddToVocab: (word: string, definition: string) => void;
  onAddToAnki: (word: string, definition: string) => void;
}

export const FloatingLookupCard: React.FC<FloatingLookupCardProps> = ({
  uiState,
  setUIState,
  onAddToVocab,
  onAddToAnki
}) => {
  if (!uiState.isLookupCardOpen || !uiState.lookupWord) return null;

  const isLight = uiState.theme === 'light';
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`w-full max-w-sm border rounded-2xl shadow-2xl pointer-events-auto overflow-hidden ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#0d1117] border-white/10 text-white'
          }`}
        >
          {/* Action Row - Moved to top, title removed */}
          <div className={`flex gap-2 p-3 border-b ${
            isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/2'
          }`}>
            <button
              onClick={() => onAddToVocab(uiState.lookupWord!, uiState.lookupResult?.definition || '无')}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl transition-all cursor-pointer shadow-lg shadow-cyan-500/10"
            >
              <Plus size={14} strokeWidth={3} />
              <span className="text-[10px] font-black uppercase">生词本</span>
            </button>
            <button
              onClick={() => onAddToAnki(uiState.lookupWord!, uiState.lookupResult?.definition || '无')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl transition-all cursor-pointer border ${
                isLight 
                  ? 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800' 
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
            >
              <Zap size={14} />
              <span className="text-[10px] font-black uppercase">Anki</span>
            </button>
            
            <button 
              onClick={() => setUIState({ isLookupCardOpen: false })}
              className={`p-2 rounded-xl border transition-colors ${
                isLight ? 'hover:bg-slate-200 border-slate-200 text-slate-400' : 'hover:bg-white/10 border-white/10 text-slate-500'
              }`}
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight mb-1">{uiState.lookupWord}</h2>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                  isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-slate-400'
                }`}>
                  {uiState.lookupResult?.dictionaryName || 'SYSTEM_DIC'}
                </span>
              </div>
            </div>

            {(() => {
              const definition = uiState.lookupResult?.definition || '暂无释义...';
              const isDual = definition.includes('【Yomitan 本地词典】');

              if (isDual) {
                const apiHeaderIndex = definition.indexOf('【Free Dictionary API】');
                const loadingIndex = definition.indexOf('⏳ 正在同时获取 API 词典释义...');
                const localStart = definition.indexOf('【Yomitan 本地词典】') + '【Yomitan 本地词典】'.length;

                let localPart = '';
                let apiPart = '';

                if (apiHeaderIndex !== -1) {
                  localPart = definition.substring(localStart, apiHeaderIndex).trim();
                  apiPart = definition.substring(apiHeaderIndex).trim();
                } else if (loadingIndex !== -1) {
                  localPart = definition.substring(localStart, loadingIndex).trim();
                  apiPart = definition.substring(loadingIndex).trim();
                } else {
                  localPart = definition.substring(localStart).trim();
                }

                // Remove structural prefix headers to present cleanly
                if (apiPart.startsWith('【Free Dictionary API】')) {
                  apiPart = apiPart.replace('【Free Dictionary API】', '').trim();
                }

                return (
                  <div className="space-y-3">
                    {/* Local Dictionary Section */}
                    <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all text-xs font-medium ${
                      isLight ? 'bg-slate-50 border-slate-100 text-slate-700' : 'bg-white/[0.02] border-white/5 text-slate-300'
                    }`}>
                      <div className="flex items-center gap-1.5 opacity-60">
                        <BookOpen size={11} className="text-cyan-500" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Yomitan 本地词典</span>
                      </div>
                      <p className="whitespace-pre-line leading-relaxed font-sans">{localPart || '未找到该词的本地离线释义。'}</p>
                    </div>

                    {/* API Dictionary Section - separated clearly */}
                    <div className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-all text-xs font-medium ${
                      isLight ? 'bg-slate-50 border-slate-100 text-slate-700' : 'bg-white/[0.02] border-white/5 text-slate-300'
                    }`}>
                      <div className="flex items-center gap-1.5 opacity-60">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Free Dictionary API</span>
                      </div>
                      <p className="whitespace-pre-line leading-relaxed font-sans">
                        {apiPart || '⏳ 获取中...'}
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div className={`p-4 rounded-xl text-xs leading-relaxed font-medium whitespace-pre-line min-h-[80px] ${
                  isLight ? 'bg-slate-50 text-slate-600 border border-slate-100' : 'bg-white/[0.02] text-slate-300 border border-white/5'
                }`}>
                  {definition}
                </div>
              );
            })()}
            
            <p className={`text-[9px] text-center opacity-40 font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              - 智能词库极速响应 -
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
