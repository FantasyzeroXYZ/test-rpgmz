/**
 * yomitanDictService.ts — Yomitan-format dictionary import, storage, and query
 * ============================================================================
 * Supports importing Yomitan/Yomichan .zip dictionary files:
 * - Parses index.json for metadata
 * - Parses term_bank*.json for word entries
 * - Stores in IndexedDB for persistence
 * - Queries by exact word match with fallback strategies
 *
 * Yomitan term bank entry format:
 *   [term, reading, definitionTag, rules, score, sequence, ...glossaries]
 */

import JSZip from 'jszip';
import { DictionaryResult, DictionaryDefinition } from './dictionaryService';

// ============================================================================
// Types
// ============================================================================

export interface YomitanDictMeta {
  id: string;
  name: string;
  language: string;
  type: 'MEANING' | 'TAG';
  termCount: number;
  importedAt: string;
}

// ============================================================================
// IndexedDB helpers
// ============================================================================

const DB_NAME = 'yomitan-dicts';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('dicts')) {
        db.createObjectStore('dicts', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('terms')) {
        const termsStore = db.createObjectStore('terms', { keyPath: 'key' });
        termsStore.createIndex('term', 'term', { unique: false });
        termsStore.createIndex('dictId', 'dictId', { unique: false });
      } else {
        // Ensure indexes exist on upgrade from v1
        const termsStore = req.transaction!.objectStore('terms');
        if (!termsStore.indexNames.contains('term')) {
          termsStore.createIndex('term', 'term', { unique: false });
        }
        if (!termsStore.indexNames.contains('dictId')) {
          termsStore.createIndex('dictId', 'dictId', { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(storeName: string, value: any): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

function dbGetAll(storeName: string): Promise<any[]> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => { db.close(); reject(req.error); };
  }));
}

function dbDelete(storeName: string, key: string): Promise<void> {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

/**
 * Query terms by index — returns all entries matching the exact term.
 * Falls back to scanning all terms if index query returns empty
 * (handles edge cases with CJK characters in IndexedDB indexes).
 */
async function dbGetTermsByWord(word: string): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    try {
      const tx = db.transaction('terms', 'readonly');
      const store = tx.objectStore('terms');

      // Try index lookup first
      if (store.indexNames.contains('term')) {
        const index = store.index('term');
        const cursorReq = index.openCursor(IDBKeyRange.only(word));
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) { results.push(cursor.value); cursor.continue(); }
          else {
            // If index found nothing, fall back to full scan
            if (results.length === 0) {
              const scanReq = store.getAll();
              scanReq.onsuccess = () => {
                const all = scanReq.result || [];
                const filtered = all.filter((t: any) =>
                  t.term === word ||
                  t.term.toLowerCase() === word.toLowerCase()
                );
                db.close();
                resolve(filtered);
              };
              scanReq.onerror = () => { db.close(); resolve([]); };
            } else {
              db.close();
              resolve(results);
            }
          }
        };
        cursorReq.onerror = () => {
          // Index error — fall back to full scan
          const scanReq = store.getAll();
          scanReq.onsuccess = () => {
            const all = scanReq.result || [];
            const filtered = all.filter((t: any) =>
              t.term === word || t.term.toLowerCase() === word.toLowerCase()
            );
            db.close();
            resolve(filtered);
          };
          scanReq.onerror = () => { db.close(); resolve([]); };
        };
      } else {
        // No index — full scan
        const scanReq = store.getAll();
        scanReq.onsuccess = () => {
          const all = scanReq.result || [];
          const filtered = all.filter((t: any) =>
            t.term === word || t.term.toLowerCase() === word.toLowerCase()
          );
          db.close();
          resolve(filtered);
        };
        scanReq.onerror = () => { db.close(); resolve([]); };
      }
    } catch (e) {
      db.close();
      resolve([]);
    }
  });
}

async function dbGetTermsByDictId(dictId: string): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('terms', 'readonly');
      const store = tx.objectStore('terms');
      if (store.indexNames.contains('dictId')) {
        const index = store.index('dictId');
        const cursorReq = index.openCursor(IDBKeyRange.only(dictId));
        const results: any[] = [];
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) { results.push(cursor.value); cursor.continue(); }
          else { db.close(); resolve(results); }
        };
        cursorReq.onerror = () => { db.close(); resolve([]); };
      } else {
        const scanReq = store.getAll();
        scanReq.onsuccess = () => {
          db.close();
          resolve((scanReq.result || []).filter((t: any) => t.dictId === dictId));
        };
        scanReq.onerror = () => { db.close(); resolve([]); };
      }
    } catch (e) {
      db.close();
      resolve([]);
    }
  });
}

// ============================================================================
// Glossary extraction
// ============================================================================

/**
 * Extract plain text from a Yomitan glossary entry.
 * Yomitan glossaries are arrays containing strings — just join them directly,
 * preserving embedded newlines. No structured-content parsing needed.
 */
function extractGlossaryText(glossary: any): string {
  if (typeof glossary === 'string') return glossary;
  if (Array.isArray(glossary)) {
    return glossary.map(item => extractGlossaryText(item)).join('');
  }
  if (glossary && typeof glossary === 'object') {
    if (glossary.text !== undefined) return String(glossary.text);
    if (glossary.content !== undefined) return extractGlossaryText(glossary.content);
  }
  return String(glossary || '');
}

// ============================================================================
// Dictionary import
// ============================================================================

/**
 * Find a file in the ZIP by matching filename pattern.
 * Handles files at root level and inside subdirectories.
 */
function findZipFile(zip: JSZip, pattern: RegExp): JSZip.JSZipObject | null {
  let found: JSZip.JSZipObject | null = null;
  zip.forEach((relativePath, file) => {
    if (found) return;
    if (file.dir) return;
    // Match against the filename portion (after last /)
    const basename = relativePath.split('/').pop() || relativePath;
    if (pattern.test(basename)) {
      found = file;
    }
  });
  return found;
}

/**
 * Find all files in the ZIP matching a filename pattern.
 */
function findZipFiles(zip: JSZip, pattern: RegExp): JSZip.JSZipObject[] {
  const results: JSZip.JSZipObject[] = [];
  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    const basename = relativePath.split('/').pop() || relativePath;
    if (pattern.test(basename)) {
      results.push(file);
    }
  });
  return results;
}

export async function importYomitanDictionary(
  file: File,
  language: string,
  type: 'MEANING' | 'TAG',
  onProgress?: (pct: number, msg: string) => void
): Promise<YomitanDictMeta> {
  onProgress?.(0, '正在读取词典文件...');

  const zip = await JSZip.loadAsync(file);
  onProgress?.(10, 'ZIP 文件已加载，正在解析索引...');

  // Parse index.json for metadata (handles files in subdirectories)
  const indexFile = findZipFile(zip, /^index\.json$/);
  if (!indexFile) throw new Error('词典文件缺少 index.json（请确认这是 Yomitan 格式的词典）');

  const indexData = JSON.parse(await indexFile.async('string'));
  const dictName = indexData.title || file.name.replace(/\.zip$/i, '');
  const dictId = `yomitan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  onProgress?.(20, `词典名称: ${dictName}`);

  // Find all term_bank files — handles term_bank.json, term_bank_1.json, term_bank_2.json etc.
  const termBankFiles = findZipFiles(zip, /^term_bank(_\d+)?\.json$/);

  if (termBankFiles.length === 0) {
    throw new Error('词典文件中未找到 term_bank*.json（请确认这是 Yomitan 释义词典或标签词典）');
  }

  console.log(`[yomitanDict] 找到 ${termBankFiles.length} 个词库文件:`, termBankFiles.map(f => f.name));
  onProgress?.(25, `找到 ${termBankFiles.length} 个词库文件，开始解析...`);

  // Parse and store terms
  let totalTerms = 0;
  const db = await openDB();
  const BATCH_SIZE = 2000;

  for (let fi = 0; fi < termBankFiles.length; fi++) {
    const bankFile = termBankFiles[fi];
    const rawJson = await bankFile.async('string');
    let bankData: any[];
    try {
      bankData = JSON.parse(rawJson);
    } catch (e) {
      console.warn(`[yomitanDict] 解析 ${bankFile.name} 失败，跳过`, e);
      continue;
    }

    if (!Array.isArray(bankData)) {
      console.warn(`[yomitanDict] ${bankFile.name} 不是数组格式，跳过`);
      continue;
    }

    // Log first entry for format debugging
    if (bankData.length > 0) {
      const sample = bankData[0];
      console.log(`[yomitanDict] ${bankFile.name} 首条样例:`, JSON.stringify(sample).slice(0, 200));
    }

    const fileProgressBase = 30 + Math.floor((fi / termBankFiles.length) * 50);
    onProgress?.(fileProgressBase, `正在导入 ${bankFile.name} (${bankData.length} 条)...`);

    for (let start = 0; start < bankData.length; start += BATCH_SIZE) {
      const batch = bankData.slice(start, start + BATCH_SIZE);
      const tx = db.transaction('terms', 'readwrite');
      const store = tx.objectStore('terms');

      let batchCount = 0;
      for (const entry of batch) {
        if (!Array.isArray(entry) || entry.length < 1) continue;
        const term = String(entry[0]).trim();
        if (!term) continue;

        const reading = entry[1] ? String(entry[1]) : '';
        const score = typeof entry[4] === 'number' ? entry[4] : 0;

        // Extract definitions from glossaries.
        // Yomitan format: [term, reading, defTag, rules, score, glossary|timestamp, ...glossaries]
        // Some dictionaries put timestamps at index 5 instead of glossaries — detect and skip.
        const definitions: string[] = [];

        // Helper: check if a value is a timestamp/numeric ID (number or string) to skip
        const isTimestamp = (v: any): boolean => {
          if (typeof v === 'number') return true;
          if (typeof v === 'string' && /^\d{10,}$/.test(v.trim())) return true;
          // Single-element array containing only a timestamp
          if (Array.isArray(v) && v.length === 1 && typeof v[0] === 'string' && /^\d{10,}$/.test(v[0].trim())) return true;
          return false;
        };

        // Find the first non-timestamp, non-empty value after index 4 as the glossary start
        let glossStart = -1;
        for (let gi = 5; gi < entry.length; gi++) {
          const val = entry[gi];
          if (val === undefined || val === null || val === '' || isTimestamp(val)) continue;
          glossStart = gi;
          break;
        }

        // If we found real glossary content, extract it; otherwise fall through to fallbacks
        if (glossStart >= 0) {
          for (let gi = glossStart; gi < entry.length; gi++) {
            const val = entry[gi];
            if (val === undefined || val === null || val === '' || isTimestamp(val)) continue;
            const text = extractGlossaryText(val);
            if (text.trim()) definitions.push(text.trim());
          }
        }

        // Fallback: check entry[2] for TAG dictionaries or if no glossaries found
        if (definitions.length === 0 && entry[2] && typeof entry[2] === 'string' && entry[2].trim()) {
          // Only use defTag if it looks like a definition (has spaces or is longer than a tag code)
          const defTag = entry[2].trim();
          if (defTag.length > 3 || defTag.includes(' ')) {
            definitions.push(defTag);
          }
        }

        // Last resort: try to extract text from entry[1] (reading) as description
        if (definitions.length === 0 && entry[1] && typeof entry[1] === 'string') {
          const reading = entry[1].trim();
          if (reading && reading !== term) {
            definitions.push(reading);
          }
        }

        const storeEntry = {
          key: `${dictId}|${term}`,
          dictId,
          term,
          reading,
          definitions: definitions.length > 0 ? definitions : ['(无释义)'],
          score,
        };
        store.put(storeEntry);
        batchCount++;
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      totalTerms += batchCount;
      const progress = fileProgressBase + Math.floor((start / Math.max(bankData.length, 1)) * (50 / termBankFiles.length));
      onProgress?.(Math.min(progress, 95), `已导入 ${totalTerms} 条...`);
    }
  }

  db.close();
  console.log(`[yomitanDict] 导入完成，共 ${totalTerms} 条词条`);

  // Store dictionary metadata
  const meta: YomitanDictMeta = {
    id: dictId,
    name: dictName,
    language,
    type,
    termCount: totalTerms,
    importedAt: new Date().toISOString(),
  };
  await dbPut('dicts', meta);

  // Clear query cache so new terms are found immediately
  clearYomitanQueryCache();

  onProgress?.(100, `导入完成！共 ${totalTerms} 条词条`);
  return meta;
}

// ============================================================================
// Dictionary query
// ============================================================================

const queryCache = new Map<string, DictionaryResult[]>();
const QUERY_CACHE_MAX = 500;

/** Match mode for dictionary lookup */
export type YomitanMatchMode = 'prefix' | 'exact';

/** Clean a word for dictionary lookup */
function cleanLookupWord(word: string): string {
  return word
    .replace(/[.,\/#!$%^&*;:{}=\-_`~()\s。、、「」『』！？…　・「」【】《》""''\[\]<>|\\]+/g, '')
    .trim();
}

/**
 * Query Yomitan dictionaries. Returns ALL matching entries.
 * @param word - the word to look up
 * @param mode - 'prefix' (default) for starts-with matching, 'exact' for exact match
 */
export async function queryYomitanTerms(
  word: string,
  mode: YomitanMatchMode = 'prefix'
): Promise<DictionaryResult[]> {
  const cleanWord = cleanLookupWord(word);
  if (!cleanWord) return [];

  const cacheKey = `q|${mode}|${cleanWord}`;
  const cached = queryCache.get(cacheKey);
  if (cached) {
    console.log(`[yomitanDict] 缓存命中: "${cleanWord}" (${mode}) → ${cached.length} 条`);
    return cached;
  }

  try {
    // Get all terms, filter by match mode
    let results = await dbGetTermsByWord(cleanWord);
    console.log(`[yomitanDict] 精确匹配 "${cleanWord}": ${results.length} 条`);

    // For prefix mode, also scan for terms starting with the word
    if (mode === 'prefix') {
      const prefixResults = await dbGetTermsByPrefix(cleanWord);
      console.log(`[yomitanDict] 前缀匹配 "${cleanWord}": ${prefixResults.length} 条`);
      // Merge, deduplicate by key
      const seen = new Set(results.map((r: any) => r.key));
      for (const r of prefixResults) {
        if (!seen.has(r.key)) { results.push(r); seen.add(r.key); }
      }
    }

    // Also try lowercase
    if (results.length === 0 && cleanWord !== cleanWord.toLowerCase()) {
      results = await dbGetTermsByWord(cleanWord.toLowerCase());
      if (mode === 'prefix') {
        const morePrefix = await dbGetTermsByPrefix(cleanWord.toLowerCase());
        const seen = new Set(results.map((r: any) => r.key));
        for (const r of morePrefix) {
          if (!seen.has(r.key)) { results.push(r); seen.add(r.key); }
        }
      }
    }

    if (results.length === 0) {
      console.log(`[yomitanDict] 未找到 "${cleanWord}" 的释义`);
      // Don't cache empty results — allows retry after dictionary re-import
      return [];
    }

    // Sort by score descending, then build DictionaryResult for each unique term
    results.sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

    const dictResults: DictionaryResult[] = [];
    const seenTerms = new Set<string>();
    for (const r of results) {
      if (seenTerms.has(r.term)) continue;
      seenTerms.add(r.term);
      dictResults.push({
        word: r.term,
        phonetic: r.reading || undefined,
        definitions: (r.definitions || []).map((d: string) => ({
          partOfSpeech: '',
          definition: typeof d === 'string' ? d : String(d || ''),
        })),
        source: 'local' as const,
      });
    }

    console.log(`[yomitanDict] 返回 ${dictResults.length} 条不重复结果`);

    // Cache successful results only
    if (queryCache.size >= QUERY_CACHE_MAX) {
      const keys = [...queryCache.keys()];
      keys.slice(0, 100).forEach(k => queryCache.delete(k));
    }
    queryCache.set(cacheKey, dictResults);
    return dictResults;
  } catch (e) {
    console.warn('[yomitanDict] Query error:', e);
    return [];
  }
}

/** Prefix match: find all terms starting with the given prefix */
async function dbGetTermsByPrefix(prefix: string): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('terms', 'readonly');
      const store = tx.objectStore('terms');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const lower = prefix.toLowerCase();
        // Filter: starts with prefix (case-insensitive)
        const filtered = all.filter((t: any) =>
          t.term === prefix ||
          t.term.toLowerCase().startsWith(lower)
        );
        db.close();
        resolve(filtered);
      };
      req.onerror = () => { db.close(); resolve([]); };
    } catch (e) {
      db.close();
      resolve([]);
    }
  });
}

/** Backward compat: single-result query using exact match */
export async function queryYomitanTerm(word: string): Promise<DictionaryResult | null> {
  const results = await queryYomitanTerms(word, 'exact');
  return results.length > 0 ? results[0] : null;
}

/** Clear query cache (call after dictionary import/delete) */
export function clearYomitanQueryCache(): void {
  queryCache.clear();
  console.log('[yomitanDict] 查询缓存已清除');
}

// ============================================================================
// Dictionary management
// ============================================================================

export async function listYomitanDictionaries(): Promise<YomitanDictMeta[]> {
  try {
    return await dbGetAll('dicts');
  } catch {
    return [];
  }
}

export async function removeYomitanDictionary(id: string): Promise<void> {
  const results = await dbGetTermsByDictId(id);
  const db = await openDB();
  const tx = db.transaction('terms', 'readwrite');
  const store = tx.objectStore('terms');
  for (const entry of results) {
    store.delete(entry.key);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();

  await dbDelete('dicts', id);
  queryCache.clear();
  console.log(`[yomitanDict] 已删除词典 ${id} 及 ${results.length} 条词条`);
}

export async function clearAllYomitanDictionaries(): Promise<void> {
  const dicts = await listYomitanDictionaries();
  for (const d of dicts) {
    await removeYomitanDictionary(d.id);
  }
}
