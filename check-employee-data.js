// 従業員データの現状確認専用スクリプト
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyCOdPT8vb4O7V3x2NJ3w38IQCTa_CsqoAI",
  authDomain: "kyuyoprint.firebaseapp.com",
  projectId: "kyuyoprint",
  storageBucket: "kyuyoprint.appspot.com",
  messagingSenderId: "630149623831",
  appId: "1:630149623831:web:2a8c6c99e4ab7bb8c8b9ba"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkEmployeeData() {
  try {
    console.log('🔍 従業員データ確認開始...\n');
    
    // 全従業員データを取得
    const employeesSnapshot = await getDocs(collection(db, 'employees'));
    
    if (employeesSnapshot.empty) {
      console.log('従業員データが見つかりません');
      return;
    }
    
    console.log(`従業員データ数: ${employeesSnapshot.size}\n`);
    
    let statusMissingCount = 0;
    let tempPasswordMissingCount = 0;
    let uidMissingCount = 0;
    let statusCounts = {};
    
    employeesSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      
      console.log(`--- 従業員 ${index + 1} ---`);
      console.log('ID:', doc.id);
      console.log('名前:', data.name || 'N/A');
      console.log('メール:', data.email || 'N/A');
      console.log('従業員ID:', data.employeeId || 'N/A');
      console.log('ステータス:', data.status || '❌ 未設定');
      console.log('UID:', data.uid ? '✅ 設定済み' : '❌ 未設定');
      console.log('仮パスワード:', data.tempPassword ? '✅ 設定済み' : '❌ 未設定');
      console.log('初回ログイン:', data.isFirstLogin !== undefined ? data.isFirstLogin : '❌ 未設定');
      console.log('作成日:', data.createdAt ? data.createdAt.toDate().toLocaleString('ja-JP') : 'N/A');
      console.log('');
      
      // 統計集計
      if (!data.status) statusMissingCount++;
      if (!data.tempPassword) tempPasswordMissingCount++;
      if (!data.uid) uidMissingCount++;
      
      const status = data.status || '未設定';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('=== 集計結果 ===');
    console.log(`status未設定: ${statusMissingCount}件`);
    console.log(`tempPassword未設定: ${tempPasswordMissingCount}件`);
    console.log(`uid未設定: ${uidMissingCount}件`);
    console.log('\nステータス別集計:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}件`);
    });
    
    console.log('\n=== 予想される修正内容 ===');
    console.log(`✅ status未設定の${statusMissingCount}件に適切なstatusを設定`);
    console.log(`📧 preparation状態の従業員で招待ボタンが表示される`);
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkEmployeeData(); 