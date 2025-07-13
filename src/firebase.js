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
  setDoc
} from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

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
const functions = getFunctions(app); // リージョン指定なし

// ローカル環境の場合はエミュレータに接続
const isLocalHost = window.location.hostname === "localhost" || 
                    window.location.hostname === "127.0.0.1";

if (isLocalHost) {
  console.log("==== Firebase Emulators が使用されます ====");
  
  try {
    // 各エミュレータに接続
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    console.log("Auth Emulator に接続しました");
    
    connectFirestoreEmulator(db, "localhost", 8080);
    console.log("Firestore Emulator に接続しました");
    
    connectStorageEmulator(storage, "localhost", 9199);
    console.log("Storage Emulator に接続しました");
    
    connectFunctionsEmulator(functions, "localhost", 5001);
    console.log("Functions Emulator に接続しました");
    
    // テストユーザーの作成（エミュレータ用）
    createTestUserIfNeeded();
    
    console.log("==== Firebase Emulators 接続完了 ====");
  } catch (error) {
    console.error("エミュレータ接続エラー:", error);
  }
}

// テストユーザーの作成
async function createTestUserIfNeeded() {
  try {
    // テスト用メールとパスワード
    const email = "test@example.com";
    const password = "password123";
    
    console.log("テストユーザーの作成を試みます:", email);
    
    try {
      // ユーザーを作成
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("テストユーザーが作成されました:", userCredential.user.uid);
      
      // Firestoreにユーザー情報を追加 - userTypeを修正
      try {
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: email,
          userType: "company_admin",  // companyからcompany_adminに変更
          companyId: "temp_id",
          displayName: "テストユーザー",
          createdAt: new Date()
        });
        console.log("ユーザー情報をFirestoreに保存しました");
      } catch (firestoreError) {
        console.error("Firestoreへのユーザー保存エラー:", firestoreError);
      }
      
      return userCredential.user;
    } catch (createError) {
      // すでに存在している場合はサインインを試みる
      if (createError.code === 'auth/email-already-in-use') {
        console.log("ユーザーは既に存在します。サインインを試みます。");
        try {
          const signInResult = await signInWithEmailAndPassword(auth, email, password);
          console.log("既存ユーザーでサインインしました:", signInResult.user.uid);
          
          // 既存ユーザーのuserTypeを更新（必要な場合）
          try {
            await setDoc(doc(db, "users", signInResult.user.uid), {
              email: email,
              userType: "company_admin",  // userTypeを更新
              companyId: "temp_id",
              displayName: "テストユーザー",
              createdAt: new Date()
            }, { merge: true });
            console.log("既存ユーザーの権限を更新しました");
          } catch (updateError) {
            console.error("ユーザー権限更新エラー:", updateError);
          }
          
          return signInResult.user;
        } catch (signInError) {
          console.error("既存ユーザーへのサインインエラー:", signInError);
        }
      } else {
        console.error("テストユーザー作成エラー:", createError);
      }
    }
  } catch (error) {
    console.error("テストユーザー処理エラー:", error);
  }
}

// デバッグ用：認証状態の変更を監視
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("認証ユーザー:", user);
  } else {
    console.log("認証ユーザーなし");
  }
});

// 必要なサービスをエクスポート
export { auth, db, storage, functions };
export default app;