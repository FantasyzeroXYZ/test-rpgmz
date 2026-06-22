/**
 * translationService.ts — 翻译服务模块
 * ============================================================================
 * 使用 MyMemory API (https://mymemory.translated.net/) 提供免费翻译服务。
 * MyMemory 是免费的机器翻译 API，支持多语言互译，每日限额 5000 字符。
 *
 * 核心功能：
 * - 单词/短语翻译
 * - 句子/段落翻译
 * - 批量翻译（逐句拆分后并发请求）
 * - 语言对检测与映射
 * - 自动回退（API 失败时返回原文 + 错误提示）
 *
 * API 文档：https://mymemory.translated.net/doc/spec.php
 */

// ============================================================================
// 语言代码映射
// ============================================================================

/** 将应用内部语言标识映射为 MyMemory 支持的语言代码 */
const LANG_CODE_MAP: Record<string, string> = {
  'zh': 'zh-CN',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'ja': 'ja',
  'en': 'en-GB',
  'en-US': 'en-GB',
  'ko': 'ko',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'es': 'es-ES',
  'pt': 'pt-PT',
  'it': 'it-IT',
  'ru': 'ru-RU',
};

const LANG_CODE_REVERSE: Record<string, string> = {
  'zh-CN': 'zh',
  'zh-TW': 'zh-TW',
  'ja': 'ja',
  'en-GB': 'en',
  'en': 'en',
  'ko': 'ko',
  'fr-FR': 'fr',
  'de-DE': 'de',
  'es-ES': 'es',
};

/** 将应用语言代码转为 MyMemory API 使用的代码 */
function toApiLangCode(appCode: string): string {
  return LANG_CODE_MAP[appCode] || appCode;
}

/** 将 MyMemory API 返回的语言代码转为应用内部代码 */
function fromApiLangCode(apiCode: string): string {
  return LANG_CODE_REVERSE[apiCode] || apiCode;
}

// ============================================================================
// 翻译结果类型
// ============================================================================

export interface TranslationResult {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  matchQuality: number; // 0-100 的匹配质量分数
  provider: 'mymemory' | 'fallback';
  error?: string;
}

interface MyMemoryResponse {
  responseData: {
    translatedText: string;
    match: number;
  };
  responseStatus: number;
  matches?: Array<{
    id: string;
    segment: string;
    translation: string;
    quality: string | number;
    'created-by': string;
  }>;
}

// ============================================================================
// 核心翻译函数
// ============================================================================

/**
 * 翻译一段文本
 * @param text - 待翻译的文本
 * @param sourceLang - 源语言（应用内部代码，如 'ja', 'zh', 'en'）
 * @param targetLang - 目标语言（应用内部代码）
 * @returns 翻译结果
 */
export async function translateText(
  text: string,
  sourceLang: string = 'auto',
  targetLang: string = 'zh-CN'
): Promise<TranslationResult> {
  // 输入校验
  if (!text?.trim()) {
    return {
      translatedText: '',
      sourceLang,
      targetLang,
      matchQuality: 0,
      provider: 'fallback',
      error: '输入文本为空',
    };
  }

  const apiSource = sourceLang === 'auto' ? '' : toApiLangCode(sourceLang);
  const apiTarget = toApiLangCode(targetLang);

  // 构建 MyMemory API URL
  // langpair 格式: "en|it" 或 "it|en", 当 source 为空时 API 自动检测
  let url: string;
  if (apiSource) {
    url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${apiSource}|${apiTarget}`;
  } else {
    // 自动检测源语言
    url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=|${apiTarget}`;
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: MyMemoryResponse = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return {
        translatedText: data.responseData.translatedText,
        sourceLang: sourceLang === 'auto'
          ? fromApiLangCode(data.matches?.[0]?.segment ?? sourceLang)
          : sourceLang,
        targetLang,
        matchQuality: data.responseData.match * 100,
        provider: 'mymemory',
      };
    } else {
      throw new Error(`API 响应异常: responseStatus=${data.responseStatus}`);
    }
  } catch (error: any) {
    console.warn('[translationService] MyMemory API 请求失败:', error.message);

    // 回退：返回原文 + 错误标记
    return {
      translatedText: `[翻译失败] ${text}`,
      sourceLang,
      targetLang,
      matchQuality: 0,
      provider: 'fallback',
      error: error.message || '网络请求失败',
    };
  }
}

/**
 * 批量翻译：将文本按句子拆分，逐句翻译后拼接
 * 这样可以利用 MyMemory 的翻译记忆库提高匹配率
 */
export async function translateSentences(
  text: string,
  sourceLang: string = 'auto',
  targetLang: string = 'zh-CN'
): Promise<TranslationResult> {
  if (!text?.trim()) {
    return {
      translatedText: '',
      sourceLang,
      targetLang,
      matchQuality: 0,
      provider: 'fallback',
    };
  }

  // 简单句子拆分（按 .!?。！？ 分割）
  const sentences = text
    .split(/(?<=[.!?。！？])\s*/)
    .filter(s => s.trim().length > 0);

  // 如果只有一句或文本很短，直接翻译
  if (sentences.length <= 1 || text.length < 50) {
    return translateText(text, sourceLang, targetLang);
  }

  // 并发翻译每句
  const results = await Promise.all(
    sentences.map(s => translateText(s.trim(), sourceLang, targetLang))
  );

  // 拼接结果
  const translatedText = results.map(r => r.translatedText).join('');
  const avgQuality = results.reduce((sum, r) => sum + r.matchQuality, 0) / results.length;

  return {
    translatedText,
    sourceLang: results[0]?.sourceLang || sourceLang,
    targetLang,
    matchQuality: Math.round(avgQuality),
    provider: 'mymemory',
  };
}

/**
 * 检测文本的语言
 * 使用 MyMemory API 的语言检测功能
 */
export async function detectLanguage(text: string): Promise<string> {
  if (!text?.trim()) return 'en';

  try {
    // 使用 MyMemory 的自动检测：发送空源语言
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 100))}&langpair=|en-GB`;
    const response = await fetch(url);
    const data: MyMemoryResponse = await response.json();

    if (data.matches?.[0]?.segment) {
      return fromApiLangCode(data.matches[0].segment) || 'en';
    }
  } catch (e) {
    console.warn('[translationService] 语言检测失败:', e);
  }

  return 'en'; // 默认英语
}

// ============================================================================
// 翻译缓存（减少重复 API 请求）
// ============================================================================

const translationCache = new Map<string, TranslationResult>();
const CACHE_MAX_SIZE = 200;

/** 生成缓存键 */
function cacheKey(text: string, source: string, target: string): string {
  return `${source}|${target}|${text}`;
}

/** 带缓存的翻译 */
export async function translateWithCache(
  text: string,
  sourceLang: string = 'auto',
  targetLang: string = 'zh-CN'
): Promise<TranslationResult> {
  const key = cacheKey(text, sourceLang, targetLang);

  // 命中缓存
  const cached = translationCache.get(key);
  if (cached) return cached;

  // 执行翻译
  const result = await translateSentences(text, sourceLang, targetLang);

  // 写入缓存（限制大小，LRU 简化版：超过上限清除最早的一半）
  if (translationCache.size >= CACHE_MAX_SIZE) {
    const entries = [...translationCache.keys()];
    const toDelete = entries.slice(0, Math.floor(CACHE_MAX_SIZE / 2));
    toDelete.forEach(k => translationCache.delete(k));
  }
  translationCache.set(key, result);

  return result;
}

/** 清空翻译缓存 */
export function clearTranslationCache(): void {
  translationCache.clear();
}
