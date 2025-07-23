// debug-mapping-data.js
// csvMappingsコレクションの現在のデータ構造を詳しく確認

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

// Firebase設定
const firebaseConfig = {
  projectId: 'kyuyoprint'
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugMappingData() {
  try {
    console.log('=== csvMappingsデータ詳細確認 ===');
    
    // 会社IDを指定（実際の会社IDに変更してください）
    const companyId = 'your-company-id'; // ここを実際の会社IDに変更
    
    const mappingDoc = await getDoc(doc(db, 'csvMappings', companyId));
    
    if (!mappingDoc.exists()) {
      console.log('❌ マッピングデータが見つかりません');
      return;
    }
    
    const data = mappingDoc.data();
    console.log('📊 マッピングデータ全体:');
    console.log(JSON.stringify(data, null, 2));
    
    // 各カテゴリの詳細を確認
    console.log('\n=== 詳細分析 ===');
    
    const categories = ['incomeItems', 'deductionItems', 'attendanceItems', 'itemCodeItems'];
    
    categories.forEach(category => {
      if (data[category] && Array.isArray(data[category])) {
        console.log(`\n📋 ${category}: ${data[category].length}件`);
        
        data[category].slice(0, 5).forEach((item, index) => {
          console.log(`  [${index}] headerName="${item.headerName}", itemName="${item.itemName}", isVisible=${item.isVisible}`);
          
          // 問題のあるデータをチェック
          if (item.itemName && item.headerName) {
            const itemIsCode = /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.itemName);
            const headerIsCode = /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.headerName);
            
            if (itemIsCode && !headerIsCode) {
              console.log(`    🚨 問題発見: itemNameが項目コード、headerNameが日本語`);
            } else if (!itemIsCode && headerIsCode) {
              console.log(`    ✅ 正常: headerNameが項目コード、itemNameが日本語`);
            } else if (itemIsCode && headerIsCode) {
              console.log(`    ❓ 両方とも項目コード`);
            } else {
              console.log(`    ❓ 両方とも日本語`);
            }
          }
        });
      }
    });
    
    console.log('\n=== 修正が必要な項目の検出 ===');
    
    let needsFix = false;
    categories.forEach(category => {
      if (data[category] && Array.isArray(data[category])) {
        data[category].forEach((item, index) => {
          if (item.itemName && item.headerName &&
              /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.itemName) &&
              !/^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.headerName)) {
            
            console.log(`🔧 修正対象: ${category}[${index}] headerName="${item.headerName}" ↔ itemName="${item.itemName}"`);
            needsFix = true;
          }
        });
      }
    });
    
    if (!needsFix) {
      console.log('✅ 修正が必要な項目は見つかりませんでした');
    }
    
  } catch (error) {
    console.error('確認処理エラー:', error);
  }
}

// スクリプトを実行
debugMappingData(); 