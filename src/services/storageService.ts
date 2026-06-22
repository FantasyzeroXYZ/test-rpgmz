/**
 * storageService.ts — 浏览器本地持久化存储服务
 * ============================================================================
 * 使用 localStorage 实现游戏库、生词本、句子本、笔记和用户设置的本地持久化。
 * 所有数据存储在浏览器本地，无需任何后端服务器支持。
 *
 * 核心功能：
 * - 游戏库 CRUD（增删改查）
 * - 生词本（Vocabulary）持久化
 * - 句子本（Sentences）持久化
 * - 笔记（Notes）持久化
 * - 用户设置（Settings）持久化
 * - 数据导出（JSON/CSV）
 *
 * 防御式编程：所有读取操作使用 try-catch 包裹，并提供默认兜底值。
 */

import { GameEntry, VocabWord, SentenceEntry, NoteEntry, UIState } from '../types';

// ============================================================================
// 存储键名常量
// ============================================================================
const STORAGE_KEYS = {
  GAMES: 'rpgmz_games',
  VOCAB: 'rpgmz_vocab',
  SENTENCES: 'rpgmz_sentences',
  NOTES: 'rpgmz_notes',
  SETTINGS: 'rpgmz_settings',
  SAVES: 'rpgmz_saves',
  SCREENSHOTS: 'rpgmz_screenshots',
} as const;

// ============================================================================
// 通用工具函数
// ============================================================================

/** 安全地从 localStorage 读取并解析 JSON，失败时返回默认值 */
function safeGetJSON<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return defaultValue;
    const parsed = JSON.parse(raw);
    // 确保解析结果是预期类型（排除 null、string 等意外情况）
    if (parsed === null || typeof parsed !== 'object') return defaultValue;
    return parsed as T;
  } catch (e) {
    console.warn(`[storageService] 读取 "${key}" 失败，使用默认值:`, e);
    return defaultValue;
  }
}

/** 安全地将数据序列化并写入 localStorage */
function safeSetJSON<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[storageService] 写入 "${key}" 失败（可能存储已满）:`, e);
    return false;
  }
}

// ============================================================================
// 游戏库持久化
// ============================================================================

/** 获取所有游戏条目 */
export function getStoredGames(): GameEntry[] {
  return safeGetJSON<GameEntry[]>(STORAGE_KEYS.GAMES, []);
}

/** 保存游戏库（全量替换） */
export function saveGames(games: GameEntry[]): boolean {
  return safeSetJSON(STORAGE_KEYS.GAMES, games);
}

/** 添加单个游戏到库中 */
export function addGame(game: GameEntry): GameEntry[] {
  const games = getStoredGames();
  games.unshift(game);
  saveGames(games);
  return games;
}

/** 更新游戏条目 */
export function updateGame(gameId: string, updates: Partial<GameEntry>): GameEntry[] {
  const games = getStoredGames();
  const index = games.findIndex(g => g.id === gameId);
  if (index !== -1) {
    games[index] = { ...games[index], ...updates };
    saveGames(games);
  }
  return games;
}

/** 删除游戏条目 */
export function deleteGame(gameId: string): GameEntry[] {
  const games = getStoredGames().filter(g => g.id !== gameId);
  saveGames(games);
  return games;
}

// ============================================================================
// 生词本持久化
// ============================================================================

/** 获取生词本 */
export function getStoredVocab(): VocabWord[] {
  return safeGetJSON<VocabWord[]>(STORAGE_KEYS.VOCAB, []);
}

/** 保存生词本 */
export function saveVocab(vocab: VocabWord[]): boolean {
  return safeSetJSON(STORAGE_KEYS.VOCAB, vocab);
}

/** 添加生词 */
export function addVocabWord(word: VocabWord): VocabWord[] {
  const vocab = getStoredVocab();
  // 去重检查
  if (!vocab.some(v => v.word.toLowerCase() === word.word.toLowerCase())) {
    vocab.unshift(word);
    saveVocab(vocab);
  }
  return vocab;
}

/** 删除生词 */
export function deleteVocabWord(wordId: string): VocabWord[] {
  const vocab = getStoredVocab().filter(v => v.id !== wordId);
  saveVocab(vocab);
  return vocab;
}

/** 更新生词 */
export function updateVocabWord(wordId: string, updates: Partial<VocabWord>): VocabWord[] {
  const vocab = getStoredVocab();
  const index = vocab.findIndex(v => v.id === wordId);
  if (index !== -1) {
    vocab[index] = { ...vocab[index], ...updates };
    saveVocab(vocab);
  }
  return vocab;
}

// ============================================================================
// 句子本持久化
// ============================================================================

/** 获取句子本 */
export function getStoredSentences(): SentenceEntry[] {
  return safeGetJSON<SentenceEntry[]>(STORAGE_KEYS.SENTENCES, []);
}

/** 保存句子本 */
export function saveSentences(sentences: SentenceEntry[]): boolean {
  return safeSetJSON(STORAGE_KEYS.SENTENCES, sentences);
}

/** 添加句子 */
export function addSentence(sentence: SentenceEntry): SentenceEntry[] {
  const sentences = getStoredSentences();
  sentences.unshift(sentence);
  saveSentences(sentences);
  return sentences;
}

/** 删除句子 */
export function deleteSentence(sentenceId: string): SentenceEntry[] {
  const sentences = getStoredSentences().filter(s => s.id !== sentenceId);
  saveSentences(sentences);
  return sentences;
}

// ============================================================================
// 笔记持久化
// ============================================================================

/** 获取笔记列表 */
export function getStoredNotes(): NoteEntry[] {
  return safeGetJSON<NoteEntry[]>(STORAGE_KEYS.NOTES, []);
}

/** 保存笔记列表 */
export function saveNotes(notes: NoteEntry[]): boolean {
  return safeSetJSON(STORAGE_KEYS.NOTES, notes);
}

/** 添加笔记 */
export function addNote(note: NoteEntry): NoteEntry[] {
  const notes = getStoredNotes();
  notes.unshift(note);
  saveNotes(notes);
  return notes;
}

/** 更新笔记 */
export function updateNote(noteId: string, updates: Partial<NoteEntry>): NoteEntry[] {
  const notes = getStoredNotes();
  const index = notes.findIndex(n => n.id === noteId);
  if (index !== -1) {
    notes[index] = { ...notes[index], ...updates, updatedAt: new Date().toISOString() };
    saveNotes(notes);
  }
  return notes;
}

/** 删除笔记 */
export function deleteNote(noteId: string): NoteEntry[] {
  const notes = getStoredNotes().filter(n => n.id !== noteId);
  saveNotes(notes);
  return notes;
}

// ============================================================================
// 用户设置持久化
// ============================================================================

/** 保存部分 UI 设置（增量合并） */
export function saveSettings(partial: Partial<UIState>): boolean {
  try {
    const current = safeGetJSON<Partial<UIState>>(STORAGE_KEYS.SETTINGS, {});
    const merged = { ...current, ...partial };
    return safeSetJSON(STORAGE_KEYS.SETTINGS, merged);
  } catch (e) {
    console.warn('[storageService] 保存设置失败:', e);
    return false;
  }
}

/** 读取已保存的设置 */
export function getStoredSettings(): Partial<UIState> {
  return safeGetJSON<Partial<UIState>>(STORAGE_KEYS.SETTINGS, {});
}

// ============================================================================
// 初始化：首次加载时从 localStorage 恢复数据
// ============================================================================

/** 检查是否是首次使用（无任何存储数据） */
export function isFirstTimeUser(): boolean {
  return localStorage.getItem(STORAGE_KEYS.GAMES) === null;
}

// ============================================================================
// 数据导出功能
// ============================================================================

/** 导出所有生词为 CSV 格式字符串 */
export function exportVocabToCSV(vocabList?: VocabWord[]): string {
  const data = vocabList ?? getStoredVocab();
  if (data.length === 0) return '';

  const headers = ['ID', 'Word', 'Translation', 'Context', 'Tags', 'AddedAt'];
  const rows = data.map(item => [
    item.id,
    `"${(item.word || '').replace(/"/g, '""')}"`,
    `"${(item.translation || '').replace(/"/g, '""')}"`,
    `"${(item.context || '').replace(/"/g, '""')}"`,
    `"${(item.tags || '').replace(/"/g, '""')}"`,
    item.addedAt
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/** 导出所有句子为 CSV 格式字符串 */
export function exportSentencesToCSV(sentenceList?: SentenceEntry[]): string {
  const data = sentenceList ?? getStoredSentences();
  if (data.length === 0) return '';

  const headers = ['ID', 'Sentence', 'Translation', 'Context', 'AddedAt'];
  const rows = data.map(item => [
    item.id,
    `"${(item.sentence || '').replace(/"/g, '""')}"`,
    `"${(item.translation || '').replace(/"/g, '""')}"`,
    `"${(item.context || '').replace(/"/g, '""')}"`,
    item.addedAt
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/** 触发浏览器下载 CSV 文件 */
export function downloadCSV(csvContent: string, filename: string): void {
  if (!csvContent) return;
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 导出全部数据为 JSON（可用于备份/迁移） */
export function exportAllDataAsJSON(): string {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    games: getStoredGames(),
    vocab: getStoredVocab(),
    sentences: getStoredSentences(),
    notes: getStoredNotes(),
    settings: getStoredSettings(),
  };
  return JSON.stringify(data, null, 2);
}
