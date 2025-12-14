let GAME_FILES = {};
const CACHE_NAME = 'rpgmz-player-v3';
const APP_VERSION = '1.0.0';

// 动态获取作用域路径
const getScopePath = () => {
  // 对于 GitHub Pages，需要处理项目子路径
  const url = new URL(self.location.href);
  
  if (url.hostname.includes('github.io')) {
    // 从完整路径中提取项目路径
    const pathSegments = url.pathname.split('/');
    
    // 移除最后的文件名（如果有的话）
    let projectPath = '';
    for (let i = 1; i < pathSegments.length - 1; i++) {
      if (pathSegments[i]) {
        projectPath += '/' + pathSegments[i];
      }
    }
    
    return projectPath || '/';
  }
  
  // 本地开发环境
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return '/';
  }
  
  // 默认返回根路径
  return '/';
};

const SCOPE_PATH = getScopePath();
const IS_GITHUB_PAGES = self.location.hostname.includes('github.io');

self.addEventListener("install", e => {
  console.log(`[SW ${APP_VERSION}] 安装中，作用域: ${SCOPE_PATH || '/'}`);
  console.log(`[SW] 当前路径: ${self.location.href}`);
  console.log(`[SW] GitHub Pages: ${IS_GITHUB_PAGES}`);
  
  // 跳过等待，立即激活
  self.skipWaiting();
  
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 预缓存关键文件
      const filesToCache = [];
      return cache.addAll(filesToCache);
    })
  );
});

self.addEventListener("activate", e => {
  console.log(`[SW ${APP_VERSION}] 激活中，作用域: ${SCOPE_PATH || '/'}`);
  
  e.waitUntil(
    Promise.all([
      // 立即接管所有客户端
      self.clients.claim(),
      
      // 清理旧版本缓存
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_NAME)
            .map(cacheName => {
              console.log(`[SW] 删除旧缓存: ${cacheName}`);
              return caches.delete(cacheName);
            })
        );
      })
    ]).then(() => {
      console.log(`[SW ${APP_VERSION}] 激活完成`);
      
      // 通知所有客户端 SW 已激活
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "SW_ACTIVATED", version: APP_VERSION });
        });
      });
    })
  );
});

self.addEventListener("message", e => {
  console.log(`[SW] 收到消息: ${e.data?.type}`);
  
  if (e.data?.type === "LOAD_GAME") {
    GAME_FILES = e.data.files || {};
    const count = Object.keys(GAME_FILES).length;
    console.log(`[SW] 游戏文件已加载: ${count} 个文件`);
    
    if (e.data.metadata) {
      console.log(`[SW] 文件信息: ${JSON.stringify(e.data.metadata)}`);
    }
    
    // 通知所有客户端准备就绪
    e.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "GAME_READY" });
        });
      })
    );
  }
  
  // 健康检查
  if (e.data?.type === "PING") {
    console.log(`[SW] 收到 PING，发送 PONG`);
    e.source.postMessage({ 
      type: "PONG", 
      version: APP_VERSION, 
      scope: SCOPE_PATH,
      location: self.location.href 
    });
  }
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  const requestPath = url.pathname;
  
  // 调试信息
  console.log(`[SW Fetch] ${e.request.method} ${requestPath}`);
  
  // 1. 处理 sw.js 自身请求 - 永远从网络获取最新版本
  if (requestPath.endsWith('sw.js')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return caches.match(e.request);
      })
    );
    return;
  }
  
  // 2. 对于 GitHub Pages，处理 404.html 请求
  if (IS_GITHUB_PAGES && requestPath.endsWith('/404.html')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        // 如果 404.html 不存在，返回一个简单的 404 页面
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>404 - RPGMZ Player</title>
          </head>
          <body>
            <h1>404 - Page Not Found</h1>
            <p>Redirecting to main page...</p>
            <script>
              setTimeout(() => location.replace('/'), 1000);
            </script>
          </body>
          </html>
        `;
        return new Response(html, {
          status: 404,
          headers: { 'Content-Type': 'text/html' }
        });
      })
    );
    return;
  }
  
  // 3. 处理游戏文件请求
  // 构建游戏路径前缀
  let gamePathPrefix;
  if (SCOPE_PATH === '/') {
    gamePathPrefix = '/game/';
  } else {
    gamePathPrefix = `${SCOPE_PATH}/game/`.replace(/\/\//g, '/');
  }
  
  // 检查是否是游戏文件请求
  const isGameRequest = requestPath.startsWith(gamePathPrefix) || 
                       (SCOPE_PATH === '/' && requestPath.startsWith('/game/'));
  
  // 对于根路径的请求，检查是否是主页面
  if (requestPath === SCOPE_PATH || requestPath === SCOPE_PATH + '/' || 
      (SCOPE_PATH === '/' && (requestPath === '/' || requestPath === '/index.html'))) {
    // 这是主页面请求，让浏览器处理
    return;
  }
  
  if (!isGameRequest) {
    // 对于非游戏请求，尝试从缓存获取，否则使用网络
    e.respondWith(
      caches.match(e.request).then(cachedResponse => {
        return cachedResponse || fetch(e.request);
      })
    );
    return;
  }
  
  // 4. 处理游戏文件
  // 提取请求的文件路径
  let requestedPath = requestPath;
  
  // 移除作用域路径前缀
  if (SCOPE_PATH !== '/' && requestedPath.startsWith(SCOPE_PATH)) {
    requestedPath = requestedPath.substring(SCOPE_PATH.length);
  }
  
  // 移除 /game/ 前缀
  requestedPath = requestedPath.replace(/^\/game\//, '');
  
  // 如果是空路径或目录，默认为 index.html
  if (requestedPath === '' || requestedPath.endsWith('/')) {
    requestedPath = 'index.html';
  }
  
  // 解码 URL (处理空格和特殊字符)
  try { 
    requestedPath = decodeURIComponent(requestedPath); 
  } catch (e) {
    console.warn(`[SW] URL 解码失败: ${requestedPath}`, e);
  }

  console.log(`[SW] 查找文件: ${requestedPath}`);
  console.log(`[SW] 可用文件: ${Object.keys(GAME_FILES).slice(0, 5)}...`);

  // ==========================================
  // ⭐ 特殊处理：index.html (注入截图修复代码)
  // ==========================================
  if (requestedPath === "index.html" || requestedPath === "") {
    let htmlContent = GAME_FILES["index.html"];
    
    // 如果没有找到 index.html，尝试 www/index.html
    if (!htmlContent && GAME_FILES["www/index.html"]) {
      htmlContent = GAME_FILES["www/index.html"];
      requestedPath = "www/index.html";
    }
    
    if (htmlContent) {
      try {
        const decoder = new TextDecoder("utf-8");
        let htmlStr = decoder.decode(htmlContent);

        // 💉 注入黑科技脚本：强制开启 WebGL 缓冲区保留，解决截图黑屏问题
        const scriptToInject = `
          <script>
            console.log("💉 [SW Inject] 正在应用截图修复补丁...");
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, attributes) {
              if (type === 'webgl' || type === 'webgl2') {
                attributes = attributes || {};
                attributes.preserveDrawingBuffer = true; // ✨ 关键：允许截图
                attributes.antialias = true; // 开启抗锯齿
                console.log("✨ WebGL Context Created with preserveDrawingBuffer: true");
              }
              return originalGetContext.call(this, type, attributes);
            };
            
            // 修复相对路径问题 - 确保游戏资源正确加载
            (function() {
              const baseTag = document.querySelector('base');
              if (!baseTag) {
                const base = document.createElement('base');
                base.href = './';
                document.head.insertBefore(base, document.head.firstChild);
              }
            })();
          </script>
        `;

        // 注入到 head 开始处
        if (htmlStr.includes('<head>')) {
          htmlStr = htmlStr.replace('<head>', '<head>' + scriptToInject);
        } else if (htmlStr.includes('<head ')) {
          // 处理 <head lang="en"> 这种情况
          htmlStr = htmlStr.replace(/<head\s[^>]*>/, '$&' + scriptToInject);
        } else if (htmlStr.includes('<html>')) {
          // 如果没有 head 标签，在 html 标签后添加
          htmlStr = htmlStr.replace('<html>', '<html><head>' + scriptToInject + '</head>');
        } else {
          // 如果也没有 html 标签，直接添加到开头
          htmlStr = scriptToInject + htmlStr;
        }
        
        const encoder = new TextEncoder();
        const newBody = encoder.encode(htmlStr);

        e.respondWith(new Response(newBody, { 
          headers: { 
            "Content-Type": "text/html; charset=utf-8",
            "X-SW-Injected": "true"
          } 
        }));
        return;
      } catch (error) {
        console.error('[SW] 注入脚本失败:', error);
        // 如果注入失败，返回原始内容
      }
    }
  }

  // ==========================================
  // ⭐ 文件查找逻辑 (增强版)
  // ==========================================
  
  // A. 精确查找
  let body = GAME_FILES[requestedPath];
  let foundPath = requestedPath;
  let successType = '精确匹配';

  // B. 下划线容错 (处理加密素材)
  if (!body && requestedPath.endsWith("_")) {
    foundPath = requestedPath.slice(0, -1);
    body = GAME_FILES[foundPath];
    if (body) successType = '下划线容错';
  }

  // C. 路径规范化 (处理 Windows 路径)
  if (!body && requestedPath.includes('\\')) {
    foundPath = requestedPath.replace(/\\/g, '/');
    body = GAME_FILES[foundPath];
    if (body) successType = '路径规范化';
  }

  // D. ⭐ 增强型忽略大小写查找 (解决音频 404 问题)
  if (!body) {
    const lowerReq = requestedPath.toLowerCase();
    
    // 寻找 ZIP 包中，路径小写化后与请求匹配的第一个文件
    const matchedKey = Object.keys(GAME_FILES).find(key => {
      const lowerKey = key.toLowerCase();
      return lowerKey === lowerReq || 
             lowerKey === lowerReq.replace(/\//g, '\\') ||
             lowerKey.replace(/\//g, '\\') === lowerReq;
    });
    
    if (matchedKey) {
      // 成功找到文件，更新 body 和 foundPath
      body = GAME_FILES[matchedKey];
      foundPath = matchedKey;
      successType = '模糊匹配';
      console.log(`[SW] 模糊匹配成功: 原始请求: ${requestedPath} -> 实际文件: ${matchedKey}`);
    }
  }

  // E. 尝试父目录查找 (处理相对路径问题)
  if (!body && requestedPath.includes('/')) {
    const parts = requestedPath.split('/');
    const filename = parts.pop();
    // 尝试在更深的目录中查找
    for (let i = 0; i < parts.length; i++) {
      const testPath = [...parts.slice(i), filename].join('/');
      if (GAME_FILES[testPath]) {
        body = GAME_FILES[testPath];
        foundPath = testPath;
        successType = '父目录查找';
        break;
      }
    }
  }

  // F. 尝试去掉扩展名查找
  if (!body && requestedPath.includes('.')) {
    const pathWithoutExt = requestedPath.replace(/\.[^/.]+$/, "");
    if (GAME_FILES[pathWithoutExt]) {
      body = GAME_FILES[pathWithoutExt];
      foundPath = pathWithoutExt;
      successType = '无扩展名匹配';
    }
  }

  // 最终响应
  if (body) {
    const ext = foundPath.split(".").pop().toLowerCase();
    const mimeMap = {
      html: "text/html", 
      htm: "text/html",
      js: "text/javascript", 
      css: "text/css", 
      json: "application/json",
      png: "image/png", 
      jpg: "image/jpeg", 
      jpeg: "image/jpeg", 
      gif: "image/gif", 
      webp: "image/webp",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      ogg: "audio/ogg", 
      m4a: "audio/mp4", 
      wav: "audio/wav", 
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      webm: "video/webm",
      wasm: "application/wasm", 
      dll: "application/octet-stream",
      txt: "text/plain",
      xml: "application/xml",
      otf: "font/otf",
      ttf: "font/ttf",
      woff: "font/woff",
      woff2: "font/woff2"
    };
    
    const mime = mimeMap[ext] || "application/octet-stream";
    const headers = { "Content-Type": mime };
    
    // 为 JavaScript 和 CSS 添加 UTF-8 字符集
    if (ext === 'js' || ext === 'css' || ext === 'html') {
      headers["Content-Type"] = `${mime}; charset=utf-8`;
    }
    
    // 缓存控制头
    if (ext === 'html' || ext === 'js' || ext === 'css') {
      headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    } else {
      headers["Cache-Control"] = "public, max-age=31536000"; // 1年缓存
    }
    
    console.log(`[SW] ${successType}: ${foundPath} (${mime})`);

    e.respondWith(new Response(body, { headers }));
  } else {
    console.error("[SW] 文件未找到:", requestedPath);
    console.log("[SW] 可用文件列表:", Object.keys(GAME_FILES));
    
    // 返回 404 响应，包含调试信息
    const debugInfo = {
      requested: requestedPath,
      availableFiles: Object.keys(GAME_FILES).length,
      scope: SCOPE_PATH,
      timestamp: new Date().toISOString(),
      swVersion: APP_VERSION
    };
    
    e.respondWith(
      new Response(
        JSON.stringify({
          error: "文件未找到",
          debug: debugInfo
        }, null, 2),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          }
        }
      )
    );
  }
});

// 错误处理
self.addEventListener('error', event => {
  console.error('[SW Error]', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW Unhandled Rejection]', event.reason);
});