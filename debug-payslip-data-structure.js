const admin = require('firebase-admin');

// Firebase Admin SDK を初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'kyuyoprint'
  });
}

const db = admin.firestore();

const TARGET_COMPANY_ID = 'pgvZMsJwTYUXS2YZugty8bIasiR2';

async function debugPayslipDataStructure() {
  try {
    console.log('=== 給与明細データ構造デバッグ開始 ===');
    console.log('対象会社ID:', TARGET_COMPANY_ID);
    
    // 1. csvMappingsコレクションの確認
    console.log('\n--- 1. CSVマッピング設定の確認 ---');
    const mappingDoc = await db.collection('csvMappings').doc(TARGET_COMPANY_ID).get();
    
    if (mappingDoc.exists()) {
      const mappingData = mappingDoc.data();
      console.log('✅ csvMappings存在');
      console.log('データ構造:', Object.keys(mappingData));
      
      // シンプルマッピングの確認
      if (mappingData.simpleMapping) {
        console.log('\n📋 シンプルマッピング設定:');
        console.log('項目数:', Object.keys(mappingData.simpleMapping).length);
        console.log('KY22_5の設定:', mappingData.simpleMapping['KY22_5'] || '❌未設定');
        console.log('最初の5件:', Object.entries(mappingData.simpleMapping).slice(0, 5));
      } else {
        console.log('❌ simpleMapping設定なし');
      }
      
      // 従来形式の確認
      ['incomeItems', 'deductionItems', 'attendanceItems', 'kyItems', 'itemCodeItems'].forEach(category => {
        if (mappingData[category] && Array.isArray(mappingData[category])) {
          console.log(`\n${category}: ${mappingData[category].length}件`);
          const ky22Items = mappingData[category].filter(item => 
            item.headerName && item.headerName.includes('KY22'));
          if (ky22Items.length > 0) {
            console.log(`  KY22系: ${ky22Items.length}件`);
            ky22Items.forEach(item => {
              console.log(`    ${item.headerName} → ${item.itemName} (visible: ${item.isVisible})`);
            });
          }
        }
      });
    } else {
      console.log('❌ csvMappings設定なし');
    }
    
    // 2. payslipsコレクションの確認
    console.log('\n--- 2. 給与明細データの確認 ---');
    const payslipsSnapshot = await db.collection('payslips')
      .where('companyId', '==', TARGET_COMPANY_ID)
      .limit(3)
      .get();
    
    console.log(`給与明細データ件数: ${payslipsSnapshot.size}件`);
    
    payslipsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n📄 給与明細 ${index + 1} (ID: ${doc.id})`);
      console.log('基本情報:', {
        employeeId: data.employeeId,
        userId: data.userId,
        totalIncome: data.totalIncome,
        totalDeduction: data.totalDeduction,
        netAmount: data.netAmount
      });
      
      // itemsの構造確認
      if (data.items) {
        console.log('items構造タイプ:', typeof data.items);
        console.log('items項目数:', Object.keys(data.items).length);
        
        // 最初の5項目の構造を確認
        const itemEntries = Object.entries(data.items).slice(0, 5);
        console.log('最初の5項目:');
        itemEntries.forEach(([key, value]) => {
          console.log(`  ${key}:`, {
            type: typeof value,
            value: value,
            isObject: typeof value === 'object',
            hasValueProperty: typeof value === 'object' && value !== null && 'value' in value
          });
        });
        
        // KY22_5の存在確認
        if (data.items['KY22_5']) {
          console.log('🎯 KY22_5の値:', data.items['KY22_5']);
        } else {
          console.log('❌ KY22_5項目なし');
        }
        
        // KY22系項目の一覧
        const ky22Items = Object.keys(data.items).filter(key => key.includes('KY22'));
        if (ky22Items.length > 0) {
          console.log(`KY22系項目 (${ky22Items.length}件):`, ky22Items.slice(0, 10));
        }
      } else {
        console.log('❌ items データなし');
      }
      
      // itemCategoriesとitemVisibilityの確認
      if (data.itemCategories) {
        console.log('itemCategories設定数:', Object.keys(data.itemCategories).length);
      }
      if (data.itemVisibility) {
        console.log('itemVisibility設定数:', Object.keys(data.itemVisibility).length);
      }
      
      // csvDataの確認
      if (data.csvData) {
        console.log('csvData存在:', typeof data.csvData);
        console.log('csvDataキー数:', Object.keys(data.csvData).length);
      }
    });
    
    // 3. 問題の特定
    console.log('\n--- 3. 問題分析 ---');
    console.log('🔍 データ構造の整合性確認完了');
    
    console.log('\n=== デバッグ終了 ===');
    
  } catch (error) {
    console.error('デバッグエラー:', error);
  }
}

debugPayslipDataStructure(); 