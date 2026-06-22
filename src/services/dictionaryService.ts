/**
 * dictionaryService.ts — 词典查词服务
 * ============================================================================
 * 整合多源词典查询，支持：
 * - 本地离线词典（OFFLINE_DICTIONARY）
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
// 本地词典
// ============================================================================

/** 内置离线词典（可扩展） */
const OFFLINE_DICT: Record<string, DictionaryResult> = {
  'session': {
    word: 'session',
    phonetic: '/ˈseʃ.ən/',
    definitions: [
      { partOfSpeech: 'noun', definition: '会话; 会议; 一场活动。在模拟器中特指当前挂载并已激活的游戏内核运行实例。' },
    ],
    source: 'local',
  },
  'active': {
    word: 'active',
    phonetic: '/ˈæk.tɪv/',
    definitions: [
      { partOfSpeech: 'adjective', definition: '活跃的; 运行中的; 起作用的。在系统监控日志中，表示模拟内核、图形管线及音频输出均正常运作。' },
    ],
    source: 'local',
  },
  'resource': {
    word: 'resource',
    phonetic: '/rɪˈzɔːs/',
    definitions: [
      { partOfSpeech: 'noun', definition: '资源; 财力; 资产。指CPU线程、GPU着色器、内存显存缓存等硬件分配给游戏的底层物理耗能。' },
    ],
    source: 'local',
  },
  'graphics': {
    word: 'graphics',
    phonetic: '/ˈɡræf.ɪks/',
    definitions: [
      { partOfSpeech: 'noun', definition: '图形学; 图表; 图像数据。指游戏内的图形像素输出模块，管理高清滤镜渲染及二值化显示。' },
    ],
    source: 'local',
  },
  'pipeline': {
    word: 'pipeline',
    phonetic: '/ˈpaɪp.laɪn/',
    definitions: [
      { partOfSpeech: 'noun', definition: '管道; 着色器管线; 流水线。控制着游戏画面从ROM芯片图像源传输到渲染器，最终投射在屏幕的过程。' },
    ],
    source: 'local',
  },
  'system': {
    word: 'system',
    phonetic: '/ˈsɪs.təm/',
    definitions: [
      { partOfSpeech: 'noun', definition: '系统; 操作系统; 体系规划。特指搭载了翻译、存档、手柄以及智能OCR插件的通用AI Studio仿真大厅运行栈。' },
    ],
    source: 'local',
  },
  'game': {
    word: 'game',
    phonetic: '/ɡeɪm/',
    definitions: [
      { partOfSpeech: 'noun', definition: '游戏; 娱乐场景; 交互式多媒体。指代当前启动或配置好的任何可视化文字冒险或模拟游戏 ROM 游戏卡带。' },
    ],
    source: 'local',
  },
};

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
    // 仅本地词典
    const localEntry = OFFLINE_DICT[cleanWord];
    if (localEntry) {
      result = { ...localEntry };
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
    // 全部：先取本地，再并发 API
    const localEntry = OFFLINE_DICT[cleanWord];
    const apiResult = await queryFreeDictionaryAPI(cleanWord);

    if (localEntry && apiResult.definitions.length > 0) {
      // 合并：本地定义 + API 定义
      result = {
        word: cleanWord,
        phonetic: apiResult.phonetic || localEntry.phonetic,
        definitions: [
          ...localEntry.definitions,
          ...apiResult.definitions,
        ],
        source: 'combined',
      };
    } else if (localEntry) {
      result = { ...localEntry };
    } else if (apiResult.definitions.length > 0) {
      result = apiResult;
    } else {
      result = { word: cleanWord, definitions: [], source: 'combined', error: '未找到释义' };
    }
  }

  // 写入缓存
  if (lookupCache.size >= CACHE_MAX_SIZE) {
    const keys = [...lookupCache.keys()];
    keys.slice(0, Math.floor(CACHE_MAX_SIZE / 2)).forEach(k => lookupCache.delete(k));
  }
  lookupCache.set(cacheKey, result);

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
