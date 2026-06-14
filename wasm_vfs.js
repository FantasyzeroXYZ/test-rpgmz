// =============================================================================
// wasm_vfs.js — ES6 driver class for the rm-wasm-vfs WASM backend
// =============================================================================
// Depends on:
//   - JSZip (https://stuk.github.io/jszip/)
//   - localforage (https://github.com/localForage/localForage)
//   - ./pkg/rm_wasm_fs.js   (wasm-pack --target web output)
// =============================================================================

import init, {
    init_fs,
    write_file,
    has_file,
    read_file,
    clear_fs,
    file_count,
    list_paths
} from './pkg/rm_wasm_vfs.js';

// -----------------------------------------------------------------------------
// MIME-type lookup table for common RPG Maker MZ assets
// -----------------------------------------------------------------------------
const MIME_MAP = {
    // Text / data
    '.json':      'application/json',
    '.txt':       'text/plain',
    '.html':      'text/html',
    '.css':       'text/css',
    '.js':        'application/javascript',
    '.xml':       'application/xml',
    '.csv':       'text/csv',
    '.yaml':      'text/yaml',
    '.yml':       'text/yaml',
    '.ini':       'text/plain',
    '.cfg':       'text/plain',

    // Images
    '.png':       'image/png',
    '.jpg':       'image/jpeg',
    '.jpeg':      'image/jpeg',
    '.gif':       'image/gif',
    '.bmp':       'image/bmp',
    '.webp':      'image/webp',
    '.svg':       'image/svg+xml',
    '.ico':       'image/x-icon',
    '.tiff':      'image/tiff',

    // Audio
    '.ogg':       'audio/ogg',
    '.oga':       'audio/ogg',
    '.m4a':       'audio/mp4',
    '.mp3':       'audio/mpeg',
    '.wav':       'audio/wav',
    '.flac':      'audio/flac',
    '.aac':       'audio/aac',
    '.opus':      'audio/opus',
    '.webm':      'audio/webm',
    '.weba':      'audio/webm',

    // Video
    '.mp4':       'video/mp4',
    '.webm':      'video/webm',

    // Fonts
    '.ttf':       'font/ttf',
    '.otf':       'font/otf',
    '.woff':      'font/woff',
    '.woff2':     'font/woff2',

    // Binary
    '.wasm':      'application/wasm',
    '.bin':       'application/octet-stream',
    '.dat':       'application/octet-stream',
    '.pak':       'application/octet-stream',
    '.dll':       'application/octet-stream',
    '.exe':       'application/octet-stream',
};

/** Guess MIME type from path extension. Falls back to application/octet-stream. */
function guessMime(path) {
    const lower = path.toLowerCase();
    // Try longest extension first (.min.js → .js)
    for (const [ext, mime] of Object.entries(MIME_MAP)) {
        if (lower.endsWith(ext)) {
            return mime;
        }
    }
    return 'application/octet-stream';
}

// -----------------------------------------------------------------------------
// WasmVFS class
// -----------------------------------------------------------------------------
export class WasmVFS {

    constructor() {
        /** @type {boolean} */
        this._initialized = false;
        /** @type {string} */
        this._basePath = '';
        /** @type {Set<string>} */
        this._activeBlobUrls = new Set();
        /** @type {Map<string, string>} path → blobUrl cache (images only) */
        this._imageBlobCache = new Map();
        /** @type {string | null} */
        this._gameId = null;
        /** @type {{ hasImages: boolean, hasAudio: boolean, key: string } | null} */
        this._encryptionInfo = null;
    }

    // =========================================================================
    // Initialisation
    // =========================================================================

    /**
     * Asynchronously initialise the WASM linear memory and the VFS.
     * Must be called once before any other method.
     * @returns {Promise<void>}
     */
    async initialize() {
        // wasm-pack's default init() loads and instantiates the WASM module.
        await init();
        init_fs();
        this._initialized = true;
    }

    /** Ensure the VFS is ready; throw otherwise. */
    _assertReady() {
        if (!this._initialized) {
            throw new Error('WasmVFS: not initialised. Call await vfs.initialize() first.');
        }
    }

    // =========================================================================
    // Path normalisation
    // =========================================================================

    /**
     * Normalise a URL / path into an internal VFS key.
     *
     * Processing pipeline:
     *   1. Strip protocol + authority  (https://example.com/a → /a)
     *   2. Strip query string & hash   (/a?t=1 → /a)
     *   3. Decode percent-encoded chars
     *   4. Normalise backslash to forward slash
     *   5. Collapse leading / and resolve . / .. segments
     *   6. Strip the detected basePath prefix when present
     *
     * @param {string} url       - Raw URL as requested by the game.
     * @param {string} [originUrl] - The document URL that made the request (for relative resolution).
     * @returns {string} Normalised internal path (e.g. "data/System.json")
     */
    normalizePath(url, originUrl) {
        if (!url) return '';

        let path = url;

        // --- strip protocol + authority ---
        // Match absolute URLs: http://host/path, blob:..., data:..., etc.
        const absMatch = path.match(/^(?:https?|file|blob|data):\/\/[^/]+\/(.*)$/i);
        if (absMatch) {
            path = '/' + absMatch[1];
        }

        // --- strip query & hash ---
        const qIdx = path.indexOf('?');
        if (qIdx !== -1) path = path.substring(0, qIdx);
        const hIdx = path.indexOf('#');
        if (hIdx !== -1) path = path.substring(0, hIdx);

        // --- decode ---
        try {
            path = decodeURIComponent(path);
        } catch (_) {
            // Not critical — keep original.
        }

        // --- normalise slashes ---
        path = path.replace(/\\/g, '/');

        // --- collapse leading / and resolve . / .. ---
        const segments = [];
        for (const seg of path.split('/')) {
            if (seg === '' || seg === '.') continue;
            if (seg === '..') {
                if (segments.length > 0 && segments[segments.length - 1] !== '..') {
                    segments.pop();
                } else {
                    segments.push('..');
                }
            } else {
                segments.push(seg);
            }
        }
        path = segments.join('/');

        // --- strip basePath ---
        if (this._basePath && path.startsWith(this._basePath)) {
            path = path.substring(this._basePath.length);
        }

        return path;
    }

    // =========================================================================
    // Zip loading
    // =========================================================================

    /**
     * Load a game .zip archive into the WASM VFS.
     *
     * @param {File|Blob|ArrayBuffer} zipFile - The zip data.
     * @param {(current: number, total: number, filename: string) => void} [onProgress]
     *        Optional progress callback.
     * @returns {Promise<{fileCount: number, basePath: string, indexHtmlPath: string}>}
     */
    async loadZip(zipFile, onProgress) {
        this._assertReady();

        // Clear any previous game data.
        this.shutdown();

        // Re-initialise fresh.
        init_fs();

        // JSZip expects ArrayBuffer / Blob / etc.
        const zip = await JSZip.loadAsync(zipFile);
        const entries = [];
        zip.forEach((relativePath, file) => {
            if (!file.dir) {
                entries.push({ path: relativePath.replace(/\\/g, '/'), file });
            }
        });

        const total = entries.length;
        let current = 0;

        for (const { path, file } of entries) {
            // Read as Uint8Array (preserves binary contents for images, audio, etc.)
            const data = await file.async('uint8array');
            write_file(path, data);
            current++;
            if (onProgress) {
                onProgress(current, total, path);
            }
        }

        // --- auto-detect basePath ---
        this._detectBasePath();

        // --- auto-detect gameId from data/System.json ---
        this._detectGameId();

        const idxPath = this._findIndexHtml();
        return {
            fileCount: file_count(),
            basePath: this._basePath,
            indexHtmlPath: idxPath
        };
    }

    /**
     * Find the directory that contains index.html and set it as basePath.
     * Also handles auto-drill: if root has only one folder, enter it.
     * Example: zip has "MyGame/www/index.html" → basePath = "MyGame/www"
     * Example: zip has only "www/" at root → auto-drill → basePath = "www"
     */
    _detectBasePath() {
        this._basePath = '';
        const paths = list_paths();
        // Auto-drill: if root contains only ONE folder (no files at root), enter it
        const rootEntries = new Set();
        for (const p of paths) {
            const slash = p.indexOf('/');
            rootEntries.add(slash === -1 ? p : p.substring(0, slash));
        }
        if (rootEntries.size === 1) {
            const onlyEntry = [...rootEntries][0];
            // If it's a directory (has files inside with /), use as basePath
            const hasSubfiles = paths.some(p => p.startsWith(onlyEntry + '/') && p !== onlyEntry + '/');
            if (hasSubfiles && !paths.includes('index.html')) {
                this._basePath = onlyEntry;
            }
        }

        const idx = this._findIndexHtml();
        if (!idx) return;
        const lastSlash = idx.lastIndexOf('/');
        if (lastSlash !== -1) {
            const dir = idx.substring(0, lastSlash);
            // If we already have a basePath from auto-drill, only use the index.html
            // directory if it's more specific
            if (!this._basePath || dir.startsWith(this._basePath)) {
                this._basePath = dir;
            }
        }
    }

    /**
     * Locate "index.html" anywhere in the VFS.
     * @returns {string|null}
     */
    _findIndexHtml() {
        const paths = list_paths();
        let best = null;
        for (const p of paths) {
            const name = p.split('/').pop().toLowerCase();
            if (name === 'index.html') {
                if (!best || p.length < best.length) {
                    best = p;
                }
            }
        }
        // Fuzzy fallback: try case-insensitive, then any .html
        if (!best) {
            for (const p of paths) {
                const name = p.split('/').pop().toLowerCase();
                if (name.endsWith('.html') || name.endsWith('.htm')) {
                    best = p;
                    break;
                }
            }
        }
        return best;
    }

    /**
     * Fuzzy file lookup. Tries exact match, then case-insensitive
     * match, then filename-only match (ignoring directory).
     * @param {string} path
     * @returns {string|null} the actual VFS path, or null if not found
     */
    findFile(path) {
        if (!path) return null;
        // 1. Exact match
        if (has_file(path)) return path;
        // 2. Case-insensitive
        const lower = path.toLowerCase();
        const all = list_paths();
        for (const p of all) {
            if (p.toLowerCase() === lower) return p;
        }
        // 3. File name match (ignoring directory)
        const fname = path.split('/').pop();
        if (fname) {
            const fnameLower = fname.toLowerCase();
            for (const p of all) {
                if (p.split('/').pop().toLowerCase() === fnameLower) return p;
            }
        }
        return null;
    }

    /**
     * Parse data/System.json inside the VFS to extract the gameId.
     * RPG Maker MZ stores: System.json → advanced.gameId.
     */
    _detectGameId() {
        this._gameId = null;

        const candidates = [
            'data/System.json',
            this._basePath ? this._basePath + '/data/System.json' : 'data/System.json'
        ];

        for (const key of candidates) {
            const bytes = read_file(key);
            if (bytes) {
                try {
                    const decoder = new TextDecoder('utf-8');
                    const json = decoder.decode(bytes);
                    const system = JSON.parse(json);
                    if (system && system.advanced && system.advanced.gameId) {
                        this._gameId = system.advanced.gameId;
                    }
                    // MV fallback: no advanced.gameId, use versionId or title hash
                    if (!this._gameId && system) {
                        this._gameId = String(system.versionId || system.gameId ||
                            (system.gameTitle||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)
                        ).slice(0,12);
                    }
                    // Extract encryption info (needed for NW.js encrypted deployments).
                    if (system) {
                        const hasImages = system.hasEncryptedImages === true;
                        const hasAudio  = system.hasEncryptedAudio === true;
                        const key       = system.encryptionKey || '';
                        if (key) {
                            this._encryptionInfo = { hasImages, hasAudio, key };
                        }
                    }
                    // If we got a gameId, return early.
                    if (this._gameId) return;
                } catch (_) {
                    // Not critical.
                }
            }
        }

        // Fallback: try to detect from existing localforage keys.
        // Typical key: "rmmzsave.<gameId>.<saveName>"
        try {
            // We can't call localforage from here synchronously; this is a
            // best-effort fallback. The gameId will be resolved lazily in
            // injectSaveFile() if needed.
        } catch (_) { /* noop */ }
    }

    /** Return the detected gameId, or a sensible default. */
    get gameId() {
        return this._gameId || 'mv';
    }

    /** Return detected encryption info, or null if not encrypted. */
    get encryptionInfo() {
        return this._encryptionInfo;
    }

    // =========================================================================
    // Internal path resolution (basePath + fuzzy fallback)
    // =========================================================================
    /**
     * Resolve a requested path to an actual VFS entry, trying:
     * 1. Exact match
     * 2. basePath-prefixed match (for nested-folder zips)
     * 3. Fuzzy match (case-insensitive + filename-only, via findFile)
     * @param {string} path
     * @returns {string|null} actual VFS key, or null
     */
    _resolvePath(path) {
        if (!path) return null;
        // 1. Exact
        if (has_file(path)) return path;
        // 2. With basePath prefix
        if (this._basePath) {
            const alt = (this._basePath + '/' + path).replace(/\/+/g, '/');
            if (has_file(alt)) return alt;
        }
        // 3. Fuzzy
        return this.findFile(path);
    }

    // =========================================================================
    // Response creation (for Fetch / XHR interception)
    // =========================================================================

    /**
     * Create a native Response object from VFS bytes.
     *
     * @param {string} internalPath - Normalised VFS path.
     * @param {string} [mimeType]   - MIME type; guessed if omitted.
     * @returns {Response}
     */
    createResponse(internalPath, mimeType) {
        this._assertReady();
        const actual = this._resolvePath(internalPath);
        if (!actual) {
            return new Response(null, { status: 404, statusText: 'Not Found in VFS' });
        }
        const data = read_file(actual);

        const mime = mimeType || guessMime(internalPath);
        return new Response(data, {
            status: 200,
            headers: {
                'Content-Type': mime,
                'Content-Length': String(data.length),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-VFS-Path': internalPath
            }
        });
    }

    // =========================================================================
    // Media URL management (<img>, <audio>, <video>)
    // =========================================================================

    /**
     * Create a blob: URL from VFS bytes suitable for <img src> or <audio src>.
     *
     * Image lifecycle (immediate revocation):
     *   After the image onload/onerror fires the blob is revoked immediately —
     *   once the GPU texture is created the CPU-side blob is dead weight.
     *
     * Audio lifecycle (deferred revocation):
     *   Audio blobs MUST NOT be revoked while playing. They are revoked only
     *   when the same element's .src changes or shutdown() is called.
     *
     * @param {string} internalPath
     * @param {string} [mimeType]
     * @returns {string|null} blob: URL or null if file not found.
     */
    createMediaUrl(internalPath, mimeType) {
        this._assertReady();
        const actual = this._resolvePath(internalPath);
        if (!actual) return null;

        // Cache check for images (images are immutable within a session).
        if (this._imageBlobCache.has(actual)) {
            return this._imageBlobCache.get(actual);
        }

        const data = read_file(actual);
        if (!data) return null;

        const mime = mimeType || guessMime(internalPath);
        const blob = new Blob([data], { type: mime });
        const url = URL.createObjectURL(blob);
        this._activeBlobUrls.add(url);

        // If it's an image, cache the blob URL.
        if (mime.startsWith('image/')) {
            this._imageBlobCache.set(internalPath, url);
        }

        return url;
    }

    /**
     * Revoke a single blob URL immediately.
     * Safe to call multiple times on the same URL.
     *
     * @param {string} blobUrl
     */
    revokeMediaUrl(blobUrl) {
        if (!blobUrl || !this._activeBlobUrls.has(blobUrl)) return;

        URL.revokeObjectURL(blobUrl);
        this._activeBlobUrls.delete(blobUrl);

        // Also remove from image cache.
        for (const [path, cached] of this._imageBlobCache) {
            if (cached === blobUrl) {
                this._imageBlobCache.delete(path);
                break;
            }
        }
    }

    /**
     * Revoke ALL active blob URLs and clear the image cache.
     * Called by shutdown().
     */
    _revokeAllMediaUrls() {
        for (const url of this._activeBlobUrls) {
            try {
                URL.revokeObjectURL(url);
            } catch (_) {
                // URL may already be invalid — ignore.
            }
        }
        this._activeBlobUrls.clear();
        this._imageBlobCache.clear();
    }

    // =========================================================================
    // Shutdown
    // =========================================================================

    /**
     * Destroy all blob URLs, clear the WASM VFS, and release all memory.
     * After this call the instance is still usable — call loadZip() again
     * to play a different game without re-creating the WasmVFS.
     */
    shutdown() {
        this._revokeAllMediaUrls();
        this._basePath = '';
        this._gameId = null;
        this._encryptionInfo = null;
        if (this._initialized) {
            clear_fs();
        }
    }

    // =========================================================================
    // Text extraction
    // =========================================================================

    /**
     * Safely extract the current visible story/dialogue text from the game
     * running inside an <iframe>.
     *
     * The iframe MUST have been injected with the
     * `window.captureGameText()` polyfill (see index.html sandbox script).
     *
     * @param {HTMLIFrameElement} iframeElement
     * @returns {string} Cleaned text, or empty string if no message is showing.
     */
    getGameCurrentText(iframeElement) {
        if (!iframeElement || !iframeElement.contentWindow) {
            console.warn('WasmVFS: iframe not available or cross-origin.');
            return '';
        }

        const win = iframeElement.contentWindow;
        if (typeof win.captureGameText !== 'function') {
            console.warn('WasmVFS: captureGameText() not found on iframe window. ' +
                         'Ensure the sandbox polyfill was injected.');
            return '';
        }

        try {
            return win.captureGameText();
        } catch (e) {
            console.error('WasmVFS: captureGameText() threw:', e);
            return '';
        }
    }

    // =========================================================================
    // Save file injection
    // =========================================================================

    /**
     * Inject an external .rmmzsave / .rpgsave file into the game's storage
     * backend so it appears in the "Continue" / "Load Game" menu.
     *
     * RPG Maker MZ storage architecture:
     *   Browser mode → localforage (backed by IndexedDB).
     *     Key pattern:  "rmmzsave.<gameId>.<saveName>"
     *     Value:        pako-deflated JSON string.
     *   NW.js mode    → fs write to save/<saveName>.rmmzsave
     *
     * Because we run inside a sandboxed iframe (no `require`, no `fs`),
     * Utils.isNwjs() will be false and the engine will use localforage.
     *
     * @param {string} fileKey  - The filename (e.g. "file1.rmmzsave" or "global").
     * @param {string|ArrayBuffer} fileData - The file content.
     *        For .rmmzsave files this is already a pako-deflated UTF-8 string.
     * @returns {Promise<{success: boolean, key: string, message: string}>}
     */
    async injectSaveFile(fileKey, fileData) {
        this._assertReady();

        // --- Determine saveName ---
        // Remove .rmmzsave / .rpgsave extension and directory prefix.
        let saveName = fileKey.replace(/\\/g, '/').split('/').pop();
        saveName = saveName
            .replace(/\.rmmzsave$/i, '')
            .replace(/\.rpgsave$/i, '');

        if (!saveName) {
            return { success: false, key: '', message: 'Empty save name.' };
        }

        // --- Convert fileData to the zip string expected by localforage ---
        let zipString;
        if (typeof fileData === 'string') {
            // Already a string — assume it's the raw pako-deflated data.
            zipString = fileData;
        } else if (fileData instanceof ArrayBuffer) {
            // Read as UTF-8 string.
            const decoder = new TextDecoder('utf-8');
            zipString = decoder.decode(new Uint8Array(fileData));
        } else if (fileData instanceof Uint8Array) {
            const decoder = new TextDecoder('utf-8');
            zipString = decoder.decode(fileData);
        } else {
            return { success: false, key: '', message: 'Unsupported fileData type.' };
        }

        // --- Resolve gameId ---
        // Priority: 1) already detected, 2) from existing localforage keys,
        //           3) fallback "mv".
        let gameId = this._gameId;

        if (!gameId) {
            try {
                gameId = await this._detectGameIdFromLocalforage();
            } catch (_) {
                gameId = gameId || 'mv';
            }
        }

        // Detect MV vs MZ: MV uses localStorage 'RPG Save N', MZ uses localforage
        const isMV = (this._hasMVEngine !== false);
        // Try to detect by checking for rpg_core.js in VFS
        if (this._hasMVEngine === undefined) {
            this._hasMVEngine = has_file('js/rpg_core.js') && !has_file('js/rmmz_core.js');
        }
        const engineIsMV = this._hasMVEngine;

        if (engineIsMV) {
            // MV: localStorage with key 'RPG Save N'
            const localStorageKey = `RPG Save ${saveName.replace(/^file/i,'')}`;
            try {
                localStorage.setItem(localStorageKey, zipString);
                console.log(`WasmVFS: injected MV save "${saveName}" → localStorage key "${localStorageKey}"`);
                return {
                    success: true,
                    key: localStorageKey,
                    message: `MV Save "${saveName}" injected to localStorage.`
                };
            } catch (e) {
                return { success: false, key: localStorageKey, message: `MV injection failed: ${e.message}` };
            }
        }

        // MZ: localforage with key rmmzsave.<gameId>.<saveName>
        const forageKey = `rmmzsave.${gameId}.${saveName}`;
        try {

            // Also update a "rmmzsave.test" key to ensure the backend is warm.
            const testKey = `rmmzsave.test`;
            await localforage.setItem(testKey, zipString);
            setTimeout(() => localforage.removeItem(testKey), 100);

            console.log(`WasmVFS: injected save "${saveName}" → localforage key "${forageKey}"`);
            return {
                success: true,
                key: forageKey,
                message: `Save "${saveName}" injected successfully as gameId="${gameId}".`
            };
        } catch (e) {
            console.error(`WasmVFS: failed to inject save "${saveName}":`, e);
            return {
                success: false,
                key: forageKey,
                message: `Injection failed: ${e.message}`
            };
        }
    }

    /**
     * Walk localforage keys looking for the rmmzsave.* pattern to extract gameId.
     * @returns {Promise<string>}
     */
    async _detectGameIdFromLocalforage() {
        const keys = await localforage.keys();
        for (const key of keys) {
            // rmmzsave.<gameId>.<saveName>
            const m = key.match(/^rmmzsave\.(.+?)\.(.+)$/);
            if (m && m[1] !== 'test') {
                console.log(`WasmVFS: detected gameId="${m[1]}" from localforage key "${key}"`);
                this._gameId = m[1];
                return m[1];
            }
        }
        return 'mv';
    }

    // =========================================================================
    // Utility: retrieve the internal HTML of the game's index.html
    // =========================================================================

    /**
     * Return the text content of the game's index.html from the VFS.
     * @returns {string|null}
     */
    getIndexHtml() {
        const idxPath = this._findIndexHtml();
        if (!idxPath) return null;

        const data = read_file(idxPath);
        if (!data) return null;

        const decoder = new TextDecoder('utf-8');
        return decoder.decode(data);
    }

    /**
     * Return the text content of any text file from the VFS.
     * @param {string} path
     * @returns {string|null}
     */
    readTextFile(path, encoding) {
        const data = read_file(path);
        if (!data) return null;
        // RPG Maker MZ uses UTF-8 by default, but older/Japanese games may
        // use Shift-JIS.  Try the requested encoding first, then UTF-8,
        // then Shift-JIS as fallback.
        const tryEncodings = encoding ? [encoding, 'utf-8', 'shift-jis'] : ['utf-8', 'shift-jis'];
        for (const enc of tryEncodings) {
            try {
                const decoder = new TextDecoder(enc);
                const text = decoder.decode(data);
                // If UTF-8 produced replacement chars, retry with Shift-JIS
                if (enc === 'utf-8' && text.indexOf('�') !== -1 && tryEncodings.includes('shift-jis')) {
                    continue;
                }
                return text;
            } catch (e) {
                // TextDecoder throws for unsupported encodings — try next
            }
        }
        // Last resort
        return new TextDecoder('utf-8').decode(data);
    }

    /**
     * Return raw bytes for any file in the VFS.
     * @param {string} path
     * @returns {Uint8Array|null}
     */

    /** @returns {boolean} */
    fileExists(path) {
        return this._resolvePath(path) !== null;
    }

    /**
     * Read raw bytes.
     * @param {string} path
     * @returns {Uint8Array|null}
     */
    readRawFile(path) {
        const actual = this._resolvePath(path);
        return actual ? read_file(actual) : null;
    }
} // end class WasmVFS
