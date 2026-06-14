// Service Worker for rm-wasm-vfs
// Caches WASM and static assets for offline use.
const CACHE = 'rm-vfs-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/wasm_vfs.js',
    '/pkg/rm_wasm_vfs.js',
    '/pkg/rm_wasm_vfs_bg.wasm',
    '/libs/jszip.min.js',
    '/libs/localforage.min.js'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request))
    );
});
