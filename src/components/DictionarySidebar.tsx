import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Plus, BookOpen, Globe, Terminal, Settings, Copy, PlusCircle, CheckCircle, HelpCircle, ExternalLink, Trash2, Edit3, Download, List, RefreshCw, Volume2, ArrowDown, ChevronDown, ChevronRight, GripVertical, Languages, Upload, Monitor, FileText, Shield } from 'lucide-react';
import { UIState, VocabWord, SentenceEntry, DictionaryEntry } from '../types';
import { MOCK_VOCAB } from '../mockData';
// 服务层导入 — 提供真实的词典查询、翻译与持久化能力
import { lookupWord, formatDictionaryResult, lookupAndTranslate } from '../services/dictionaryService';
import { translateText } from '../services/translationService';
import { importYomitanDictionary, listYomitanDictionaries, removeYomitanDictionary } from '../services/yomitanDictService';
import { getStoredVocab, saveVocab, addVocabWord, deleteVocabWord, getStoredSentences, saveSentences, addSentence, deleteSentence, downloadCSV, exportVocabToCSV, exportSentencesToCSV } from '../services/storageService';

interface DictionarySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  uiState: UIState;
  setUIState: (state: Partial<UIState>) => void;
}

// Local dictionary quick-reference map (populated from Yomitan imports via dictionaryService)
export const OFFLINE_DICTIONARY: Record<string, string> = {};

const DictionaryManager = ({ uiState, setUIState }: { uiState: UIState, setUIState: (s: Partial<UIState>) => void }) => {
  const isLight = uiState.theme === 'light';
  const [isImporting, setIsImporting] = React.useState(false);
  const [newDictName, setNewDictName] = React.useState('');
  const [newDictType, setNewDictType] = React.useState<'MEANING' | 'TAG'>('MEANING');
  const [newDictLang, setNewDictLang] = React.useState('Japanese');
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importProgress, setImportProgress] = React.useState({ pct: 0, msg: '' });
  const [importPending, setImportPending] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const languages = ['all', ...new Set(uiState.dictionaries.map(d => d.language))];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const name = file.name.replace(/\.[^/.]+$/, '');
      setNewDictName(name);
      setImportFile(file);
    }
  };

  const handleImport = async () => {
    if (!importFile || !newDictName) return;
    setImportPending(true);
    setImportProgress({ pct: 0, msg: '开始导入...' });
    try {
      const meta = await importYomitanDictionary(importFile, newDictLang, newDictType, (pct, msg) => {
        setImportProgress({ pct, msg });
      });
      // Add to dictionary list
      const newEntry: DictionaryEntry = {
        id: meta.id,
        name: meta.name,
        type: meta.type,
        language: meta.language,
        enabled: true,
        order: uiState.dictionaries.length,
      };
      setUIState({ dictionaries: [...uiState.dictionaries, newEntry] });
      setImportProgress({ pct: 100, msg: `导入完成！共 ${meta.termCount} 条词条` });
      setTimeout(() => {
        setIsImporting(false);
        setImportPending(false);
        setNewDictName('');
        setImportFile(null);
        setImportProgress({ pct: 0, msg: '' });
      }, 1500);
    } catch (err: any) {
      setImportProgress({ pct: 0, msg: `导入失败: ${err.message}` });
      setImportPending(false);
    }
  };

  const moveDict = (id: string, direction: 'up' | 'down') => {
    const sorted = [...uiState.dictionaries].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(d => d.id === id);
    if (direction === 'up' && index > 0) {
      [sorted[index], sorted[index-1]] = [sorted[index-1], sorted[index]];
    } else if (direction === 'down' && index < sorted.length - 1) {
      [sorted[index], sorted[index+1]] = [sorted[index+1], sorted[index]];
    }
    const updated = sorted.map((d, i) => ({ ...d, order: i }));
    setUIState({ dictionaries: updated });
  };

  const filteredDicts = uiState.dictionaries.filter(d => {
    const langMatch = uiState.dictionaryFilterLanguage === 'all' || d.language === uiState.dictionaryFilterLanguage;
    const typeMatch = uiState.dictionaryFilterType === 'all' || d.type === uiState.dictionaryFilterType;
    return langMatch && typeMatch;
  });
  
  const sortedDicts = [...filteredDicts].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className={`text-[9px] font-black uppercase tracking-widest pl-1 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>词典导入与管理</label>
        <button 
           onClick={() => setIsImporting(!isImporting)}
           className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
             isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
           }`}
        >
          {isImporting ? <X size={12} /> : <Plus size={12} />}
          {isImporting ? '取消' : '导入词典'}
        </button>
      </div>

      <AnimatePresence>
        {isImporting && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`overflow-hidden rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'}`}
          >
            <div className="p-4 space-y-3">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".yomichan,.zip,.json,.txt"
              />
              
              <div className="space-y-1">
                <span className="text-[10px] font-bold opacity-50 pl-1">选择 Yomitan 词典 (.zip)</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importPending}
                  className={`w-full py-4 px-3 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 ${
                    isLight
                       ? 'bg-white border-slate-200 text-slate-400 hover:border-cyan-500 hover:text-cyan-600 hover:bg-cyan-50/30'
                       : 'bg-black/20 border-white/10 text-slate-500 hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/5'
                  }`}
                >
                  <Upload size={20} className={newDictName ? 'text-cyan-500' : 'opacity-40'} />
                  <span className={`text-xs font-bold ${newDictName ? (isLight ? 'text-slate-800' : 'text-white') : ''}`}>
                    {newDictName ? `已选择: ${newDictName}` : '点击上传 Yomitan 词典 .zip 文件'}
                  </span>
                  {!newDictName && <span className="text-[9px] opacity-50">term_bank + index.json 格式</span>}
                </button>
              </div>

              {importProgress.msg && (
                <div className={`rounded-xl p-3 ${isLight ? 'bg-white' : 'bg-black/20'}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {importPending && importProgress.pct < 100 && (
                      <span className="inline-block w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    )}
                    <span className="text-[10px] font-bold text-cyan-500">{importProgress.msg}</span>
                  </div>
                  {importProgress.pct > 0 && (
                    <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${importProgress.pct}%` }} />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold opacity-50 pl-1">词典类型</span>
                  <select
                    value={newDictType}
                    onChange={(e) => setNewDictType(e.target.value as 'MEANING' | 'TAG')}
                    className={`w-full py-2 px-3 rounded-xl text-xs outline-none border transition-all ${
                      isLight
                         ? 'bg-white border-slate-200 text-slate-800'
                         : 'bg-white/5 border-white/10 text-white bg-[#121820]'
                    }`}
                  >
                    <option value="MEANING">释义词典</option>
                    <option value="TAG">标签词典</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold opacity-50 pl-1">词典语言</span>
                  <select
                    value={newDictLang}
                    onChange={(e) => setNewDictLang(e.target.value)}
                    className={`w-full py-2 px-3 rounded-xl text-xs outline-none border transition-all ${
                      isLight
                         ? 'bg-white border-slate-200 text-slate-800'
                         : 'bg-white/5 border-white/10 text-white bg-[#121820]'
                    }`}
                  >
                    <option value="Japanese">Japanese</option>
                    <option value="English">English</option>
                    <option value="Korean">Korean</option>
                    <option value="Chinese">Chinese</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleImport}
                disabled={!newDictName || importPending}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${
                  importPending ? 'bg-slate-600 text-white' : isLight ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-cyan-500 text-black hover:bg-cyan-400 font-black'
                }`}
              >
                {importPending ? '导入中...' : '开始解析并导入'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-wider opacity-40 ml-1">筛选语言</span>
          <select 
            value={uiState.dictionaryFilterLanguage}
            onChange={(e) => setUIState({ dictionaryFilterLanguage: e.target.value })}
            className={`w-full py-2 px-3 rounded-xl text-xs outline-none border transition-all font-bold ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-800' 
                : 'bg-white/5 border-white/10 text-white bg-[#121820]'
            }`}
          >
            {languages.map(lang => (
              <option key={lang} value={lang}>{lang === 'all' ? '全部语言' : lang}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-wider opacity-40 ml-1">筛选类型</span>
          <select 
            value={uiState.dictionaryFilterType}
            onChange={(e) => setUIState({ dictionaryFilterType: e.target.value as any })}
            className={`w-full py-2 px-3 rounded-xl text-xs outline-none border transition-all font-bold ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-800' 
                : 'bg-white/5 border-white/10 text-white bg-[#121820]'
            }`}
          >
            <option value="all">全部类型</option>
            <option value="MEANING">释义词典</option>
            <option value="TAG">标签词典</option>
          </select>
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
        {sortedDicts.length === 0 ? (
          <div className="text-center py-10 opacity-20 transition-all">
             <BookOpen size={24} className="mx-auto mb-2" />
             <p className="text-[10px] font-bold">暂无词典资源</p>
          </div>
        ) : (
          sortedDicts.map((dict, idx) => (
            <div 
              key={dict.id}
              className={`group flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                isLight ? 'bg-white border-slate-100 hover:border-slate-300 shadow-sm' : 'bg-white/5 border-white/5 hover:border-white/10'
              }`}
            >
              <div className={`p-2 rounded-lg ${isLight ? 'bg-slate-100' : 'bg-white/5 text-slate-500 opacity-50 group-hover:opacity-100'}`}>
                 <GripVertical size={14} className="cursor-grab active:cursor-grabbing" />
              </div>
              
              <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold truncate">{dict.name}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter ${
                      dict.type === 'TAG' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {dict.type === 'TAG' ? '标签' : '释义'}
                    </span>
                 </div>
                 <div className="flex items-center gap-2 text-[9px] opacity-40 font-bold">
                    <Languages size={10} />
                    <span>{dict.language}</span>
                 </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                    onClick={() => moveDict(dict.id, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded-md hover:bg-white/10 disabled:opacity-20 transition-colors"
                 >
                    <ChevronDown size={14} className="rotate-180" />
                 </button>
                 <button 
                    onClick={() => moveDict(dict.id, 'down')}
                    disabled={idx === sortedDicts.length - 1}
                    className="p-1 rounded-md hover:bg-white/10 disabled:opacity-20 transition-colors"
                 >
                    <ChevronDown size={14} />
                 </button>
                 <div className={`w-px h-3 mx-1 ${isLight ? 'bg-slate-200' : 'bg-white/10'}`} />
                 <button
                   onClick={() => {
                     setUIState({ dictionaries: uiState.dictionaries.filter(d => d.id !== dict.id) });
                     removeYomitanDictionary(dict.id).catch(() => {});
                   }}
                   className="p-1 rounded-md hover:text-red-500 transition-colors"
                 >
                   <Trash2 size={12} />
                 </button>
              </div>

              <button 
                 onClick={() => {
                   const updated = uiState.dictionaries.map(d => d.id === dict.id ? { ...d, enabled: !d.enabled } : d);
                   setUIState({ dictionaries: updated });
                 }}
                 className={`w-8 h-4 rounded-full relative transition-all flex items-center ${
                   dict.enabled ? (isLight ? 'bg-slate-900' : 'bg-cyan-500') : (isLight ? 'bg-slate-200' : 'bg-white/10')
                 }`}
              >
                 <div className={`absolute w-3 h-3 rounded-full bg-white transition-all shadow-sm ${dict.enabled ? 'left-[17px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const DictionarySidebar: React.FC<DictionarySidebarProps> = ({ isOpen, onClose, uiState, setUIState }) => {
  const isLight = uiState.theme === 'light';
  
  // Tab states: main tab (Search, Vocab book, Management)
  const [mainTab, setMainTab] = React.useState<'search' | 'vocab' | 'manage'>('search');
  
  // Search sub-tab (Local dict, API, Yomitan, Web, Custom)
  const [subTab, setSubTab] = React.useState<'local' | 'api' | 'tampermonkey' | 'web' | 'custom'>('local');

  const [searchWord, setSearchWord] = React.useState(uiState.dictionarySearchQuery || '');
  const [localDefinition, setLocalDefinition] = React.useState<string | null>(null);
  const [apiDefinition, setApiDefinition] = React.useState<any | null>(null);
  const [externalDefinition, setExternalDefinition] = React.useState<string | null>(null);
  const [isSearchingApi, setIsSearchingApi] = React.useState(false);

  // Vocab management states
  const [vocabSubTab, setVocabSubTab] = React.useState<'word' | 'sentence'>('word');
  const [vocabSearchTerm, setVocabSearchTerm] = React.useState('');
  const [isSentenceCollapsed, setIsSentenceCollapsed] = React.useState(false);
  const [isBuiltInLangsCollapsed, setIsBuiltInLangsCollapsed] = React.useState(true);
  const [isExternalRulesCollapsed, setIsExternalRulesCollapsed] = React.useState(true);
  const ITEMS_PER_PAGE = 15;
  const [lastClickedWordIndex, setLastClickedWordIndex] = React.useState<number | null>(null);
  const ruleFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleRuleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newRule = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        date: new Date().toISOString().slice(0, 10)
      };
      setUIState({ lemmatizationExternalRules: [...uiState.lemmatizationExternalRules, newRule] });
      if (ruleFileInputRef.current) ruleFileInputRef.current.value = '';
    }
  };

  const handleRemoveRule = (id: string) => {
    setUIState({ lemmatizationExternalRules: uiState.lemmatizationExternalRules.filter(r => r.id !== id) });
  };

  const [vocabList, setVocabList] = React.useState<VocabWord[]>(() => {
    // 优先从 localStorage 恢复，其次从全局变量，最后用 Mock 数据
    const stored = getStoredVocab();
    if (stored.length > 0) return stored;
    const globalList = (window as any).globalVocabList;
    if (globalList?.length > 0) return globalList;
    (window as any).globalVocabList = [...MOCK_VOCAB];
    return [...MOCK_VOCAB];
  });

  const [sentenceList, setSentenceList] = React.useState<SentenceEntry[]>(() => {
    const stored = getStoredSentences();
    if (stored.length > 0) return stored;
    const globalList = (window as any).globalSentenceList;
    return globalList || [];
  });

  // Sync back to global refs and localStorage
  React.useEffect(() => {
    (window as any).globalVocabList = vocabList;
    saveVocab(vocabList);
  }, [vocabList]);

  React.useEffect(() => {
    (window as any).globalSentenceList = sentenceList;
    saveSentences(sentenceList);
  }, [sentenceList]);

  // Edit vocab word state
  const [editingWord, setEditingWord] = React.useState<VocabWord | null>(null);
  const [editWordText, setEditWordText] = React.useState('');
  const [editTranslationText, setEditTranslationText] = React.useState('');
  const [editContextText, setEditContextText] = React.useState('');
  const [editTagsText, setEditTagsText] = React.useState('');

  React.useEffect(() => {
    if (editingWord) {
      setEditWordText(editingWord.word);
      setEditTranslationText(editingWord.translation);
      setEditContextText(editingWord.context);
      setEditTagsText(editingWord.tags || '');
    }
  }, [editingWord]);

  // Custom Input Form State
  const [customWord, setCustomWord] = React.useState('');
  const [customDef, setCustomDef] = React.useState('');
  const [customCtx, setCustomCtx] = React.useState('');

  // Update query state and trigger tab sync if outer state updates
  React.useEffect(() => {
    if (uiState.dictionarySearchQuery) {
      setSearchWord(uiState.dictionarySearchQuery);
      handleSearch(uiState.dictionarySearchQuery);
    }
  }, [uiState.dictionarySearchQuery]);

  React.useEffect(() => {
    if (uiState.dictionaryActiveTab) {
      if (uiState.dictionaryActiveTab === 'vocab') {
        setMainTab('vocab');
      } else if (uiState.dictionaryActiveTab === 'manage') {
        setMainTab('manage');
      } else {
        setMainTab('search');
        if (['local', 'api', 'tampermonkey', 'web', 'custom'].includes(uiState.dictionaryActiveTab)) {
          setSubTab(uiState.dictionaryActiveTab as any);
        }
      }
    }
  }, [uiState.dictionaryActiveTab]);

  // 词典打开时同步当前游戏文本（如果有的话）
  React.useEffect(() => {
    if (isOpen && !uiState.dictionarySentence) {
      // 不再使用硬编码假数据；游戏文本由模拟器实时捕获
    }
  }, [isOpen]);

  // Listen for Tampermonkey Bridge messages
  React.useEffect(() => {
    const handleTampermonkeyMessage = (event: MessageEvent) => {
      // Expecting { type: 'DICTIONARY_DATA', word: string, definition: string }
      if (event.data && event.data.type === 'DICTIONARY_DATA') {
        const { word, definition } = event.data;
        setExternalDefinition(definition);
        setSearchWord(word);
        setSubTab('tampermonkey');
        setUIState({ 
          dictionarySearchQuery: word, 
          dictionaryActiveTab: 'tampermonkey' 
        });
      }
    };

    window.addEventListener('message', handleTampermonkeyMessage);
    return () => window.removeEventListener('message', handleTampermonkeyMessage);
  }, [setUIState]);

  const handleSearch = async (queryText: string = searchWord) => {
    if (!queryText.trim()) {
      setLocalDefinition("请输入词汇开始检索。");
      setApiDefinition(null);
      return;
    }
    const cleanWord = queryText.toLowerCase().trim();

    // 使用真实词典服务查询本地词典
    if (OFFLINE_DICTIONARY[cleanWord]) {
      setLocalDefinition(OFFLINE_DICTIONARY[cleanWord]);
    } else {
      // 尝试通过 dictionaryService 查询
      const localResult = await lookupWord(cleanWord, 'local');
      if (localResult.definitions.length > 0 && !localResult.error) {
        setLocalDefinition(formatDictionaryResult(localResult));
      } else {
        setLocalDefinition(`【本地库暂无收录】 ${queryText}\n请尝试切换到 API 词典或在线搜索以获取完整解析。`);
      }
    }

    // API 词典查询（Free Dictionary API）
    setIsSearchingApi(true);
    try {
      const apiResult = await lookupWord(cleanWord, 'api');
      if (apiResult.definitions.length > 0 && !apiResult.error) {
        // 格式化为兼容旧 UI 的数据结构
        const formatted: any = {
          word: apiResult.word,
          phonetic: apiResult.phonetic,
          meanings: apiResult.definitions.reduce((acc: any[], d) => {
            const existing = acc.find(a => a.partOfSpeech === d.partOfSpeech);
            if (existing) {
              existing.definitions.push({ definition: d.definition, example: d.example });
            } else {
              acc.push({ partOfSpeech: d.partOfSpeech, definitions: [{ definition: d.definition, example: d.example }] });
            }
            return acc;
          }, [] as any[]),
        };
        setApiDefinition(formatted);
      } else {
        setApiDefinition({ error: apiResult.error || '未找到该词的 API 释义。' });
      }
    } catch (error: any) {
      console.error('[DictionarySidebar] API 查询错误:', error);
      setApiDefinition({ error: '查询 API 时发生网络错误。' });
    } finally {
      setIsSearchingApi(false);
    }

    setUIState({ dictionarySearchQuery: queryText });
  };

  const handleAppendSegment = () => {
    const words = (uiState.dictionarySentence || '').split(/\s+/);
    let nextIdx = 0;
    if (lastClickedWordIndex !== null) {
      nextIdx = lastClickedWordIndex + 1;
    } else {
      // Find matches for searchWord
      const index = words.findIndex(w => w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase() === searchWord.toLowerCase());
      if (index !== -1) {
        nextIdx = index + 1;
      }
    }

    if (nextIdx < words.length) {
      const nextWord = words[nextIdx];
      const cleanNext = nextWord.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
      const newWord = (searchWord + " " + cleanNext).trim();
      setSearchWord(newWord);
      handleSearch(newWord);
      setLastClickedWordIndex(nextIdx);
    } else {
      alert("已到达当前句读文本的末尾，无后续单词可追加。");
    }
  };

  const handleAddToVocab = (wordStr: string, meaningStr: string, contextStr: string) => {
    if (!wordStr.trim() || !meaningStr.trim()) {
      alert("单词和释义内容不能为空！");
      return;
    }

    const exists = vocabList.some(v => v.word.toLowerCase() === wordStr.toLowerCase());
    if (exists) {
      alert(`生词 "${wordStr}" 已存在于您的生词本中。`);
      return;
    }

    const newVocab: VocabWord = {
      id: Math.random().toString(36).substring(2, 9),
      word: wordStr.trim(),
      translation: meaningStr.trim(),
      context: contextStr.trim(),
      addedAt: new Date().toISOString().split('T')[0]
    };

    setVocabList(prev => [...prev, newVocab]);
    alert(`已成功将词汇 "${wordStr}" 保存至系统核心生词本中！`);
  };

  const handleAddToSentenceList = (sentenceStr: string, translationStr: string) => {
    const newSentence: SentenceEntry = {
      id: Math.random().toString(36).substring(2, 9),
      sentence: sentenceStr,
      translation: translationStr,
      context: 'Game Speaker',
      addedAt: new Date().toISOString().split('T')[0],
    };
    setSentenceList(prev => [...prev, newSentence]);
    alert("已将当前句添加到句子本！");
  };

  const handleDeleteWord = (id: string) => {
    if (confirm('是否确定要从生词本中删除此单词？')) {
      setVocabList(prev => prev.filter(w => w.id !== id));
    }
  };

  const handleDeleteSentence = (id: string) => {
    if (confirm('是否确定要从句子本中删除此句子？')) {
      setSentenceList(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleExportCSV = () => {
    // 使用服务层导出 CSV 并触发浏览器下载
    const csvContent = vocabSubTab === 'word' ? exportVocabToCSV(vocabList) : exportSentencesToCSV(sentenceList);
    if (!csvContent) {
      alert('当前没有可导出的数据。');
      return;
    }
    const filename = `${vocabSubTab === 'word' ? 'vocabulary' : 'sentences'}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(csvContent, filename);
  };

  const [editingSentence, setEditingSentence] = React.useState<SentenceEntry | null>(null);
  const [editSentenceText, setEditSentenceText] = React.useState('');
  const [editSentenceTranslation, setEditSentenceTranslation] = React.useState('');

  const handleEditSentence = (sentence: SentenceEntry) => {
    setEditingSentence(sentence);
    setEditSentenceText(sentence.sentence);
    setEditSentenceTranslation(sentence.translation);
  };

  const handleSaveEditSentence = () => {
    if (!editingSentence) return;
    setSentenceList(prev => prev.map(s => s.id === editingSentence.id ? { ...s, sentence: editSentenceText, translation: editSentenceTranslation } : s));
    setEditingSentence(null);
  };

  const handleAddToAnkiSentence = (sentence: SentenceEntry) => {
    console.log('Adding sentence to Anki:', sentence);
    alert(`句子 "${sentence.sentence.slice(0, 20)}..." 已同步至 Anki！`);
  };

  const handleSaveEdit = () => {
    if (!editingWord) return;
    if (!editWordText.trim() || !editTranslationText.trim()) {
      alert('单词和释义不能为空！');
      return;
    }
    setVocabList(prev => prev.map(w => {
      if (w.id === editingWord.id) {
        return {
          ...w,
          word: editWordText.trim(),
          translation: editTranslationText.trim(),
          context: editContextText.trim(),
          tags: editTagsText.trim()
        };
      }
      return w;
    }));
    setEditingWord(null);
    alert('修改已保存。');
  };

  const handleAddToAnki = (word: VocabWord) => {
    alert(`已将单词 "${word.word}" 添加到 Anki。 (${uiState.ankiDeckName || 'Default'} 牌组)`);
  };

  // Click a word inside the current sentence to search immediately
  const handleSentenceWordClick = (word: string) => {
    const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
    if (clean) {
      setSearchWord(clean);
      handleSearch(clean);
      
      // Automatic clipboard sync if enabled
      if (uiState.autoCopyToClipboard) {
        navigator.clipboard.writeText(clean).catch(err => {
          console.error('Failed to copy to clipboard:', err);
        });
      }
    }
  };

  // Memoized Filtered Vocab List
  const filteredVocab = React.useMemo(() => {
    let list = vocabList.filter(v => 
      v.word.toLowerCase().includes(vocabSearchTerm.toLowerCase()) ||
      v.translation.toLowerCase().includes(vocabSearchTerm.toLowerCase())
    );
    if (uiState.vocabSortOrder === 'NEWEST') {
      list = [...list].reverse();
    }
    return list;
  }, [vocabList, vocabSearchTerm, uiState.vocabSortOrder]);

  const filteredSentences = React.useMemo(() => {
    let list = sentenceList.filter(s => 
      s.sentence.toLowerCase().includes(vocabSearchTerm.toLowerCase()) ||
      s.translation.toLowerCase().includes(vocabSearchTerm.toLowerCase())
    );
    if (uiState.vocabSortOrder === 'NEWEST') {
      list = [...list].reverse();
    }
    return list;
  }, [sentenceList, vocabSearchTerm, uiState.vocabSortOrder]);

  const totalPages = vocabSubTab === 'word' ? Math.ceil(filteredVocab.length / ITEMS_PER_PAGE) : Math.ceil(filteredSentences.length / ITEMS_PER_PAGE);
  const displayedVocab = filteredVocab.slice(
    (uiState.vocabPage - 1) * ITEMS_PER_PAGE, 
    uiState.vocabPage * ITEMS_PER_PAGE
  );
  
  const displayedSentences = filteredSentences.slice(
    (uiState.vocabPage - 1) * ITEMS_PER_PAGE,
    uiState.vocabPage * ITEMS_PER_PAGE
  );

  // Reset page to 1 on search change
  React.useEffect(() => {
    setUIState({ vocabPage: 1 });
  }, [vocabSearchTerm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="dict-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden pointer-events-auto"
          />

          {/* Dictionary Panel */}
          <motion.aside
            key="dict-sidebar"
            initial={{ x: '100%', opacity: 0.95 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className={`fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[425px] lg:w-[415px] border-l ${
              isLight 
                ? 'bg-white border-slate-200 text-slate-800 shadow-2xl' 
                : 'bg-[#05070a] border-white/5 text-white shadow-[0_0_50px_rgba(0,0,0,0.8)]'
            } backdrop-blur-3xl flex flex-col h-full overflow-hidden`}
          >
            {/* Header / Tabs switcher at the very top: 搜索 (Search), 生词本 (Vocab), 词典管理 (Manage) */}
            <div className={`p-4 border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-white/[0.01]'} flex items-center gap-2 shrink-0`}>
              <div className={`flex flex-1 p-1 rounded-xl gap-0.5 overflow-x-auto select-none no-scrollbar ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                {(['search', 'vocab', 'manage'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setMainTab(tab);
                      setUIState({ dictionaryActiveTab: tab === 'search' ? subTab : tab });
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                      mainTab === tab
                        ? 'bg-cyan-500 text-black shadow font-bold shadow-cyan-500/20'
                        : isLight 
                          ? 'text-slate-500 hover:text-slate-850'
                          : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab === 'search' && <><Search size={14} /><span className="text-[10px]">搜索</span></>}
                    {tab === 'vocab' && <><BookOpen size={14} /><span className="text-[10px]">生词本</span></>}
                    {tab === 'manage' && <><Settings size={14} /><span className="text-[10px]">词典管理</span></>}
                  </button>
                ))}
              </div>
              
              <button 
                onClick={onClose} 
                className={`p-1.5 rounded-lg border transition-all shrink-0 ${
                  isLight 
                    ? 'border-slate-200 hover:bg-slate-100 text-slate-404 hover:text-slate-705' 
                    : 'border-white/5 hover:bg-white/5 text-slate-500 hover:text-white'
                }`}
                title="关闭词典"
              >
                <X size={14} />
              </button>
            </div>

            {/* Core Scroll View Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
              
              {/* Main Tab 1: 搜索 */}
              {mainTab === 'search' && (
                <div className="space-y-2.5">
                  {/* Row 1: Search input + Buttons */}
                  <div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-404" />
                        <input
                          type="text"
                          placeholder="输入单词或句子进行检索..."
                          value={searchWord}
                          onChange={(e) => setSearchWord(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          className={`w-full rounded-2xl py-3 pl-11 pr-10 text-[13px] outline-none transition-all border shadow-sm ${
                            isLight 
                              ? 'bg-slate-50 border-slate-200 text-slate-850 focus:bg-white focus:border-cyan-500/50' 
                              : 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-cyan-500/50 font-medium'
                          }`}
                        />
                        {searchWord && (
                          <button
                            onClick={() => {
                              setSearchWord('');
                              setUIState({ dictionarySearchQuery: '' });
                            }}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex gap-2 shrink-0">
                        {/* TTS button */}
                        <button
                          onClick={() => {
                            if ('speechSynthesis' in window && searchWord) {
                              window.speechSynthesis.cancel();
                              const utterance = new SpeechSynthesisUtterance(searchWord);
                              utterance.rate = 0.9;
                              window.speechSynthesis.speak(utterance);
                            }
                          }}
                          className={`w-11 h-11 border rounded-2xl transition-all cursor-pointer flex items-center justify-center ${
                            isLight 
                              ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-cyan-500' 
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-cyan-400'
                          }`}
                          title="语音发音"
                        >
                          <Volume2 size={18} />
                        </button>

                        {/* Search button (icon only) */}
                        <button
                          onClick={() => handleSearch()}
                          className="w-11 h-11 bg-cyan-500 hover:bg-cyan-400 text-black rounded-2xl transition-all shadow-lg shadow-cyan-500/20 cursor-pointer flex items-center justify-center shrink-0"
                          title="立即查询"
                        >
                          <Search size={18} />
                        </button>
                        
                        {/* Append button (icon only) - Only available in click mode */}
                        {uiState.lookupMode === 'click' && (
                          <button
                            onClick={handleAppendSegment}
                            className={`w-11 h-11 border rounded-2xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                              isLight 
                                ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100' 
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                            }`}
                            title="追加分词"
                          >
                            <Plus size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Sentence Bar */}
                  <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
                    isLight 
                      ? 'bg-slate-50 border-slate-200' 
                      : 'bg-white/[0.02] border-white/5'
                  }`}>
                    <div className="flex items-center justify-between mb-1 pb-1 border-b border-dashed border-slate-200 dark:border-white/5">
                      <button 
                        onClick={() => setIsSentenceCollapsed(!isSentenceCollapsed)}
                        className={`hover:text-cyan-400 transition-colors ${isLight ? 'text-slate-500' : 'text-slate-500'}`}
                        title={isSentenceCollapsed ? "展开句子" : "折叠句子"}
                      >
                        {isSentenceCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      </button>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleAddToSentenceList(uiState.dictionarySentence || '', '（待添加翻译）')}
                          className={`hover:text-cyan-400 transition-colors ${isLight ? 'text-slate-500' : 'text-slate-500'}`}
                          title="添加到句子本"
                        >
                          <PlusCircle size={11} />
                        </button>
                        {uiState.lookupMode === 'click' && (
                          <button 
                            onClick={() => {
                              setSearchWord(uiState.dictionarySentence || '');
                              handleSearch(uiState.dictionarySentence || '');
                            }}
                            className={`hover:text-cyan-400 transition-colors ${isLight ? 'text-slate-500' : 'text-slate-500'}`}
                            title="填入搜索框"
                          >
                            <ArrowDown size={11} />
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            if ('speechSynthesis' in window) {
                              window.speechSynthesis.cancel();
                              const utterance = new SpeechSynthesisUtterance(uiState.dictionarySentence || '');
                              // Detect language roughly?
                              utterance.rate = 0.9;
                              window.speechSynthesis.speak(utterance);
                            }
                          }}
                          className={`hover:text-cyan-400 transition-colors ${isLight ? 'text-slate-500' : 'text-slate-500'}`}
                          title="语音播放"
                        >
                          <Volume2 size={11} />
                        </button>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(uiState.dictionarySentence || '');
                            alert("已复制到剪贴板");
                          }}
                          className={`hover:text-cyan-400 transition-colors ${isLight ? 'text-slate-500' : 'text-slate-500'}`}
                          title="复制整句"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    </div>
                    
                    <AnimatePresence initial={false}>
                      {!isSentenceCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="pt-1">
                            {uiState.dictionarySentence ? (
                              uiState.lookupMode === 'yomitan' ? (
                                <div className={`text-xs leading-relaxed font-semibold select-text ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                                  {uiState.dictionarySentence}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-x-1.5 gap-y-1 font-sans text-xs leading-relaxed font-semibold">
                                  {uiState.dictionarySentence.split(/\s+/).map((word, idx) => (
                                    <span
                                      key={idx}
                                      onClick={() => {
                                        handleSentenceWordClick(word);
                                        setLastClickedWordIndex(idx);
                                      }}
                                      className={`px-1 py-0.5 rounded cursor-pointer transition-all border border-transparent ${
                                        searchWord.toLowerCase() === word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase()
                                          ? 'text-cyan-400 bg-cyan-400/10 border-cyan-500/20 shadow-inner'
                                          : isLight 
                                            ? 'text-slate-800 hover:bg-slate-205 hover:text-cyan-600'
                                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                      }`}
                                    >
                                      {word}
                                    </span>
                                  ))}
                                </div>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-550 italic">暂无内容...</span>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Row 3: Sub-tabs Switcher for Search */}
                  <div className="space-y-1.5">
                    <div className={`flex p-1 rounded-xl gap-0.5 select-none overflow-x-auto no-scrollbar ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                      {(['dictionary', 'tampermonkey', 'web', 'custom'] as const).map((parentTab) => {
                        const isActive = parentTab === 'dictionary' 
                          ? (subTab === 'local' || subTab === 'api')
                          : subTab === parentTab;
                          
                        return (
                          <button
                            key={parentTab}
                            onClick={() => {
                              if (parentTab === 'dictionary') {
                                setSubTab('local');
                                setUIState({ dictionaryActiveTab: 'local' });
                              } else {
                                setSubTab(parentTab);
                                setUIState({ dictionaryActiveTab: parentTab });
                              }
                            }}
                            className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-[70px] ${
                              isActive
                                ? 'bg-slate-850 dark:bg-zinc-800 text-cyan-400 shadow'
                                : isLight 
                                  ? 'text-slate-500 hover:text-slate-850'
                                  : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {parentTab === 'dictionary' && <BookOpen size={12} />}
                            {parentTab === 'tampermonkey' && <Terminal size={12} />}
                            {parentTab === 'web' && <Globe size={12} />}
                            {parentTab === 'custom' && <Edit3 size={12} />}
                            <span className="text-[10px] font-bold">
                              {parentTab === 'dictionary' ? '词典' : 
                               parentTab === 'tampermonkey' ? '脚本' :
                               parentTab === 'web' ? '网页' : '自定义'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Dictionary Sub-tabs: Local vs API */}
                    <AnimatePresence mode="wait">
                      {(subTab === 'local' || subTab === 'api') && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className={`flex p-0.5 rounded-lg gap-0.5 select-none mx-1 ${isLight ? 'bg-slate-200/50' : 'bg-white/5'}`}
                        >
                          {(['local', 'api'] as const).map((childTab) => (
                            <button
                              key={childTab}
                              onClick={() => {
                                setSubTab(childTab);
                                setUIState({ dictionaryActiveTab: childTab });
                                if (childTab === 'api' && !apiDefinition && searchWord) {
                                  handleSearch(searchWord);
                                }
                              }}
                              className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                subTab === childTab
                                  ? (isLight ? 'bg-white text-cyan-600 shadow-sm' : 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20')
                                  : isLight 
                                    ? 'text-slate-50 hover:text-slate-800'
                                    : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              <span className="text-[9px] font-black uppercase tracking-wider">
                                {childTab === 'local' ? '本地词典' : 'API 词典'}
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Row 4: Sub-tab Contents */}
                  <div className="mt-1">
                    {subTab === 'local' && (
                      <div className="h-full">
                        <div className={`p-3 rounded-xl border flex flex-col gap-2 whitespace-pre-wrap ${
                          isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
                        }`}>
                          <div className="flex items-center justify-between border-b border-dashed border-white/5 pb-1 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-500">Yomitan 本地词典</span>
                            <BookOpen size={10} className="text-slate-500" />
                          </div>
                          
                          {localDefinition ? (
                            <div className="space-y-2.5 flex flex-col">
                              <div className={`text-[11px] leading-relaxed font-sans ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                                {localDefinition}
                              </div>
                              
                              {!localDefinition.startsWith("请输入") && !localDefinition.includes("暂无收录") && (
                                <button
                                  onClick={() => handleAddToVocab(searchWord, localDefinition.split('\n')[0], uiState.dictionarySentence)}
                                  className="mt-2 py-1.5 px-3 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black border border-cyan-500/20 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <PlusCircle size={12} />
                                  保存词条
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-6 text-slate-450">
                              <HelpCircle size={22} className="mx-auto mb-1.5 opacity-20" />
                              <p className="text-[9px] font-black uppercase tracking-wider">
                                等待检索
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {subTab === 'api' && (
                      <div className="h-full">
                        <div className={`p-3 rounded-xl border flex flex-col gap-3 ${
                          isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
                        }`}>
                          <div className="flex items-center justify-between border-b border-dashed border-white/5 pb-1 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-500">Free Dictionary API</span>
                            {isSearchingApi ? <RefreshCw size={10} className="text-cyan-500 animate-spin" /> : <Globe size={10} className="text-slate-500" />}
                          </div>
                          
                          {apiDefinition ? (
                            apiDefinition.error ? (
                              <div className="py-4 text-center">
                                <HelpCircle size={20} className="mx-auto mb-2 opacity-20 text-red-500" />
                                <p className="text-[10px] text-red-400 italic font-medium">{apiDefinition.error}</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-black uppercase italic">{apiDefinition.word}</h3>
                                    {apiDefinition.phonetic && (
                                      <span className="text-[10px] opacity-50 font-mono tracking-tighter">/{apiDefinition.phonetic}/</span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const topDef = apiDefinition.meanings?.[0]?.definitions?.[0]?.definition || '';
                                      handleAddToVocab(apiDefinition.word, topDef, uiState.dictionarySentence);
                                    }}
                                    className="p-1 px-2 rounded-md bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black border border-cyan-500/20 text-[8px] font-black uppercase transition-all"
                                  >
                                    保存
                                  </button>
                                </div>
                                
                                {apiDefinition.meanings?.map((m: any, i: number) => (
                                  <div key={i} className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <div className="h-px flex-1 bg-white/5" />
                                      <span className="text-[9px] font-black uppercase text-cyan-500/70 italic px-1.5 py-0.5 rounded bg-cyan-500/5">{m.partOfSpeech}</span>
                                    </div>
                                    <ul className="space-y-2">
                                      {m.definitions.slice(0, 2).map((d: any, j: number) => (
                                        <li key={j} className="text-[11px] leading-relaxed group">
                                          <div className="flex gap-2">
                                            <span className="text-cyan-500 font-black mt-0.5">•</span>
                                            <div className="flex-1">
                                              <p className={isLight ? 'text-slate-700' : 'text-slate-200'}>{d.definition}</p>
                                              {d.example && (
                                                <p className="text-[10px] mt-1 italic opacity-40 group-hover:opacity-60 transition-opacity">
                                                  Ex: {d.example}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )
                          ) : (
                            <div className="text-center py-6 text-slate-450">
                              <HelpCircle size={22} className="mx-auto mb-1.5 opacity-20" />
                              <p className="text-[9px] font-black uppercase tracking-wider">
                                等待 API 检索
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {subTab === 'tampermonkey' && (
                      <div className="h-full">
                        <div className={`p-4 rounded-xl border flex flex-col gap-3 min-h-[160px] ${
                          isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
                        }`}>
                          {externalDefinition ? (
                            <div className="space-y-3 flex flex-col flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest px-2 py-0.5 bg-cyan-400/10 rounded">
                                  Captured Content (External)
                                </span>
                                <span className="text-[8px] font-mono text-emerald-400 animate-pulse uppercase">
                                  ● Synchronized
                                </span>
                              </div>
                              
                              <div className={`text-xs font-semibold leading-relaxed whitespace-pre-wrap flex-1 ${
                                isLight ? 'text-slate-800' : 'text-slate-200'
                              }`}>
                                {externalDefinition}
                              </div>
                              
                              <button
                                onClick={() => handleAddToVocab(searchWord, externalDefinition.split('\n')[0], uiState.dictionarySentence)}
                                className="mt-auto py-2 px-3 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black border border-cyan-500/20 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <PlusCircle size={12} />
                                导出外部词条至生词本
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 opacity-40">
                              <RefreshCw size={24} className="mb-3 text-cyan-500 animate-spin-slow" />
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-500 mb-1">
                                Listening for Yomitan connection...
                              </p>
                              <p className="text-[8px] font-bold text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                                请在外部网页中使用 Yomitan 悬停查词，结果将在此自动实时捕获呈现。
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {subTab === 'web' && (
                      <div className="space-y-4">
                        {/* Web Selection Group - Condensed Row */}
                        <div className="flex items-center gap-2">
                          <select 
                            value={uiState.translationSearchGroup}
                            onChange={(e) => {
                              const group = e.target.value as any;
                              setUIState({ 
                                translationSearchGroup: group,
                                translationSearchWebsite: group === 'translationSite' ? 'bing-dict' : 'bing'
                              });
                            }}
                            className={`flex-1 min-w-0 py-1.5 px-2 rounded-lg text-[10px] font-bold outline-none border transition-all ${
                              isLight 
                                ? 'bg-slate-100 border-slate-200 text-slate-800' 
                                : 'bg-white/5 border-white/10 text-white bg-[#121820]'
                            }`}
                          >
                            <option value="translationSite">翻译网站</option>
                            <option value="searchEngine">搜索引擎</option>
                          </select>

                          <select 
                            value={uiState.translationSearchWebsite}
                            onChange={(e) => setUIState({ translationSearchWebsite: e.target.value })}
                            className={`flex-1 min-w-0 py-1.5 px-2 rounded-lg text-[10px] font-bold outline-none border transition-all ${
                              isLight 
                                ? 'bg-slate-100 border-slate-200 text-slate-800' 
                                : 'bg-white/5 border-white/10 text-white bg-[#121820]'
                            }`}
                          >
                            {uiState.translationSearchGroup === 'translationSite' ? (
                              <option value="bing-dict">必应翻译</option>
                            ) : (
                              <>
                                <option value="bing">必应 (Bing)</option>
                                <option value="google">谷歌 (Google)</option>
                              </>
                            )}
                          </select>

                          <button
                            onClick={() => setUIState({ dictionaryWebViewDisplayMode: uiState.dictionaryWebViewDisplayMode === 'internal' ? 'external' : 'internal' })}
                            className={`shrink-0 flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg border transition-all ${
                              uiState.dictionaryWebViewDisplayMode === 'internal'
                                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                : isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-slate-400'
                            }`}
                            title={uiState.dictionaryWebViewDisplayMode === 'internal' ? '内部显示 (Iframe)' : '外部显示 (New Tab)'}
                          >
                            <Monitor size={12} />
                            <span className="text-[10px] font-black uppercase tracking-wider">
                              {uiState.dictionaryWebViewDisplayMode === 'internal' ? '内部' : '外部'}
                            </span>
                          </button>
                        </div>

                        {/* Search URL generation and Display */}
                        {(() => {
                           let searchUrl = '';
                           if (uiState.translationSearchGroup === 'translationSite') {
                             if (uiState.translationSearchWebsite === 'bing-dict') {
                               searchUrl = `https://www.bing.com/translator?text=${encodeURIComponent(searchWord || '')}`;
                             }
                           } else {
                             if (uiState.translationSearchWebsite === 'bing') {
                               searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(searchWord || '')}`;
                             } else if (uiState.translationSearchWebsite === 'google') {
                               searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchWord || '')}`;
                             }
                           }

                           return (
                             <div className="space-y-3">
                               {searchWord ? (
                                 uiState.dictionaryWebViewDisplayMode === 'internal' ? (
                                   <div className={`rounded-2xl border overflow-hidden h-[360px] relative ${
                                     isLight ? 'bg-white border-slate-200 shadow-lg' : 'bg-black/60 border-white/5'
                                   }`}>
                                     <div className="absolute inset-0 flex flex-col">
                                       <div className={`flex items-center justify-between px-3 py-2 border-b ${
                                         isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-black/40 border-white/10'
                                       }`}>
                                          <div className="flex items-center gap-2 max-w-[70%]">
                                            <Globe size={10} className="text-cyan-500" />
                                            <span className="text-[8px] font-mono truncate opacity-60">{searchUrl}</span>
                                          </div>
                                          <button 
                                            onClick={() => window.open(searchUrl, '_blank')}
                                            className="p-1 hover:bg-black/10 rounded transition-colors"
                                            title="在新窗口中打开"
                                          >
                                            <ExternalLink size={10} />
                                          </button>
                                       </div>
                                       <iframe 
                                         src={searchUrl} 
                                         className="w-full h-full border-none"
                                         title="Web Dict View"
                                         sandbox="allow-scripts allow-forms allow-same-origin"
                                       />
                                     </div>
                                   </div>
                                 ) : (
                                   <button 
                                      onClick={() => window.open(searchUrl, '_blank')}
                                      className="w-full group p-6 rounded-2xl border border-dashed border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all flex flex-col items-center justify-center gap-3 cursor-pointer"
                                   >
                                      <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <ExternalLink size={24} className="text-cyan-400" />
                                      </div>
                                      <div className="text-center">
                                        <p className="text-xs font-black uppercase text-cyan-400 tracking-widest mb-1">在新标签页中打开检索</p>
                                        <p className="text-[10px] text-slate-500 font-bold">跳转至: {uiState.translationSearchWebsite.toUpperCase()}</p>
                                      </div>
                                   </button>
                                 )
                               ) : (
                                 <div className={`p-8 rounded-2xl border border-dashed text-center flex flex-col items-center justify-center gap-3 opacity-30 ${
                                   isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/[0.02] border-white/10'
                                 }`}>
                                   <div className="p-3 bg-slate-500/10 rounded-full">
                                     <Search size={24} className="text-slate-500" />
                                   </div>
                                   <p className="text-[10px] font-black uppercase tracking-widest">请在上方输入检索词开始网页同步</p>
                                 </div>
                               )}
                             </div>
                           );
                        })()}
                      </div>
                    )}

                    {subTab === 'custom' && (
                      <div className="space-y-3.5">
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="在此输入自定义释义 (例如: 【名词】 管道)..."
                            value={customDef}
                            onChange={(e) => setCustomDef(e.target.value)}
                            className={`w-full rounded-xl py-2.5 px-3 text-xs outline-none border ${
                              isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white bg-[#0e121a]'
                            }`}
                          />
                        </div>

                        <button
                          onClick={() => {
                            handleAddToVocab(searchWord || 'Custom Word', customDef, uiState.dictionarySentence);
                            setCustomDef('');
                          }}
                          className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[10px] rounded-xl uppercase tracking-widest transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/15"
                        >
                          <PlusCircle size={12} />
                          保存当前状态到生词本
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Main Tab 2: 生词本 (保持以前完美的界面交互) */}
              {mainTab === 'vocab' && (
                <div className="space-y-3.5">
                  <div className={`p-1 rounded-xl flex gap-1 ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                    <button onClick={() => setVocabSubTab('word')} className={`flex-1 py-1.5 rounded-lg text-[10px] transition-all font-bold ${vocabSubTab === 'word' ? (isLight ? 'bg-white text-slate-800 shadow-sm' : 'bg-cyan-500 text-black') : 'opacity-50'}`}>词库</button>
                    <button onClick={() => setVocabSubTab('sentence')} className={`flex-1 py-1.5 rounded-lg text-[10px] transition-all font-bold ${vocabSubTab === 'sentence' ? (isLight ? 'bg-white text-slate-800 shadow-sm' : 'bg-cyan-500 text-black') : 'opacity-50'}`}>句子本</button>
                  </div>
                  {/* Vocab Controls */}
                  <div className="flex items-center gap-1.5 px-0.5">
                    <div className="relative flex-1">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
                      <input
                        type="text"
                        placeholder={`搜索${vocabSubTab === 'word' ? '生词' : '句子'}...`}
                        value={vocabSearchTerm}
                        onChange={(e) => setVocabSearchTerm(e.target.value)}
                        className={`w-full border rounded-xl py-1.5 pl-8 pr-3 text-[11px] outline-none transition-all ${
                          isLight
                            ? 'bg-slate-50 border-slate-205 text-slate-800'
                            : 'bg-white/5 border-white/10 text-white'
                        }`}
                      />
                    </div>
                    
                    <select
                      value={uiState.vocabSortOrder}
                      onChange={(e) => setUIState({ vocabSortOrder: e.target.value as any })}
                      className={`py-1.5 px-2 rounded-xl text-[10px] font-bold outline-none border transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-200 text-slate-800'
                          : 'bg-white/5 border-white/10 text-white bg-[#121820]'
                      }`}
                    >
                      <option value="NEWEST">按时间 (新)</option>
                      <option value="OLDEST">按时间 (旧)</option>
                    </select>

                    <button
                      onClick={handleExportCSV}
                      className={`p-1.5 rounded-xl border transition-all ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                      title="导出 CSV"
                    >
                      <Download size={12} />
                    </button>
                  </div>
                  {/* Displayed List */}
                  <div className="space-y-2 pr-1">
                    {vocabSubTab === 'word' ? (
                      displayedVocab.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                          <BookOpen size={24} className="mx-auto mb-2 opacity-20" />
                          <p className="text-[10px] font-black uppercase tracking-wider">
                            暂无匹配生词
                          </p>
                        </div>
                      ) : (
                        displayedVocab.map(word => (
                          <div
                            key={word.id}
                            className={`group border rounded-xl py-1.5 px-2.5 flex items-center justify-between transition-all ${
                              isLight
                                ? 'bg-slate-50 border-slate-200 shadow-xs'
                                : 'bg-white/[0.02] border-white/5 hover:border-cyan-500/20 hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <p className={`text-xs font-black truncate ${isLight ? 'text-slate-800' : 'text-cyan-400 font-bold'}`}>
                                {word.word}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => setEditingWord(word)}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isLight ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                }`}
                                title="编辑"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                onClick={() => handleAddToAnki(word)}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                }`}
                                title="同步 Anki"
                              >
                                <PlusCircle size={11} />
                              </button>
                              <button
                                onClick={() => handleDeleteWord(word.id)}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isLight ? 'bg-red-100 text-red-500' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                }`}
                                title="删除"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))
                      )
                    ) : (
                      displayedSentences.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                          <List size={24} className="mx-auto mb-2 opacity-20" />
                          <p className="text-[10px] font-black uppercase tracking-wider">
                            暂无匹配句子
                          </p>
                        </div>
                      ) : (
                        displayedSentences.map(sentence => (
                          <div
                            key={sentence.id}
                            className={`group border rounded-xl py-1.5 px-2.5 flex items-center justify-between transition-all ${
                              isLight
                                ? 'bg-slate-50 border-slate-200 shadow-xs'
                                : 'bg-white/[0.02] border-white/5 hover:border-cyan-500/20 hover:bg-white/[0.04]'
                            }`}
                          >
                             <div className="flex-1 min-w-0 pr-2">
                               <p className={`text-xs font-bold truncate ${isLight ? 'text-slate-800' : 'text-cyan-400 font-bold'}`}>{sentence.sentence}</p>
                             </div>
                             
                             <div className="flex items-center gap-1 shrink-0">
                               <button
                                 onClick={() => handleEditSentence(sentence)}
                                 className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                   isLight ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                 }`}
                                 title="编辑"
                               >
                                 <Edit3 size={11} />
                               </button>
                               <button
                                 onClick={() => handleAddToAnkiSentence(sentence)}
                                 className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                   isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                 }`}
                                 title="同步 Anki"
                               >
                                 <PlusCircle size={11} />
                               </button>
                               <button
                                 onClick={() => handleDeleteSentence(sentence.id)}
                                 className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                   isLight ? 'bg-red-100 text-red-500' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                 }`}
                                 title="删除"
                               >
                                 <Trash2 size={11} />
                               </button>
                             </div>
                          </div>
))))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 pt-2 border-t border-dashed border-slate-200 dark:border-white/5">
                      <button
                        disabled={uiState.vocabPage <= 1}
                        onClick={() => setUIState({ vocabPage: uiState.vocabPage - 1 })}
                        className={`text-[9px] font-black uppercase tracking-widest disabled:opacity-20 hover:text-cyan-500 transition-colors cursor-pointer ${
                          isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Prev
                      </button>
                      <span className="text-[10px] font-mono font-bold text-cyan-500">
                        {uiState.vocabPage} / {totalPages}
                      </span>
                      <button
                        disabled={uiState.vocabPage >= totalPages}
                        onClick={() => setUIState({ vocabPage: uiState.vocabPage + 1 })}
                        className={`text-[9px] font-black uppercase tracking-widest disabled:opacity-20 hover:text-cyan-500 transition-colors cursor-pointer ${
                          isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Main Tab 3: 词典管理 (用于管理词典和进行各种和词典相关的设置) */}
              {mainTab === 'manage' && (
                <div className="space-y-6">
                  <DictionaryManager uiState={uiState} setUIState={setUIState} />
                  
                  <div className={`p-4 rounded-xl border space-y-5 ${
                    isLight ? 'bg-slate-50/50 border-slate-200 shadow-sm' : 'bg-white/[0.02] border-white/5'
                  }`}>
                    <div className="space-y-4">
                      {/* Segmentation and Interaction Dropdowns */}
                      <div className={`grid ${uiState.lookupMode === 'click' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                        {uiState.lookupMode === 'click' && (
                          <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                            <label className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              <Terminal size={10} className="text-cyan-500" />
                              分词模式
                            </label>
                            <select 
                              value={uiState.segmentationMode}
                              onChange={(e) => setUIState({ segmentationMode: e.target.value as any })}
                              className={`w-full py-2 px-3 rounded-xl text-[10px] font-bold outline-none border transition-all ${
                                isLight 
                                  ? 'bg-white border-slate-200 text-slate-800' 
                                  : 'bg-white/5 border-white/10 text-white bg-[#121820]'
                              }`}
                            >
                              <option value="none">不分词</option>
                              <option value="browser">浏览器分词</option>
                              <option value="space">按空格</option>
                              <option value="char">按单字</option>
                            </select>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <label className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            <Search size={10} className="text-cyan-500" />
                            查词交互
                          </label>
                          <select 
                            value={uiState.lookupMode}
                            onChange={(e) => setUIState({ lookupMode: e.target.value as any })}
                            className={`w-full py-2 px-3 rounded-xl text-[10px] font-bold outline-none border transition-all ${
                              isLight 
                                ? 'bg-white border-slate-200 text-slate-800' 
                                : 'bg-white/5 border-white/10 text-white bg-[#121820]'
                            }`}
                          >
                            <option value="click">点击触发</option>
                            <option value="yomitan">Yomitan 扫描</option>
                          </select>
                        </div>
                      </div>

                      {/* Clipboard and Lemmatization Settings */}
                      <div className="grid grid-cols-1 gap-2">
                        {uiState.lookupMode === 'click' && (
                          <div className={`p-3 rounded-xl border flex flex-col gap-2.5 transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
                            isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-white/5 border-white/5'
                          }`}>
                            <div className="flex items-center gap-2">
                               <div className={`p-1.5 rounded-lg ${isLight ? 'bg-cyan-50' : 'bg-cyan-500/10'}`}>
                                 <BookOpen size={12} className="text-cyan-400" />
                               </div>
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-black uppercase tracking-wider">词典查词来源</span>
                                 <span className="text-[8px] opacity-40 font-bold">设定点击剧情文本查词时启用的词典源</span>
                               </div>
                            </div>
                            <div className={`flex p-0.5 rounded-lg gap-0.5 select-none ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                              {([
                                { key: 'local', label: '本地 Yomitan' },
                                { key: 'api', label: 'API 词典' },
                                { key: 'all', label: '全部启用' }
                              ] as const).map((sourceItem) => (
                                <button
                                  key={sourceItem.key}
                                  onClick={() => setUIState({ clickLookupSource: sourceItem.key })}
                                  className={`flex-1 py-1 rounded-md text-[9px] font-bold transition-all cursor-pointer text-center ${
                                    (uiState.clickLookupSource || 'all') === sourceItem.key
                                      ? (isLight ? 'bg-white text-cyan-500 shadow-xs' : 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/10')
                                      : isLight 
                                        ? 'text-slate-500 hover:text-slate-850'
                                        : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {sourceItem.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {uiState.lookupMode === 'click' && (
                          <div className={`p-3 rounded-xl border flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
                            isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-white/5 border-white/5'
                          }`}>
                            <div className="flex items-center gap-2">
                               <div className={`p-1.5 rounded-lg ${isLight ? 'bg-amber-50' : 'bg-amber-500/10'}`}>
                                 <Globe size={12} className="text-amber-400" />
                               </div>
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-black uppercase tracking-wider">词典查询语言</span>
                                 <span className="text-[8px] opacity-40 font-bold">选择词典查询时优先匹配的语言</span>
                               </div>
                            </div>
                            <div className={`flex p-0.5 rounded-lg gap-0.5 select-none ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                              {([
                                { key: 'game', label: '跟随游戏' },
                                { key: 'learning', label: '跟随学习语言' }
                              ] as const).map((modeItem) => (
                                <button
                                  key={modeItem.key}
                                  onClick={() => setUIState({ dictionaryLanguageMode: modeItem.key })}
                                  className={`flex-1 py-1 px-2 rounded-md text-[9px] font-bold transition-all cursor-pointer text-center ${
                                    uiState.dictionaryLanguageMode === modeItem.key
                                      ? (isLight ? 'bg-white text-amber-500 shadow-xs' : 'bg-amber-500 text-black shadow-lg shadow-amber-500/10')
                                      : isLight
                                        ? 'text-slate-500 hover:text-slate-850'
                                        : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {modeItem.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {uiState.lookupMode === 'click' && (
                          <div className={`p-3 rounded-xl border flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
                            isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-white/5 border-white/5'
                          }`}>
                            <div className="flex items-center gap-2">
                               <div className={`p-1.5 rounded-lg ${isLight ? 'bg-indigo-50' : 'bg-indigo-500/10'}`}>
                                 <Copy size={12} className="text-indigo-400" />
                               </div>
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-black uppercase tracking-wider">剪贴板联动同步</span>
                                 <span className="text-[8px] opacity-40 font-bold">点击即复制到剪贴板</span>
                               </div>
                            </div>
                            <button
                              onClick={() => setUIState({ autoCopyToClipboard: !uiState.autoCopyToClipboard })}
                              className={`w-9 h-5 rounded-full transition-all relative ${
                                uiState.autoCopyToClipboard ? 'bg-indigo-500' : 'bg-slate-700/50'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-all ${
                                uiState.autoCopyToClipboard ? 'right-0.75' : 'left-0.75'
                              }`} />
                            </button>
                          </div>
                        )}

                        {uiState.lookupMode === 'click' && (
                          <div className={`p-4 rounded-xl border space-y-3 transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
                            isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-white/5 border-white/5'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg ${isLight ? 'bg-cyan-50' : 'bg-cyan-500/10'}`}>
                                  <RefreshCw size={12} className="text-cyan-500" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider">词形还原预处理</span>
                              </div>
                              <button
                                onClick={() => setUIState({ lemmatizationEnabled: !uiState.lemmatizationEnabled })}
                                className={`w-9 h-5 rounded-full transition-all relative ${
                                  uiState.lemmatizationEnabled ? 'bg-cyan-500' : 'bg-slate-700/50'
                                }`}
                              >
                                <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-all ${
                                  uiState.lemmatizationEnabled ? 'right-0.75' : 'left-0.75'
                                }`} />
                              </button>
                            </div>

                            {uiState.lemmatizationEnabled && (
                              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                {/* Built-in languages */}
                                <div className="space-y-2">
                                  <button 
                                    onClick={() => setIsBuiltInLangsCollapsed(!isBuiltInLangsCollapsed)}
                                    className="flex items-center justify-between w-full px-0.5 group cursor-pointer"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <Shield size={10} className="text-cyan-500" />
                                      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">内置支持语言</span>
                                    </div>
                                    <motion.div
                                      animate={{ rotate: isBuiltInLangsCollapsed ? 0 : 180 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <ChevronDown size={10} className="opacity-30" />
                                    </motion.div>
                                  </button>
                                  <AnimatePresence>
                                    {!isBuiltInLangsCollapsed && (
                                      <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="flex flex-wrap gap-1.5 ml-0.5 pt-1">
                                          {uiState.lemmatizationLanguages.map(lang => (
                                            <div 
                                                key={lang}
                                                className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter border flex items-center gap-1 ${
                                                  isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white/5 border-white/10 text-slate-500'
                                                }`}
                                            >
                                              <div className="w-1 h-1 rounded-full bg-cyan-500 animate-pulse" />
                                              {lang}
                                            </div>
                                          ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* External rules */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between px-0.5">
                                    <button 
                                      onClick={() => setIsExternalRulesCollapsed(!isExternalRulesCollapsed)}
                                      className="flex items-center gap-1.5 group cursor-pointer flex-1"
                                    >
                                      <FileText size={10} className="text-cyan-500" />
                                      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity text-left">外部导入规则</span>
                                      <motion.div
                                        animate={{ rotate: isExternalRulesCollapsed ? 0 : 180 }}
                                        transition={{ duration: 0.2 }}
                                      >
                                        <ChevronDown size={10} className="opacity-30" />
                                      </motion.div>
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        ruleFileInputRef.current?.click();
                                      }}
                                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 whitespace-nowrap transition-all ${
                                        isLight ? 'border-slate-200 hover:bg-slate-100 text-slate-500' : 'border-white/10 hover:bg-white/10 text-slate-400'
                                      }`}
                                    >
                                      <Plus size={8} /> 导入规则
                                    </button>
                                    <input 
                                      type="file"
                                      ref={ruleFileInputRef}
                                      onChange={handleRuleFileUpload}
                                      className="hidden"
                                      accept=".json,.txt"
                                    />
                                  </div>

                                  <AnimatePresence>
                                    {!isExternalRulesCollapsed && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="space-y-1.5 ml-0.5 pt-1">
                                          {uiState.lemmatizationExternalRules.length === 0 ? (
                                            <div className={`p-3 rounded-xl border border-dashed text-center ${
                                              isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-white/[0.02] border-white/10'
                                            }`}>
                                              <p className="text-[8px] font-bold opacity-30 italic">暂无外部还原规则</p>
                                            </div>
                                          ) : (
                                            uiState.lemmatizationExternalRules.map(rule => (
                                              <div 
                                                key={rule.id}
                                                className={`flex items-center justify-between p-2 rounded-lg border ${
                                                  isLight ? 'bg-white border-slate-100 shadow-xs' : 'bg-white/5 border-white/5'
                                                }`}
                                              >
                                                <div className="flex items-center gap-2">
                                                  <div className="p-1 rounded bg-cyan-500/10">
                                                    <FileText size={10} className="text-cyan-500" />
                                                  </div>
                                                  <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold truncate max-w-[120px]">{rule.name}</span>
                                                    <span className="text-[7px] opacity-40 uppercase">{rule.date}</span>
                                                  </div>
                                                </div>
                                                <button 
                                                  onClick={() => handleRemoveRule(rule.id)}
                                                  className="p-1 hover:text-red-500 transition-colors opacity-40 hover:opacity-100"
                                                >
                                                  <Trash2 size={10} />
                                                </button>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                <p className={`text-[8px] italic font-bold opacity-40 leading-relaxed pt-1 border-t border-dashed ${
                                  isLight ? 'text-slate-500 border-slate-200' : 'text-slate-400 border-white/5'
                                }`}>
                                  *开启后查找变体、变形词时将自动映射回原形。
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                    </div>

                    {uiState.lookupMode === 'yomitan' && (
                        <p className={`text-[9px] font-bold opacity-40 px-1 leading-normal text-center ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                          - 扫描模式已启用，系统正在监测取词钩子 -
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Float Edit Word Card */}
            <AnimatePresence>
              {editingWord && (
                <motion.div
                  key="edit-vocab-submodal"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm pointer-events-auto"
                >
                  <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl relative ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800'
                      : 'bg-[#121620] border-cyan-500/20 text-white'
                  }`}>
                    <h4 className="text-sm font-black italic uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-1.5 font-sans">
                      <Edit3 size={14} className="text-cyan-500" />
                      编辑单词条目
                    </h4>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">单词</label>
                        <input
                          type="text"
                          value={editWordText}
                          onChange={(e) => setEditWordText(e.target.value)}
                          className={`w-full rounded-lg py-1.5 px-3 text-xs outline-none border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white bg-[#0e121a]'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">释义</label>
                        <input
                          type="text"
                          value={editTranslationText}
                          onChange={(e) => setEditTranslationText(e.target.value)}
                          className={`w-full rounded-lg py-1.5 px-3 text-xs outline-none border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white bg-[#0e121a]'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">单词所在句子文本</label>
                        <textarea
                          value={editContextText}
                          onChange={(e) => setEditContextText(e.target.value)}
                          rows={3}
                          className={`w-full rounded-lg py-1.5 px-3 text-xs outline-none border resize-none ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-805' : 'bg-white/5 border-white/10 text-white bg-[#0e121a]'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Anki 标签 (Tags)</label>
                        <input
                          type="text"
                          placeholder="例如: unit1 boss_battle anime_lines"
                          value={editTagsText}
                          onChange={(e) => setEditTagsText(e.target.value)}
                          className={`w-full rounded-lg py-1.5 px-3 text-xs outline-none border ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white bg-[#0e121a]'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2.5 mt-5">
                      <button
                        onClick={() => setEditingWord(null)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer ${
                          isLight ? 'border-slate-200 hover:bg-slate-50 text-slate-650' : 'border-white/10 hover:bg-white/5 text-slate-404'
                        }`}
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[10px] rounded-lg uppercase tracking-wider shadow cursor-pointer"
                      >
                        保存修改
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Float Edit Sentence Card */}
            <AnimatePresence>
              {editingSentence && (
                <motion.div
                  key="edit-sentence-submodal"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm pointer-events-auto"
                >
                  <div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl relative ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-800'
                      : 'bg-[#121620] border-cyan-500/20 text-white'
                  }`}>
                    <h4 className="text-sm font-black italic uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-1.5 font-sans">
                      <Edit3 size={14} className="text-cyan-500" />
                      编辑句子条目
                    </h4>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">句子内容</label>
                        <textarea
                          value={editSentenceText}
                          onChange={(e) => setEditSentenceText(e.target.value)}
                          rows={3}
                          className={`w-full rounded-lg py-1.5 px-3 text-xs outline-none border resize-none ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white bg-[#0e121a]'
                          }`}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">句子释义</label>
                        <textarea
                          value={editSentenceTranslation}
                          onChange={(e) => setEditSentenceTranslation(e.target.value)}
                          rows={2}
                          className={`w-full rounded-lg py-1.5 px-3 text-xs outline-none border resize-none ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white bg-[#0e121a]'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2.5 mt-5">
                      <button
                        onClick={() => setEditingSentence(null)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer ${
                          isLight ? 'border-slate-200 hover:bg-slate-50 text-slate-650' : 'border-white/10 hover:bg-white/5 text-slate-404'
                        }`}
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveEditSentence}
                        className="flex-1 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[10px] rounded-lg uppercase tracking-wider shadow cursor-pointer"
                      >
                        保存修改
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
