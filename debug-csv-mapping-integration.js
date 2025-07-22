// debug-csv-mapping-integration.js
// CSVマッピング設定とCSVアップロード設定の統合問題を調査するスクリプト

const admin = require('firebase-admin');

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'kyuyoprint'
  });
}

const db = admin.firestore();

async function debugCSVMappingIntegration() {
  console.log('=== CSVマッピング設定とアップロード設定の統合調査 ===\n');
  
  try {
    // すべての会社のCSVマッピング設定を取得
    const csvMappingsSnapshot = await db.collection('csvMappings').get();
    
    console.log(`CSVマッピング設定数: ${csvMappingsSnapshot.size}件\n`);
    
    for (const doc of csvMappingsSnapshot.docs) {
      const companyId = doc.id;
      const mappingData = doc.data();
      
      console.log(`--- 会社ID: ${companyId} ---`);
      
      // CSVマッピング設定の基本項目を確認
      const mainFields = mappingData.mainFields || {};
      const employeeCode = mainFields.employeeCode || {};
      const departmentCode = mainFields.departmentCode || {};
      
      console.log('CSVマッピング設定:');
      console.log(`  従業員コード: ${JSON.stringify(employeeCode)}`);
      console.log(`  部門コード: ${JSON.stringify(departmentCode)}`);
      
      // CSVアップロード設定を確認
      const csvSettingsDoc = await db.collection('csvSettings').doc(companyId).get();
      let csvSettings = {};
      if (csvSettingsDoc.exists()) {
        csvSettings = csvSettingsDoc.data();
      }
      
      console.log('CSVアップロード設定:');
      console.log(`  employeeIdColumn: ${csvSettings.employeeIdColumn || '未設定'}`);
      console.log(`  departmentCodeColumn: ${csvSettings.departmentCodeColumn || '未設定'}`);
      
      // employeeMapping設定も確認
      const employeeMapping = mappingData.employeeMapping || {};
      console.log('employeeMapping設定:');
      console.log(`  employeeIdColumn: ${employeeMapping.employeeIdColumn || '未設定'}`);
      console.log(`  departmentCodeColumn: ${employeeMapping.departmentCodeColumn || '未設定'}`);
      
      // 設定の一致状況を分析
      console.log('\n設定統合状況の分析:');
      
      // 従業員コード設定の統合状況
      const employeeCodeHeader = employeeCode.columnIndex >= 0 ? 
        `ヘッダー: ${employeeCode.headerName}` : 
        `手動: ${employeeCode.headerName}`;
      
      const employeeIdFromSettings = csvSettings.employeeIdColumn || employeeMapping.employeeIdColumn;
      
      console.log(`  従業員コード設定統合:`);
      console.log(`    マッピング設定: ${employeeCodeHeader}`);
      console.log(`    アップロード設定: ${employeeIdFromSettings || '未設定'}`);
      console.log(`    統合状況: ${employeeCode.headerName === employeeIdFromSettings ? '✅ 一致' : '❌ 不一致'}`);
      
      // 部門コード設定の統合状況
      const departmentCodeHeader = departmentCode.columnIndex >= 0 ? 
        `ヘッダー: ${departmentCode.headerName}` : 
        departmentCode.headerName ? `手動: ${departmentCode.headerName}` : '未設定';
      
      const departmentCodeFromSettings = csvSettings.departmentCodeColumn || employeeMapping.departmentCodeColumn;
      
      console.log(`  部門コード設定統合:`);
      console.log(`    マッピング設定: ${departmentCodeHeader}`);
      console.log(`    アップロード設定: ${departmentCodeFromSettings || '未設定'}`);
      console.log(`    統合状況: ${departmentCode.headerName === departmentCodeFromSettings ? '✅ 一致' : '❌ 不一致'}`);
      
      // 最近のCSVアップロード履歴を確認
      const recentUploadsSnapshot = await db.collection('csvUploads')
        .where('companyId', '==', companyId)
        .orderBy('uploadDate', 'desc')
        .limit(3)
        .get();
      
      console.log(`\n最近のCSVアップロード履歴 (${recentUploadsSnapshot.size}件):`);
      
      recentUploadsSnapshot.docs.forEach((uploadDoc, index) => {
        const uploadData = uploadDoc.data();
        console.log(`  ${index + 1}. ${uploadData.fileName} (${uploadData.uploadDate?.toDate().toLocaleDateString()})`);
        console.log(`     employeeIdColumn: ${uploadData.employeeIdColumn || '未設定'}`);
        console.log(`     departmentCodeColumn: ${uploadData.departmentCodeColumn || '未設定'}`);
      });
      
      // 最近の給与明細データを確認
      const recentPayslipsSnapshot = await db.collection('payslips')
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();
      
      console.log(`\n最近の給与明細データ (${recentPayslipsSnapshot.size}件):`);
      
      recentPayslipsSnapshot.docs.forEach((payslipDoc, index) => {
        const payslipData = payslipDoc.data();
        console.log(`  ${index + 1}. 給与明細ID: ${payslipDoc.id}`);
        console.log(`     employeeId: ${payslipData.employeeId || '未設定'}`);
        console.log(`     departmentCode: ${payslipData.departmentCode || '未設定'}`);
        console.log(`     userId: ${payslipData.userId || '未設定'}`);
      });
      
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
    // 統合問題の解決策を提案
    console.log('=== 統合問題の解決策 ===');
    console.log('1. CSVマッピング設定での従業員コード・部門コード設定を');
    console.log('   CSVアップロード時にも自動で使用するように統合する');
    console.log('2. 設定の重複を解消し、一元管理する');
    console.log('3. 既存のアップロード設定を自動マイグレーションする');
    
  } catch (error) {
    console.error('調査エラー:', error);
  }
}

// 設定統合修正の提案
async function proposeIntegrationFix() {
  console.log('\n=== 統合修正の実装提案 ===');
  
  console.log(`
修正方針:
1. useFileUpload.js を修正して、CSVマッピング設定から従業員コード・部門コードの情報を取得
2. buildUploadInfo関数で、マッピング設定を優先して employeeIdColumn と departmentCodeColumn を設定
3. 既存の重複設定は後方互換性のため残すが、マッピング設定を優先

修正が必要なファイル:
- src/pages/CsvUpload/hooks/useFileUpload.js
- src/pages/CsvUpload/utils/csvProcessor.js
- src/pages/CsvUpload/utils/fetchMappings.js
  `);
}

// メイン実行
debugCSVMappingIntegration()
  .then(() => proposeIntegrationFix())
  .then(() => {
    console.log('\n調査完了');
    process.exit(0);
  })
  .catch(error => {
    console.error('実行エラー:', error);
    process.exit(1);
  }); 