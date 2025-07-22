// Firestoreのマッピング関連データをクリーンアップするスクリプト
const admin = require('firebase-admin');

// Firebase Admin SDK の初期化
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'kyuyoprint'
  });
}

const db = admin.firestore();

async function cleanupMappingData() {
  console.log('=== マッピングデータクリーンアップ開始 ===');
  
  try {
    // 削除対象のコレクション
    const collectionsToClean = [
      'csvMapping',      // 単数形（旧）
      'csvMappings',     // 複数形（新）
      'csvSettings',     // 従業員CSV設定
    ];
    
    // 全ての会社のドキュメントを削除
    for (const collectionName of collectionsToClean) {
      console.log(`\n${collectionName} コレクションをクリーンアップ中...`);
      
      const snapshot = await db.collection(collectionName).get();
      console.log(`  - ${snapshot.size} ドキュメントが見つかりました`);
      
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        console.log(`  - 削除: ${doc.id}`);
        batch.delete(doc.ref);
      });
      
      if (snapshot.size > 0) {
        await batch.commit();
        console.log(`  ✓ ${collectionName} コレクションをクリーンアップしました`);
      } else {
        console.log(`  - ${collectionName} は既に空です`);
      }
    }
    
    console.log('\n=== クリーンアップ完了 ===');
    console.log('次のステップ:');
    console.log('1. CSVマッピング設定画面でヘッダーをアップロード');
    console.log('2. 各項目に日本語名を設定');
    console.log('3. 設定を保存');
    
  } catch (error) {
    console.error('クリーンアップ中にエラーが発生しました:', error);
  }
}

// 確認メッセージ
console.log('⚠️  重要: このスクリプトはマッピング設定データを削除します');
console.log('給与明細や従業員データは削除されません');
console.log('続行するには、以下のコマンドでスクリプトを実行してください:');
console.log('node cleanup-mapping-data.js');

// 実際の削除は手動実行時のみ
if (process.argv.includes('--execute')) {
  cleanupMappingData().then(() => {
    console.log('\n=== スクリプト終了 ===');
    process.exit(0);
  }).catch(error => {
    console.error('スクリプト実行失敗:', error);
    process.exit(1);
  });
} else {
  console.log('\n実行するには --execute フラグを追加してください:');
  console.log('node cleanup-mapping-data.js --execute');
} 