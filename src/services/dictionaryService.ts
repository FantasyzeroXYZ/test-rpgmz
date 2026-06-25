/**
 * dictionaryService.ts — 词典查词服务
 * ============================================================================
 * 整合多源词典查询，支持：
 * - 本地词典（Yomitan 导入的真实词典）
 * - Free Dictionary API (https://api.dictionaryapi.dev/)
 * - 可扩展的其他词典源
 *
 * 核心功能：
 * - 单词查询（本地 + API 并发）
 * - 多源结果合并展示
 * - API 响应格式化
 * - 查询缓存
 */
import { translateText, TranslationResult } from './translationService';
import { queryYomitanTerm } from './yomitanDictService';

// ============================================================================
// 词典查询结果类型
// ============================================================================

export interface DictionaryResult {
  word: string;
  phonetic?: string;
  definitions: DictionaryDefinition[];
  source: 'local' | 'api' | 'combined';
  error?: string;
}

export interface DictionaryDefinition {
  partOfSpeech: string;
  definition: string;
  example?: string;
  synonyms?: string[];
}

// ============================================================================
// 查询缓存
// ============================================================================

const lookupCache = new Map<string, DictionaryResult>();
const CACHE_MAX_SIZE = 300;

// ============================================================================
// Free Dictionary API 查询
// ============================================================================

/**
 * 查询 Free Dictionary API
 * @param word - 要查询的单词（需先清洗）
 * @returns 格式化的词典结果
 */
async function queryFreeDictionaryAPI(word: string): Promise<DictionaryResult> {
  const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').toLowerCase().trim();

  if (!cleanWord) {
    return { word, definitions: [], source: 'api', error: '无效的查询词' };
  }

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { word: cleanWord, definitions: [], source: 'api', error: '未找到该词' };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const entry = data[0];

    const definitions: DictionaryDefinition[] = [];
    entry.meanings?.forEach((m: any) => {
      m.definitions?.slice(0, 3).forEach((d: any) => {
        definitions.push({
          partOfSpeech: m.partOfSpeech || 'unknown',
          definition: d.definition,
          example: d.example || undefined,
          synonyms: d.synonyms || undefined,
        });
      });
    });

    return {
      word: entry.word || cleanWord,
      phonetic: entry.phonetic || entry.phonetics?.[0]?.text || undefined,
      definitions,
      source: 'api',
    };
  } catch (error: any) {
    console.warn('[dictionaryService] Free Dictionary API 查询失败:', error.message);
    return { word: cleanWord, definitions: [], source: 'api', error: 'API 查询失败' };
  }
}

// ============================================================================
// 统一查询入口
// ============================================================================

/**
 * 查询单词（支持 local / api / all 三种模式）
 * @param word - 要查询的原始单词
 * @param source - 查询来源
 * @param localDict - 可选的扩展本地词典
 * @returns 词典查询结果
 */
export async function lookupWord(
  word: string,
  source: 'local' | 'api' | 'all' = 'all',
  localDict?: Record<string, string>
): Promise<DictionaryResult> {
  const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').toLowerCase().trim();
  if (!cleanWord) {
    return { word, definitions: [], source: 'api', error: '无效的查询词' };
  }

  // 检查缓存
  const cacheKey = `${source}|${cleanWord}`;
  const cached = lookupCache.get(cacheKey);
  if (cached) return cached;

  let result: DictionaryResult;

  if (source === 'local') {
    // 仅本地词典：先查 Yomitan 导入词典
    const yomitanResult = await queryYomitanTerm(cleanWord);
    if (yomitanResult) {
      result = yomitanResult;
    } else if (localDict?.[cleanWord]) {
      result = {
        word: cleanWord,
        definitions: [{ partOfSpeech: 'unknown', definition: localDict[cleanWord] }],
        source: 'local',
      };
    } else {
      result = {
        word: cleanWord,
        definitions: [],
        source: 'local',
        error: '本地词典暂无收录',
      };
    }
  } else if (source === 'api') {
    // 仅 API
    result = await queryFreeDictionaryAPI(cleanWord);
  } else {
    // 全部：Yomitan 本地 + API 并发
    const [yomitanResult, apiResult] = await Promise.all([
      queryYomitanTerm(cleanWord),
      queryFreeDictionaryAPI(cleanWord),
    ]);

    if (yomitanResult && apiResult.definitions.length > 0) {
      // 合并：本地定义 + API 定义
      result = {
        word: cleanWord,
        phonetic: apiResult.phonetic || yomitanResult.phonetic,
        definitions: [
          ...yomitanResult.definitions,
          ...apiResult.definitions,
        ],
        source: 'combined',
      };
    } else if (yomitanResult) {
      result = yomitanResult;
    } else if (apiResult.definitions.length > 0) {
      result = apiResult;
    } else {
      result = { word: cleanWord, definitions: [], source: 'combined', error: '未找到释义' };
    }
  }

  // Only cache successful results — never cache errors/empty
  if (!result.error && result.definitions.length > 0) {
    if (lookupCache.size >= CACHE_MAX_SIZE) {
      const keys = [...lookupCache.keys()];
      keys.slice(0, Math.floor(CACHE_MAX_SIZE / 2)).forEach(k => lookupCache.delete(k));
    }
    lookupCache.set(cacheKey, result);
  }

  return result;
}

/**
 * 查询单词并获取对应的翻译
 * 对于查到的英文定义，自动翻译为中文
 */
export async function lookupAndTranslate(
  word: string,
  source: 'local' | 'api' | 'all' = 'all',
  targetLang: string = 'zh-CN'
): Promise<{
  dictionary: DictionaryResult;
  translation?: TranslationResult;
}> {
  const dictionary = await lookupWord(word, source);

  // 如果有 API 定义，翻译第一条
  if (dictionary.definitions.length > 0) {
    const firstDef = dictionary.definitions[0].definition;
    try {
      const translation = await translateText(firstDef, 'en', targetLang);
      return { dictionary, translation };
    } catch {
      // 翻译失败，仅返回词典结果
    }
  }

  return { dictionary };
}

/**
 * 格式化词典结果为纯文本（用于 FloatingLookupCard 展示）
 */
export function formatDictionaryResult(result: DictionaryResult): string {
  if (result.error && result.definitions.length === 0) {
    return `❌ ${result.error}`;
  }

  const lines: string[] = [];

  if (result.phonetic) {
    lines.push(`音标: /${result.phonetic}/`);
    lines.push('');
  }

  // 按词性分组
  const grouped = new Map<string, DictionaryDefinition[]>();
  for (const def of result.definitions) {
    const key = def.partOfSpeech || 'unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(def);
  }

  for (const [pos, defs] of grouped) {
    lines.push(`[${pos.toUpperCase()}]`);
    for (const def of defs) {
      lines.push(`• ${def.definition}`);
      if (def.example) {
        lines.push(`  例句: ${def.example}`);
      }
    }
    lines.push('');
  }

  if (result.source === 'combined') {
    lines.push('---');
    lines.push('来源: 本地词典 + Free Dictionary API');
  }

  return lines.join('\n').trim();
}

/** 清空查询缓存 */
export function clearDictionaryCache(): void {
  lookupCache.clear();
}
