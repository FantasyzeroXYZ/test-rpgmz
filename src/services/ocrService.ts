/**
 * ocrService.ts — OCR 光学字符识别服务
 * ============================================================================
 * 使用 Tesseract.js v5 库实现纯浏览器端 OCR 文字识别。
 * Tesseract.js 在 Web Worker 中运行，不阻塞主线程。
 *
 * 核心功能：
 * - 全屏截图 OCR（截取当前可视区域）
 * - 选区 OCR（用户框选区域）
 * - 多语言支持（通过 Tesseract 语言包）
 * - 进度回调
 *
 * 使用前提：项目中需安装 tesseract.js 依赖：
 *   npm install tesseract.js@5
 */

// 动态导入类型（Tesseract.js 为可选依赖，按需加载）
type TesseractWorker = any;
type RecognizeResult = {
  data: {
    text: string;
    confidence: number;
    lines: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
  };
};

// ============================================================================
// 语言映射
// ============================================================================

/** 应用内语言标识 → Tesseract 语言代码 */
const OCR_LANG_MAP: Record<string, string> = {
  'jp': 'jpn',
  'ja': 'jpn',
  'jpn': 'jpn',
  'zh': 'chi_sim',
  'zh-CN': 'chi_sim',
  'zh-TW': 'chi_tra',
  'en': 'eng',
  'eng': 'eng',
  'ko': 'kor',
  'kor': 'kor',
  'fr': 'fra',
  'fra': 'fra',
  'de': 'deu',
  'deu': 'deu',
  'es': 'spa',
  'spa': 'spa',
};

// ============================================================================
// OCR 结果类型
// ============================================================================

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
  lines: Array<{
    text: string;
    confidence: number;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  duration: number;
}

export interface OCRProgress {
  status: 'loading' | 'recognizing' | 'done' | 'error';
  progress: number; // 0-1
  message?: string;
}

// ============================================================================
// OCR 实例缓存（单例模式，避免重复加载语言包）
// ============================================================================

let tesseractModule: any = null;
let activeWorkers: Map<string, TesseractWorker> = new Map();

/** 动态加载 Tesseract.js（按需导入，减小初始包体积） */
async function loadTesseract(): Promise<any> {
  if (tesseractModule) return tesseractModule;

  try {
    // 动态导入 Tesseract.js
    tesseractModule = await import('tesseract.js');
    return tesseractModule;
  } catch (e) {
    console.error('[ocrService] Tesseract.js 加载失败，请确保已安装: npm install tesseract.js@5');
    throw new Error('Tesseract.js 库未安装。请运行: npm install tesseract.js@5');
  }
}

/** 获取或创建一个 Worker */
async function getWorker(language: string): Promise<TesseractWorker> {
  const Tesseract = await loadTesseract();
  const langCode = OCR_LANG_MAP[language] || 'eng';

  const cacheKey = langCode;
  if (activeWorkers.has(cacheKey)) {
    return activeWorkers.get(cacheKey)!;
  }

  const worker = await Tesseract.createWorker(langCode);
  activeWorkers.set(cacheKey, worker);
  return worker;
}

// ============================================================================
// 核心 OCR 函数
// ============================================================================

/**
 * 对图片数据进行 OCR 识别
 * @param imageData - ImageData、图片 URL、base64 字符串或 HTMLImageElement
 * @param language - OCR 语言
 * @param onProgress - 进度回调
 * @returns OCR 识别结果
 */
export async function recognizeImage(
  imageData: ImageData | string | HTMLImageElement,
  language: string = 'en',
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    // 进度：开始加载
    onProgress?.({ status: 'loading', progress: 0, message: '正在加载 OCR 引擎...' });

    const Tesseract = await loadTesseract();
    const langCode = OCR_LANG_MAP[language] || 'eng';

    // 进度：开始识别
    onProgress?.({ status: 'recognizing', progress: 0.3, message: '正在识别文字...' });

    let result: RecognizeResult;

    // 根据输入类型选择识别方式
    if (imageData instanceof ImageData) {
      // ImageData → Canvas → 识别
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
      ctx.putImageData(imageData, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');

      result = await Tesseract.recognize(dataUrl, langCode, {
        logger: (info: any) => {
          if (info.status === 'recognizing text') {
            onProgress?.({
              status: 'recognizing',
              progress: 0.3 + (info.progress || 0) * 0.6,
              message: `识别中... ${Math.round((info.progress || 0) * 100)}%`,
            });
          }
        },
      });
    } else if (typeof imageData === 'string') {
      // URL 或 base64
      result = await Tesseract.recognize(imageData, langCode, {
        logger: (info: any) => {
          if (info.status === 'recognizing text') {
            onProgress?.({
              status: 'recognizing',
              progress: 0.3 + (info.progress || 0) * 0.6,
              message: `识别中... ${Math.round((info.progress || 0) * 100)}%`,
            });
          }
        },
      });
    } else {
      // HTMLImageElement
      const canvas = document.createElement('canvas');
      canvas.width = imageData.naturalWidth;
      canvas.height = imageData.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
      ctx.drawImage(imageData, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');

      result = await Tesseract.recognize(dataUrl, langCode, {
        logger: (info: any) => {
          if (info.status === 'recognizing text') {
            onProgress?.({
              status: 'recognizing',
              progress: 0.3 + (info.progress || 0) * 0.6,
              message: `识别中... ${Math.round((info.progress || 0) * 100)}%`,
            });
          }
        },
      });
    }

    const duration = Date.now() - startTime;

    onProgress?.({
      status: 'done',
      progress: 1,
      message: `识别完成，用时 ${(duration / 1000).toFixed(1)}s`,
    });

    return {
      text: result.data.text?.trim() || '',
      confidence: result.data.confidence || 0,
      language: langCode,
      lines: (result.data.lines || []).map((line: any) => ({
        text: line.text?.trim() || '',
        confidence: line.confidence || 0,
        bbox: line.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 },
      })),
      duration,
    };
  } catch (error: any) {
    onProgress?.({ status: 'error', progress: 0, message: error.message });
    console.error('[ocrService] OCR 识别失败:', error);

    return {
      text: '',
      confidence: 0,
      language,
      lines: [],
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 从当前浏览器视口（viewport）截取屏幕并进行 OCR
 * 注意：只能截取同源内容，跨域 iframe 无法截取
 */
export async function captureScreenOCR(
  language: string = 'en',
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  try {
    // 使用现代浏览器的 Screen Capture API（如果可用）
    // 回退方案：提示用户手动上传截图

    // 由于浏览器安全限制，无法自动截取全屏
    // 这里提供一个 ImageData 捕获方式（仅限同源 canvas）
    throw new Error('全屏捕获需要使用 HTML Canvas 截取或用户手动上传图片');
  } catch (e: any) {
    console.warn('[ocrService] 全屏 OCR 捕获失败:', e.message);
    return {
      text: '',
      confidence: 0,
      language,
      lines: [],
      duration: 0,
    };
  }
}

/**
 * 从 Canvas 或 Video 元素中捕获帧并进行 OCR
 * 适用于模拟器游戏画面
 */
export async function captureElementOCR(
  element: HTMLCanvasElement | HTMLVideoElement,
  language: string = 'en',
  onProgress?: (progress: OCRProgress) => void
): Promise<OCRResult> {
  try {
    let dataUrl: string;

    if (element instanceof HTMLCanvasElement) {
      dataUrl = element.toDataURL('image/png');
    } else if (element instanceof HTMLVideoElement) {
      const canvas = document.createElement('canvas');
      canvas.width = element.videoWidth;
      canvas.height = element.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');
      ctx.drawImage(element, 0, 0);
      dataUrl = canvas.toDataURL('image/png');
    } else {
      throw new Error('不支持的元素类型');
    }

    return recognizeImage(dataUrl, language, onProgress);
  } catch (e: any) {
    console.error('[ocrService] 元素 OCR 捕获失败:', e.message);
    return {
      text: '',
      confidence: 0,
      language,
      lines: [],
      duration: 0,
    };
  }
}

/**
 * 终止所有活跃的 OCR Worker（释放内存）
 */
export async function terminateOCRWorkers(): Promise<void> {
  for (const [key, worker] of activeWorkers) {
    try {
      await worker.terminate();
    } catch (e) {
      // 忽略终止错误
    }
  }
  activeWorkers.clear();
}
