let GAME_FILES = {};

self.addEventListener("install", e => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("message", e => {
  if (e.data?.type === "LOAD_GAME") {
    GAME_FILES = e.data.files || {};
    const count = Object.keys(GAME_FILES).length;
    console.log(`[SW] 游戏文件已加载: ${count} 个文件`);
    
    if (e.source) {
      e.source.postMessage({ type: "GAME_READY" });
    }
  }
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // ==========================================
  // ⭐ GitHub Pages 路径修正：动态剥离 Base Path
  // ==========================================
  
  // 1. 获取 Service Worker 的 Scope Pathname (例如：/repo-name/)
  const scopePathname = self.registration.scope.replace(url.origin, '');

  // 2. 获取请求的完整 Pathname (例如：/repo-name/game/index.html)
  const fullPathname = url.pathname;
  
  // 3. 剥离 Scope 部分，得到相对路径 (例如：/game/index.html)
  let requestedPathWithGame = fullPathname.replace(scopePathname, '/');
  
  // 只处理 /game/ 下的请求 (确保只处理游戏资源)
  if (!requestedPathWithGame.startsWith("/game/")) return;

  // 4. 剥离 /game/ 前缀，得到文件在 ZIP 中的路径 (例如：index.html)
  let requestedPath = requestedPathWithGame.replace(/^\/game\//, "");
  
  // 5. 解码 URL (处理空格)
  try { requestedPath = decodeURIComponent(requestedPath); } catch (e) {}

  // ==========================================
  // ⭐ 特殊处理：index.html (注入截图修复代码)
  // ==========================================
  if (requestedPath === "index.html" || requestedPath === "") {
    let htmlContent = GAME_FILES["index.html"];
    
    if (htmlContent) {
      const decoder = new TextDecoder("utf-8");
      let htmlStr = decoder.decode(htmlContent);

      // 💉 注入 WebGL 补丁
      const scriptToInject = `
        <script>
          console.log("💉 [SW Inject] 正在应用截图修复补丁...");
          const originalGetContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, attributes) {
            if (type === 'webgl' || type === 'webgl2') {
              attributes = attributes || {};
              attributes.preserveDrawingBuffer = true;
              console.log("✨ WebGL Context Created with preserveDrawingBuffer: true");
            }
            return originalGetContext.call(this, type, attributes);
          };
        </script>
      `;

      htmlStr = htmlStr.replace("<head>", "<head>" + scriptToInject);
      const encoder = new TextEncoder();
      const newBody = encoder.encode(htmlStr);

      e.respondWith(new Response(newBody, { headers: { "Content-Type": "text/html" } }));
      return;
    }
  }

  // ==========================================
  // ⭐ 文件查找逻辑 (包含所有容错)
  // ==========================================
  
  let body, foundPath = requestedPath, successType = '未找到';

  // --- A. 精确查找 ---
  if (GAME_FILES[requestedPath]) {
      body = GAME_FILES[requestedPath];
      successType = '精确匹配';
  }

  // --- B. 下划线容错 ---
  if (!body && requestedPath.endsWith("_")) {
    foundPath = requestedPath.slice(0, -1);
    body = GAME_FILES[foundPath];
    if (body) successType = '下划线容错';
  }

  // --- C. 增强型忽略大小写查找 ---
  if (!body) {
    const lowerReq = requestedPath.toLowerCase();
    const matchedKey = Object.keys(GAME_FILES).find(key => key.toLowerCase() === lowerReq);
    
    if (matchedKey) {
      body = GAME_FILES[matchedKey];
      foundPath = matchedKey;
      successType = '模糊匹配 (大小写)';
      console.log(`[SW] 模糊匹配成功: 原始请求: ${requestedPath} -> 实际文件: ${matchedKey}`);
    }
  }
  
  // --- D. 自定义后缀处理 ---
  if (!body) {
      const parts = requestedPath.split('.');
      if (parts.length > 1) {
          const ext = parts.pop();
          const nameWithSuffix = parts.join('.');
          const lastUnderscoreIndex = nameWithSuffix.lastIndexOf('_');
          
          if (lastUnderscoreIndex !== -1) {
              const cleanPath = `${nameWithSuffix.substring(0, lastUnderscoreIndex)}.${ext}`;

              const lowerCleanPath = cleanPath.toLowerCase();
              const matchedKey = Object.keys(GAME_FILES).find(key => key.toLowerCase() === lowerCleanPath);
              
              if (matchedKey) {
                  body = GAME_FILES[matchedKey];
                  foundPath = matchedKey;
                  successType = '后缀容错';
                  console.warn(`[SW] 后缀容错成功: 原始请求: ${requestedPath} -> 实际文件: ${matchedKey}`);
              }
          }
      }
  }


  // 最终响应
  if (body) {
    const ext = foundPath.split(".").pop().toLowerCase();
    const mime = {
      html: "text/html", js: "text/javascript", css: "text/css", json: "application/json",
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
      ogg: "audio/ogg", m4a: "audio/mp4", wav: "audio/wav", mp3: "audio/mpeg",
      wasm: "application/wasm", dll: "application/octet-stream"
    }[ext] || "application/octet-stream";

    e.respondWith(new Response(body, { headers: { "Content-Type": mime } }));
  } else {
    console.error(`[SW] 彻底未找到 (${requestedPath}): 文件不存在或无法解密。`);
    e.respondWith(new Response("Not Found", { status: 404 }));
  }
});