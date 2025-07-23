// fix-mapping-data-structure.js
// csvMappingsコレクションのitemNameとheaderNameの入れ替え問題を修正

const admin = require('firebase-admin');

// Firebase Admin SDKの初期化
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'kyuyoprint'
});

const db = admin.firestore();

async function fixMappingDataStructure() {
  try {
    console.log('=== csvMappingsデータ修正開始 ===');
    
    // csvMappingsコレクションの全ドキュメントを取得
    const snapshot = await db.collection('csvMappings').get();
    
    if (snapshot.empty) {
      console.log('csvMappingsコレクションにデータがありません');
      return;
    }
    
    console.log(`${snapshot.docs.length}件のドキュメントを処理します`);
    
    for (const docSnapshot of snapshot.docs) {
      const companyId = docSnapshot.id;
      const data = docSnapshot.data();
      
      console.log(`\n--- 会社ID: ${companyId} ---`);
      
      let hasChanges = false;
      const fixedData = { ...data };
      
      // 各カテゴリを処理
      const categories = ['incomeItems', 'deductionItems', 'attendanceItems', 'itemCodeItems'];
      
      for (const category of categories) {
        if (data[category] && Array.isArray(data[category])) {
          console.log(`${category}: ${data[category].length}件`);
          
          fixedData[category] = data[category].map((item, index) => {
            // itemNameが項目コード（KY03など）で、headerNameが日本語の場合は入れ替え
            if (item.itemName && item.headerName &&
                /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.itemName) &&
                !/^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.headerName)) {
              
              console.log(`  [${index}] 修正: headerName="${item.headerName}" ↔ itemName="${item.itemName}"`);
              hasChanges = true;
              
              return {
                ...item,
                headerName: item.itemName,  // 項目コードをheaderNameに
                itemName: item.headerName   // 日本語名をitemNameに
              };
            }
            
            return item;
          });
        }
      }
      
      // mainFieldsも修正
      if (data.mainFields) {
        console.log('mainFields を確認中...');
        const fixedMainFields = { ...data.mainFields };
        
        for (const [fieldName, field] of Object.entries(data.mainFields)) {
          if (field && field.headerName && field.itemName &&
              /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(field.itemName) &&
              !/^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(field.headerName)) {
            
            console.log(`  mainFields.${fieldName}: headerName="${field.headerName}" ↔ itemName="${field.itemName}"`);
            hasChanges = true;
            
            fixedMainFields[fieldName] = {
              ...field,
              headerName: field.itemName,  // 項目コードをheaderNameに
              itemName: field.headerName   // 日本語名をitemNameに
            };
          }
        }
        
        fixedData.mainFields = fixedMainFields;
      }
      
      // 変更があった場合のみ更新
      if (hasChanges) {
        console.log(`✅ 会社ID: ${companyId} のデータを修正して保存`);
        await db.collection('csvMappings').doc(companyId).set({
          ...fixedData,
          fixedAt: admin.firestore.Timestamp.now(),
          fixNote: 'itemNameとheaderNameの入れ替え問題を修正'
        });
      } else {
        console.log(`ℹ️ 会社ID: ${companyId} は修正不要`);
      }
    }
    
    console.log('\n=== 修正完了 ===');
    
  } catch (error) {
    console.error('修正処理エラー:', error);
  } finally {
    // 接続を閉じる
    admin.app().delete();
  }
}

// スクリプトを実行
fixMappingDataStructure(); 