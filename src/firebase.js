// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  connectAuthEmulator, 
  onAuthStateChanged, 
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { 
  getFirestore, 
  connectFirestoreEmulator,
  collection,
  addDoc,
  doc,
  setDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getMessaging, isSupported } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzmFj5-DH-SECGcQ0FLDujxfXJg9pd0-8",
  authDomain: "kyuyoprint.firebaseapp.com",
  projectId: "kyuyoprint",
  storageBucket: "kyuyoprint.firebasestorage.app", // 実際のストレージバケット名に修正
  messagingSenderId: "300754692484",
  appId: "1:300754692484:web:da56e0c2f86543b61395d1",
  measurementId: "G-248TDC31LZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Analytics only in production
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // ローカル環境ではanalyticsをスキップ
  console.log("Analytics not available in development mode");
}

// Firebase サービスの初期化
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'asia-northeast1'); // リージョン指定

// FCM Messaging初期化（対応ブラウザのみ）
let messaging = null;
const getMessagingInstance = async () => {
  if (messaging) return messaging;
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
      console.log("📱 FCM Messaging 初期化完了");
    }
  } catch (e) {}
  return messaging;
};
// 初回読み込み時にも試行
getMessagingInstance();

// 本番環境を使用
console.log("==== Firebase 本番環境を使用します ====");

// デバッグ用：認証状態の変更を監視
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("認証ユーザー:", user);
  } else {
    console.log("認証ユーザーなし");
  }
});

// 必要なサービスをエクスポート
export { auth, db, storage, functions, messaging, getMessagingInstance };
export default app;