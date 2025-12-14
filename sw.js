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
    
    // 通知主线程准备就绪
    if (e.source) {
      e.source.postMessage({ type: "GAME_READY" });
    }
  }
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // ==========================================
  // ⭐ 【修改 1】动态剥离 Base Path 和 /game/ 前缀
  // ==========================================
  
  // Service Worker 的 Scope (例如：https://user.github.io/repo-name/)
  // 它的 pathname 是 /repo-name/
  const scopePathname = self.registration.scope.replace(url.origin, '');

  // 完整的请求路径名 (例如：/repo-name/game/index.html)
  const fullPathname = url.pathname;
  
  // 剥离 Scope 部分，得到 /game/index.html
  let requestedPathWithGame = fullPathname.replace(scopePathname, '/');
  
  // 只处理 /game/ 下的请求
  if (!requestedPathWithGame.startsWith("/game/")) return;

  // 1. 剥离 /game/
  let requestedPath = requestedPathWithGame.replace(/^\/game\//, "");
  
  // 2. 解码 URL (处理空格)
  try { requestedPath = decodeURIComponent(requestedPath); } catch (e) {}

  // ==========================================
  // ⭐ 特殊处理：index.html (注入截图修复代码)
  // ==========================================
  if (requestedPath === "index.html" || requestedPath === "") {
    let htmlContent = GAME_FILES["index.html"];
    
    if (htmlContent) {
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
  // ⭐ 文件查找逻辑 (增加忽略大小写和后缀容错)
  // ==========================================
  
  let body, foundPath = requestedPath, successType = '未找到';

  // --- A. 精确查找 ---
  if (GAME_FILES[requestedPath]) {
      body = GAME_FILES[requestedPath];
      successType = '精确匹配';
  }

  // --- B. 下划线容错 (处理加密素材) ---
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
  
  // --- D. 【修改 2】 最终容错：自定义后缀处理 (例如 Frigid_Eyes_fin.ogg) ---
  if (!body) {
      const parts = requestedPath.split('.');
      if (parts.length > 1) {
          const ext = parts.pop(); // .ogg
          const nameWithSuffix = parts.join('.'); // audio/bgm/Frigid_Eyes_fin
          
          const lastUnderscoreIndex = nameWithSuffix.lastIndexOf('_');
          
          if (lastUnderscoreIndex !== -1) {
              const baseName = nameWithSuffix.substring(0, lastUnderscoreIndex);
              const cleanPath = `${baseName}.${ext}`; // audio/bgm/Frigid_Eyes.ogg

              // 再次进行大小写模糊查找
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