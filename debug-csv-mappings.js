const admin = require('firebase-admin');

// Firebase Admin SDK を初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'kyuyoprint'
  });
}

const db = admin.firestore();

async function debugCsvMappings() {
  try {
    console.log('=== csvMappingsコレクション デバッグ開始 ===');
    
    // csvMappingsコレクション全体を取得
    const mappingsSnapshot = await db.collection('csvMappings').get();
    
    console.log(`csvMappings ドキュメント数: ${mappingsSnapshot.size}`);
    
    mappingsSnapshot.forEach((doc) => {
      console.log(`\n--- ドキュメントID: ${doc.id} ---`);
      const data = doc.data();
      
      console.log('データ構造:');
      console.log('- キー一覧:', Object.keys(data));
      
      // mappingsフィールドがあるかチェック
      if (data.mappings) {
        console.log('- mappingsフィールド: あり');
        console.log('- mappingsタイプ:', typeof data.mappings);
        if (typeof data.mappings === 'object') {
          console.log('- mappingsキー数:', Object.keys(data.mappings).length);
          console.log('- mappingsキー例:', Object.keys(data.mappings).slice(0, 5));
          
          // 最初のマッピングアイテムの構造を確認
          const firstKey = Object.keys(data.mappings)[0];
          if (firstKey) {
            console.log(`- 最初のマッピング (${firstKey}):`, data.mappings[firstKey]);
          }
        }
      } else {
        console.log('- mappingsフィールド: なし');
      }
      
      // 配列形式のフィールドもチェック
      ['incomeItems', 'deductionItems', 'attendanceItems'].forEach(field => {
        if (data[field]) {
          console.log(`- ${field}: 配列長 ${data[field].length}`);
          if (data[field].length > 0) {
            console.log(`  - 最初の項目:`, data[field][0]);
          }
        }
      });
      
      // csvMappingネスト構造もチェック
      if (data.csvMapping) {
        console.log('- csvMappingフィールド: あり');
        console.log('- csvMappingキー一覧:', Object.keys(data.csvMapping));
      }
      
      console.log('- 完全なデータ:', JSON.stringify(data, null, 2));
    });
    
    console.log('\n=== csvMappingsコレクション デバッグ終了 ===');
    
  } catch (error) {
    console.error('デバッグエラー:', error);
  }
}

debugCsvMappings(); 