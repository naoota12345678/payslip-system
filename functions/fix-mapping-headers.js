const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function fixMappingHeaders() {
  try {
    console.log('=== CSVマッピング設定のヘッダー修正 ===');
    
    const csvMappingRef = db.collection('csvMappings');
    const snapshot = await csvMappingRef.get();
    
    if (snapshot.empty) {
      console.log('❌ csvMappingsコレクションは空です');
      return;
    }
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      let hasChanges = false;
      const newData = { ...data };
      
      console.log('\n🔍 会社ID:', doc.id);
      
      if (data.csvMapping && data.csvMapping.deductionItems) {
        console.log('控除項目を修正中...');
        
        newData.csvMapping.deductionItems = data.csvMapping.deductionItems.map(item => {
          // 所得税の項目を修正
          if (item.itemName && item.itemName.includes('所得税') && item.headerName === 'KY21_5') {
            console.log(`✅ 所得税のヘッダーを修正: ${item.headerName} → KY22_6`);
            hasChanges = true;
            return { ...item, headerName: 'KY22_6' };
          }
          // 住民税の項目を修正
          if (item.itemName && item.itemName.includes('住民税') && item.headerName === 'KY21_6') {
            console.log(`✅ 住民税のヘッダーを修正: ${item.headerName} → KY22_7`);
            hasChanges = true;
            return { ...item, headerName: 'KY22_7' };
          }
          return item;
        });
        
        if (hasChanges) {
          // 更新されたデータを保存
          await doc.ref.update(newData);
          console.log('✅ マッピング設定を保存しました');
        } else {
          console.log('ℹ️ 修正が必要な項目が見つかりませんでした');
        }
      }
    }
    
    console.log('\n✅ マッピング設定の修正が完了しました');
    process.exit(0);
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

fixMappingHeaders(); 