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
 * - 翻译贡献（/set 端点）
 * - API 密钥生成（/keygen 端点）
 * - TMX 翻译记忆库导入（/v2/tmx/import 端点）
 *
 * API 文档：https://mymemory.translated.net/doc/spec.php
 */

// ============================================================================
// 语言代码映射
// ============================================================================

/** 将应用内部语言标识映射为 MyMemory 支持的语言代码 */
const LANG_CODE_MAP: Record<string, string> = {
  'zh': 'zh',
  'zh-CN': 'zh',
  'zh-TW': 'zh-TW',
  'ja': 'ja',
  'en': 'en',
  'en-US': 'en',
  'ko': 'ko',
  'fr': 'fr',
  'de': 'de',
  'es': 'es',
  'pt': 'pt',
  'it': 'it',
  'ru': 'ru',
};

const LANG_CODE_REVERSE: Record<string, string> = {
  'zh': 'zh',
  'zh-CN': 'zh',
  'zh-TW': 'zh-TW',
  'ja': 'ja',
  'en': 'en',
  'en-GB': 'en',
  'ko': 'ko',
  'fr': 'fr',
  'de': 'de',
  'es': 'es',
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
// 翻译语言解析
// ============================================================================

/** 翻译语言解析的输入参数 */
export interface TranslationLanguageConfig {
  /** 源语言模式: 'game' (跟随游戏) | 'system' (跟随学习语言) | 'custom' (自定义) */
  sourceLangMode: string;
  /** 自定义源语言代码 (sourceLangMode === 'custom' 时使用) */
  sourceLangCustom: string;
  /** 目标语言模式: 'ui' (跟随界面语言) | 'custom' (自定义) */
  targetLangMode: string;
  /** 自定义目标语言代码 (targetLangMode === 'custom' 时使用) */
  targetLangCustom: string;
  /** 界面语言代码 (targetLangMode === 'ui' 时使用) */
  uiLanguage: string;
  /** 游戏原始语言代码 (sourceLangMode === 'game' 时使用) */
  gameLanguage?: string;
  /** 学习语言代码 (sourceLangMode === 'system' 时使用) */
  learningLanguage?: string;
}

/**
 * 将翻译设置中的模式选择解析为实际的语言代码。
 *
 * 模式说明：
 * - source 'game'    → 跟随游戏原始语言
 * - source 'system'  → 跟随学习语言设置
 * - source 'custom'  → 使用自定义源语言
 * - target 'ui'      → 跟随界面语言
 * - target 'custom'  → 使用自定义目标语言
 */
export function resolveTranslationLanguages(config: TranslationLanguageConfig): {
  sourceLang: string;
  targetLang: string;
} {
  // === 解析源语言（文本来自哪里） ===
  let sourceLang = 'auto';
  if (config.sourceLangMode === 'game') {
    sourceLang = config.gameLanguage || 'en';
  } else if (config.sourceLangMode === 'system') {
    sourceLang = config.learningLanguage || 'en';
  } else if (config.sourceLangMode === 'custom') {
    sourceLang = config.sourceLangCustom || 'auto';
  }

  // === 解析目标语言（翻译成什么语言） ===
  let targetLang = 'zh';
  if (config.targetLangMode === 'ui') {
    targetLang = config.uiLanguage || 'zh';
  } else if (config.targetLangMode === 'custom') {
    targetLang = config.targetLangCustom || 'zh';
  }

  return { sourceLang, targetLang };
}

// ============================================================================
// 全局配置
// ============================================================================

/** MyMemory API 请求的全局配置 */
export interface TranslationConfig {
  /** API 密钥，用于认证并访问私有翻译记忆库 */
  key?: string;
  /** 联系邮箱，出现问题时用于联系（推荐用于 CAT 工具和高流量场景） */
  de?: string;
  /** 最终用户的 IP 地址（推荐用于高流量场景） */
  ip?: string;
  /** 是否启用机器翻译。0 = 仅返回人工翻译，1 = 包含机器翻译（默认） */
  mt?: number;
  /** 认证后是否仅返回私有 TM 的匹配结果。0 = 所有匹配，1 = 仅私有（默认 0） */
  onlyprivate?: number;
}

/** 默认配置：不发送额外参数，仅用 q + langpair 做最简请求 */
const DEFAULT_CONFIG: TranslationConfig = {};

let currentConfig: TranslationConfig = { ...DEFAULT_CONFIG };

/**
 * 设置全局翻译配置（API 密钥、联系邮箱等）。
 * 与现有配置合并。通常在应用启动时或设置变更时调用一次。
 *
 * @example
 *   setTranslationConfig({ key: 'mykey', de: 'user@example.com' });
 */
export function setTranslationConfig(config: TranslationConfig): void {
  currentConfig = { ...currentConfig, ...config };
}

/** 获取当前全局翻译配置的副本 */
export function getTranslationConfig(): TranslationConfig {
  return { ...currentConfig };
}

/** 重置全局配置为默认值 */
export function resetTranslationConfig(): void {
  currentConfig = { ...DEFAULT_CONFIG };
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
    /** 检测到的源语言代码（当 langpair 源为空时由 API 返回） */
    detectedLanguage?: string;
  };
  responseStatus: number;
  matches?: Array<{
    id: string;
    segment: string;
    translation: string;
    quality: string | number;
    'created-by': string;
    /** 该匹配项的源语言代码 */
    source?: string;
    /** 该匹配项的目标语言代码 */
    target?: string;
  }>;
}

interface MyMemorySetResponse {
  responseStatus: number;
  responseDetails?: string;
  error?: string;
}

/** 贡献翻译的返回结果 */
export interface ContributeResult {
  success: boolean;
  responseStatus: number;
  error?: string;
}

/** 生成 API 密钥的返回结果 */
export interface ApiKeyResult {
  success: boolean;
  key?: string;
  error?: string;
}

/** TMX 导入的返回结果 */
export interface TmxImportResult {
  success: boolean;
  uuid?: string;
  error?: string;
}

/** TMX 导入状态的返回结果 */
export interface ImportStatusResult {
  success: boolean;
  status?: 'processing' | 'completed' | 'failed';
  progress?: number; // 0-100
  error?: string;
}

// ============================================================================
// 内部辅助函数
// ============================================================================

/**
 * 构建 URL 查询参数，将全局配置与单次调用配置合并。
 * 使用 URLSearchParams 自动处理编码。
 */
function buildSearchParams(
  baseParams: Record<string, string>,
  perCallConfig?: TranslationConfig
): URLSearchParams {
  const merged: TranslationConfig = { ...currentConfig, ...perCallConfig };
  const params = new URLSearchParams(baseParams);

  if (merged.key) params.set('key', merged.key);
  if (merged.de) params.set('de', merged.de);
  if (merged.ip) params.set('ip', merged.ip);
  if (merged.mt !== undefined) params.set('mt', String(merged.mt));
  if (merged.onlyprivate !== undefined) params.set('onlyprivate', String(merged.onlyprivate));

  return params;
}

// ============================================================================
// 核心翻译函数
// ============================================================================

/**
 * 翻译一段文本
 * @param text - 待翻译的文本
 * @param sourceLang - 源语言（应用内部代码，如 'ja', 'zh', 'en'）
 * @param targetLang - 目标语言（应用内部代码）
 * @param config - 可选的单次调用配置覆盖
 * @returns 翻译结果
 */
export async function translateText(
  text: string,
  sourceLang: string = 'auto',
  targetLang: string = 'zh-CN',
  config?: TranslationConfig
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

  // 使用 URLSearchParams 构建查询字符串，自动处理编码
  const searchParams = buildSearchParams(
    { q: text, langpair: `${apiSource}|${apiTarget}` },
    config
  );
  const url = `https://api.mymemory.translated.net/get?${searchParams.toString()}`;

  // 调试日志：打印每次翻译请求的参数
  console.log('[translationService] 翻译请求参数:', {
    sourceLang,
    targetLang,
    apiLangpair: `${apiSource}|${apiTarget}`,
    textLength: text.length,
    textPreview: text.slice(0, 80),
    allParams: searchParams.toString(),
    fullUrl: url.replace(/(key=)[^&]+/, '$1***'),
  });

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

    // 调试日志：打印 API 响应状态
    console.log('[translationService] API 响应:', {
      responseStatus: data.responseStatus,
      translatedText: data.responseData?.translatedText?.slice(0, 50),
      match: data.responseData?.match,
      detectedLanguage: data.responseData?.detectedLanguage,
      matchesCount: data.matches?.length || 0,
    });

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      // 修复：使用 detectedLanguage 或 matches[0].source 检测源语言，
      // 而非 matches[0].segment（segment 是源文本字符串，不是语言代码）
      const detectedSource = ((): string => {
        if (sourceLang !== 'auto') return sourceLang;
        const fromApi = data.responseData?.detectedLanguage
          || data.matches?.[0]?.source;
        return fromApi ? fromApiLangCode(fromApi) : 'und';
      })();

      return {
        translatedText: data.responseData.translatedText,
        sourceLang: detectedSource,
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
  targetLang: string = 'zh-CN',
  config?: TranslationConfig
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
    return translateText(text, sourceLang, targetLang, config);
  }

  // 并发翻译每句
  const results = await Promise.all(
    sentences.map(s => translateText(s.trim(), sourceLang, targetLang, config))
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

    if (data.responseStatus === 200) {
      // 修复：使用 detectedLanguage 或 matches[0].source 检测语言，
      // 而非 matches[0].segment（segment 是源文本字符串，不是语言代码）
      const detected = data.responseData?.detectedLanguage
        || data.matches?.[0]?.source;
      if (detected) {
        return fromApiLangCode(detected) || 'en';
      }
    }
  } catch (e) {
    console.warn('[translationService] 语言检测失败:', e);
  }

  return 'en'; // 默认英语
}

// ============================================================================
// 贡献翻译（/set 端点）
// ============================================================================

/**
 * 向 MyMemory 贡献一个翻译对。
 * 将源文本及其翻译提交到公共（或使用密钥时为私有）翻译记忆库。
 *
 * @param segment - 源语言文本
 * @param translation - 目标语言翻译
 * @param sourceLang - 源语言代码（如 'en', 'ja'）
 * @param targetLang - 目标语言代码（如 'zh-CN'）
 * @param config - 可选的单次调用配置覆盖（如 { key: '...' } 用于私有 TM）
 * @returns ContributeResult 表示成功或失败
 *
 * @example
 *   const result = await contributeTranslation('Hello', '你好', 'en', 'zh-CN');
 *   if (result.success) console.log('翻译已贡献');
 */
export async function contributeTranslation(
  segment: string,
  translation: string,
  sourceLang: string,
  targetLang: string,
  config?: TranslationConfig
): Promise<ContributeResult> {
  if (!segment?.trim() || !translation?.trim()) {
    return { success: false, responseStatus: 0, error: '源文本和目标翻译不能为空' };
  }

  const apiSource = toApiLangCode(sourceLang);
  const apiTarget = toApiLangCode(targetLang);

  const searchParams = buildSearchParams(
    {
      seg: segment,
      tra: translation,
      langpair: `${apiSource}|${apiTarget}`,
    },
    config
  );
  const url = `https://api.mymemory.translated.net/set?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const data: MyMemorySetResponse = await response.json();

    if (data.responseStatus === 200) {
      return { success: true, responseStatus: 200 };
    }
    return {
      success: false,
      responseStatus: data.responseStatus,
      error: data.error || data.responseDetails || `API 返回状态 ${data.responseStatus}`,
    };
  } catch (error: any) {
    console.warn('[translationService] 贡献翻译失败:', error.message);
    return { success: false, responseStatus: 0, error: error.message || '网络请求失败' };
  }
}

// ============================================================================
// 生成 API 密钥（/keygen 端点）
// ============================================================================

/**
 * 为已注册用户生成 MyMemory API 密钥。
 *
 * @param username - MyMemory 用户名
 * @param password - MyMemory 密码
 * @returns ApiKeyResult，成功时包含生成的密钥
 *
 * @example
 *   const result = await generateApiKey('myuser', 'mypass');
 *   if (result.key) setTranslationConfig({ key: result.key });
 */
export async function generateApiKey(
  username: string,
  password: string
): Promise<ApiKeyResult> {
  if (!username?.trim() || !password?.trim()) {
    return { success: false, error: '用户名和密码不能为空' };
  }

  try {
    const url = `https://api.mymemory.translated.net/keygen?user=${encodeURIComponent(username)}&pass=${encodeURIComponent(password)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();

    // /keygen 返回 { responseStatus: 200, responseData: { key: '...' } }
    if (data.responseStatus === 200 && data.responseData?.key) {
      return { success: true, key: data.responseData.key };
    }
    return {
      success: false,
      error: data.responseDetails || data.error || `API 返回状态 ${data.responseStatus}`,
    };
  } catch (error: any) {
    console.warn('[translationService] 生成密钥失败:', error.message);
    return { success: false, error: error.message || '网络请求失败' };
  }
}

// ============================================================================
// TMX 翻译记忆库导入（/v2/tmx/import 和 /v2/import/status 端点）
// ============================================================================

/**
 * 将 TMX 文件导入到 MyMemory 翻译记忆库。
 * 使用 multipart/form-data（POST）。文件内容需以 Blob 或 File 形式提供。
 *
 * 注意：这是一个底层方法。在浏览器中使用时，传入来自 <input type="file"> 的 File 对象。
 *
 * @param tmxFile - TMX 文件（File 或 Blob）
 * @param options - 导入选项
 * @param options.name - 可选的简短描述
 * @param options.subject - 可选的主题（如 'Medical'）
 * @param options.isPrivate - 是否仅自己可见（默认 true）
 * @param options.config - 可选的单次调用配置（用于 key/联系方式）
 * @returns TmxImportResult，包含用于轮询状态的 uuid
 *
 * @example
 *   const result = await importTmx(file, {
 *     name: '游戏对话翻译',
 *     config: { key: 'mykey' }
 *   });
 *   if (result.uuid) {
 *     // 轮询导入状态
 *     const status = await checkImportStatus(result.uuid);
 *   }
 */
export async function importTmx(
  tmxFile: File | Blob,
  options: {
    name?: string;
    subject?: string;
    isPrivate?: boolean;
    config?: TranslationConfig;
  } = {}
): Promise<TmxImportResult> {
  const { name, subject, isPrivate = true, config } = options;

  const mergedConfig: TranslationConfig = { ...currentConfig, ...config };

  const formData = new FormData();
  formData.append('tmx', tmxFile);

  if (name) formData.append('name', name);
  if (subject) formData.append('subj', subject);
  formData.append('private', isPrivate ? '1' : '0');
  if (mergedConfig.key) formData.append('key', mergedConfig.key);
  if (mergedConfig.de) formData.append('de', mergedConfig.de);
  // surl 和 turl 极少使用，暂不暴露。如需使用可后续添加。

  try {
    const response = await fetch('https://api.mymemory.translated.net/v2/tmx/import', {
      method: 'POST',
      body: formData,
      // 注意：不要手动设置 Content-Type 头，浏览器会自动设置
      // multipart/form-data 及其 boundary
    });
    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.uuid) {
      return { success: true, uuid: data.responseData.uuid };
    }
    return {
      success: false,
      error: data.responseDetails || data.error || `API 返回状态 ${data.responseStatus}`,
    };
  } catch (error: any) {
    console.warn('[translationService] TMX 导入失败:', error.message);
    return { success: false, error: error.message || '网络请求失败' };
  }
}

/**
 * 查询 TMX 导入任务的处理状态。
 *
 * @param uuid - importTmx() 返回的 UUID
 * @returns ImportStatusResult，包含当前状态和进度
 *
 * @example
 *   const status = await checkImportStatus(uuid);
 *   if (status.status === 'completed') console.log('导入完成');
 */
export async function checkImportStatus(uuid: string): Promise<ImportStatusResult> {
  if (!uuid?.trim()) {
    return { success: false, error: 'UUID 不能为空' };
  }

  try {
    const url = `https://api.mymemory.translated.net/v2/import/status?uuid=${encodeURIComponent(uuid)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const data = await response.json();

    if (data.responseStatus === 200) {
      return {
        success: true,
        status: data.responseData?.status,
        progress: data.responseData?.progress,
      };
    }
    return {
      success: false,
      error: data.responseDetails || data.error || `API 返回状态 ${data.responseStatus}`,
    };
  } catch (error: any) {
    console.warn('[translationService] 查询导入状态失败:', error.message);
    return { success: false, error: error.message || '网络请求失败' };
  }
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
  targetLang: string = 'zh-CN',
  config?: TranslationConfig
): Promise<TranslationResult> {
  const key = cacheKey(text, sourceLang, targetLang);

  // 命中缓存
  const cached = translationCache.get(key);
  if (cached) return cached;

  // 执行翻译
  const result = await translateSentences(text, sourceLang, targetLang, config);

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
