/**
 * tokenizerService.ts — 文本分词服务
 * ============================================================================
 * 提供多种分词策略的统一接口，支持：
 * - 浏览器原生分词（Intl.Segmenter API）
 * - 按空格分词
 * - 按单字分词
 * - 日语分词（kuromoji.js 形态素解析）
 * - 词形还原（Lemmatization）预处理
 *
 * kuromoji.js 使用前提：
 *   npm install kuromoji
 *
 * 防御式编程：kuromoji.js 按需加载，加载失败时自动回退到浏览器分词。
 */

// ============================================================================
// 类型定义
// ============================================================================

export type TokenizerMethod = 'none' | 'browser' | 'space' | 'char' | 'japanese';

export interface TokenizedWord {
  text: string;
  reading?: string;         // 读音（仅日语分词提供）
  partOfSpeech?: string;    // 词性（仅日语分词提供）
  lemma?: string;           // 词形还原后的基本形
  position: number;         // 在原文中的位置
}

// ============================================================================
// kuromoji.js 加载状态
// ============================================================================

let kuromojiTokenizer: any = null;
let kuromojiLoading = false;
let kuromojiLoadPromise: Promise<any> | null = null;

/** 动态加载 kuromoji.js 并构建分词器 */
async function loadKuromoji(): Promise<any> {
  if (kuromojiTokenizer) return kuromojiTokenizer;
  if (kuromojiLoadPromise) return kuromojiLoadPromise;

  kuromojiLoading = true;
  kuromojiLoadPromise = (async () => {
    try {
      // 动态导入 kuromoji
      const kuromoji = await import('kuromoji');

      // kuromoji.js 需要词典路径，使用 CDN 提供的词典
      const dicPath = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/';

      return new Promise((resolve, reject) => {
        kuromoji.builder({ dicPath }).build((err: any, tokenizer: any) => {
          if (err) {
            console.error('[tokenizerService] kuromoji 词典加载失败:', err);
            kuromojiLoading = false;
            kuromojiLoadPromise = null;
            reject(err);
          } else {
            kuromojiTokenizer = tokenizer;
            kuromojiLoading = false;
            resolve(tokenizer);
          }
        });
      });
    } catch (e: any) {
      console.warn('[tokenizerService] kuromoji.js 加载失败，日语分词将回退到浏览器分词:', e.message);
      kuromojiLoading = false;
      kuromojiLoadPromise = null;
      throw e;
    }
  })();

  return kuromojiLoadPromise;
}

// ============================================================================
// 词形还原规则（Lemmatization）
// ============================================================================

/** 简单的英文词形还原映射（可扩展） */
const SIMPLE_LEMMATIZATION: Record<string, string> = {
  // 动词变化
  'studying': 'study',
  'playing': 'play',
  'running': 'run',
  'swimming': 'swim',
  'coming': 'come',
  'making': 'make',
  'taking': 'take',
  'giving': 'give',
  'going': 'go',
  'seeing': 'see',
  'doing': 'do',
  'having': 'have',
  'being': 'be',
  'saying': 'say',
  'getting': 'get',
  'thinking': 'think',
  'working': 'work',
  'talking': 'talk',
  'walking': 'walk',
  'reading': 'read',
  'writing': 'write',
  'sitting': 'sit',
  'standing': 'stand',
  'eating': 'eat',
  'drinking': 'drink',
  'sleeping': 'sleep',
  'watching': 'watch',
  'listening': 'listen',
  'waiting': 'wait',
  'looking': 'look',
  'calling': 'call',
  'telling': 'tell',
  'finding': 'find',
  'leaving': 'leave',
  'putting': 'put',
  'stopping': 'stop',
  'beginning': 'begin',
  'living': 'live',
  'moving': 'move',
  'showing': 'show',
  'starting': 'start',
  'turning': 'turn',
  'opening': 'open',
  'closing': 'close',
  'carrying': 'carry',
  'changing': 'change',
  'happening': 'happen',
  // 过去式和过去分词
  'studied': 'study',
  'played': 'play',
  'ran': 'run',
  'swam': 'swim',
  'came': 'come',
  'made': 'make',
  'took': 'take',
  'gave': 'give',
  'went': 'go',
  'saw': 'see',
  'did': 'do',
  'had': 'have',
  'was': 'be',
  'were': 'be',
  'said': 'say',
  'got': 'get',
  'thought': 'think',
  'worked': 'work',
  'talked': 'talk',
  'walked': 'walk',
  'read': 'read',
  'wrote': 'write',
  'sat': 'sit',
  'stood': 'stand',
  'ate': 'eat',
  'drank': 'drink',
  'slept': 'sleep',
  'watched': 'watch',
  // 名词复数
  'children': 'child',
  'mice': 'mouse',
  'feet': 'foot',
  'teeth': 'tooth',
  'people': 'person',
  'men': 'man',
  'women': 'woman',
  'geese': 'goose',
  'lives': 'life',
  'knives': 'knife',
  'wives': 'wife',
};

/**
 * 对单词进行简单的词形还原
 * 后续可扩展接入外部规则 JSON
 */
export function lemmatizeWord(word: string, externalRules?: Record<string, string>): string {
  if (!word) return word;

  const lower = word.toLowerCase().trim();

  // 检查外部规则（优先级最高）
  if (externalRules?.[lower]) {
    return externalRules[lower];
  }

  // 检查内置规则
  if (SIMPLE_LEMMATIZATION[lower]) {
    return SIMPLE_LEMMATIZATION[lower];
  }

  // 规则式还原
  // -ing → 还原（running → run, making → make）
  if (lower.endsWith('ing') && lower.length > 5) {
    const base = lower.slice(0, -3);
    if (lower[lower.length - 4] === lower[lower.length - 5]) {
      return base.slice(0, -1); // running → run
    }
    if (lower.endsWith('ying') && lower.length > 5) {
      return base.slice(0, -1) + 'ie'; // dying → die
    }
    return base + (lower[lower.length - 4] === 'e' ? 'e' : ''); // taking → take 但 playing → play
  }

  // -ed → 还原
  if (lower.endsWith('ed') && lower.length > 4 && !lower.endsWith('eed')) {
    const base = lower.slice(0, -2);
    if (lower[lower.length - 3] === lower[lower.length - 4]) {
      return base.slice(0, -1); // stopped → stop
    }
    return base; // played → play
  }

  // 复数 -s/-es → 还原
  if (lower.endsWith('es') && lower.length > 4) {
    if (lower.endsWith('ies')) {
      return lower.slice(0, -3) + 'y'; // studies → study
    }
    if (['s', 'x', 'z', 'o'].includes(lower[lower.length - 3]) || lower.endsWith('ches') || lower.endsWith('shes')) {
      return lower.slice(0, -2); // boxes → box
    }
  }
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
    return lower.slice(0, -1); // cats → cat
  }

  return word;
}

// ============================================================================
// 分词函数
// ============================================================================

/**
 * 按空格分词（适用于英语等以空格分隔的语言）
 */
function tokenizeBySpace(text: string): TokenizedWord[] {
  return text.split(/\s+/).map((word, i) => ({
    text: word,
    position: i,
  }));
}

/**
 * 按单字分词（适用于中文、日文等无空格语言的基础处理）
 */
function tokenizeByChar(text: string): TokenizedWord[] {
  return [...text].map((char, i) => ({
    text: char,
    position: i,
  }));
}

/**
 * 使用浏览器 Intl.Segmenter API 分词
 */
function tokenizeByBrowser(text: string): TokenizedWord[] {
  try {
    // @ts-ignore - Intl.Segmenter is available in modern browsers
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    const segments = [...segmenter.segment(text)];
    return segments.map((s, i) => ({
      text: s.segment,
      position: i,
    }));
  } catch (e) {
    // 回退到按空格+字符混合分词
    console.warn('[tokenizerService] Intl.Segmenter 不可用，回退到空格分词');
    return tokenizeBySpace(text);
  }
}

/**
 * 使用 kuromoji.js 进行日语分词
 */
async function tokenizeByJapanese(text: string): Promise<TokenizedWord[]> {
  try {
    const tokenizer = await loadKuromoji();
    const tokens = tokenizer.tokenize(text);

    return tokens
      .filter((t: any) => t.surface_form?.trim())
      .map((t: any, i: number) => ({
        text: t.surface_form,
        reading: t.reading || undefined,
        partOfSpeech: t.pos || undefined,
        lemma: t.basic_form || undefined,
        position: t.word_position || i,
      }));
  } catch (e) {
    console.warn('[tokenizerService] 日语分词失败，回退到浏览器分词');
    return tokenizeByBrowser(text);
  }
}

// ============================================================================
// 统一分词入口
// ============================================================================

/**
 * 对文本进行分词处理
 * @param text - 待分词文本
 * @param method - 分词方式
 * @param lemmatizationEnabled - 是否启用词形还原
 * @param externalRules - 外部词形还原规则
 * @returns 分词结果数组
 */
export async function tokenizeText(
  text: string,
  method: TokenizerMethod = 'browser',
  lemmatizationEnabled: boolean = false,
  externalRules?: Record<string, string>
): Promise<TokenizedWord[]> {
  if (!text?.trim()) return [];

  let words: TokenizedWord[];

  switch (method) {
    case 'none':
      // 不分词：整个文本作为一个单元
      words = [{ text, position: 0 }];
      break;

    case 'space':
      words = tokenizeBySpace(text);
      break;

    case 'char':
      words = tokenizeByChar(text);
      break;

    case 'japanese':
      words = await tokenizeByJapanese(text);
      break;

    case 'browser':
    default:
      words = tokenizeByBrowser(text);
      break;
  }

  // 词形还原处理
  if (lemmatizationEnabled && method !== 'japanese') {
    words = words.map(w => ({
      ...w,
      lemma: lemmatizeWord(w.text, externalRules) || w.text,
    }));
  }

  return words;
}

/**
 * 同步分词（不包含日语分词）
 * 用于不需要异步处理的场景
 */
export function tokenizeTextSync(
  text: string,
  method: Exclude<TokenizerMethod, 'japanese'> = 'browser',
  lemmatizationEnabled: boolean = false,
  externalRules?: Record<string, string>
): TokenizedWord[] {
  if (!text?.trim()) return [];

  let words: TokenizedWord[];

  switch (method) {
    case 'none':
      words = [{ text, position: 0 }];
      break;
    case 'space':
      words = tokenizeBySpace(text);
      break;
    case 'char':
      words = tokenizeByChar(text);
      break;
    case 'browser':
    default:
      words = tokenizeByBrowser(text);
      break;
  }

  if (lemmatizationEnabled) {
    words = words.map(w => ({
      ...w,
      lemma: lemmatizeWord(w.text, externalRules) || w.text,
    }));
  }

  return words;
}

/**
 * 仅提取分词后的纯文本数组（用于 TextOverlay 点击展示）
 */
export function tokenizeToWordList(
  text: string,
  method: TokenizerMethod = 'browser'
): string[] {
  if (!text?.trim()) return [];

  switch (method) {
    case 'none':
      return [text];
    case 'space':
      return text.split(/\s+/).filter(Boolean);
    case 'char':
      return [...text];
    case 'browser':
    default:
      try {
        // @ts-ignore
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
        return [...segmenter.segment(text)]
          .map(s => s.segment)
          .filter(w => w.trim());
      } catch (e) {
        return text.split(/(\b|\s+)/).filter(Boolean);
      }
  }
}

/** 检查日语分词是否就绪 */
export async function isJapaneseTokenizerReady(): Promise<boolean> {
  try {
    await loadKuromoji();
    return true;
  } catch {
    return false;
  }
}
