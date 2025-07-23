const admin = require('firebase-admin');

// Firebase Admin SDKを初期化
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'kyuyoprint'
});

const db = admin.firestore();

async function checkEmployeeStatus() {
  try {
    console.log('=== 従業員データ確認 ===');
    
    // 従業員データを取得
    const snapshot = await db.collection('employees').limit(10).get();
    
    if (snapshot.empty) {
      console.log('従業員データが見つかりません');
      return;
    }
    
    console.log(`従業員データ数: ${snapshot.size}`);
    console.log('');
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`--- 従業員 ${index + 1} ---`);
      console.log('ID:', doc.id);
      console.log('名前:', data.name || 'N/A');
      console.log('メール:', data.email || 'N/A');
      console.log('従業員ID:', data.employeeId || 'N/A');
      console.log('ステータス:', data.status || '未設定');
      console.log('isFirstLogin:', data.isFirstLogin);
      console.log('tempPassword:', data.tempPassword ? '設定済み' : '未設定');
      console.log('uid:', data.uid || '未設定');
      console.log('作成日:', data.createdAt ? data.createdAt.toDate().toLocaleString('ja-JP') : 'N/A');
      console.log('');
    });
    
  } catch (error) {
    console.error('エラー:', error.message);
  }
  
  process.exit(0);
}

checkEmployeeStatus(); 