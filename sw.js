const CACHE_NAME = 'elite-tunnel-v2';

// Install hote hi naya Service Worker turant active ho jaye
self.addEventListener('install', (event) => {
    console.log('✅ PWA Service Worker Installed');
    self.skipWaiting();
});

// Purane cache ko clean karein aur turant control lein
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Socket.IO aur Metered TURN API ko humesha direct network se jane dein
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    if (
        url.includes('/socket.io/') || 
        url.includes('metered.live') || 
        url.includes('metered.ca') ||
        event.request.method !== 'GET'
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
