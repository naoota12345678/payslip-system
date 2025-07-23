// 既存従業員データのstatus修正スクリプト
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');

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

async function fixEmployeeStatus() {
  try {
    console.log('🔧 既存従業員データのstatus修正開始...');
    
    // 全従業員データを取得
    const employeesSnapshot = await getDocs(collection(db, 'employees'));
    
    if (employeesSnapshot.empty) {
      console.log('従業員データが見つかりません');
      return;
    }
    
    console.log(`従業員データ数: ${employeesSnapshot.size}`);
    
    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    
    for (const employeeDoc of employeesSnapshot.docs) {
      const data = employeeDoc.data();
      
      console.log(`\n--- 処理中: ${data.name || data.employeeId || employeeDoc.id} ---`);
      console.log('現在のstatus:', data.status || '未設定');
      console.log('uid:', data.uid || '未設定');
      console.log('tempPassword:', data.tempPassword ? '設定済み' : '未設定');
      
      // statusが未設定の場合の処理
      if (!data.status) {
        let newStatus;
        let updateData = {};
        
        if (data.uid) {
          // uidがある = Firebase Authユーザーが作成済み = アクティブ
          newStatus = 'active';
          updateData = {
            status: 'active',
            isFirstLogin: false,
            tempPassword: null,
            updatedAt: new Date()
          };
        } else if (data.tempPassword) {
          // 仮パスワードがある = 招待可能状態
          newStatus = 'preparation';
          updateData = {
            status: 'preparation',
            isFirstLogin: true,
            updatedAt: new Date()
          };
        } else {
          // 何もない = 準備中として設定し、仮パスワード生成
          const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase();
          newStatus = 'preparation';
          updateData = {
            status: 'preparation',
            isFirstLogin: true,
            tempPassword: tempPassword,
            updatedAt: new Date()
          };
        }
        
        await updateDoc(doc(db, 'employees', employeeDoc.id), updateData);
        console.log(`✅ ステータス更新: ${newStatus}`);
        updatedCount++;
      } else {
        console.log('✓ ステータス設定済み');
        alreadyCorrectCount++;
      }
    }
    
    console.log('\n=== 修正完了 ===');
    console.log(`更新済み: ${updatedCount}件`);
    console.log(`設定済み: ${alreadyCorrectCount}件`);
    console.log('合計:', employeesSnapshot.size, '件');
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// 実行確認
console.log('既存従業員データのstatus修正を実行しますか？');
console.log('このスクリプトは以下を行います:');
console.log('1. statusが未設定の従業員にstatusを設定');
console.log('2. uidがある従業員 → active');
console.log('3. uidがない従業員 → preparation + 仮パスワード生成');
console.log('');
console.log('実行するには: node fix-employee-status.js run');

if (process.argv[2] === 'run') {
  fixEmployeeStatus();
} else {
  console.log('実行がキャンセルされました');
} 