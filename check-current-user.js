// 現在のユーザー権限を確認するスクリプト
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

// Firebaseの設定（src/firebase.jsから同じ設定をコピー）
const firebaseConfig = {
  // ここに実際のFirebase設定を入れてください
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function checkCurrentUser() {
  const user = auth.currentUser;
  
  if (!user) {
    console.log('ログインしていません');
    return;
  }
  
  console.log('=== 現在のFirebase Authユーザー ===');
  console.log('UID:', user.uid);
  console.log('Email:', user.email);
  console.log('');
  
  // employeesコレクションから検索
  try {
    const q = query(collection(db, 'employees'), where('uid', '==', user.uid));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('❌ employeesコレクションにデータが見つかりません');
      console.log('');
      
      // email で検索してみる
      const qEmail = query(collection(db, 'employees'), where('email', '==', user.email));
      const snapshotEmail = await getDocs(qEmail);
      
      if (!snapshotEmail.empty) {
        console.log('⚠️ emailで検索したら見つかりました（uidが一致していません）');
        snapshotEmail.forEach(doc => {
          console.log('Document ID:', doc.id);
          console.log('Data:', JSON.stringify(doc.data(), null, 2));
        });
      }
    } else {
      console.log('✅ employeesコレクションのデータ:');
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log('Document ID:', doc.id);
        console.log('Data:', JSON.stringify(data, null, 2));
        console.log('');
        console.log('権限情報:');
        console.log('- userType:', data.userType);
        console.log('- role:', data.role);
        console.log('- companyId:', data.companyId);
        console.log('');
        
        if (data.userType === 'company_admin' || data.role === 'admin') {
          console.log('✅ 管理者権限があります');
        } else {
          console.log('❌ 管理者権限がありません');
        }
      });
    }
  } catch (error) {
    console.error('エラー:', error);
  }
}

// 認証状態の監視
auth.onAuthStateChanged((user) => {
  if (user) {
    checkCurrentUser();
  }
});