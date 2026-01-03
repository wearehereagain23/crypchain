// /sw.js

self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body,
        icon: './chart/assets/badge/logo.png', // Small icon
        image: data.image,       // LARGE image inside the notification
        badge: './chart/assets/badge/logo.png',
        vibrate: [100, 50, 100],
        data: { url: data.url },
        actions: [
            { action: 'open', title: 'View Terminal' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});