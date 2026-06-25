/**
 * ttsService.ts — 浏览器 TTS 语音合成服务
 * ============================================================================
 * 提供浏览器原生 SpeechSynthesis API 的封装：
 * - 获取可用语音列表（处理 Chrome 异步加载）
 * - 按语言分组语音
 * - 统一的 speak 接口
 */

export interface VoiceInfo {
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
  voiceURI: string;
}

/** 按语言分组的语音列表 */
export interface VoiceGroup {
  langLabel: string;   // 显示用的语言标签（如 "中文 (zh)"）
  langCode: string;    // 语言代码前缀（如 "zh"）
  voices: VoiceInfo[];
}

/**
 * 获取浏览器可用的 TTS 语音列表。
 * 处理 Chrome 中语音异步加载的情况（首次 getVoices() 返回空数组）。
 *
 * @param timeoutMs - 等待语音加载的最大时间（默认 3000ms）
 * @returns Promise<VoiceInfo[]>
 */
export function getAvailableVoices(timeoutMs = 3000): Promise<VoiceInfo[]> {
  return new Promise((resolve) => {
    // 检查 API 是否可用
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }

    // 首次尝试获取语音（可能在 Chrome 中返回空数组）
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices.map(mapVoice));
      return;
    }

    // Chrome: 语音异步加载，等待 voiceschanged 事件
    let resolved = false;
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      // 超时回退：再次尝试获取
      const fallback = window.speechSynthesis.getVoices();
      resolve(fallback.map(mapVoice));
    }, timeoutMs);

    const onVoicesChanged = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices().map(mapVoice));
    };

    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
  });
}

function mapVoice(v: SpeechSynthesisVoice): VoiceInfo {
  return {
    name: v.name,
    lang: v.lang,
    default: v.default,
    localService: v.localService,
    voiceURI: v.voiceURI,
  };
}

/** 语言代码 → 友好标签映射 */
const LANG_LABELS: Record<string, string> = {
  zh: '中文',
  'zh-CN': '中文（简体）',
  'zh-TW': '中文（繁体）',
  'zh-HK': '中文（粤语）',
  ja: '日本語',
  en: 'English',
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  pt: 'Português',
  it: 'Italiano',
  ru: 'Русский',
  ar: 'العربية',
  hi: 'हिन्दी',
  th: 'ไทย',
  vi: 'Tiếng Việt',
};

function getLangLabel(langCode: string): string {
  if (LANG_LABELS[langCode]) return LANG_LABELS[langCode];
  // 尝试匹配前缀
  const prefix = langCode.split('-')[0];
  if (LANG_LABELS[prefix]) return `${LANG_LABELS[prefix]} (${langCode})`;
  return langCode;
}

/**
 * 将语音列表按语言分组排序。
 * 中文和日文排在前面（项目主要目标语言），其余按语言代码排序。
 */
export function groupVoicesByLanguage(voices: VoiceInfo[]): VoiceGroup[] {
  const groups = new Map<string, VoiceInfo[]>();

  for (const v of voices) {
    // 用语言代码前缀分组（如 "zh-CN" → "zh"）
    const prefix = v.lang.split('-')[0].toLowerCase();
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(v);
  }

  // 排序：zh、ja 优先，其余按字母
  const priorityLangs = ['zh', 'ja', 'en'];
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const ai = priorityLangs.indexOf(a);
    const bi = priorityLangs.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  return sortedKeys.map((key) => ({
    langCode: key,
    langLabel: getLangLabel(key),
    voices: groups.get(key)!.sort((a, b) => {
      // 默认语音排最前，其余按名称排序
      if (a.default !== b.default) return a.default ? -1 : 1;
      return a.name.localeCompare(b.name);
    }),
  }));
}

/**
 * 统一的 TTS 朗读接口。
 * @param text - 要朗读的文本
 * @param options - 语音参数
 */
export function speakTTS(
  text: string,
  options: {
    voiceName?: string;   // 语音名称（空字符串 = 系统默认）
    rate?: number;        // 语速（0.1 ~ 10，默认 1.0）
    pitch?: number;       // 音高（0 ~ 2，默认 1.0）
    volume?: number;      // 音量（0 ~ 1，默认 0.8）
  } = {},
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  // 设置语音
  if (options.voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(
      (v) => v.name === options.voiceName || v.voiceURI === options.voiceName,
    );
    if (voice) utterance.voice = voice;
  }

  utterance.rate = options.rate ?? 1.0;
  utterance.pitch = options.pitch ?? 1.0;
  utterance.volume = options.volume ?? 0.8;

  window.speechSynthesis.speak(utterance);
}
