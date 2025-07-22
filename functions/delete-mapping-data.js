const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function deleteMappingData() {
  try {
    console.log('=== CSVマッピング設定の完全削除開始 ===');
    
    const csvMappingRef = db.collection('csvMappings');
    const snapshot = await csvMappingRef.get();
    
    if (snapshot.empty) {
      console.log('❌ csvMappingsコレクションは空です');
      return;
    }
    
    console.log(`📄 ${snapshot.docs.length}個のマッピング設定を削除します`);
    
    for (const doc of snapshot.docs) {
      console.log(`🗑️ 削除中: ${doc.id}`);
      await doc.ref.delete();
      console.log(`✅ 削除完了: ${doc.id}`);
    }
    
    console.log('✅ すべてのCSVマッピング設定を削除しました');
    process.exit(0);
  } catch (error) {
    console.error('❌ 削除エラー:', error);
    process.exit(1);
  }
}

deleteMappingData(); 