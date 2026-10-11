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
    read_file_decrypted,
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

    // RPG Maker encrypted assets — map to their decrypted MIME types
    '.rpgmvp':    'image/png',
    '.rpgmvo':    'audio/ogg',
    '.png_':      'image/png',
    '.jpg_':      'image/jpeg',
    '.jpeg_':     'image/jpeg',
    '.m4a_':      'audio/mp4',
    '.ogg_':      'audio/ogg',
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
// RPG Maker encryption utilities
// -----------------------------------------------------------------------------

/**
 * RPG Maker MV/MZ encrypted file header (16 bytes).
 * Bytes 0-4: "RPGMV" magic
 * Bytes 5-10: version info (0x0003, 0x0001 for MV/MZ)
 * Bytes 11-15: reserved (zeros)
 */
const RPGMV_HEADER_BYTES = new Uint8Array([
    0x52, 0x50, 0x47, 0x4D, 0x56, 0x00, 0x00, 0x00,
    0x00, 0x03, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00
]);

/**
 * Known PNG file header (first 16 bytes).
 * Used to derive the XOR encryption key from an encrypted PNG image.
 * Structure: 8-byte PNG signature + 4-byte IHDR length + 4-byte IHDR magic
 */
const PNG_SIGNATURE_16 = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
]);

/**
 * Check whether a buffer has the RPGMV encrypted file header.
 * @param {Uint8Array} data
 * @returns {boolean}
 */
function hasRpgmvHeader(data) {
    if (!data || data.length < 16) return false;
    for (let i = 0; i < 16; i++) {
        if (data[i] !== RPGMV_HEADER_BYTES[i]) return false;
    }
    return true;
}

/**
 * Derive the 16-byte XOR encryption key by comparing the encrypted PNG data
 * against the known PNG file header.
 *
 * Works for both MV (.rpgmvp) and MZ (.png_) encrypted files.
 *
 * Algorithm:
 *   key[i] = encrypted_block[i] XOR known_png_byte[i]   (for i = 0..15)
 *
 * @param {Uint8Array} encryptedData - Raw file bytes (with RPGMV header).
 * @returns {string|null} 32-char hex key string, or null if derivation fails.
 */
function deriveKeyFromEncryptedImage(encryptedData) {
    if (!hasRpgmvHeader(encryptedData)) return null;
    if (encryptedData.length < 32) return null;

    // The encrypted image data starts at offset 16 (after the RPGMV header).
    // The first 16 bytes of the encrypted payload correspond to the first
    // 16 bytes of the original PNG file, which are known.
    const key = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        key[i] = encryptedData[i + 16] ^ PNG_SIGNATURE_16[i];
    }

    // Sanity-check: a valid key shouldn't be all zeros
    const allZero = key.every(b => b === 0);
    if (allZero) return null;

    // Convert to hex string
    return Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Decrypt RPGMV-encrypted file data.
 *
 * The file has a 16-byte RPGMV header followed by XOR-encrypted content.
 * The same 16-byte key is applied to each 16-byte block (CBC-like without IV).
 *
 * @param {Uint8Array} data - Raw file bytes (with 16-byte RPGMV header).
 * @param {string} hexKey - 32-char hex encryption key.
 * @returns {Uint8Array} Decrypted content (without the RPGMV header).
 */
function decryptRpgmvData(data, hexKey) {
    // RPG Maker only encrypts the first 16 bytes of the file body.
    // Rest is plaintext. Matches engine's Utils.decryptArrayBuffer.
    const keyBytes = hexKey.match(/.{2}/g).map(b => parseInt(b, 16));
    const contentLen = data.length - 16;
    const result = new Uint8Array(contentLen);
    for (let i = 0; i < contentLen; i++) {
        result[i] = data[i + 16];
    }
    for (let i = 0; i < 16 && i < contentLen; i++) {
        result[i] ^= keyBytes[i];
    }
    return result;
}

// -----------------------------------------------------------------------------
// Game Root Detector — Configuration
// -----------------------------------------------------------------------------
// All tunable thresholds, marker names, and engine behaviour are collected here
// so they can be adjusted without touching the detection logic.
// -----------------------------------------------------------------------------
const GAME_ROOT_CONFIG = {
    // Entry-point file names searched during the global fuzzy scan (lowercase).
    entryFiles: ['index.html'],

    // Fallback regex for any HTML file when no entryFiles match.
    fallbackPattern: /\.html?$/i,

    // When a directory has <= this many immediate children AND contains no
    // game-data markers, it is considered a "wrapper" directory and will be
    // drilled through (Step 3).
    childThreshold: 1,

    // Directory names that may contain a nested web-root (e.g. NW.js wraps).
    knownSpecialDirs: ['www'],

    // Sub-directories whose presence signals "this is a game project folder".
    gameDataMarkers: [
        'data/', 'js/', 'effects/', 'img/', 'audio/', 'fonts/', 'css/'
    ],

    // Per-engine feature flags for the detection pipeline.
    engineFeatures: {
        'RPGMV': {
            // MV ships web assets inside a www/ sub-directory.
            checkWww: true,
            // Directories that should co-exist with index.html in MV games.
            siblingDirs: ['data/', 'js/'],
        },
        'RPGMZ': {
            // MZ removed the www/ wrapper — never drill into www/ for MZ.
            checkWww: false,
            // MZ games typically have effects/ and data/ alongside index.html.
            siblingDirs: ['effects/', 'data/'],
        },
    },
};

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
        /** @type {string | null} — declared engine type for root detection */
        this._engineType = null;
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
    async loadZip(zipFile, onProgress, preKey, engineType) {
        this._assertReady();

        // Clear WASM filesystem but keep existing blob URLs alive for 30s
        // so in-flight script/image loads from a previous game aren't broken.
        // React StrictMode double-mount can trigger loadZip() while the first
        // game's scripts are still loading via blob URLs.
        if (this._initialized) {
            clear_fs();
        }
        this._basePath = '';
        this._gameId = null;
        this._encryptionInfo = null;
        this._engineType = null;
        // Schedule old blob URLs for cleanup after a grace period
        var _oldBlobs = this._activeBlobUrls;
        this._activeBlobUrls = new Set();
        this._imageBlobCache = new Map();
        setTimeout(function() {
            _oldBlobs.forEach(function(url) {
                try { URL.revokeObjectURL(url); } catch(_) {}
            });
        }, 30000);

        // Re-initialise fresh.
        init_fs();

        // If a pre-known encryption key was provided, set it now so
        // _deriveEncryptionKey skips auto-detection.
        const _hasPreKey = !!(preKey && preKey.length >= 32);
        if (_hasPreKey) {
            this._encryptionInfo = {
                hasImages: true, hasAudio: true,
                key: preKey.toLowerCase().slice(0, 32)
            };
        }

        // --- Known NW.js / Electron runtime files (useless for web play) ---
        // These are filtered out to reduce IndexedDB storage and WASM memory usage.
        const NWJS_SKIP_NAMES = new Set([
            'nw.dll', 'node.dll', 'ffmpeg.dll', 'libegl.dll', 'libglesv2.dll',
            'd3dcompiler_47.dll', 'nw_elf.dll', 'notification_helper.exe',
            'game.exe', 'nw.exe', 'nwjc.exe',
            'nw_100_percent.pak', 'nw_200_percent.pak', 'resources.pak',
            'icudtl.dat', 'natives_blob.bin', 'snapshot_blob.bin',
            'v8_context_snapshot.bin', 'debug.log',
            '.ds_store', 'thumbs.db',
        ]);
        const NWJS_SKIP_DIRS = ['locales/', 'swiftshader/'];

        function _isNwjsBinary(path) {
            const lower = path.toLowerCase().replace(/\\/g, '/');
            const name = lower.split('/').pop();
            if (NWJS_SKIP_NAMES.has(name)) return true;
            for (const dir of NWJS_SKIP_DIRS) {
                if (lower.startsWith(dir) || lower.includes('/' + dir)) return true;
            }
            return false;
        }

        // JSZip expects ArrayBuffer / Blob / etc.
        const zip = await JSZip.loadAsync(zipFile);
        const entries = [];
        let skippedCount = 0;
        zip.forEach((relativePath, file) => {
            if (!file.dir) {
                const path = relativePath.replace(/\\/g, '/');
                if (_isNwjsBinary(path)) {
                    skippedCount++;
                } else {
                    entries.push({ path, file });
                }
            }
        });

        if (skippedCount > 0) {
            console.log(`WasmVFS: skipped ${skippedCount} NW.js runtime file(s) — not needed for web play`);
        }

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

        // --- auto-detect basePath (engine-aware) ---
        this._engineType = engineType ? engineType.toUpperCase() : null;
        this._detectBasePath(this._engineType);

        // --- auto-detect gameId from data/System.json ---
        this._detectGameId();

        // --- auto-derive encryption key from encrypted images (if needed) ---
        this._deriveEncryptionKey();

        // Always re-patch System.json when we have a key, to ensure
        // hasEncryptedImages=false (VFS decrypts transparently).
        if (this._encryptionInfo && this._encryptionInfo.key) {
            this._patchSystemJson(this._encryptionInfo.key);
        }

        const idxPath = this._findIndexHtml(this._engineType);
        return {
            fileCount: file_count(),
            basePath: this._basePath,
            indexHtmlPath: idxPath
        };
    }

    // =========================================================================
    // Game Root Detection — helpers
    // =========================================================================

    /**
     * Return the set of immediate child names under `dir` from a flat path list.
     * `dir` === '' means the zip root.
     * @param {string} dir
     * @param {string[]} paths
     * @returns {Set<string>}
     */
    _getImmediateChildren(dir, paths) {
        const children = new Set();
        const prefix = dir ? dir + '/' : '';
        for (const p of paths) {
            if (prefix && !p.startsWith(prefix)) continue;
            const rest = prefix ? p.substring(prefix.length) : p;
            const slash = rest.indexOf('/');
            children.add(slash === -1 ? rest : rest.substring(0, slash));
        }
        return children;
    }

    /**
     * Check whether `dir` contains game-data marker directories.
     * @param {string} dir
     * @param {string[]} paths
     * @param {object} cfg
     * @returns {boolean}
     */
    _hasGameFiles(dir, paths, cfg) {
        const prefix = dir ? dir + '/' : '';
        const markers = cfg.gameDataMarkers;
        for (const p of paths) {
            if (prefix && !p.startsWith(prefix)) continue;
            const rest = prefix ? p.substring(prefix.length) : p;
            for (const m of markers) {
                if (rest === m.slice(0, -1) || rest.startsWith(m)) return true;
            }
        }
        // Also true if an entry file exists directly in this directory.
        const entryFiles = cfg.entryFiles;
        for (const p of paths) {
            if (prefix && !p.startsWith(prefix)) continue;
            const rest = prefix ? p.substring(prefix.length) : p;
            if (rest.indexOf('/') === -1) {
                const lower = rest.toLowerCase();
                if (entryFiles.some(ef => lower === ef)) return true;
            }
        }
        return false;
    }

    /**
     * A directory is a "wrapper" when it has <= childThreshold children and
     * no game-data markers directly inside it.
     * @param {string} dir
     * @param {string[]} paths
     * @param {object} cfg
     * @returns {boolean}
     */
    _isWrapperDir(dir, paths, cfg) {
        const children = this._getImmediateChildren(dir, paths);
        if (children.size > cfg.childThreshold) return false;
        if (children.size === 0) return false;
        return !this._hasGameFiles(dir, paths, cfg);
    }

    /**
     * Recursively drill down through wrapper directories until reaching a
     * directory that looks like a game root (or a dead end).
     * @param {string} startDir
     * @param {string[]} paths
     * @param {object} cfg
     * @returns {string|null} detected root, or null
     */
    _drillToGameRoot(startDir, paths, cfg) {
        let current = startDir;
        // Safety: maximum 10 levels of nesting
        for (let depth = 0; depth < 10; depth++) {
            // If current dir has game files, this is a valid root.
            if (this._hasGameFiles(current, paths, cfg)) {
                return current;
            }
            // If current dir is not a wrapper, stop.
            if (!this._isWrapperDir(current, paths, cfg)) {
                return this._hasGameFiles(current, paths, cfg) ? current : null;
            }
            // Drill into the single child directory.
            const children = [...this._getImmediateChildren(current, paths)];
            // Only drill if exactly ONE child (a folder).
            if (children.length !== 1) return null;
            const onlyChild = children[0];
            // Verify it's actually a directory (contains a / in some path).
            const prefix = current ? current + '/' : '';
            const hasSub = paths.some(p =>
                p.startsWith(prefix + onlyChild + '/') && p !== prefix + onlyChild + '/'
            );
            if (!hasSub) return null;
            current = current ? current + '/' + onlyChild : onlyChild;
        }
        return null;
    }

    /**
     * Verify that `dir` has the required sibling directories expected by a
     * specific engine (e.g. MZ needs effects/ or data/ alongside index.html).
     * @param {string} dir
     * @param {string[]} paths
     * @param {string[]} requiredDirs
     * @returns {boolean}
     */
    _verifyEngineDirs(dir, paths, requiredDirs) {
        const prefix = dir ? dir + '/' : '';
        for (const rd of requiredDirs) {
            const has = paths.some(p => {
                if (prefix && !p.startsWith(prefix)) return false;
                const rest = prefix ? p.substring(prefix.length) : p;
                return rest === rd.slice(0, -1) || rest.startsWith(rd);
            });
            if (has) return true;
        }
        return false;
    }

    /**
     * Find a target file (e.g. "index.html") inside a specific named directory
     * (e.g. "www") anywhere in the path tree.
     * @param {string} targetDir  — directory name (lowercase)
     * @param {string} targetFile — file name (lowercase)
     * @param {string[]} paths
     * @returns {string|null} matching path, or null
     */
    _findInDir(targetDir, targetFile, paths) {
        const tdir = targetDir.toLowerCase();
        const tfile = targetFile.toLowerCase();
        for (const p of paths) {
            const parts = p.split('/');
            if (parts.length < 2) continue;
            const parent = parts[parts.length - 2].toLowerCase();
            const fname = parts[parts.length - 1].toLowerCase();
            if (parent === tdir && fname === tfile) return p;
        }
        return null;
    }

    // =========================================================================
    // Game Root Detection — main algorithm
    // =========================================================================

    /**
     * Engine-aware game-root detection.
     *
     * Priority order (highest first):
     *   Step 0 – Engine-type pre-filter + global fuzzy index.html search
     *   Step 1 – Flat structure (files at zip root)
     *   Step 2 – Single parent-folder wrapper
     *   Step 3 – Deep nesting drill‑down (threshold‑based)
     *   Step 4 – RPG MV "www/" special structure (skipped for RPGMZ)
     *   Fallback – first directory containing an entry file
     *
     * @param {string|null} engineType — 'RPGMV', 'RPGMZ', or null
     */
    _detectBasePath(engineType) {
        this._basePath = '';
        const paths = list_paths();
        const cfg = GAME_ROOT_CONFIG;

        // ---- helpers (bound to this) ----
        const hasGameFiles = (d) => this._hasGameFiles(d, paths, cfg);
        const verifyEngineDirs = (d, dirs) => this._verifyEngineDirs(d, paths, dirs);
        const findInDir = (td, tf) => this._findInDir(td, tf, paths);

        // =====================================================================
        // Step 0 – Engine‑aware pre‑filter + global fuzzy search
        // =====================================================================

        // 0a. RPGMV: if engine is MV, try www/<entryFile> first.
        if (engineType === 'RPGMV') {
            for (const ef of cfg.entryFiles) {
                const hit = findInDir('www', ef);
                if (hit) {
                    this._basePath = hit.substring(0, hit.lastIndexOf('/'));
                    return;
                }
            }
        }

        // 0b. Collect all paths whose filename matches an entry file.
        const indexPaths = [];
        for (const p of paths) {
            const fname = p.split('/').pop().toLowerCase();
            if (cfg.entryFiles.some(ef => fname === ef)) {
                indexPaths.push(p);
            }
        }

        // 0c. Unique match → use its directory directly.
        if (indexPaths.length === 1) {
            const lastSlash = indexPaths[0].lastIndexOf('/');
            this._basePath = lastSlash === -1 ? '' : indexPaths[0].substring(0, lastSlash);
            return;
        }

        // 0d. RPGMZ pre-filter: among multiple index.html files, skip www/
        //     entries and prefer the one whose sibling dirs match MZ conventions.
        if (engineType === 'RPGMZ' && indexPaths.length > 1) {
            const mzFeatures = cfg.engineFeatures['RPGMZ'];
            // Separate non-www and www candidates.
            const nonWww = indexPaths.filter(p => {
                const parts = p.split('/');
                return parts.length < 2 || parts[parts.length - 2].toLowerCase() !== 'www';
            });
            const wwwOnly = indexPaths.filter(p => {
                const parts = p.split('/');
                return parts.length >= 2 && parts[parts.length - 2].toLowerCase() === 'www';
            });
            // Prefer non-www candidates with MZ sibling dirs.
            for (const idx of [...nonWww, ...wwwOnly]) {
                const dir = idx.lastIndexOf('/') === -1 ? '' : idx.substring(0, idx.lastIndexOf('/'));
                if (verifyEngineDirs(dir, mzFeatures.siblingDirs)) {
                    this._basePath = dir;
                    return;
                }
            }
        }

        // =====================================================================
        // Steps 1‑3 – Heuristic directory traversal
        // =====================================================================

        // Build ordered candidates: directories of found entry files, then root.
        const candidateDirs = indexPaths.length > 0
            ? indexPaths.map(p => {
                const s = p.lastIndexOf('/');
                return s === -1 ? '' : p.substring(0, s);
            })
            : [''];

        // Deduplicate while preserving order.
        const seen = new Set();
        const ordered = [];
        for (const d of candidateDirs) {
            if (!seen.has(d)) { seen.add(d); ordered.push(d); }
        }

        // Score each candidate by how many game-data markers it contains.
        // In case of ties, prefer the shallower (shorter basePath) candidate.
        const scoreCandidate = (dir) => {
            const prefix = dir ? dir + '/' : '';
            let score = 0;
            for (const p of paths) {
                if (prefix && !p.startsWith(prefix)) continue;
                const rest = prefix ? p.substring(prefix.length) : p;
                for (const m of cfg.gameDataMarkers) {
                    if (rest === m.slice(0, -1) || rest.startsWith(m)) { score++; break; }
                }
            }
            return score;
        };

        let bestResult = null;
        let bestScore = -1;

        for (const candidate of ordered) {
            // Step 1 – Flat structure (game files directly at this candidate).
            if (hasGameFiles(candidate)) {
                const s = scoreCandidate(candidate);
                if (s > bestScore || (s === bestScore && bestResult !== null && candidate.length < bestResult.length)) {
                    bestScore = s;
                    bestResult = candidate;
                }
                continue;
            }

            // Step 2 + 3 – Drill down through wrapper directories.
            const drilled = this._drillToGameRoot(candidate, paths, cfg);
            if (drilled !== null) {
                const s = scoreCandidate(drilled);
                if (s > bestScore || (s === bestScore && bestResult !== null && drilled.length < bestResult.length)) {
                    bestScore = s;
                    bestResult = drilled;
                }
            }
        }

        if (bestResult !== null) {
            this._basePath = bestResult;
            return;
        }

        // =====================================================================
        // Step 4 – RPG MV "www/" special structure
        // =====================================================================
        // Only active when engine is NOT explicitly RPGMZ.
        if (engineType !== 'RPGMZ') {
            for (const ef of cfg.entryFiles) {
                const wwwHit = findInDir('www', ef);
                if (wwwHit) {
                    this._basePath = wwwHit.substring(0, wwwHit.lastIndexOf('/'));
                    return;
                }
            }
        }

        // =====================================================================
        // Fallback – first directory containing an entry file
        // =====================================================================
        if (indexPaths.length > 0) {
            const lastSlash = indexPaths[0].lastIndexOf('/');
            this._basePath = lastSlash === -1 ? '' : indexPaths[0].substring(0, lastSlash);
            return;
        }

        // Last resort: search for any .html/.htm file.
        for (const p of paths) {
            if (cfg.fallbackPattern.test(p.split('/').pop())) {
                const lastSlash = p.lastIndexOf('/');
                this._basePath = lastSlash === -1 ? '' : p.substring(0, lastSlash);
                return;
            }
        }
    }

    /**
     * Locate the game's entry HTML anywhere in the VFS.
     *
     * Strategy (in order, engine‑aware):
     * 1. package.json "main" field (NW.js / Electron wraps).
     * 2. Entry-file search using GAME_ROOT_CONFIG.entryFiles.
     *    - RPGMV: prefer www/<entryFile>.
     *    - Other: shortest matching entry file first.
     * 3. Fuzzy fallback: any .html / .htm file.
     *
     * @param {string|null} [engineType]
     * @returns {string|null}
     */
    _findIndexHtml(engineType) {
        const paths = list_paths();
        const cfg = GAME_ROOT_CONFIG;

        // --- 1. package.json "main" field ---
        const pkgPaths = [];
        for (const p of paths) {
            if (p.split('/').pop().toLowerCase() === 'package.json') {
                pkgPaths.push(p);
            }
        }
        pkgPaths.sort((a, b) => a.length - b.length);

        for (const pkgPath of pkgPaths) {
            try {
                const data = read_file(pkgPath);
                const json = JSON.parse(new TextDecoder('utf-8').decode(data));
                if (json.main && typeof json.main === 'string') {
                    const pkgDir = pkgPath.substring(0, pkgPath.lastIndexOf('/'));
                    const raw = json.main.replace(/\\/g, '/');
                    const mainPath = pkgDir
                        ? (pkgDir + '/' + raw).replace(/\/+/g, '/')
                        : raw;
                    const mainLower = mainPath.toLowerCase();
                    for (const p of paths) {
                        if (p.replace(/\\/g, '/').toLowerCase() === mainLower) {
                            return p;
                        }
                    }
                    const mainName = mainPath.split('/').pop().toLowerCase();
                    for (const p of paths) {
                        if (p.split('/').pop().toLowerCase() === mainName) {
                            return p;
                        }
                    }
                }
            } catch (_) { /* ignore */ }
        }

        // --- 2. Entry-file search (engine‑aware) ---
        let best = null;
        let bestInWww = null;

        for (const p of paths) {
            const name = p.split('/').pop().toLowerCase();
            if (cfg.entryFiles.some(ef => name === ef)) {
                if (!best || p.length < best.length) {
                    best = p;
                }
                // Track entry files whose parent dir is "www"
                const parts = p.split('/');
                if (parts.length >= 2) {
                    const parentDir = parts[parts.length - 2].toLowerCase();
                    if (parentDir === 'www' && (!bestInWww || p.length < bestInWww.length)) {
                        bestInWww = p;
                    }
                }
            }
        }

        // RPGMV (or unknown engine): prefer www/<entryFile> when available.
        // RPGMZ explicitly: skip www/ preference (MZ removed the www wrapper).
        if (bestInWww && engineType !== 'RPGMZ') {
            best = bestInWww;
        } else if (engineType === 'RPGMZ' && bestInWww && !best) {
            // MZ: only use www if no other entry file was found.
            best = bestInWww;
        }

        // --- 3. Fuzzy fallback: any .html / .htm ---
        if (!best) {
            for (const p of paths) {
                const name = p.split('/').pop().toLowerCase();
                if (cfg.fallbackPattern.test(name)) {
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

    /**
     * If System.json didn't contain an encryptionKey, try to derive one
     * from encrypted image files (.rpgmvp / .png_) inside the VFS.
     *
     * On success the derived key is injected back into System.json so the
     * game engine's built-in Decrypter class can use it.
     */
    /**
     * Set the encryption key from an external source (e.g., stored in IndexedDB).
     * Call BEFORE bootGame() to skip the auto-derivation step.
     * @param {string} hexKey - 32-char hex encryption key.
     * @param {boolean} [hasImages=true]
     * @param {boolean} [hasAudio=true]
     */
    setEncryptionKey(hexKey, hasImages, hasAudio) {
        if (!hexKey || hexKey.length < 32) return false;
        this._encryptionInfo = {
            hasImages: hasImages !== false,
            hasAudio: hasAudio !== false,
            key: hexKey.toLowerCase().slice(0, 32)
        };
        // Also patch System.json so the engine finds it
        this._patchSystemJson(this._encryptionInfo.key);
        return true;
    }

    _deriveEncryptionKey() {
        // Already have a key (from System.json or setEncryptionKey)? Done.
        if (this._encryptionInfo && this._encryptionInfo.key) return;

        const encryptedImages = this._findEncryptedImages();
        if (encryptedImages.length === 0) return;

        for (const imgPath of encryptedImages) {
            const data = this.readRawFile(imgPath);
            if (!data || data.length < 32) continue;

            const derivedKey = deriveKeyFromEncryptedImage(data);
            if (!derivedKey) continue;

            console.log(`WasmVFS: derived encryption key from "${imgPath}"`);

            this._encryptionInfo = {
                hasImages: true,
                hasAudio: true,  // MV/MZ use the same key for both
                key: derivedKey
            };

            // Inject the key into System.json so the game engine finds it
            this._patchSystemJson(derivedKey);
            return;
        }
    }

    /**
     * Find all encrypted image files in the VFS.
     * MV format: *.rpgmvp   MZ format: *.png_  *.jpg_
     * @returns {string[]} VFS paths, sorted shortest-first.
     */
    _findEncryptedImages() {
        const paths = list_paths();
        const encrypted = [];
        for (const p of paths) {
            const lower = p.toLowerCase();
            if (lower.endsWith('.rpgmvp') || lower.endsWith('.png_') || lower.endsWith('.jpg_')) {
                encrypted.push(p);
            }
        }
        // Prefer shorter paths (usually title/icon images)
        encrypted.sort((a, b) => a.length - b.length);
        return encrypted;
    }

    /**
     * Write the derived encryption key back into data/System.json so the
     * RPG Maker engine's Decrypter class can read it at boot time.
     *
     * @param {string} hexKey - 32-char hex encryption key.
     */
    _patchSystemJson(hexKey) {
        const candidates = [
            'data/System.json',
            this._basePath ? this._basePath + '/data/System.json' : 'data/System.json'
        ];
        for (const sysPath of candidates) {
            const raw = read_file(sysPath);
            if (!raw) continue;
            try {
                const decoder = new TextDecoder('utf-8');
                const system = JSON.parse(decoder.decode(raw));
                // Keep hasEncryptedImages=true so the engine uses its XHR-based
                // decryption path which creates blob URLs IN the iframe.
                // Cross-context blob URLs (parent → iframe) fail to load.
                system.hasEncryptedImages = true;
                system.hasEncryptedAudio = true;
                system.encryptionKey = hexKey;
                const encoded = new TextEncoder().encode(JSON.stringify(system));
                write_file(sysPath, encoded);
                console.log(`WasmVFS: patched "${sysPath}" — encryptedImages=true, key saved`);
                return;
            } catch (e) {
                console.warn('WasmVFS: failed to patch System.json:', e);
            }
        }
    }

    /**
     * Check whether a VFS path points to an RPGMV-encrypted file.
     * @param {string} path - VFS path.
     * @returns {boolean}
     */
    _isEncryptedPath(path) {
        if (!this._encryptionInfo || !this._encryptionInfo.key) return false;
        const lower = path.toLowerCase();
        return lower.endsWith('.rpgmvp') || lower.endsWith('.rpgmvo') ||
               lower.endsWith('.png_') || lower.endsWith('.jpg_') || lower.endsWith('.jpeg_') ||
               lower.endsWith('.m4a_') || lower.endsWith('.ogg_');
    }

    /**
     * Public method: decrypt an RPGMV-encrypted file and return the raw
     * content bytes (without the 16-byte RPGMV header).
     *
     * Useful for thumbnail extraction and other host-level operations.
     *
     * @param {string} path - Requested path (e.g. "img/titles1/Title.png_").
     * @returns {Uint8Array|null} Decrypted bytes, or null if not found / not encrypted.
     */
    decryptFile(path) {
        if (!this._encryptionInfo || !this._encryptionInfo.key) return null;
        const actual = this._resolvePath(path);
        if (!actual) return null;
        const data = read_file(actual);
        if (!data || !hasRpgmvHeader(data)) return null;
        return decryptRpgmvData(data, this._encryptionInfo.key);
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
        const fuzzy = this.findFile(path);
        if (fuzzy) return fuzzy;
        // 4. Encrypted filename mapping (Title.png → Title.png_ / Title.rpgmvp)
        //    Only when we have a known encryption key.
        if (this._encryptionInfo && this._encryptionInfo.key) {
            const lower = path.toLowerCase();
            // Don't remap files that already have encrypted extensions
            if (!lower.endsWith('.png_') && !lower.endsWith('.rpgmvp') &&
                !lower.endsWith('.ogg_') && !lower.endsWith('.m4a_') && !lower.endsWith('.rpgmvo') &&
                !lower.endsWith('.jpg_') && !lower.endsWith('.jpeg_')) {
                const tryExts = [path + '_'];
                if (/\.(png|jpg|jpeg)$/i.test(path)) tryExts.push(path.replace(/\.(png|jpg|jpeg)$/i, '.rpgmvp'));
                if (/\.(ogg|m4a)$/i.test(path)) tryExts.push(path.replace(/\.(ogg|m4a)$/i, '.rpgmvo'));
                for (const tp of tryExts) {
                    if (has_file(tp)) return tp;
                    if (this._basePath) {
                        const altTry = (this._basePath + '/' + tp).replace(/\/+/g, '/');
                        if (has_file(altTry)) return altTry;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Read file data, transparently decrypting encrypted files.
     * @param {string} path - VFS path (resolved via _resolvePath).
     * @param {boolean} [raw=false] - If true, return raw bytes without decryption.
     * @returns {Uint8Array|null}
     */
    _readFileData(path, raw) {
        if (raw) return read_file(path);
        // Decrypt via Rust (16-byte XOR matching the engine).
        // For non-encrypted files, read_file_decrypted returns raw bytes.
        const hexKey = (this._encryptionInfo && this._encryptionInfo.key) ? this._encryptionInfo.key : '';
        return read_file_decrypted(path, hexKey);
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
        let data = this._readFileData(actual);
        let mime = mimeType || guessMime(internalPath);

        // Fix MIME for decrypted content (strip encrypted extension)
        if (data && this._encryptionInfo && this._encryptionInfo.key && this._isEncryptedPath(actual)) {
            const lo = actual.toLowerCase();
            if (lo.endsWith('.png_') || lo.endsWith('.rpgmvp')) mime = 'image/png';
            else if (lo.endsWith('.ogg_') || lo.endsWith('.rpgmvo')) mime = 'audio/ogg';
            else if (lo.endsWith('.m4a_')) mime = 'audio/mp4';
            else if (lo.endsWith('.jpg_') || lo.endsWith('.jpeg_')) mime = 'image/jpeg';
        }

        // Encode path for X-VFS-Path header — HTTP headers must be ISO-8859-1.
        // Non-ASCII characters (Cyrillic, CJK, etc.) in file paths will crash
        // the Response constructor with: "String contains non ISO-8859-1 code point"
        const safePath = internalPath.replace(/[^\x00-\xFF]/g, function(ch) {
            return encodeURIComponent(ch);
        });

        return new Response(data, {
            status: 200,
            headers: {
                'Content-Type': mime,
                'Content-Length': String(data.length),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=31536000, immutable',
                'X-VFS-Path': safePath
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

        // Read with Rust-side decryption for encrypted files (returns clean Vec<u8>).
        // For non-encrypted files, read_file passthrough does the same thing.
        // Using read_file_decrypted for both paths is safe and avoids branching.
        const hexKey = (this._encryptionInfo && this._encryptionInfo.key) ? this._encryptionInfo.key : '';
        const data = read_file_decrypted(actual, hexKey);
        if (!data) return null;

        let mime = mimeType || guessMime(internalPath);
        // Fix MIME for encrypted file extensions
        if (hexKey && this._isEncryptedPath(actual)) {
            const lo = actual.toLowerCase();
            if (lo.endsWith('.png_') || lo.endsWith('.rpgmvp')) mime = 'image/png';
            else if (lo.endsWith('.ogg_') || lo.endsWith('.rpgmvo')) mime = 'audio/ogg';
            else if (lo.endsWith('.m4a_')) mime = 'audio/mp4';
            else if (lo.endsWith('.jpg_') || lo.endsWith('.jpeg_')) mime = 'image/jpeg';
        }

        // Return the clean ArrayBuffer from WASM. Caller is responsible for
        // creating a blob/data URL in the appropriate context.
        // The sandbox's Image.src setter uses vfs.readRawFile() instead of
        // createMediaUrl() to build the data URL locally in the iframe.
        const blob = new Blob([data], { type: mime });
        const url = URL.createObjectURL(blob);
        this._activeBlobUrls.add(url);

        // If it's an image, cache the blob URL keyed by the resolved (actual) VFS path.
        // This ensures consistent cache hits regardless of the requested path
        // (e.g. "Title.png" vs "Title.png_") resolving to the same file.
        if (mime.startsWith('image/')) {
            this._imageBlobCache.set(actual, url);
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

        // Only revoke blob: URLs (data: URLs don't need revocation)
        if (blobUrl.startsWith('blob:')) {
            try { URL.revokeObjectURL(blobUrl); } catch (_) {}
        }
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
        this._engineType = null;
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
            // Write the actual save data into the correct slot so the game
            // can detect and load it via StorageManager.loadFromForage().
            await localforage.setItem(forageKey, zipString);

            // Also touch a "rmmzsave.test" key to ensure the backend is warm
            // (fixes browsers that defer IndexedDB init until first write).
            const testKey = `rmmzsave.test`;
            await localforage.setItem(testKey, zipString);
            setTimeout(() => localforage.removeItem(testKey), 100);

            console.log(`WasmVFS: injected save "${saveName}" → localforage key "${forageKey}" (${zipString.length} bytes)`);
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
        const idxPath = this._findIndexHtml(this._engineType);
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
        const data = this.readRawFile(path);
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
        return actual ? this._readFileData(actual) : null;
    }
} // end class WasmVFS
