/**
 * mockData.ts — 默认空数据
 * ============================================================================
 * 所有数据现在从 localStorage / IndexedDB 实时读取。
 * 此文件仅保留空的默认回退值。
 */

import { GameEntry, SaveEntry, VocabWord } from './types';

/** 空游戏库 — 首次使用时无任何游戏，通过 ZIP 导入添加 */
export const MOCK_GAMES: GameEntry[] = [];

/** 空存档列表 — 存档数据从游戏实时读取 */
export const MOCK_SAVES: SaveEntry[] = [];

/** 空生词本 — 生词通过查词功能手动添加 */
export const MOCK_VOCAB: VocabWord[] = [];

/** 空截图列表 — 截图实时生成 */
export const MOCK_SCREENSHOTS: Array<{ id: string; url: string; date: string }> = [];

/** 系统信息 — 从 WASM 运行时动态获取 */
export const MOCK_SYSTEM_INFO = {
  version: '—',
  runtime: 'WASM/VFS-Core',
  memory: '—',
  gpu: '—',
  latency: '—'
};
