// 給与明細と従業員情報の紐づけ問題を診断するスクリプト

const admin = require('firebase-admin');
const serviceAccount = require('./functions/serviceAccountKey.json'); // サービスアカウントキーのパス

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'your-project-id.appspot.com' // 実際のプロジェクトIDに置換
});

const db = admin.firestore();

async function diagnoseMappingIssues() {
  try {
    console.log('=== 給与明細と従業員情報の紐づけ診断 ===\n');

    // 1. 会社一覧を取得
    console.log('1. 会社情報の確認...');
    const companiesSnapshot = await db.collection('companies').get();
    if (companiesSnapshot.empty) {
      console.log('❌ 会社情報が見つかりません');
      return;
    }

    for (const companyDoc of companiesSnapshot.docs) {
      const companyData = companyDoc.data();
      const companyId = companyDoc.id;
      
      console.log(`\n--- 会社: ${companyData.name || companyId} ---`);
      
      // 2. この会社のユーザー情報を確認
      console.log('2. ユーザー情報の確認...');
      const usersSnapshot = await db.collection('users')
        .where('companyId', '==', companyId)
        .get();
      
      console.log(`   登録ユーザー数: ${usersSnapshot.size}名`);
      
      const usersByEmployeeId = {};
      const usersWithoutEmployeeId = [];
      
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.employeeId) {
          usersByEmployeeId[userData.employeeId] = {
            userId: doc.id,
            email: userData.email,
            displayName: userData.displayName || userData.name,
            userType: userData.userType
          };
        } else {
          usersWithoutEmployeeId.push({
            userId: doc.id,
            email: userData.email,
            displayName: userData.displayName || userData.name
          });
        }
      });
      
      console.log(`   従業員ID付きユーザー: ${Object.keys(usersByEmployeeId).length}名`);
      console.log(`   従業員ID不備ユーザー: ${usersWithoutEmployeeId.length}名`);
      
      if (usersWithoutEmployeeId.length > 0) {
        console.log('   ⚠️  従業員IDが設定されていないユーザー:');
        usersWithoutEmployeeId.forEach(user => {
          console.log(`      - ${user.email} (${user.displayName || 'N/A'})`);
        });
      }
      
      // 3. この会社の給与明細を確認
      console.log('\n3. 給与明細データの確認...');
      const payslipsSnapshot = await db.collection('payslips')
        .where('companyId', '==', companyId)
        .limit(50) // 最新50件をチェック
        .get();
      
      console.log(`   給与明細数: ${payslipsSnapshot.size}件`);
      
      const payslipsWithUserId = [];
      const payslipsWithoutUserId = [];
      const employeeIdMismatches = [];
      
      payslipsSnapshot.docs.forEach(doc => {
        const payslipData = doc.data();
        
        if (payslipData.userId) {
          payslipsWithUserId.push({
            id: doc.id,
            employeeId: payslipData.employeeId,
            userId: payslipData.userId,
            paymentDate: payslipData.paymentDate?.toDate()
          });
        } else {
          payslipsWithoutUserId.push({
            id: doc.id,
            employeeId: payslipData.employeeId,
            paymentDate: payslipData.paymentDate?.toDate()
          });
          
          // この従業員IDがユーザーテーブルに存在するかチェック
          if (payslipData.employeeId && !usersByEmployeeId[payslipData.employeeId]) {
            employeeIdMismatches.push({
              payslipId: doc.id,
              employeeId: payslipData.employeeId,
              reason: 'ユーザーテーブルに該当する従業員IDが見つからない'
            });
          }
        }
      });
      
      console.log(`   正常な給与明細(userId有り): ${payslipsWithUserId.length}件`);
      console.log(`   問題のある給与明細(userId無し): ${payslipsWithoutUserId.length}件`);
      
      if (payslipsWithoutUserId.length > 0) {
        console.log('\n   ❌ 問題のある給与明細:');
        payslipsWithoutUserId.slice(0, 10).forEach(payslip => {
          const userInfo = usersByEmployeeId[payslip.employeeId];
          const status = userInfo ? 
            `✅ 対応ユーザー存在: ${userInfo.email}` : 
            `❌ 対応ユーザー不存在`;
          console.log(`      - ${payslip.employeeId}: ${status}`);
        });
        
        if (payslipsWithoutUserId.length > 10) {
          console.log(`      ... 他${payslipsWithoutUserId.length - 10}件`);
        }
      }
      
      // 4. CSVマッピング設定を確認
      console.log('\n4. CSVマッピング設定の確認...');
      const mappingDoc = await db.collection('csvMappings').doc(companyId).get();
      
      if (mappingDoc.exists()) {
        const mappingData = mappingDoc.data();
        console.log('   ✅ CSVマッピング設定: 存在');
        
        // 従業員IDカラムの設定確認
        const employeeMapping = mappingData.employeeMapping;
        if (employeeMapping?.employeeIdColumn) {
          console.log(`   ✅ 従業員IDカラム設定: ${employeeMapping.employeeIdColumn}`);
        } else {
          console.log('   ⚠️  従業員IDカラム設定: 未設定');
        }
        
        // CSVSettings からも確認
        const csvSettingsDoc = await db.collection('csvSettings').doc(companyId).get();
        if (csvSettingsDoc.exists()) {
          const csvSettings = csvSettingsDoc.data();
          if (csvSettings.employeeIdColumn) {
            console.log(`   ✅ CSV設定の従業員IDカラム: ${csvSettings.employeeIdColumn}`);
          }
        }
      } else {
        console.log('   ❌ CSVマッピング設定: 未設定');
      }
      
      // 5. 修復提案
      console.log('\n5. 修復提案:');
      if (usersWithoutEmployeeId.length > 0) {
        console.log('   a) 従業員IDが未設定のユーザーに従業員IDを設定');
      }
      if (payslipsWithoutUserId.length > 0) {
        console.log('   b) 既存の給与明細にuserIdを補完');
      }
      if (!mappingDoc.exists()) {
        console.log('   c) CSVマッピング設定を完了');
      }
      
      console.log('\n' + '='.repeat(80));
    }
    
  } catch (error) {
    console.error('診断中にエラーが発生しました:', error);
  }
}

// 修復用の関数
async function fixPayslipUserIds(companyId) {
  console.log(`\n=== ${companyId} 会社の給与明細修復開始 ===`);
  
  try {
    // ユーザー情報を取得
    const usersSnapshot = await db.collection('users')
      .where('companyId', '==', companyId)
      .get();
    
    const usersByEmployeeId = {};
    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      if (userData.employeeId) {
        usersByEmployeeId[userData.employeeId] = doc.id;
      }
    });
    
    // userId が未設定の給与明細を取得
    const payslipsSnapshot = await db.collection('payslips')
      .where('companyId', '==', companyId)
      .get();
    
    const batch = db.batch();
    let fixedCount = 0;
    let unfixableCount = 0;
    
    payslipsSnapshot.docs.forEach(doc => {
      const payslipData = doc.data();
      
      // userIdが未設定で、employeeIdが存在する場合
      if (!payslipData.userId && payslipData.employeeId && usersByEmployeeId[payslipData.employeeId]) {
        batch.update(doc.ref, {
          userId: usersByEmployeeId[payslipData.employeeId],
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        fixedCount++;
      } else if (!payslipData.userId) {
        unfixableCount++;
      }
    });
    
    if (fixedCount > 0) {
      await batch.commit();
      console.log(`✅ ${fixedCount}件の給与明細を修復しました`);
    }
    
    if (unfixableCount > 0) {
      console.log(`⚠️  ${unfixableCount}件の給与明細は修復できませんでした（対応するユーザーが見つからない）`);
    }
    
  } catch (error) {
    console.error('修復中にエラーが発生しました:', error);
  }
}

// 実行部分
async function main() {
  console.log('診断開始...\n');
  await diagnoseMappingIssues();
  
  // 修復を実行する場合は、会社IDを指定してコメントアウトを外してください
  // await fixPayslipUserIds('your-company-id');
  
  console.log('\n診断完了');
  process.exit(0);
}

main().catch(console.error); 