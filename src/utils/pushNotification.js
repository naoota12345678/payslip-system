import { getMessagingInstance } from '../firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const VAPID_KEY = 'BAOL122J91EnHfkHVJ5DSdgKfANw9Li3IFaUdboy5YpGs8a7BgzrAhNlB3mD1te3LEjbEHPOBV-SR5iAqZ-WCbs';

/**
 * 通知許可を要求し、FCMトークンをFirestoreに保存
 */
export const requestNotificationPermission = async (userId, companyId, employeeId) => {
  const msg = await getMessagingInstance();
  if (!msg) {
    console.log('📱 このブラウザはプッシュ通知に対応していません');
    return { success: false, reason: 'not_supported' };
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('📱 通知許可が拒否されました');
      return { success: false, reason: 'denied' };
    }

    const token = await getToken(msg, { vapidKey: VAPID_KEY });

    if (!token) {
      console.log('📱 FCMトークンの取得に失敗しました');
      return { success: false, reason: 'no_token' };
    }

    // Firestoreに保存（トークンをドキュメントIDに使用）
    await setDoc(doc(db, 'fcmTokens', token), {
      token: token,
      userId: userId,
      employeeId: employeeId || '',
      companyId: companyId || '',
      updatedAt: serverTimestamp(),
      platform: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    }, { merge: true });

    console.log('📱 FCMトークン保存完了');
    return { success: true, token };

  } catch (error) {
    console.error('📱 通知設定エラー:', error);
    return { success: false, reason: 'error', error: error.message };
  }
};

/**
 * フォアグラウンド通知のリスナーを設定
 */
export const setupForegroundNotification = async (callback) => {
  const msg = await getMessagingInstance();
  if (!msg) return null;

  return onMessage(msg, (payload) => {
    console.log('📱 フォアグラウンド通知受信:', payload);

    // ブラウザ通知を表示
    if (Notification.permission === 'granted') {
      const title = payload.notification?.title || '給与明細システム';
      new Notification(title, {
        body: payload.notification?.body || '新しいお知らせがあります',
        icon: '/logo192.png'
      });
    }

    if (callback) callback(payload);
  });
};

/**
 * 通知がサポートされているか確認
 */
export const isNotificationSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

/**
 * 現在の通知許可状態を取得
 */
export const getNotificationStatus = () => {
  if (!('Notification' in window)) return 'not_supported';
  return Notification.permission; // 'default', 'granted', 'denied'
};
