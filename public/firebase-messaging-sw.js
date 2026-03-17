// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBzmFj5-DH-SECGcQ0FLDujxfXJg9pd0-8",
  authDomain: "kyuyoprint.firebaseapp.com",
  projectId: "kyuyoprint",
  storageBucket: "kyuyoprint.firebasestorage.app",
  messagingSenderId: "300754692484",
  appId: "1:300754692484:web:da56e0c2f86543b61395d1"
});

const messaging = firebase.messaging();

// バックグラウンドメッセージ受信時の処理
messaging.onBackgroundMessage((payload) => {
  console.log('📱 バックグラウンド通知受信:', payload);

  const title = payload.notification?.title || '給与明細システム';
  const options = {
    body: payload.notification?.body || '新しいお知らせがあります',
    icon: '/logo192.png',
    badge: '/favicon.ico',
    data: {
      url: payload.data?.url || 'https://kyuyoprint.web.app/employee/login'
    }
  };

  self.registration.showNotification(title, options);
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || 'https://kyuyoprint.web.app/employee/login';
  event.waitUntil(clients.openWindow(url));
});
