// 一時的なデバッグスクリプト - Firestoreのマッピングデータを調査
const admin = require('firebase-admin');

// Firebase Admin SDK の初期化
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'kyuyoprint'
  });
}

const db = admin.firestore();

async function investigateMappingData() {
  console.log('=== Firestoreマッピングデータ調査開始 ===');
  
  try {
    // 会社IDを仮定（実際の値に置き換える必要があります）
    const companyId = 'YOUR_COMPANY_ID'; // 実際の会社IDに置き換え
    
    console.log('\n1. csvMappings コレクションの確認...');
    const csvMappingsDoc = await db.collection('csvMappings').doc(companyId).get();
    if (csvMappingsDoc.exists) {
      console.log('csvMappings データ:', JSON.stringify(csvMappingsDoc.data(), null, 2));
    } else {
      console.log('csvMappings: ドキュメントが存在しません');
    }
    
    console.log('\n2. csvMapping コレクションの確認...');
    const csvMappingDoc = await db.collection('csvMapping').doc(companyId).get();
    if (csvMappingDoc.exists) {
      console.log('csvMapping データ:', JSON.stringify(csvMappingDoc.data(), null, 2));
    } else {
      console.log('csvMapping: ドキュメントが存在しません');
    }
    
    console.log('\n3. csvSettings コレクションの確認...');
    const csvSettingsDoc = await db.collection('csvSettings').doc(companyId).get();
    if (csvSettingsDoc.exists) {
      console.log('csvSettings データ:', JSON.stringify(csvSettingsDoc.data(), null, 2));
    } else {
      console.log('csvSettings: ドキュメントが存在しません');
    }
    
  } catch (error) {
    console.error('調査中にエラーが発生しました:', error);
  }
}

// スクリプトを実行
investigateMappingData().then(() => {
  console.log('\n=== 調査完了 ===');
  process.exit(0);
}).catch(error => {
  console.error('調査失敗:', error);
  process.exit(1);
}); 