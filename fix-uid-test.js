// Firebase Functionsの修正をテストするスクリプト
const { httpsCallable } = require('firebase/functions');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFunctions } = require('firebase/functions');

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyBzmFj5-DH-SECGcQ0FLDujxfXJg9pd0-8",
  authDomain: "kyuyoprint.firebaseapp.com",
  projectId: "kyuyoprint",
  storageBucket: "kyuyoprint.firebasestorage.app",
  messagingSenderId: "300754692484",
  appId: "1:300754692484:web:da56e0c2f86543b61395d1",
  measurementId: "G-248TDC31LZ"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, 'asia-northeast1');

async function testFixUIDs() {
  try {
    console.log('🔐 管理者でログイン中...');
    
    // 管理者でログイン（あなたのアカウント）
    await signInWithEmailAndPassword(auth, 'nao.osawa@gmail.com', 'Nao19820212');
    console.log('✅ ログイン成功');
    
    console.log('🔧 UID修正関数を呼び出し中...');
    
    // fixEmployeeUIDs関数を呼び出し
    const fixEmployeeUIDs = httpsCallable(functions, 'fixEmployeeUIDs');
    const result = await fixEmployeeUIDs();
    
    console.log('🎉 UID修正結果:', result.data);
    
  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('詳細:', error.code, error.message);
  }
}

testFixUIDs();