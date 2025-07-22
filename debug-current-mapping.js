const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkCurrentMapping() {
  try {
    console.log('=== 現在のCSVマッピング設定の確認 ===');
    
    const csvMappingRef = db.collection('csvMappings');
    const snapshot = await csvMappingRef.get();
    
    if (snapshot.empty) {
      console.log('❌ csvMappingsコレクションは空です');
      return;
    }
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('\n🔍 会社ID:', doc.id);
      
      if (data.csvMapping && data.csvMapping.deductionItems) {
        console.log('\n💰 控除項目の詳細:');
        data.csvMapping.deductionItems.forEach((item, index) => {
          console.log(`  ${index}: ${item.headerName} → ${item.itemName} (visible: ${item.isVisible})`);
        });
        
        // 所得税と住民税の項目を特定
        const shotokuzei = data.csvMapping.deductionItems.find(item => 
          item.itemName && item.itemName.includes('所得税')
        );
        const juminzei = data.csvMapping.deductionItems.find(item => 
          item.itemName && item.itemName.includes('住民税')
        );
        
        console.log('\n🎯 重要項目の確認:');
        if (shotokuzei) {
          console.log(`  所得税: ${shotokuzei.headerName} → ${shotokuzei.itemName}`);
        }
        if (juminzei) {
          console.log(`  住民税: ${juminzei.headerName} → ${juminzei.itemName}`);
        }
        
        // KY22_6とKY22_7の項目を探す
        const ky22_6 = data.csvMapping.deductionItems.find(item => 
          item.headerName === 'KY22_6'
        );
        const ky22_7 = data.csvMapping.deductionItems.find(item => 
          item.headerName === 'KY22_7'
        );
        
        console.log('\n🔍 KY22系項目の確認:');
        if (ky22_6) {
          console.log(`  KY22_6: ${ky22_6.headerName} → ${ky22_6.itemName}`);
        } else {
          console.log('  KY22_6: 見つかりません');
        }
        if (ky22_7) {
          console.log(`  KY22_7: ${ky22_7.headerName} → ${ky22_7.itemName}`);
        } else {
          console.log('  KY22_7: 見つかりません');
        }
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

checkCurrentMapping(); 