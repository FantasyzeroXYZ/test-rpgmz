export type AppStage = 'HOME' | 'PLAYING';

export interface GameEntry {
  id: string;
  title: string;
  system: string;
  coverUrl: string;
  lastPlayed?: string;
  rating?: number;
  language?: string;
  fileName?: string;
  // 管理与统计字段
  createdAt: string;
  fileSize: string;
  totalPlayTime: string;
}

export interface SaveEntry {
  id: string;
  gameId: string;
  name: string;
  date: string;
  type: 'auto' | 'manual' | 'global';
}

export interface VocabWord {
  id: string;
  word: string;
  translation: string;
  context: string;
  tags?: string;
  addedAt: string;
}

export interface SentenceEntry {
  id: string;
  sentence: string;
  translation: string;
  context: string; // e.g. game title, speaker
  addedAt: string;
}

export interface NoteEntry {
  id: string;
  gameId: string;
  title: string;
  content: string;
  timestamp: string; // latest modification/creation fallback
  createdAt: string;
  updatedAt?: string;
  color?: string; // hex or color class name like "cyan", "red", "yellow", "green"
  category?: 'none' | 'todo' | 'unprocessed' | 'story';
  image?: string; // base64 or url/filepath
}

export interface UIState {
  games: GameEntry[];
  isPaused: boolean;
  activeModal: 'EDIT_ENTRY' | 'NONE';
  sidePanelOpen: boolean;
  leftPanelOpen: boolean;
  textOverlayOpen: boolean;
  textOverlayOpacity: number;
  textOverlayFontSize: number;
  autoUpdateText: boolean;
  currentSideTab: 'SETTINGS' | 'ANKI' | 'GAMEPAD' | 'DATA';
  currentSystemSubTab: 'ADJUSTMENT' | 'ACCESSIBILITY';
  currentLeftTab: 'SAVES' | 'SCREENSHOTS' | 'NOTES';
  editingGameId: string | null;
  isVocabOpen: boolean;
  isLocked: boolean;
  activeSaveCategory: 'ALL' | 'GLOBAL' | 'AUTO' | 'MANUAL';
  theme: 'dark' | 'light';
  // Note Management
  notes: NoteEntry[];
  isNoteEditorOpen: boolean;
  editingNoteId: string | null;
  // Game Audio & Visuals
  gameVolume: number;
  screenFilter: 'none' | 'sepia' | 'grayscale' | 'cool' | 'warm';
  // Gamepad Configuration
  showVirtualGamepad: boolean;
  gamepadHiddenButtons: string[];
  gamepadOpacity?: number;
  gamepadMappings?: Record<string, string>;
  /** D-Pad 方向键映射模式: 'wasd' | 'arrows' */
  gamepadDpadMode: 'wasd' | 'arrows';
  // Translation Configuration
  showTranslation: boolean;
  autoTranslate: boolean;
  translationSourceLangMode: string;
  translationSourceLangCustom: string;
  translationTargetLangMode: string;
  translationTargetLangCustom: string;
  // Navigation State
  vocabSortOrder: 'NEWEST' | 'OLDEST';
  vocabPage: number;
  // TTS Configuration
  ttsEnabled: boolean;
  ttsSource: 'browser' | 'userscript';
  ttsVoice: string;       // 浏览器语音名称（SpeechSynthesisVoice.name），空字符串=系统默认
  ttsSpeed: number;
  ttsPitch: number;
  ttsVolume: number;
  ttsAutoPlay: boolean;
  // Anki Configuration
  ankiConnectUrl: string;
  ankiDeckName: string;
  ankiModelName: string;
  ankiFieldFront: string;
  ankiFieldBack: string;
  ankiFieldSentence: string;
  ankiFieldSentenceTranslation: string;
  ankiFieldTags: string;
  ankiFieldNoteTitle: string;
  ankiFieldNoteContent: string;
  ankiFieldNoteImage: string;
  ankiFieldGameImage: string;
  ankiActiveScheme: 'WORD' | 'SENTENCE' | 'NOTE';
  ankiWordEnabled: boolean;
  ankiSentenceEnabled: boolean;
  ankiNoteEnabled: boolean;
  // Removed real-time OCR
  ocrAccordionOpen: boolean;
  ocrCaptureMode: 'fullscreen' | 'selection';
  ocrLanguageMode: 'global' | 'game' | 'custom';
  ocrCustomLanguage: string;
  translationSource: 'api' | 'userscript' | 'search';
  translationSearchGroup: 'searchEngine' | 'translationSite';
  translationSearchWebsite: string;
  dictionaryWebViewDisplayMode: 'internal' | 'external';
  // Custom Segmentation & Yomitan Compatibility
  tokenizerMethod: 'none' | 'browser' | 'space' | 'char' | 'japanese';
  textSelectableMode: 'clickable' | 'selectable';
  uiLanguage: 'zh' | 'en';
  learningLanguage: string;
  // Dictionary Sidebar Configuration
  isDictionaryOpen: boolean;
  dictionaryActiveTab?: 'local' | 'api' | 'vocab' | 'tampermonkey' | 'web' | 'custom';
  dictionarySearchQuery: string;
  dictionarySentence: string;
  // Dictionary Management
  dictionaries: DictionaryEntry[];
  dictionaryFilterLanguage: string;
  dictionaryFilterType: 'all' | 'TAG' | 'MEANING';
  segmentationMode: 'none' | 'browser' | 'space' | 'char' | 'japanese';
  lookupMode: 'click' | 'yomitan';
  clickLookupSource: 'local' | 'api' | 'all';
  /** 词典查询语言跟随模式: 'game' = 跟随游戏语言, 'learning' = 跟随学习语言设置 */
  dictionaryLanguageMode: 'game' | 'learning';
  lemmatizationEnabled: boolean;
  lemmatizationLanguages: string[];
  lemmatizationExternalRules: { id: string; name: string; date: string }[];
  autoCopyToClipboard: boolean;
  showHistory: boolean;
  // Floating Lookup Card State
  isLookupCardOpen: boolean;
  lookupWord: string | null;
  lookupResult: {
    definition: string;
    dictionaryName: string;
  } | null;
}

export interface DictionaryEntry {
  id: string;
  name: string;
  type: 'TAG' | 'MEANING';
  language: string;
  enabled: boolean;
  order: number;
}
