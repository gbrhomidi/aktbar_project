/* ==================== SERVICE WORKER (محسّن ومُعالَج) ==================== */
const CACHE_NAME = 'smart-learning-v6'; // تم تغيير الإصدار
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/themes.css',
    '/css/animations.css',
    '/css/style.css',
    '/js/error-handler.js',
    '/js/store.js',
    '/js/question-validator.js',
    '/js/db.js',
    '/js/translations.js',
    '/js/theme-manager.js',
    '/js/achievements.js',
    '/js/network.js',
    '/js/game.js',
    '/js/audio.js',
    '/js/splash.js',
    '/js/adaptive-ai.js',
    '/js/app-version.js',
    // تم استبدال ui.js بالملفات الأربعة
    '/js/ui-core.js',
    '/js/ui-modals.js',
    '/js/ui-game.js',
    '/js/ui-manage.js',
    '/sw.js'
];

// Install: Cache static assets with error handling
self.addEventListener('install', event => {
    console.log('[SW] Installing new version');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                const results = await Promise.allSettled(
                    STATIC_ASSETS.map(async asset => {
                        try {
                            const response = await fetch(asset);
                            if (response.ok) {
                                await cache.put(asset, response);
                                console.log(`[SW] Cached: ${asset}`);
                            } else {
                                console.warn(`[SW] Failed to fetch ${asset}: ${response.status}`);
                            }
                        } catch (err) {
                            console.warn(`[SW] Error caching ${asset}:`, err);
                        }
                    })
                );
                const failed = results.filter(r => r.status === 'rejected');
                if (failed.length) {
                    console.warn(`[SW] ${failed.length} assets failed to cache`);
                }
            })
            .then(() => self.skipWaiting())
            .catch(err => console.error('[SW] Installation failed:', err))
    );
});

// Activate: Clean old caches and take control
self.addEventListener('activate', event => {
    console.log('[SW] Activating new version');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log(`[SW] Deleting old cache: ${name}`);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Cache-first strategy with network fallback
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith(self.location.origin)) return;
    if (url.pathname.includes('analytics') || url.pathname.includes('collect')) return;
    
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) {
                if (event.request.destination !== 'document' && event.request.destination !== 'font') {
                    event.waitUntil(
                        fetch(event.request).then(networkResponse => {
                            if (networkResponse.ok) {
                                const clone = networkResponse.clone();
                                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                            }
                        }).catch(() => {})
                    );
                }
                return cached;
            }
            
            return fetch(event.request).then(networkResponse => {
                if (networkResponse.ok && event.request.destination !== 'document' && event.request.destination !== 'font') {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return networkResponse;
            }).catch(() => {
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
                return new Response('⚠️ هذا المورد غير متوفر حالياً (لا يوجد اتصال بالإنترنت)', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                        'Content-Type': 'text/html; charset=utf-8'
                    })
                });
            });
        })
    );
});