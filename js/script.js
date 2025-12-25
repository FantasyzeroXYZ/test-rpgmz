// ============================
// 全局变量
// ============================
let lastText = "";
let textInterval;
let currentScreenshot = null;
let ankiConnected = false;
let currentAnkiDeck = "";
let currentAnkiModel = "";
let ankiFields = [];
let saveFiles = [];
let quickSaveSlots = Array(6).fill(null);
let fullscreenMode = false;
let sidebarPosition = "right";
let gameScaleMode = "fit-both";
let ankiCards = [];
let selectedAnkiCard = null;
let gameLoaded = false;
let screenshotQuality = 1.0;
let autoExtractEnabled = true;
let logLevel = "normal";

// DOM 元素引用
let swIndicator, gameIndicator, swStatusText, gameStatusText, envInfo;
let settingsPanel, saveManagerPanel, leftSidebar, rightSidebar, gameArea, gamePlaceholder, gameIframe;
let ankiStatusIndicator, ankiStatusText, ankiSidebarStatus, ankiSidebarText;

// ============================
// 基础路径
// ============================
const BASE_PATH = location.pathname.replace(/\/[^\/]*$/, '/');

function getGamePath() {
  return BASE_PATH + 'game/index.html';
}

function getSWPath() {
  return BASE_PATH + 'sw.js';
}

// ============================
// 日志系统
// ============================
const log = (t, level = "info") => {
  if (logLevel === "minimal" && level !== "error") return;
  if (logLevel === "normal" && level === "debug") return;
  
  try {
    const el = document.getElementById("log");
    if (el) {
      const timestamp = new Date().toLocaleTimeString();
      const levelPrefix = level === "error" ? "❌ " : level === "warn" ? "⚠️ " : level === "debug" ? "🔍 " : "";
      el.textContent = `[${timestamp}] ${levelPrefix}${t}\n${el.textContent}`;
      
      const lines = el.textContent.split('\n');
      if (lines.length > 50) {
        el.textContent = lines.slice(0, 50).join('\n');
      }
    }
  } catch (error) {
    console.warn('日志记录失败:', error);
  }
};

// ============================
// 通知系统
// ============================
function showNotification(message, type = "info", duration = 3000) {
  const notification = document.getElementById("notification");
  const content = document.getElementById("notification-content");
  
  if (notification && content) {
    const icon = type === "success" ? "✅" : type === "error" ? "❌" : type === "warn" ? "⚠️" : "ℹ️";
    content.textContent = `${icon} ${message}`;
    notification.style.display = "block";
    
    // 设置样式
    notification.style.background = type === "success" ? "#4CAF50" : 
                                   type === "error" ? "#f44336" : 
                                   type === "warn" ? "#ff9800" : "#333";
    
    // 自动隐藏
    setTimeout(() => {
      notification.style.display = "none";
    }, duration);
  }
}

// ============================
// DOM 工具函数
// ============================
function getElementSafe(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`元素 ${id} 未找到`);
    return null;
  }
  return el;
}

function initDOMElements() {
  swIndicator = getElementSafe('sw-indicator');
  gameIndicator = getElementSafe('game-indicator');
  swStatusText = getElementSafe('sw-status');
  gameStatusText = getElementSafe('game-status');
  envInfo = getElementSafe('env-info');
  
  // 新增 DOM 元素
  settingsPanel = getElementSafe('settings-panel');
  saveManagerPanel = getElementSafe('save-manager-panel');
  leftSidebar = getElementSafe('sidebar-left');
  rightSidebar = getElementSafe('sidebar-right');
  gameArea = getElementSafe('game-area');
  gamePlaceholder = getElementSafe('game-placeholder');
  gameIframe = getElementSafe('game');
  
  // Anki 元素
  ankiStatusIndicator = getElementSafe('anki-status-indicator');
  ankiStatusText = getElementSafe('anki-status-text');
  ankiSidebarStatus = getElementSafe('anki-sidebar-status');
  ankiSidebarText = getElementSafe('anki-sidebar-text');
  
  // 更新环境信息显示
  if (envInfo) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    envInfo.textContent = isLocalhost ? '💻 本地' : '🌍 在线';
  }
}

// ============================
// 状态管理
// ============================
function updateSWStatus(status) {
  try {
    const indicator = swIndicator;
    const text = swStatusText;
    
    if (!indicator || !text) return;
    
    switch(status) {
      case 'registered':
        indicator.className = 'status-indicator active';
        text.textContent = 'SW: 已激活';
        break;
      case 'error':
        indicator.style.background = '#f44336';
        indicator.style.animation = '';
        text.textContent = 'SW: 错误';
        break;
      case 'installing':
        indicator.style.background = '#ff9800';
        indicator.style.animation = 'pulse 1s infinite';
        text.textContent = 'SW: 安装中';
        break;
      default:
        indicator.style.background = '#888';
        indicator.style.animation = '';
        text.textContent = 'SW: 未注册';
    }
  } catch (error) {
    console.warn('更新 SW 状态时出错:', error);
  }
}

function updateGameStatus(status) {
  try {
    const indicator = gameIndicator;
    const text = gameStatusText;
    
    if (!indicator || !text) return;
    
    switch(status) {
      case 'loaded':
        indicator.className = 'status-indicator active';
        text.textContent = '游戏: 已加载';
        break;
      case 'loading':
        indicator.style.background = '#ff9800';
        indicator.style.animation = 'pulse 1s infinite';
        text.textContent = '游戏: 加载中';
        break;
      case 'error':
        indicator.style.background = '#f44336';
        indicator.style.animation = '';
        text.textContent = '游戏: 错误';
        break;
      default:
        indicator.style.background = '#888';
        indicator.style.animation = '';
        text.textContent = '游戏: 未加载';
    }
  } catch (error) {
    console.warn('更新游戏状态时出错:', error);
  }
}

// ============================
// Service Worker 注册与通信
// ============================
function setupSWMessageHandler() {
  try {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "GAME_READY") {
        log("✅ 资源就绪，启动游戏...");
        updateGameStatus('loading');
        
        const gameUrl = getGamePath();
        log(`🚀 加载游戏: ${gameUrl}`);
        
        if (gameIframe) {
          gamePlaceholder.style.display = 'none';
          gameIframe.style.display = 'block';
          gameIframe.src = gameUrl;
          
          gameIframe.onload = function() {
            log("🎮 游戏加载完成");
            updateGameStatus('loaded');
            gameLoaded = true;
            startTextWatcher();
            adjustGameScale();
            initQuickSaveSlots();
            scanSaveFiles();
            startGameMonitor();
          };
          
          gameIframe.onerror = function() {
            log("❌ 游戏加载失败", "error");
            updateGameStatus('error');
            gamePlaceholder.style.display = 'flex';
            gameIframe.style.display = 'none';
          };
        }
      }
      
      if (event.data && event.data.type === "PONG") {
        log(`🔄 SW 版本: ${event.data.version}, 作用域: ${event.data.scope || '/'}`);
        updateSWStatus('registered');
      }
    });
  } catch (error) {
    console.error('设置 SW 消息处理器失败:', error);
  }
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    log("❌ 浏览器不支持 Service Worker", "error");
    updateSWStatus('error');
    return false;
  }
  
  try {
    updateSWStatus('installing');
    
    const swPath = getSWPath();
    const scope = BASE_PATH;

    log(`📡 注册 Service Worker: ${swPath}, 作用域: ${scope}`);
    
    const registration = await navigator.serviceWorker.register(swPath, {
      scope
    });
    
    // 等待 Service Worker 就绪
    if (registration.installing) {
      registration.installing.addEventListener('statechange', (e) => {
        const sw = e.target;
        log(`🔄 SW 状态: ${sw.state}`);
        
        if (sw.state === 'activated') {
          updateSWStatus('registered');
          
          if (registration.active) {
            registration.active.postMessage({ type: "PING" });
          }
        }
      });
    } else if (registration.active) {
      updateSWStatus('registered');
      registration.active.postMessage({ type: "PING" });
    }
    
    // 监听更新
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      log('🔄 发现 Service Worker 更新');
      
      newWorker.addEventListener('statechange', () => {
        log(`🔄 新 SW 状态: ${newWorker.state}`);
        if (newWorker.state === 'installed') {
          showNotification('新版本已安装，刷新页面即可使用', 'info', 5000);
        }
      });
    });
    
    return true;
  } catch (error) {
    console.error('Service Worker 注册失败:', error);
    log(`❌ SW 注册失败: ${error.message}`, "error");
    updateSWStatus('error');
    return false;
  }
}

// ============================
// ZIP 文件处理
// ============================
function setupZipHandler() {
  const zipInput = document.getElementById("zip");
  if (!zipInput) return;
  
  zipInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    log(`📦 读取 ZIP 文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    showNotification(`正在处理: ${file.name}`, "info");
    
    // 显示上传进度
    const progress = getElementSafe('upload-progress');
    const progressText = getElementSafe('upload-progress-text');
    const progressBar = getElementSafe('upload-progress-bar');
    if (progress) progress.style.display = 'block';
    
    try {
      // 更新进度
      const updateProgress = (percent) => {
        if (progressText) progressText.textContent = `${percent}%`;
        if (progressBar) progressBar.style.width = `${percent}%`;
      };
      
      updateProgress(10);
      
      // 注册 Service Worker
      const swRegistered = await registerSW();
      if (!swRegistered) {
        log("❌ 无法继续，Service Worker 注册失败", "error");
        showNotification("Service Worker 注册失败", "error");
        return;
      }
      
      updateProgress(30);
      
      // 读取 ZIP 文件
      const zip = await JSZip.loadAsync(file);
      const files = {};
      let totalSize = 0;
      let fileCount = 0;
      const fileEntries = Object.entries(zip.files);
      
      updateProgress(50);
      
      // 处理所有文件
      for (let i = 0; i < fileEntries.length; i++) {
        const [relativePath, entry] = fileEntries[i];
        if (!entry.dir) {
          const cleanPath = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
          
          // 跳过系统文件
          if (cleanPath.includes('__MACOSX/') || 
              cleanPath.includes('.DS_Store') ||
              cleanPath.includes('Thumbs.db')) continue;
          
          const fileData = await entry.async("uint8array");
          files[cleanPath] = fileData;
          totalSize += fileData.length;
          fileCount++;
          
          // 更新进度
          if (i % Math.floor(fileEntries.length / 10) === 0) {
            updateProgress(50 + (i / fileEntries.length * 40));
          }
        }
      }
      
      updateProgress(90);
      
      if (fileCount > 10) {
        log(`📄 ... 以及另外 ${fileCount - 10} 个文件`);
      }
      
      log(`📤 准备发送 ${fileCount} 个文件 (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
      
      // 检查是否有必要的文件
      if (!files["index.html"] && !files["www/index.html"]) {
        log("⚠️ 警告: ZIP 文件中未找到 index.html", "warn");
        showNotification("未找到 index.html，可能不是有效的游戏文件", "warn");
      }
      
      // 发送文件给 Service Worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ 
          type: "LOAD_GAME", 
          files: files,
          metadata: {
            fileName: file.name,
            fileCount: fileCount,
            totalSize: totalSize,
            timestamp: new Date().toISOString()
          }
        });
        
        // 更新调试信息
        const debugInfo = getElementSafe('debug-info');
        if (debugInfo) {
          debugInfo.innerHTML = `
            ZIP: ${file.name}<br>
            文件数: ${fileCount}<br>
            总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB<br>
            路径: ${BASE_PATH}<br>
            环境: ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '本地' : '在线'}
          `;
        }
        
        showNotification("游戏文件处理完成，正在加载...", "success");
      } else {
        log("❌ Service Worker 未激活，请刷新页面重试", "error");
        showNotification("Service Worker 未激活，请刷新页面", "error");
      }
      
      updateProgress(100);
      setTimeout(() => {
        if (progress) progress.style.display = 'none';
      }, 1000);
      
    } catch (error) {
      console.error("ZIP 处理错误:", error);
      log(`❌ ZIP 处理失败: ${error.message}`, "error");
      showNotification(`ZIP 处理失败: ${error.message}`, "error");
      
      if (progress) progress.style.display = 'none';
    }
  };
}

// ============================
// 文本提取功能
// ============================
function extractText() {
  if (!gameLoaded) {
    log("⚠️ 游戏未加载，无法提取文本", "warn");
    return;
  }
  
  try {
    const gameWin = gameIframe.contentWindow;
    
    if (!gameWin) {
      log("⚠️ 无法访问游戏窗口", "warn");
      return;
    }
    
    let text = "";
    
    // RPG Maker MZ
    if (gameWin.$gameMessage && gameWin.$gameMessage.hasText) {
      if (gameWin.$gameMessage.hasText()) {
        text = gameWin.$gameMessage._texts?.join("\n") || "";
      }
    } 
    // RPG Maker MV
    else if (gameWin.$gameMessage && gameWin.$gameMessage._texts) {
      text = gameWin.$gameMessage._texts.join("\n");
    }
    // 通用方法：查找对话框元素
    else {
      try {
        const messageWindows = gameWin.document.querySelectorAll('.window, .message_window, .Window, .Message_Window');
        messageWindows.forEach(window => {
          const content = window.textContent || window.innerText;
          if (content.trim()) {
            text += content + "\n";
          }
        });
      } catch (e) {
        // 跨域限制，使用其他方法
      }
    }
    
    // 清理文本
    if (text) {
      text = text.replace(/\\(?:[A-Z]+\[[^\]]*\]|[A-Z]+|[.\|\^<>!])/gi, "")
                 .replace(/\\[Nn]/g, "\n")
                 .replace(/\\[Cc]\[(\d+)\]/g, "")
                 .replace(/\{.*?\}/g, "")
                 .replace(/\r\n/g, "\n")
                 .replace(/\r/g, "\n")
                 .replace(/\n+/g, "\n")
                 .trim();
    }
    
    if (text && text !== lastText) {
      const textarea = getElementSafe('game-text');
      if (textarea) {
        textarea.value = text;
        lastText = text;
        
        // 视觉反馈
        textarea.style.background = "#2a2a2a";
        setTimeout(() => textarea.style.background = "#1e1e1e", 100);
        
        log(`📝 提取文本: ${text.length} 字符`, "debug");
        
        // 自动复制到剪贴板（可选）
        const autoCopy = getElementSafe('auto-copy');
        if (autoCopy && autoCopy.checked) {
          copyText();
        }
      }
    }
  } catch (e) {
    console.error("文本提取错误:", e);
    log(`❌ 文本提取失败: ${e.message}`, "error");
  }
}

function copyText() {
  const textarea = getElementSafe('game-text');
  if (textarea && textarea.value) {
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    try {
      document.execCommand('copy');
      showNotification("文本已复制到剪贴板", "success");
      log("📋 文本已复制到剪贴板");
    } catch (err) {
      console.error('复制失败:', err);
      
      // 使用现代 Clipboard API
      navigator.clipboard.writeText(textarea.value).then(() => {
        showNotification("文本已复制到剪贴板", "success");
        log("📋 文本已复制到剪贴板");
      }).catch(err => {
        showNotification("复制失败", "error");
        log(`❌ 复制失败: ${err.message}`, "error");
      });
    }
  } else {
    showNotification("没有文本可复制", "warn");
  }
}

function saveText() {
  const textarea = getElementSafe('game-text');
  if (textarea && textarea.value) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `game-text-${timestamp}.txt`;
    const blob = new Blob([textarea.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
    showNotification("文本已保存", "success");
    log(`💾 文本已保存: ${filename}`);
  } else {
    showNotification("没有文本可保存", "warn");
  }
}

function clearText() {
  const textarea = getElementSafe('game-text');
  if (textarea) {
    textarea.value = "";
    lastText = "";
    showNotification("文本框已清空", "info");
    log("🗑️ 已清空文本框");
  }
}

function startTextWatcher() {
  if (textInterval) clearInterval(textInterval);
  
  textInterval = setInterval(() => {
    if (autoExtractEnabled) {
      extractText();
    }
  }, 500);
}

// ============================
// 截图功能
// ============================
function takeScreenshot() {
  if (!gameLoaded) {
    showNotification("游戏未加载", "error");
    return;
  }
  
  try {
    const gameWin = gameIframe.contentWindow;
    
    if (!gameWin) {
      showNotification("无法访问游戏窗口", "error");
      return;
    }
    
    const canvas = gameWin.document.querySelector("canvas");
    
    if (!canvas) {
      showNotification("未找到游戏 Canvas", "error");
      return;
    }
    
    // 检查 Canvas 尺寸
    if (canvas.width === 0 || canvas.height === 0) {
      showNotification("Canvas 尺寸为 0，等待游戏初始化...", "warn");
      return;
    }
    
    log(`📷 截图尺寸: ${canvas.width}x${canvas.height}`, "debug");
    
    // 闪光效果
    const flash = getElementSafe('flash');
    if (flash) {
      flash.style.opacity = "0.7";
      setTimeout(() => flash.style.opacity = "0", 150);
    }
    
    // 创建高质量截图
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const ctx = offscreenCanvas.getContext('2d');
    
    if (!ctx) {
      showNotification("无法创建绘图上下文", "error");
      return;
    }
    
    // 设置高质量渲染
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // 绘制截图
    ctx.drawImage(canvas, 0, 0);
    
    // 生成数据 URL
    currentScreenshot = offscreenCanvas.toDataURL("image/png", screenshotQuality);
    
    // 显示截图
    const img = getElementSafe('screenshot-img');
    const tip = getElementSafe('screenshot-tip');
    const actions = getElementSafe('screenshot-actions');
    
    if (img) {
      img.src = currentScreenshot;
      img.style.display = "block";
      img.style.maxHeight = "200px";
    }
    
    if (tip) {
      tip.textContent = "已捕获 (右键可保存)";
    }
    
    if (actions) {
      actions.style.display = "block";
    }
    
    // 启用下载按钮
    const downloadBtn = getElementSafe('download-btn');
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.style.background = "#4CAF50";
    }
    
    showNotification("截图成功", "success");
    log("✅ 截图成功");
    
  } catch (e) {
    console.error("截图失败:", e);
    showNotification(`截图失败: ${e.message}`, "error");
    log(`❌ 截图失败: ${e.message}`, "error");
  }
}

function downloadScreenshot() {
  if (!currentScreenshot) {
    showNotification("没有可下载的截图", "error");
    return;
  }
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `screenshot-${timestamp}.png`;
    
    const link = document.createElement('a');
    link.download = filename;
    link.href = currentScreenshot;
    link.click();
    
    showNotification(`截图已下载: ${filename}`, "success");
    log(`⬇️ 下载截图: ${filename}`);
  } catch (e) {
    console.error("下载失败:", e);
    showNotification(`下载失败: ${e.message}`, "error");
    log(`❌ 下载失败: ${e.message}`, "error");
  }
}

function copyScreenshot() {
  if (!currentScreenshot) {
    showNotification("没有可复制的截图", "error");
    return;
  }
  
  fetch(currentScreenshot)
    .then(res => res.blob())
    .then(blob => {
      navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]).then(() => {
        showNotification("截图已复制到剪贴板", "success");
        log("📋 截图已复制到剪贴板");
      }).catch(err => {
        showNotification("复制失败，请使用下载功能", "error");
        log(`❌ 复制失败: ${err.message}`, "error");
      });
    })
    .catch(err => {
      showNotification("处理截图失败", "error");
      log(`❌ 处理截图失败: ${err.message}`, "error");
    });
}

function shareScreenshot() {
  if (!currentScreenshot) {
    showNotification("没有可分享的截图", "error");
    return;
  }
  
  if (navigator.share) {
    fetch(currentScreenshot)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'screenshot.png', { type: 'image/png' });
        navigator.share({
          files: [file],
          title: '游戏截图',
          text: '来自 RPGMZ Player 的游戏截图'
        }).then(() => {
          showNotification("截图分享成功", "success");
          log("📤 截图分享成功");
        }).catch(err => {
          if (err.name !== 'AbortError') {
            showNotification("分享失败", "error");
            log(`❌ 分享失败: ${err.message}`, "error");
          }
        });
      })
      .catch(err => {
        showNotification("处理截图失败", "error");
        log(`❌ 处理截图失败: ${err.message}`, "error");
      });
  } else {
    showNotification("当前浏览器不支持分享功能", "warn");
  }
}

// ============================
// Anki Connect 功能
// ============================
async function testAnkiConnection() {
  const ip = getElementSafe('anki-ip').value;
  const port = getElementSafe('anki-port').value;
  
  const testResult = getElementSafe('anki-test-result');
  if (testResult) {
    testResult.style.display = 'block';
    testResult.className = '';
    testResult.textContent = '连接中...';
  }
  
  try {
    log(`🔗 测试 AnkiConnect 连接: ${ip}:${port}`);
    
    const response = await fetch(`http://${ip}:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'version',
        version: 6,
        params: {}
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    ankiConnected = true;
    updateAnkiStatus('connected', `已连接 v${result.result}`);
    log("✅ AnkiConnect 连接成功");
    
    if (testResult) {
      testResult.className = 'success-message';
      testResult.innerHTML = `✅ 连接成功！AnkiConnect 版本: v${result.result}`;
    }
    
    showNotification("AnkiConnect 连接成功", "success");
    
    // 获取牌组列表
    await loadAnkiDecks();
    await loadRecentAnkiCards();
    
    return true;
    
  } catch (error) {
    ankiConnected = false;
    updateAnkiStatus('disconnected', '连接失败');
    log(`❌ AnkiConnect 连接失败: ${error.message}`, "error");
    
    if (testResult) {
      testResult.className = 'error-message';
      testResult.innerHTML = `❌ 连接失败: ${error.message}<br>请确保 Anki 正在运行且 AnkiConnect 插件已安装`;
    }
    
    showNotification(`Anki 连接失败: ${error.message}`, "error");
    return false;
  }
}

async function loadAnkiDecks() {
  if (!ankiConnected) return;
  
  try {
    const ip = getElementSafe('anki-ip').value;
    const port = getElementSafe('anki-port').value;
    
    const response = await fetch(`http://${ip}:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'deckNames',
        version: 6,
        params: {}
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    const deckSelect = getElementSafe('anki-deck');
    if (!deckSelect) return;
    
    deckSelect.innerHTML = '<option value="">选择牌组</option>';
    deckSelect.disabled = false;
    
    result.result.forEach(deck => {
      const option = document.createElement('option');
      option.value = deck;
      option.textContent = deck;
      deckSelect.appendChild(option);
    });
    
    log(`📚 加载 ${result.result.length} 个牌组`);
    
  } catch (error) {
    log(`❌ 获取牌组失败: ${error.message}`, "error");
  }
}

async function loadAnkiModels() {
  if (!ankiConnected) return;
  
  try {
    const ip = getElementSafe('anki-ip').value;
    const port = getElementSafe('anki-port').value;
    
    const response = await fetch(`http://${ip}:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'modelNames',
        version: 6,
        params: {}
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    const modelSelect = getElementSafe('anki-model');
    if (!modelSelect) return;
    
    modelSelect.innerHTML = '<option value="">选择模板</option>';
    modelSelect.disabled = false;
    
    result.result.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });
    
    log(`📋 加载 ${result.result.length} 个模板`);
    
  } catch (error) {
    log(`❌ 获取模板失败: ${error.message}`, "error");
  }
}

async function loadAnkiFields(modelName) {
  if (!ankiConnected || !modelName) return;
  
  try {
    const ip = getElementSafe('anki-ip').value;
    const port = getElementSafe('anki-port').value;
    
    const response = await fetch(`http://${ip}:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'modelFieldNames',
        version: 6,
        params: { modelName }
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    ankiFields = result.result;
    
    // 更新字段选择器
    const fieldsContainer = getElementSafe('anki-fields');
    if (fieldsContainer) {
      fieldsContainer.style.display = 'block';
      
      const fieldSelects = ['anki-field-screenshot', 'anki-field-text', 'anki-field-game'];
      fieldSelects.forEach(selectId => {
        const select = getElementSafe(selectId);
        if (select) {
          select.innerHTML = '<option value="">不添加</option>';
          
          ankiFields.forEach(field => {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = field;
            select.appendChild(option);
          });
        }
      });
    }
    
    // 启用添加按钮
    const addBtn = getElementSafe('add-to-anki-btn');
    if (addBtn) {
      addBtn.disabled = false;
    }
    
    log(`📝 加载 ${ankiFields.length} 个字段`);
    
  } catch (error) {
    log(`❌ 获取字段失败: ${error.message}`, "error");
  }
}

async function loadRecentAnkiCards() {
  if (!ankiConnected) return;
  
  try {
    const ip = getElementSafe('anki-ip').value;
    const port = getElementSafe('anki-port').value;
    
    // 获取最近 10 张卡片
    const response = await fetch(`http://${ip}:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'findNotes',
        version: 6,
        params: { query: 'added:7' } // 最近 7 天添加的卡片
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    if (result.result.length === 0) {
      ankiCards = [];
      updateAnkiCardsList();
      return;
    }
    
    // 获取卡片详情
    const infoResponse = await fetch(`http://${ip}:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'notesInfo',
        version: 6,
        params: { notes: result.result.slice(0, 10) } // 最多 10 张
      })
    });
    
    const infoResult = await infoResponse.json();
    
    if (infoResult.error) {
      throw new Error(infoResult.error);
    }
    
    ankiCards = infoResult.result;
    updateAnkiCardsList();
    
    log(`📚 加载 ${ankiCards.length} 张最近卡片`);
    
  } catch (error) {
    log(`❌ 获取卡片失败: ${error.message}`, "error");
  }
}

function updateAnkiCardsList() {
  const cardsList = getElementSafe('anki-cards-list');
  const addToAnotherBtn = getElementSafe('add-to-another-card-btn');
  
  if (!cardsList) return;
  
  if (ankiCards.length === 0) {
    cardsList.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">没有找到最近卡片</div>';
    if (addToAnotherBtn) addToAnotherBtn.disabled = true;
    return;
  }
  
  let html = '';
  ankiCards.forEach((card, index) => {
    const fields = card.fields;
    const firstField = Object.values(fields)[0]?.value || '无标题';
    const title = firstField.replace(/<[^>]*>/g, '').substring(0, 50);
    const deck = card.deckName;
    const model = card.modelName;
    
    html += `
      <div class="save-file-item" onclick="selectAnkiCard(${index})" 
           style="${selectedAnkiCard === index ? 'border-color: #0e639c; background: rgba(14, 99, 156, 0.1);' : ''}">
        <div class="save-file-info">
          <div class="save-file-name">${title}</div>
          <div class="save-file-details">${deck} • ${model}</div>
        </div>
        <div class="save-file-actions">
          <button class="icon-btn" onclick="event.stopPropagation(); viewAnkiCard(${card.noteId});" title="查看" style="padding: 3px; font-size: 12px;">
            👁️
          </button>
        </div>
      </div>
    `;
  });
  
  cardsList.innerHTML = html;
  
  if (addToAnotherBtn) {
    addToAnotherBtn.disabled = selectedAnkiCard === null;
  }
}

function selectAnkiCard(index) {
  selectedAnkiCard = index;
  updateAnkiCardsList();
  showNotification(`已选择卡片: ${index + 1}`, "info");
}

async function addToAnkiCard() {
  if (!ankiConnected) {
    showNotification("请先连接 Anki", "error");
    return;
  }
  
  const deck = getElementSafe('anki-deck')?.value;
  const model = getElementSafe('anki-model')?.value;
  
  if (!deck || !model) {
    showNotification("请先选择牌组和模板", "error");
    return;
  }
  
  try {
    const ip = getElementSafe('anki-ip').value;
    const port = getElementSafe('anki-port').value;
    
    // 构建笔记数据
    const fields = {};
    
    const screenshotField = getElementSafe('anki-field-screenshot')?.value;
    const textField = getElementSafe('anki-field-text')?.value;
    const gameField = getElementSafe('anki-field-game')?.value;
    
    if (screenshotField && currentScreenshot) {
      fields[screenshotField] = `<img src="${currentScreenshot}" style="max-width: 100%;" />`;
    }
    
    if (textField && lastText) {
      fields[textField] = lastText;
    }
    
    if (gameField) {
      const zipInput = document.getElementById("zip");
      fields[gameField] = zipInput?.files[0]?.name || "RPG游戏";
    }
    
    // 如果没有字段数据，提示用户
    if (Object.keys(fields).length === 0) {
      showNotification("请至少选择一个字段映射", "warn");
      return;
    }
    
    let noteId;
    
    if (selectedAnkiCard !== null && selectedAnkiCard < ankiCards.length) {
      // 更新现有卡片
      noteId = ankiCards[selectedAnkiCard].noteId;
      await updateAnkiCard(noteId, fields, ip, port);
    } else {
      // 查找最近创建的卡片（Yomitan 创建的）
      const findResponse = await fetch(`http://${ip}:${port}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'findNotes',
          version: 6,
          params: { query: `deck:"${deck}" added:1` }
        })
      });
      
      const findResult = await findResponse.json();
      
      if (findResult.error) {
        throw new Error(findResult.error);
      }
      
      if (findResult.result.length > 0) {
        // 更新最近创建的卡片
        noteId = findResult.result[0];
        await updateAnkiCard(noteId, fields, ip, port);
      } else {
        // 创建新卡片
        noteId = await createNewAnkiCard(deck, model, fields, ip, port);
      }
    }
    
    showNotification("内容已添加到 Anki 卡片", "success");
    log(`✅ 内容已添加到卡片: ${noteId}`);
    
    // 刷新卡片列表
    await loadRecentAnkiCards();
    
  } catch (error) {
    showNotification(`添加到 Anki 失败: ${error.message}`, "error");
    log(`❌ 添加到 Anki 失败: ${error.message}`, "error");
  }
}

async function createNewAnkiCard(deck, model, fields, ip, port) {
  const response = await fetch(`http://${ip}:${port}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'addNote',
      version: 6,
      params: {
        note: {
          deckName: deck,
          modelName: model,
          fields: fields,
          tags: ['RPG游戏', '截图'],
          options: {
            allowDuplicate: false
          }
        }
      }
    })
  });
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error);
  }
  
  return result.result;
}

async function updateAnkiCard(noteId, fields, ip, port) {
  // 先获取现有卡片内容
  const getResponse = await fetch(`http://${ip}:${port}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'notesInfo',
      version: 6,
      params: { notes: [noteId] }
    })
  });
  
  const getResult = await getResponse.json();
  
  if (getResult.error) {
    throw new Error(getResult.error);
  }
  
  const existingFields = getResult.result[0].fields;
  
  // 合并字段
  Object.keys(fields).forEach(fieldName => {
    if (fields[fieldName]) {
      if (existingFields[fieldName] && existingFields[fieldName].value) {
        // 追加到现有内容
        existingFields[fieldName].value += `\n\n<hr>\n${fields[fieldName]}`;
      } else {
        existingFields[fieldName] = { value: fields[fieldName] };
      }
    }
  });
  
  // 更新卡片
  const updateResponse = await fetch(`http://${ip}:${port}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'updateNoteFields',
      version: 6,
      params: {
        note: {
          id: noteId,
          fields: existingFields
        }
      }
    })
  });
  
  const updateResult = await updateResponse.json();
  
  if (updateResult.error) {
    throw new Error(updateResult.error);
  }
}

async function viewAnkiCard(noteId) {
  if (!ankiConnected) return;
  
  try {
    const ip = getElementSafe('anki-ip').value;
    const port = getElementSafe('anki-port').value;
    
    const response = await fetch(`http://${ip}:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'guiBrowse',
        version: 6,
        params: { query: `nid:${noteId}` }
      })
    });
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    showNotification("正在 Anki 中查看卡片", "success");
    
  } catch (error) {
    log(`❌ 查看卡片失败: ${error.message}`, "error");
  }
}

function updateAnkiStatus(status, message) {
  const updateElement = (indicator, text, message) => {
    if (indicator) {
      indicator.className = 'anki-status-indicator';
      if (status === 'connected') {
        indicator.classList.add('connected');
      }
    }
    if (text) {
      text.textContent = message;
    }
  };
  
  updateElement(ankiStatusIndicator, ankiStatusText, message);
  updateElement(ankiSidebarStatus, ankiSidebarText, `Anki: ${message}`);
}

// ============================
// 存档管理功能
// ============================
async function scanSaveFiles() {
  if (!gameLoaded) return;
  
  try {
    log("🔍 扫描存档文件中...", "debug");
    
    // 模拟存档文件扫描
    saveFiles = [
      { 
        name: '存档1.rpgsave', 
        size: '15.2 KB', 
        time: new Date(Date.now() - 3600000).toLocaleString(),
        slot: 1,
        thumbnail: null
      },
      { 
        name: '存档2.rpgsave', 
        size: '18.5 KB', 
        time: new Date(Date.now() - 7200000).toLocaleString(),
        slot: 2,
        thumbnail: null
      },
      { 
        name: '自动存档.rpgsave', 
        size: '16.8 KB', 
        time: new Date(Date.now() - 1800000).toLocaleString(),
        slot: 'auto',
        thumbnail: null
      }
    ];
    
    updateSaveFilesList();
    updateQuickSaveSlots();
    
  } catch (error) {
    log(`⚠️ 扫描存档失败: ${error.message}`, "error");
  }
}

function updateSaveFilesList() {
  const listElement = getElementSafe('save-files-list');
  const container = getElementSafe('save-files-container');
  
  if (!listElement || !container) return;
  
  if (saveFiles.length === 0) {
    listElement.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">未找到存档文件</div>';
    container.style.display = 'none';
    return;
  }
  
  let html = '';
  saveFiles.forEach((file, index) => {
    const timeAgo = getTimeAgo(new Date(file.time));
    html += `
      <div class="save-file-item">
        <div class="save-file-info">
          <div class="save-file-name">${file.name}</div>
          <div class="save-file-details">${file.size} • ${timeAgo}</div>
        </div>
        <div class="save-file-actions">
          <button class="icon-btn" onclick="loadSaveFile(${index})" title="加载存档" style="padding: 3px; font-size: 12px;">
            🔄
          </button>
          <button class="icon-btn" onclick="downloadSaveFileByIndex(${index})" title="下载存档" style="padding: 3px; font-size: 12px;">
            ⬇️
          </button>
        </div>
      </div>
    `;
  });
  
  listElement.innerHTML = html;
  container.style.display = 'block';
}

function getTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return date.toLocaleDateString();
}

function initQuickSaveSlots() {
  const slotsContainer = getElementSafe('quick-save-slots');
  if (!slotsContainer) return;
  
  let html = '';
  for (let i = 0; i < 6; i++) {
    const slot = quickSaveSlots[i];
    const hasSave = slot !== null;
    const slotNumber = i + 1;
    
    html += `
      <button class="secondary" onclick="quickSaveToSlot(${i})" 
              style="aspect-ratio: 1; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;">
        <div style="font-size: 20px;">${hasSave ? '💾' : '📁'}</div>
        <div style="font-size: 10px;">${hasSave ? '已存档' : '空槽位'}</div>
        <div style="font-size: 9px; color: #888;">${slotNumber}</div>
      </button>
    `;
  }
  
  slotsContainer.innerHTML = html;
  
  // 更新快速读档按钮状态
  const quickLoadBtn = getElementSafe('quick-load-btn');
  if (quickLoadBtn) {
    const hasAnySave = quickSaveSlots.some(slot => slot !== null);
    quickLoadBtn.disabled = !hasAnySave;
  }
}

function updateQuickSaveSlots() {
  initQuickSaveSlots();
}

function quickSaveToSlot(slotIndex) {
  if (!gameLoaded) {
    showNotification("游戏未加载", "error");
    return;
  }
  
  try {
    const timestamp = new Date().toLocaleString();
    quickSaveSlots[slotIndex] = {
      timestamp: timestamp,
      screenshot: currentScreenshot,
      text: lastText
    };
    
    updateQuickSaveSlots();
    showNotification(`已快速存档到槽位 ${slotIndex + 1}`, "success");
    log(`💾 快速存档到槽位 ${slotIndex + 1}: ${timestamp}`);
    
  } catch (error) {
    showNotification(`快速存档失败: ${error.message}`, "error");
    log(`❌ 快速存档失败: ${error.message}`, "error");
  }
}

function quickSave() {
  // 找到第一个空槽位，如果没有空槽位则使用第一个槽位
  let slotIndex = quickSaveSlots.findIndex(slot => slot === null);
  if (slotIndex === -1) slotIndex = 0;
  
  quickSaveToSlot(slotIndex);
}

function quickLoadFromSlot(slotIndex) {
  const slot = quickSaveSlots[slotIndex];
  if (!slot) {
    showNotification("该槽位没有存档", "warn");
    return;
  }
  
  // 恢复截图
  if (slot.screenshot) {
    currentScreenshot = slot.screenshot;
    const img = getElementSafe('screenshot-img');
    const tip = getElementSafe('screenshot-tip');
    const actions = getElementSafe('screenshot-actions');
    
    if (img) {
      img.src = currentScreenshot;
      img.style.display = "block";
    }
    
    if (tip) {
      tip.textContent = "已从存档恢复";
    }
    
    if (actions) {
      actions.style.display = "block";
    }
    
    const downloadBtn = getElementSafe('download-btn');
    if (downloadBtn) {
      downloadBtn.disabled = false;
    }
  }
  
  // 恢复文本
  if (slot.text) {
    const textarea = getElementSafe('game-text');
    if (textarea) {
      textarea.value = slot.text;
      lastText = slot.text;
    }
  }
  
  showNotification(`已从槽位 ${slotIndex + 1} 恢复存档`, "success");
  log(`🔄 从槽位 ${slotIndex + 1} 恢复存档: ${slot.timestamp}`);
}

function quickLoad() {
  // 找到最后一个有存档的槽位
  for (let i = quickSaveSlots.length - 1; i >= 0; i--) {
    if (quickSaveSlots[i] !== null) {
      quickLoadFromSlot(i);
      return;
    }
  }
  
  showNotification("没有可用的快速存档", "warn");
}

function loadSaveFile(index) {
  if (index >= 0 && index < saveFiles.length) {
    const file = saveFiles[index];
    showNotification(`加载存档: ${file.name}`, "info");
    log(`🔍 加载存档: ${file.name}`);
    
    // 实际加载存档的逻辑需要游戏支持
    // 这里只是示例
    if (gameLoaded) {
      // 尝试调用游戏的存档加载功能
      try {
        const gameWin = gameIframe.contentWindow;
        if (gameWin && gameWin.DataManager && gameWin.DataManager.loadGame) {
          // 这是 RPG Maker 的存档加载方法
          // 实际实现需要根据游戏具体调整
          showNotification("正在加载存档...", "info");
          setTimeout(() => {
            showNotification("存档加载功能需要游戏支持", "warn");
          }, 1000);
        }
      } catch (e) {
        // 跨域限制
        showNotification("无法直接访问游戏存档系统", "warn");
      }
    }
  }
}

function downloadSaveFileByIndex(index) {
  if (index >= 0 && index < saveFiles.length) {
    const file = saveFiles[index];
    downloadSaveFile(file);
  }
}

function downloadSaveFile(file) {
  // 创建一个虚拟的存档文件
  const content = `RPG Maker Save File\nName: ${file.name}\nSize: ${file.size}\nTime: ${file.time}\n\nThis is a simulated save file.`;
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.download = file.name;
  link.href = url;
  link.click();
  
  URL.revokeObjectURL(url);
  showNotification(`下载存档: ${file.name}`, "success");
  log(`⬇️ 下载存档: ${file.name}`);
}

function openSaveManager() {
  const panel = getElementSafe('save-manager-panel');
  const content = getElementSafe('save-manager-content');
  
  if (panel && content) {
    // 更新内容
    content.innerHTML = `
      <div style="margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0;">存档文件管理</h4>
        <p style="color: #888; font-size: 12px; margin: 0;">
          管理游戏存档文件，支持导入和导出
        </p>
      </div>
      
      <div id="save-manager-files" style="max-height: 300px; overflow-y: auto; margin-bottom: 15px;">
        ${saveFiles.length > 0 ? '' : '<div style="color: #888; text-align: center; padding: 40px;">没有存档文件</div>'}
      </div>
      
      <div class="controls-row">
        <button class="secondary" onclick="importSaveFile()" style="flex: 1;">
          <span>📥</span>
          <span>导入存档</span>
        </button>
        <button class="secondary" onclick="exportAllSaves()" style="flex: 1;">
          <span>📤</span>
          <span>导出全部</span>
        </button>
      </div>
      
      <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px;">
        <div style="font-size: 11px; color: #888; margin-bottom: 5px;">提示:</div>
        <div style="font-size: 10px; color: #666; line-height: 1.4;">
          • 存档文件通常位于游戏的 save 文件夹中<br>
          • RPG Maker 存档文件扩展名为 .rpgsave<br>
          • 确保存档文件与游戏版本兼容
        </div>
      </div>
    `;
    
    // 显示文件列表
    const filesContainer = getElementSafe('save-manager-files');
    if (filesContainer && saveFiles.length > 0) {
      let filesHtml = '';
      saveFiles.forEach((file, index) => {
        filesHtml += `
          <div class="save-file-item">
            <div class="save-file-info">
              <div class="save-file-name">${file.name}</div>
              <div class="save-file-details">${file.size} • ${file.time}</div>
            </div>
            <div class="save-file-actions">
              <button class="icon-btn" onclick="downloadSaveFileByIndex(${index})" title="下载" style="padding: 3px; font-size: 12px;">
                ⬇️
              </button>
              <button class="icon-btn" onclick="deleteSaveFile(${index})" title="删除" style="padding: 3px; font-size: 12px; color: #f44336;">
                🗑️
              </button>
            </div>
          </div>
        `;
      });
      filesContainer.innerHTML = filesHtml;
    }
    
    panel.style.display = 'block';
    panel.classList.add('active');
  }
}

function importSaveFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.rpgsave,.sav,.save,.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const newSave = {
            name: file.name,
            size: (file.size / 1024).toFixed(1) + ' KB',
            time: new Date().toLocaleString(),
            slot: saveFiles.length + 1,
            data: event.target.result
          };
          
          saveFiles.push(newSave);
          updateSaveFilesList();
          showNotification(`已导入存档: ${file.name}`, "success");
          log(`📥 导入存档: ${file.name}`);
        } catch (error) {
          showNotification(`导入失败: ${error.message}`, "error");
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}

function exportAllSaves() {
  if (saveFiles.length === 0) {
    showNotification("没有存档可导出", "warn");
    return;
  }
  
  const exportData = {
    saves: saveFiles,
    exportTime: new Date().toISOString(),
    playerVersion: '1.0.0'
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.download = `rpg-saves-${new Date().toISOString().slice(0, 10)}.json`;
  link.href = url;
  link.click();
  
  URL.revokeObjectURL(url);
  showNotification(`已导出 ${saveFiles.length} 个存档`, "success");
  log(`📤 导出 ${saveFiles.length} 个存档`);
}

function deleteSaveFile(index) {
  if (confirm(`确定要删除存档 "${saveFiles[index].name}" 吗？`)) {
    const deleted = saveFiles.splice(index, 1);
    updateSaveFilesList();
    showNotification(`已删除存档: ${deleted[0].name}`, "info");
    log(`🗑️ 删除存档: ${deleted[0].name}`);
  }
}

// ============================
// 布局和全屏功能
// ============================
function toggleFullscreen() {
  const elem = document.documentElement;
  const icon = getElementSafe('fullscreen-icon');
  
  if (!fullscreenMode) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
    
    document.body.classList.add('fullscreen');
    fullscreenMode = true;
    
    // 显示浮动按钮
    getElementSafe('left-sidebar-toggle').style.display = 'flex';
    getElementSafe('right-sidebar-toggle').style.display = 'flex';
    getElementSafe('toggle-dialog-btn').style.display = 'flex';
    
    if (icon) icon.textContent = '⛶';
    showNotification("进入全屏模式", "info");
    log("⛶ 进入全屏模式");
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
    
    document.body.classList.remove('fullscreen');
    fullscreenMode = false;
    
    // 隐藏浮动按钮
    getElementSafe('left-sidebar-toggle').style.display = 'none';
    getElementSafe('right-sidebar-toggle').style.display = 'none';
    getElementSafe('toggle-dialog-btn').style.display = 'none';
    
    if (icon) icon.textContent = '⛶';
    showNotification("退出全屏模式", "info");
    log("📱 退出全屏模式");
  }
}

function toggleLeftSidebar() {
  if (leftSidebar) {
    leftSidebar.classList.toggle('active');
    updateGameAreaClass();
    
    const btn = getElementSafe('left-sidebar-toggle');
    if (btn) {
      if (leftSidebar.classList.contains('active')) {
        btn.innerHTML = '<span style="font-size: 20px;">▶</span>';
      } else {
        btn.innerHTML = '<span style="font-size: 20px;">◀</span>';
      }
    }
  }
}

function toggleRightSidebar() {
  if (rightSidebar) {
    rightSidebar.classList.toggle('active');
    updateGameAreaClass();
    
    const btn = getElementSafe('right-sidebar-toggle');
    if (btn) {
      if (rightSidebar.classList.contains('active')) {
        btn.innerHTML = '<span style="font-size: 20px;">◀</span>';
      } else {
        btn.innerHTML = '<span style="font-size: 20px;">▶</span>';
      }
    }
  }
}

function toggleDialogPanel() {
  if (sidebarPosition === 'left' || sidebarPosition === 'both') {
    toggleLeftSidebar();
  } else {
    toggleRightSidebar();
  }
}

function updateGameAreaClass() {
  if (!gameArea) return;
  
  const leftActive = leftSidebar?.classList.contains('active') || false;
  const rightActive = rightSidebar?.classList.contains('active') || false;
  
  // 移除所有相关类
  gameArea.classList.remove('with-left-sidebar', 'with-right-sidebar', 'with-both-sidebars');
  
  if (leftActive && rightActive) {
    gameArea.classList.add('with-both-sidebars');
  } else if (leftActive) {
    gameArea.classList.add('with-left-sidebar');
  } else if (rightActive) {
    gameArea.classList.add('with-right-sidebar');
  }
  
  // 更新缩放类
  gameArea.classList.remove('fit-width', 'fit-height', 'fit-both', 'original');
  gameArea.classList.add(gameScaleMode);
}

function adjustGameScale() {
  const scaleSelect = getElementSafe('game-scale');
  if (scaleSelect) {
    gameScaleMode = scaleSelect.value;
    updateGameAreaClass();
    
    if (gameIframe) {
      switch(gameScaleMode) {
        case 'fit-width':
          gameIframe.style.width = '100%';
          gameIframe.style.height = 'auto';
          break;
        case 'fit-height':
          gameIframe.style.width = 'auto';
          gameIframe.style.height = '100%';
          break;
        case 'fit-both':
          gameIframe.style.width = '100%';
          gameIframe.style.height = '100%';
          break;
        case 'original':
          gameIframe.style.width = 'auto';
          gameIframe.style.height = 'auto';
          break;
      }
    }
  }
}

function updateSidebarPosition() {
  const positionSelect = getElementSafe('sidebar-position');
  if (positionSelect) {
    sidebarPosition = positionSelect.value;
    
    // 显示/隐藏侧边栏
    if (leftSidebar) {
      leftSidebar.classList.toggle('active', sidebarPosition === 'left' || sidebarPosition === 'both');
    }
    if (rightSidebar) {
      rightSidebar.classList.toggle('active', sidebarPosition === 'right' || sidebarPosition === 'both');
    }
    
    updateGameAreaClass();
    
    // 保存设置
    saveSettings();
  }
}

// ============================
// 游戏控制功能
// ============================
function resetGame() {
  if (!gameLoaded) return;
  
  if (confirm("确定要重置游戏吗？当前进度可能会丢失。")) {
    if (gameIframe) {
      gameIframe.src = gameIframe.src;
      showNotification("游戏已重置", "info");
      log("🔄 游戏已重置");
    }
  }
}

function reloadGame() {
  if (gameIframe) {
    gameIframe.src = gameIframe.src;
    showNotification("游戏已重新加载", "info");
    log("📄 游戏已重新加载");
  }
}

function muteGame() {
  if (!gameLoaded) return;
  
  try {
    const gameWin = gameIframe.contentWindow;
    if (gameWin && gameWin.AudioManager) {
      // RPG Maker 音频控制
      if (gameWin.AudioManager.isCurrentBgmMuted) {
        gameWin.AudioManager.unmuteBgm();
        gameWin.AudioManager.unmuteBgs();
        gameWin.AudioManager.unmuteMe();
        gameWin.AudioManager.unmuteSe();
        showNotification("取消静音", "info");
        log("🔊 取消静音");
      } else {
        gameWin.AudioManager.muteBgm();
        gameWin.AudioManager.muteBgs();
        gameWin.AudioManager.muteMe();
        gameWin.AudioManager.muteSe();
        showNotification("已静音", "info");
        log("🔇 已静音");
      }
    } else {
      // 通用方法
      const audioElements = gameWin.document.querySelectorAll('audio, video');
      audioElements.forEach(audio => {
        audio.muted = !audio.muted;
      });
      showNotification(audioElements[0]?.muted ? "已静音" : "取消静音", "info");
    }
  } catch (e) {
    showNotification("无法控制音频", "error");
    log(`❌ 音频控制失败: ${e.message}`, "error");
  }
}

function speedUpGame() {
  if (!gameLoaded) return;
  
  try {
    const gameWin = gameIframe.contentWindow;
    if (gameWin && gameWin.Graphics) {
      // RPG Maker 帧率控制
      const currentSpeed = gameWin.Graphics._tickHandler._speed || 1;
      const newSpeed = Math.min(currentSpeed * 1.5, 4);
      gameWin.Graphics._tickHandler._speed = newSpeed;
      showNotification(`游戏加速: ${newSpeed.toFixed(1)}x`, "info");
      log(`⏩ 游戏加速: ${newSpeed.toFixed(1)}x`);
    }
  } catch (e) {
    showNotification("无法调整游戏速度", "error");
  }
}

function slowDownGame() {
  if (!gameLoaded) return;
  
  try {
    const gameWin = gameIframe.contentWindow;
    if (gameWin && gameWin.Graphics) {
      const currentSpeed = gameWin.Graphics._tickHandler._speed || 1;
      const newSpeed = Math.max(currentSpeed / 1.5, 0.25);
      gameWin.Graphics._tickHandler._speed = newSpeed;
      showNotification(`游戏减速: ${newSpeed.toFixed(1)}x`, "info");
      log(`⏪ 游戏减速: ${newSpeed.toFixed(1)}x`);
    }
  } catch (e) {
    showNotification("无法调整游戏速度", "error");
  }
}

// ============================
// 游戏监控
// ============================
function startGameMonitor() {
  if (!gameLoaded) return;
  
  setInterval(() => {
    updateGameInfo();
  }, 1000);
}

function updateGameInfo() {
  if (!gameLoaded) return;
  
  try {
    const gameWin = gameIframe.contentWindow;
    if (!gameWin) return;
    
    const stateElement = getElementSafe('game-state');
    const fpsElement = getElementSafe('game-fps');
    const memoryElement = getElementSafe('game-memory');
    const timeElement = getElementSafe('game-time');
    
    if (stateElement) {
      stateElement.textContent = gameLoaded ? '运行中' : '已停止';
    }
    
    if (timeElement) {
      const now = new Date();
      timeElement.textContent = now.toLocaleTimeString();
    }
    
    // 尝试获取游戏信息
    if (gameWin.$gameSystem) {
      if (gameWin.$gameSystem._saveEnabled !== undefined) {
        const saveEnabled = gameWin.$gameSystem._saveEnabled ? '可保存' : '不可保存';
        if (stateElement) {
          stateElement.textContent = `运行中 (${saveEnabled})`;
        }
      }
    }
    
  } catch (e) {
    // 跨域限制，忽略错误
  }
}

// ============================
// 设置管理
// ============================
function saveSettings() {
  const settings = {
    sidebarPosition: getElementSafe('sidebar-position')?.value || 'right',
    gameScale: getElementSafe('game-scale')?.value || 'fit-both',
    ankiIp: getElementSafe('anki-ip')?.value || '127.0.0.1',
    ankiPort: getElementSafe('anki-port')?.value || '8765',
    screenshotQuality: getElementSafe('screenshot-quality')?.value || '1.0',
    autoExtract: getElementSafe('auto-extract')?.checked !== false,
    logLevel: getElementSafe('log-level')?.value || 'normal',
    showDialogSidebar: getElementSafe('show-dialog-sidebar')?.checked !== false
  };
  
  localStorage.setItem('rpgmz-player-settings', JSON.stringify(settings));
}

function loadSettings() {
  try {
    const saved = localStorage.getItem('rpgmz-player-settings');
    if (saved) {
      const settings = JSON.parse(saved);
      
      // 应用设置
      if (settings.sidebarPosition && getElementSafe('sidebar-position')) {
        getElementSafe('sidebar-position').value = settings.sidebarPosition;
        sidebarPosition = settings.sidebarPosition;
      }
      
      if (settings.gameScale && getElementSafe('game-scale')) {
        getElementSafe('game-scale').value = settings.gameScale;
        gameScaleMode = settings.gameScale;
      }
      
      if (settings.ankiIp && getElementSafe('anki-ip')) {
        getElementSafe('anki-ip').value = settings.ankiIp;
      }
      
      if (settings.ankiPort && getElementSafe('anki-port')) {
        getElementSafe('anki-port').value = settings.ankiPort;
      }
      
      if (settings.screenshotQuality && getElementSafe('screenshot-quality')) {
        getElementSafe('screenshot-quality').value = settings.screenshotQuality;
        screenshotQuality = parseFloat(settings.screenshotQuality);
      }
      
      if (getElementSafe('auto-extract')) {
        getElementSafe('auto-extract').checked = settings.autoExtract !== false;
        autoExtractEnabled = settings.autoExtract !== false;
      }
      
      if (settings.logLevel && getElementSafe('log-level')) {
        getElementSafe('log-level').value = settings.logLevel;
        logLevel = settings.logLevel;
      }
      
      if (getElementSafe('show-dialog-sidebar')) {
        getElementSafe('show-dialog-sidebar').checked = settings.showDialogSidebar !== false;
      }
      
      // 应用布局设置
      updateSidebarPosition();
      adjustGameScale();
      
      log("⚙️ 设置已加载");
    }
  } catch (error) {
    log(`❌ 加载设置失败: ${error.message}`, "error");
  }
}

// ============================
// 实用工具函数
// ============================
function clearLog() {
  const logElement = getElementSafe('log');
  if (logElement) {
    logElement.textContent = '';
    showNotification("日志已清空", "info");
  }
}

function loadSampleGame() {
  showNotification("示例游戏功能开发中", "info");
  log("🎲 加载示例游戏功能开发中");
}

// ============================
// 事件监听器设置
// ============================
function setupEventListeners() {
  // 设置按钮
  document.getElementById('settings-btn').addEventListener('click', () => {
    settingsPanel.classList.toggle('active');
    if (settingsPanel.classList.contains('active')) {
      saveManagerPanel.classList.remove('active');
    }
  });
  
  // 关闭设置
  document.getElementById('close-settings').addEventListener('click', () => {
    settingsPanel.classList.remove('active');
  });
  
  // 存档管理按钮
  document.getElementById('save-manager-btn').addEventListener('click', () => {
    saveManagerPanel.classList.toggle('active');
    if (saveManagerPanel.classList.contains('active')) {
      settingsPanel.classList.remove('active');
      openSaveManager();
    }
  });
  
  // 关闭存档管理
  document.getElementById('close-save-manager').addEventListener('click', () => {
    saveManagerPanel.classList.remove('active');
  });
  
  // 全屏按钮
  document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
  
  // 侧边栏浮动按钮
  document.getElementById('left-sidebar-toggle').addEventListener('click', toggleLeftSidebar);
  document.getElementById('right-sidebar-toggle').addEventListener('click', toggleRightSidebar);
  document.getElementById('toggle-dialog-btn').addEventListener('click', toggleDialogPanel);
  
  // 关闭侧边栏按钮
  document.getElementById('close-left-sidebar').addEventListener('click', toggleLeftSidebar);
  document.getElementById('close-right-sidebar').addEventListener('click', toggleRightSidebar);
  
  // Anki 测试连接按钮
  document.getElementById('test-anki-btn').addEventListener('click', testAnkiConnection);
  
  // Anki 设置按钮
  document.getElementById('anki-settings-btn').addEventListener('click', () => {
    settingsPanel.classList.add('active');
    saveManagerPanel.classList.remove('active');
  });
  
  // Anki 牌组选择
  document.getElementById('anki-deck').addEventListener('change', (e) => {
    if (e.target.value) {
      loadAnkiModels();
    }
  });
  
  // Anki 模板选择
  document.getElementById('anki-model').addEventListener('change', (e) => {
    if (e.target.value) {
      loadAnkiFields(e.target.value);
    }
  });
  
  // Anki 添加按钮
  document.getElementById('add-to-anki-btn').addEventListener('click', addToAnkiCard);
  
  // Anki 刷新按钮
  document.getElementById('anki-refresh-btn').addEventListener('click', () => {
    if (ankiConnected) {
      loadAnkiDecks();
      loadRecentAnkiCards();
    } else {
      testAnkiConnection();
    }
  });
  
  // Anki 添加到另一个卡片按钮
  document.getElementById('add-to-another-card-btn').addEventListener('click', addToAnkiCard);
  
  // 侧边栏位置选择
  document.getElementById('sidebar-position').addEventListener('change', updateSidebarPosition);
  
  // 游戏缩放选择
  document.getElementById('game-scale').addEventListener('change', adjustGameScale);
  
  // 显示对话侧边栏
  document.getElementById('show-dialog-sidebar').addEventListener('change', (e) => {
    if (e.target.checked) {
      if (sidebarPosition === 'left' || sidebarPosition === 'both') {
        leftSidebar.classList.add('active');
      } else {
        rightSidebar.classList.add('active');
      }
    } else {
      leftSidebar.classList.remove('active');
      rightSidebar.classList.remove('active');
    }
    updateGameAreaClass();
    saveSettings();
  });
  
  // 自动提取
  document.getElementById('auto-extract').addEventListener('change', (e) => {
    autoExtractEnabled = e.target.checked;
    saveSettings();
  });
  
  // 截图质量
  document.getElementById('screenshot-quality').addEventListener('change', (e) => {
    screenshotQuality = parseFloat(e.target.value);
    saveSettings();
  });
  
  // 日志级别
  document.getElementById('log-level').addEventListener('change', (e) => {
    logLevel = e.target.value;
    saveSettings();
  });
  
  // 存档管理按钮
  document.getElementById('load-save-btn').addEventListener('click', () => {
    importSaveFile();
  });
  
  document.getElementById('download-save-btn').addEventListener('click', () => {
    if (saveFiles.length > 0) {
      exportAllSaves();
    } else {
      showNotification("没有存档可下载", "warn");
    }
  });
  
  // 点击设置面板外部关闭
  document.addEventListener('click', (event) => {
    if (!settingsPanel.contains(event.target) && 
        !document.getElementById('settings-btn').contains(event.target)) {
      settingsPanel.classList.remove('active');
    }
    
    if (!saveManagerPanel.contains(event.target) && 
        !document.getElementById('save-manager-btn').contains(event.target)) {
      saveManagerPanel.classList.remove('active');
    }
  });
  
  // 全屏变化监听
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('msfullscreenchange', handleFullscreenChange);
}

function handleFullscreenChange() {
  const isFullscreen = !!(document.fullscreenElement || 
                         document.webkitFullscreenElement || 
                         document.msFullscreenElement);
  
  fullscreenMode = isFullscreen;
  document.body.classList.toggle('fullscreen', isFullscreen);
  
  const leftBtn = getElementSafe('left-sidebar-toggle');
  const rightBtn = getElementSafe('right-sidebar-toggle');
  const dialogBtn = getElementSafe('toggle-dialog-btn');
  
  if (isFullscreen) {
    if (leftBtn) leftBtn.style.display = 'flex';
    if (rightBtn) rightBtn.style.display = 'flex';
    if (dialogBtn) dialogBtn.style.display = 'flex';
  } else {
    if (leftBtn) leftBtn.style.display = 'none';
    if (rightBtn) rightBtn.style.display = 'none';
    if (dialogBtn) dialogBtn.style.display = 'none';
  }
}

// ============================
// 键盘快捷键
// ============================
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // 忽略输入框中的按键
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Ctrl+Shift+S: 截图
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      takeScreenshot();
    }
    
    // Ctrl+E: 提取文本
    if (e.ctrlKey && e.key === 'E') {
      e.preventDefault();
      extractText();
    }
    
    // F11: 全屏
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFullscreen();
    }
    
    // Esc: 关闭面板
    if (e.key === 'Escape') {
      settingsPanel.classList.remove('active');
      saveManagerPanel.classList.remove('active');
    }
    
    // `: 切换侧边栏
    if (e.key === '`' || e.key === '~') {
      e.preventDefault();
      toggleDialogPanel();
    }
  });
}

// ============================
// 初始化
// ============================
function init() {
  try {
    // 初始化 DOM 元素引用
    initDOMElements();
    
    log("🚀 RPGMZ Player Pro 已启动");
    
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    log(`🌐 环境: ${isLocalhost ? '本地' : '在线'}`);
    log(`📁 基础路径: ${BASE_PATH}`);
    
    // 加载设置
    loadSettings();
    
    // 设置事件处理器
    setupSWMessageHandler();
    setupZipHandler();
    setupEventListeners();
    setupKeyboardShortcuts();
    
    // 初始化侧边栏和布局
    updateSidebarPosition();
    adjustGameScale();
    initQuickSaveSlots();
    
    // 自动注册 Service Worker（如果可能）
    if (window.location.protocol === 'https:' || isLocalhost) {
      setTimeout(() => {
        registerSW().then(registered => {
          if (!registered) {
            log("ℹ️ Service Worker 需要 HTTPS 或 localhost 环境", "warn");
          }
        });
      }, 1000);
    }
    
    // 初始状态
    updateSWStatus('default');
    updateGameStatus('default');
    updateAnkiStatus('disconnected', '未连接');
    
    // 初始游戏信息
    updateGameInfo();
    
    // 保存设置变化
    const saveElements = [
      'sidebar-position', 'game-scale', 'anki-ip', 'anki-port', 
      'screenshot-quality', 'auto-extract', 'log-level', 'show-dialog-sidebar'
    ];
    
    saveElements.forEach(id => {
      const element = getElementSafe(id);
      if (element) {
        element.addEventListener('change', saveSettings);
      }
    });
    
  } catch (error) {
    console.error('初始化失败:', error);
    log(`❌ 初始化失败: ${error.message}`, "error");
    showNotification(`初始化失败: ${error.message}`, "error");
  }
}

// 在 DOM 完全加载后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// 导出功能给全局使用
window.extractText = extractText;
window.clearText = clearText;
window.takeScreenshot = takeScreenshot;
window.downloadScreenshot = downloadScreenshot;
window.copyText = copyText;
window.saveText = saveText;
window.copyScreenshot = copyScreenshot;
window.shareScreenshot = shareScreenshot;
window.quickSave = quickSave;
window.quickLoad = quickLoad;
window.loadSaveFile = loadSaveFile;
window.downloadSaveFileByIndex = downloadSaveFileByIndex;
window.quickSaveToSlot = quickSaveToSlot;
window.quickLoadFromSlot = quickLoadFromSlot;
window.openSaveManager = openSaveManager;
window.importSaveFile = importSaveFile;
window.exportAllSaves = exportAllSaves;
window.deleteSaveFile = deleteSaveFile;
window.toggleFullscreen = toggleFullscreen;
window.toggleLeftSidebar = toggleLeftSidebar;
window.toggleRightSidebar = toggleRightSidebar;
window.resetGame = resetGame;
window.reloadGame = reloadGame;
window.muteGame = muteGame;
window.speedUpGame = speedUpGame;
window.slowDownGame = slowDownGame;
window.clearLog = clearLog;
window.loadSampleGame = loadSampleGame;
window.selectAnkiCard = selectAnkiCard;
window.viewAnkiCard = viewAnkiCard;
window.testAnkiConnection = testAnkiConnection;
window.addToAnkiCard = addToAnkiCard;