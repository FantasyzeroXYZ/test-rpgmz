import React from 'react';
import { AnimatePresence } from 'motion/react';
import { AppStage, UIState, GameEntry, VocabWord, SentenceEntry, NoteEntry } from './types';
import { MOCK_GAMES } from './mockData';
import { HomeView } from './components/HomeView';
import { EmulatorView } from './components/EmulatorView';
import { SidePanel, LeftPanel } from './components/SidePanel';
import { EditEntryModal } from './components/EditEntryModal';
import { NoteEditor } from './components/NoteEditor';
import { DictionarySidebar, OFFLINE_DICTIONARY } from './components/DictionarySidebar';
import { FloatingLookupCard } from './components/FloatingLookupCard';
// 服务层导入 — 提供纯浏览器端的持久化存储与 API 查询能力
import { getStoredGames, saveGames, getStoredVocab, saveVocab, getStoredSentences, getStoredNotes, saveNotes, getStoredSettings, saveSettings } from './services/storageService';
import { lookupWord, formatDictionaryResult } from './services/dictionaryService';
// 模拟器桥接 — 管理 WASM VFS 引擎与 IndexedDB 游戏库
import { libraryGetAll, libraryEntryToGameEntry, initEmulator } from './services/emulatorBridge';

export default function App() {
  const [currentStage, setCurrentStage] = React.useState<AppStage>('HOME');

  // 从 localStorage 恢复已保存的设置（首次加载时合并到默认状态）
  const storedSettings = React.useMemo(() => getStoredSettings(), []);

  // 游戏列表状态（从 IndexedDB 异步加载）
  const [storedGames, setStoredGames] = React.useState<GameEntry[]>([]);
  const [gamesLoading, setGamesLoading] = React.useState(true);

  // 初始化：加载 WASM 引擎 + 从 IndexedDB 恢复游戏库
  React.useEffect(() => {
    async function bootstrap() {
      // 1. 初始化 WASM 虚拟机
      initEmulator().catch(e => console.warn('[App] WASM init failed:', e));

      // 2. 从 IndexedDB 加载游戏库
      try {
        const libEntries = await libraryGetAll();
        if (libEntries.length > 0) {
          const games = libEntries.map(libraryEntryToGameEntry);
          setStoredGames(games);
        }
      } catch (e) {
        console.warn('[App] IndexedDB 游戏库加载失败:', e);
      }
      setGamesLoading(false);
    }
    bootstrap();
  }, []);

  const [uiState, setUIState] = React.useState<UIState>({
    games: storedGames.length > 0 ? storedGames : MOCK_GAMES,
    isPaused: false,
    activeModal: 'NONE',
    sidePanelOpen: false,
    textOverlayOpen: false,
    textOverlayOpacity: 85,
    textOverlayFontSize: 100,
    autoUpdateText: true,
    currentSideTab: 'SETTINGS',
    currentSystemSubTab: 'ADJUSTMENT',
    editingGameId: null,
    isVocabOpen: false,
    isLocked: false,
    leftPanelOpen: false,
    currentLeftTab: 'SAVES',
    activeSaveCategory: 'ALL',
    theme: 'dark',
    notes: [
      { 
        id: 'n1', 
        gameId: '1', 
        title: '隐藏任务线索',
        content: '发现了一个隐藏任务的线索，需要去北方的森林找那个老人。', 
        timestamp: '2026-06-12 14:20',
        createdAt: '2026-06-12 14:20',
        color: '#06b6d4',
        category: 'todo'
      },
      { 
        id: 'n2', 
        gameId: '1', 
        title: 'Boss 弱点分析',
        content: '这里的 Boss 弱点是雷属性，记得带上电弩。', 
        timestamp: '2026-06-13 10:05',
        createdAt: '2026-06-13 10:05',
        color: '#ef4444',
        category: 'unprocessed'
      },
    ],
    isNoteEditorOpen: false,
    editingNoteId: null,
    gameVolume: 80,
    screenFilter: 'none',
    showVirtualGamepad: false,
    gamepadHiddenButtons: [],
    gamepadOpacity: 100,
    gamepadMappings: {
      U: 'W',
      D: 'S',
      L: 'A',
      R: 'D',
      A: 'K',
      B: 'J',
      X: 'I',
      Y: 'U',
      L1: 'Q',
      R1: 'E',
      Select: 'Space',
      Start: 'Enter'
    },
    showTranslation: false,
    autoTranslate: false,
    translationSourceLangMode: 'ui',
    translationSourceLangCustom: 'ja',
    translationTargetLangMode: 'system',
    translationTargetLangCustom: 'zh',
    vocabSortOrder: 'NEWEST',
    vocabPage: 1,
    ttsEnabled: false,
    ttsSource: 'browser',
    ttsVoice: 'en-US-Standard-C',
    ttsSpeed: 1.0,
    ttsPitch: 1.0,
    ttsVolume: 0.8,
    ttsAutoPlay: true,
    ankiConnectUrl: 'http://127.0.0.1:8765',
    ankiDeckName: 'Default',
    ankiModelName: 'Basic',
    ankiFieldFront: 'Front',
    ankiFieldBack: 'Back',
    ankiFieldSentence: 'Sentence',
    ankiFieldSentenceTranslation: 'Translation',
    ankiFieldTags: 'Tags',
    ankiFieldNoteTitle: 'Title',
    ankiFieldNoteContent: 'Content',
    ankiFieldNoteImage: 'Image',
    ankiFieldGameImage: 'Screenshot',
    ankiActiveScheme: 'WORD',
    ankiWordEnabled: true,
    ankiSentenceEnabled: true,
    ankiNoteEnabled: true,
    // Removed real-time OCR
    ocrAccordionOpen: false,
    ocrCaptureMode: 'selection',
    ocrLanguageMode: 'global',
    ocrCustomLanguage: 'jp',
    translationSource: 'api',
    translationSearchGroup: 'searchEngine',
    translationSearchWebsite: 'google',
    dictionaryWebViewDisplayMode: 'internal',
    // Custom Segmentation & Yomitan Compatibility
    tokenizerMethod: 'browser',
    textSelectableMode: 'clickable',
    uiLanguage: 'zh',
    learningLanguage: 'ja',
    // Dictionary Sidebar Configuration
    isDictionaryOpen: false,
    dictionaryActiveTab: 'local',
    dictionarySearchQuery: '',
    dictionarySentence: '',
    dictionaries: [
      { id: '1', name: 'J-E Meaning Dictionary', type: 'MEANING', language: 'Japanese', enabled: true, order: 0 },
      { id: '2', name: 'K-E Tag Dictionary', type: 'TAG', language: 'Korean', enabled: true, order: 1 },
      { id: '3', name: 'E-C Advanced Dictionary', type: 'MEANING', language: 'English', enabled: true, order: 2 },
    ],
    dictionaryFilterLanguage: 'all',
    dictionaryFilterType: 'all',
    segmentationMode: 'browser',
    lookupMode: 'click',
    clickLookupSource: 'all',
    lemmatizationEnabled: true,
    lemmatizationLanguages: ['Japanese', 'English', 'French', 'German', 'Spanish'],
    lemmatizationExternalRules: [],
    autoCopyToClipboard: false,
    showHistory: true,
    isLookupCardOpen: false,
    lookupWord: null,
    lookupResult: null,
    // 合并 localStorage 中保存的设置（增量覆盖默认值）
    ...storedSettings,
  });
  // 默认选中第一个游戏（或空占位）
  const defaultGame: GameEntry = storedGames[0] || MOCK_GAMES[0] || {
    id: '', title: '请导入游戏', system: '—', coverUrl: '', createdAt: '', fileSize: '', totalPlayTime: ''
  };
  const [selectedGame, setSelectedGame] = React.useState<GameEntry>(defaultGame);

  // 当 IndexedDB 游戏加载完成后，同步到 UI 状态
  React.useEffect(() => {
    if (storedGames.length > 0) {
      setUIState(prev => ({ ...prev, games: storedGames }));
      if (!selectedGame.id || selectedGame.id === '') {
        setSelectedGame(storedGames[0]);
      }
    }
  }, [storedGames]);

  // 每当游戏库变更时，自动持久化到 localStorage
  React.useEffect(() => {
    saveGames(uiState.games);
  }, [uiState.games]);

  // 每当设置变更时，自动持久化关键设置项到 localStorage
  React.useEffect(() => {
    saveSettings({
      theme: uiState.theme,
      gameVolume: uiState.gameVolume,
      screenFilter: uiState.screenFilter,
      showVirtualGamepad: uiState.showVirtualGamepad,
      gamepadHiddenButtons: uiState.gamepadHiddenButtons,
      gamepadMappings: uiState.gamepadMappings,
      showTranslation: uiState.showTranslation,
      autoTranslate: uiState.autoTranslate,
      ttsEnabled: uiState.ttsEnabled,
      ttsAutoPlay: uiState.ttsAutoPlay,
      ttsVoice: uiState.ttsVoice,
      ttsSpeed: uiState.ttsSpeed,
      ttsPitch: uiState.ttsPitch,
      ttsVolume: uiState.ttsVolume,
      autoCopyToClipboard: uiState.autoCopyToClipboard,
      lookupMode: uiState.lookupMode,
      clickLookupSource: uiState.clickLookupSource,
      lemmatizationEnabled: uiState.lemmatizationEnabled,
      segmentationMode: uiState.segmentationMode,
      ankiConnectUrl: uiState.ankiConnectUrl,
      ankiDeckName: uiState.ankiDeckName,
      textOverlayOpacity: uiState.textOverlayOpacity,
      textOverlayFontSize: uiState.textOverlayFontSize,
      uiLanguage: uiState.uiLanguage,
      learningLanguage: uiState.learningLanguage,
    });
  }, [
    uiState.theme, uiState.gameVolume, uiState.screenFilter,
    uiState.showVirtualGamepad, uiState.gamepadHiddenButtons, uiState.gamepadMappings,
    uiState.showTranslation, uiState.autoTranslate,
    uiState.ttsEnabled, uiState.ttsAutoPlay, uiState.ttsVoice,
    uiState.ttsSpeed, uiState.ttsPitch, uiState.ttsVolume,
    uiState.autoCopyToClipboard, uiState.lookupMode, uiState.clickLookupSource,
    uiState.lemmatizationEnabled, uiState.segmentationMode,
    uiState.ankiConnectUrl, uiState.ankiDeckName,
    uiState.textOverlayOpacity, uiState.textOverlayFontSize,
    uiState.uiLanguage, uiState.learningLanguage,
  ]);

  // Handle message listener for NAV_HOME to transition stage
  React.useEffect(() => {
    const handleNavigationMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'NAV_HOME') {
        setCurrentStage('HOME');
      }
    };
    window.addEventListener('message', handleNavigationMessage);
    return () => window.removeEventListener('message', handleNavigationMessage);
  }, []);

  // Handle setting partial state
  const handleSetUIState = (partial: Partial<UIState>) => {
    setUIState((prev) => ({ ...prev, ...partial }));
  };

  const handleGameSelect = (game: GameEntry) => {
    setSelectedGame(game);
    setCurrentStage('PLAYING');
    // 确保游戏以非暂停状态启动
    handleSetUIState({ isPaused: false });
    // WASM 引擎在应用启动时已经初始化，此处不需要重复调用
  };

  const handleWordLookup = async (word: string) => {
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").toLowerCase().trim();

    // 自动剪贴板同步（如果启用）
    if (uiState.autoCopyToClipboard) {
      navigator.clipboard.writeText(cleanWord).catch(err => {
        console.error('[App] 复制到剪贴板失败:', err);
      });
    }

    const source = uiState.clickLookupSource || 'all';

    // 使用真实词典服务查询（本地词典 + Free Dictionary API）
    try {
      const dictResult = await lookupWord(cleanWord, source === 'local' ? 'local' : source === 'api' ? 'api' : 'all');

      const formattedDef = formatDictionaryResult(dictResult);

      // 确定词典来源名称
      let dictName = '词典';
      if (dictResult.source === 'local') dictName = 'Yomitan 本地词典';
      else if (dictResult.source === 'api') dictName = 'Free Dictionary API';
      else dictName = '本地 & API 双重查词';

      handleSetUIState({
        lookupWord: word,
        lookupResult: {
          definition: formattedDef || `未找到 “${cleanWord}” 的释义。`,
          dictionaryName: dictName,
        },
        isLookupCardOpen: true,
      });
    } catch (e) {
      console.error('[App] 查词失败:', e);
      handleSetUIState({
        lookupWord: word,
        lookupResult: {
          definition: `查询 “${cleanWord}” 时发生错误，请检查网络连接后重试。`,
          dictionaryName: '查词错误',
        },
        isLookupCardOpen: true,
      });
    }
  };

  const handleAddToVocab = (word: string, translation: string) => {
    // 检查是否已存在
    const existing = getStoredVocab();
    const exists = existing.some(v => v.word.toLowerCase() === word.toLowerCase());

    if (exists) {
      alert(`单词 "${word}" 已存在于生词本中。`);
      handleSetUIState({ isLookupCardOpen: false });
      return;
    }

    // 创建新生词并持久化到 localStorage
    const newVocab: VocabWord = {
      id: Math.random().toString(36).substring(2, 9),
      word: word.trim(),
      translation: translation?.split('\n')[0]?.trim() || '（释义待补充）',
      context: uiState.dictionarySentence || '',
      addedAt: new Date().toISOString().split('T')[0],
    };

    const updatedList = [newVocab, ...existing];
    saveVocab(updatedList);
    // 同步到全局变量（兼容旧版组件）
    (window as any).globalVocabList = updatedList;

    alert(`已将单词 "${word}" 成功添加至您的极客生词本！`);
    handleSetUIState({ isLookupCardOpen: false });
  };

  const handleAddToAnki = async (word: string, translation: string) => {
    const ankiUrl = uiState.ankiConnectUrl || 'http://127.0.0.1:8765';

    try {
      // 尝试调用 AnkiConnect API
      const payload = {
        action: 'addNote',
        version: 6,
        params: {
          note: {
            deckName: uiState.ankiDeckName || 'Default',
            modelName: uiState.ankiModelName || 'Basic',
            fields: {
              [uiState.ankiFieldFront || 'Front']: word,
              [uiState.ankiFieldBack || 'Back']: translation,
              [uiState.ankiFieldSentence || 'Sentence']: uiState.dictionarySentence || '',
            },
            tags: ['rpgmz-player'],
          },
        },
      };

      const response = await fetch(ankiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // AnkiConnect 在本地运行，可能需要较长的超时
        signal: AbortSignal.timeout?.(5000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.error === null) {
          alert(`已将 "${word}" 同步至 Anki 牌组 "${uiState.ankiDeckName || 'Default'}"！`);
        } else {
          throw new Error(data.error || '未知错误');
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (e: any) {
      console.warn('[App] AnkiConnect 同步失败（可能 Anki 未运行）:', e.message);
      // 优雅降级：提示用户手动添加
      alert(`AnkiConnect 暂时不可用，请确认 Anki 已启动且安装了 AnkiConnect 插件。\n\n已将 "${word}" 复制到剪贴板，您可以手动添加到 Anki。`);
      navigator.clipboard.writeText(word).catch(() => {});
    }

    handleSetUIState({ isLookupCardOpen: false });
  };

  const editingGame = React.useMemo(() => 
    uiState.games.find(g => g.id === uiState.editingGameId) || null
  , [uiState.editingGameId, uiState.games]);

  return (
    <div className={`w-screen h-screen relative font-sans overflow-hidden transition-colors duration-300 ${
      uiState.theme === 'light' ? 'bg-slate-100 text-slate-800' : 'bg-black text-white'
    }`}>
      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {currentStage === 'HOME' ? (
          <HomeView 
            key="home" 
            onGameSelect={handleGameSelect} 
            uiState={uiState}
            setUIState={handleSetUIState}
          />
        ) : (
          <EmulatorView 
            key="playing" 
            game={selectedGame}
            uiState={uiState}
            setUIState={handleSetUIState}
            onWordClick={handleWordLookup}
          />
        )}
      </AnimatePresence>

      {/* Entry Management Modal */}
      <EditEntryModal 
        isOpen={uiState.activeModal === 'EDIT_ENTRY'}
        onClose={() => handleSetUIState({ activeModal: 'NONE', editingGameId: null })}
        game={editingGame}
        uiState={uiState}
        setUIState={handleSetUIState}
      />

      {/* Global Side Panels */}
      <LeftPanel 
        isOpen={uiState.leftPanelOpen}
        uiState={uiState}
        onClose={() => handleSetUIState({ leftPanelOpen: false })}
        setUIState={handleSetUIState}
      />

      <SidePanel 
        isOpen={uiState.sidePanelOpen} 
        uiState={uiState}
        currentStage={currentStage}
        onClose={() => handleSetUIState({ sidePanelOpen: false })}
        setUIState={handleSetUIState}
      />

      <NoteEditor 
        isOpen={uiState.isNoteEditorOpen}
        onClose={() => handleSetUIState({ isNoteEditorOpen: false })}
        uiState={uiState}
        setUIState={handleSetUIState}
      />

      <DictionarySidebar 
        isOpen={uiState.isDictionaryOpen}
        onClose={() => handleSetUIState({ isDictionaryOpen: false })}
        uiState={uiState}
        setUIState={handleSetUIState}
      />

      <FloatingLookupCard 
        uiState={uiState}
        setUIState={handleSetUIState}
        onAddToVocab={handleAddToVocab}
        onAddToAnki={handleAddToAnki}
      />

      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none z-[-1] overflow-hidden opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* 系统状态指示器（显示 WASM 引擎状态） */}
      <div className="fixed top-6 right-8 pointer-events-none opacity-15 z-10 hidden md:block">
        <p className="text-[10px] font-mono text-right leading-tight">
          WASM_VFS_RUNTIME<br />
          INDEXEDDB: ACTIVE<br />
          EMU_ENGINE: READY
        </p>
      </div>
    </div>
  );
}
