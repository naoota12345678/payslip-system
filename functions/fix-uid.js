// Firebase Functions環境で従業員UIDを修正するスクリプット
const admin = require('firebase-admin');

// Firebase Admin SDKが既に初期化されていない場合のみ初期化
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

async function fixEmployeeUIDs() {
  try {
    console.log('🔧 従業員データのUID修正を開始...');
    
    // 全ての従業員を取得
    const employeesSnapshot = await db.collection('employees').get();
    console.log(`📊 ${employeesSnapshot.size}件の従業員データを確認中...`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const doc of employeesSnapshot.docs) {
      const employeeData = doc.data();
      const docId = doc.id;
      
      // UIDが既に設定されている場合はスキップ
      if (employeeData.uid) {
        console.log(`⏭️  スキップ: ${employeeData.email} (UID既に設定済み)`);
        skippedCount++;
        continue;
      }
      
      // メールアドレスがない場合はスキップ
      if (!employeeData.email) {
        console.log(`⚠️  スキップ: ${docId} (メールアドレスなし)`);
        skippedCount++;
        continue;
      }
      
      try {
        // Firebase Authでユーザーをメールアドレスで検索
        const userRecord = await auth.getUserByEmail(employeeData.email);
        
        // Firestoreドキュメントを更新
        await doc.ref.update({
          uid: userRecord.uid,
          status: 'auth_created',
          isFirstLogin: true,
          tempPassword: '000000',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ 修正完了: ${employeeData.email} -> UID: ${userRecord.uid}`);
        fixedCount++;
        
      } catch (authError) {
        if (authError.code === 'auth/user-not-found') {
          console.log(`❌ 未修正: ${employeeData.email} (Firebase Authユーザーが存在しません)`);
        } else {
          console.error(`❌ エラー: ${employeeData.email}`, authError.message);
        }
        skippedCount++;
      }
    }
    
    console.log(`\n🎉 修正完了:`);
    console.log(`  - 修正件数: ${fixedCount}件`);
    console.log(`  - スキップ件数: ${skippedCount}件`);
    console.log(`  - 合計: ${fixedCount + skippedCount}件`);
    
    return { fixed: fixedCount, skipped: skippedCount };
    
  } catch (error) {
    console.error('❌ 全体的なエラー:', error);
    throw error;
  }
}

// Cloud Functionsとして実行する場合
exports.fixEmployeeUIDs = fixEmployeeUIDs;

// 直接実行する場合
if (require.main === module) {
  fixEmployeeUIDs()
    .then((result) => {
      console.log('✅ 処理完了:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 処理失敗:', error);
      process.exit(1);
    });
}