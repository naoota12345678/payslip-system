// fix-payslip-employee-data.js
// 既存の給与明細データに従業員ID情報を設定する修復スクリプト

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyBzmFj5-DH-SECGcQ0FLDujxfXJg9pd0-8",
  authDomain: "kyuyoprint.firebaseapp.com",
  projectId: "kyuyoprint",
  storageBucket: "kyuyoprint.firebasestorage.app",
  messagingSenderId: "300754692484",
  appId: "1:300754692484:web:da56e0c2f86543b61395d1",
  measurementId: "G-248TDC31LZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 修復処理メイン関数
const fixPayslipEmployeeData = async () => {
  console.log('🚀 給与明細データ修復開始');
  
  try {
    // 1. 全ての給与明細を取得
    const payslipsSnapshot = await getDocs(collection(db, 'payslips'));
    console.log(`📊 修復対象の給与明細総数: ${payslipsSnapshot.size}件`);
    
    // 2. 全ての従業員データを取得（会社別）
    const employeesSnapshot = await getDocs(collection(db, 'employees'));
    console.log(`👥 従業員データ総数: ${employeesSnapshot.size}件`);
    
    // 3. 従業員データを会社とemployeeIdでインデックス化
    const employeeMap = new Map();
    employeesSnapshot.forEach(doc => {
      const data = doc.data();
      const key = `${data.companyId}_${data.employeeId}`;
      employeeMap.set(key, {
        id: doc.id,
        ...data
      });
    });
    
    console.log(`🗂️ 従業員マップ作成完了: ${employeeMap.size}件`);
    
    // 4. 給与明細データを修復
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const payslipDoc of payslipsSnapshot.docs) {
      const payslipData = payslipDoc.data();
      const payslipId = payslipDoc.id;
      
      try {
        // userIdとemployeeIdがnullの場合のみ修復
        if (payslipData.userId === null || payslipData.employeeId === null) {
          console.log(`🔧 修復対象: ${payslipId}`);
          
          // CSVデータから従業員IDを探す
          let foundEmployeeId = null;
          
          // CSVデータから従業員ID候補を探す
          if (payslipData.csvData) {
            const csvData = payslipData.csvData;
            
            // 一般的な従業員IDフィールド名で検索
            const possibleFields = ['社員番号', '従業員番号', '従業員ID', 'employee_id', 'emp_id', '社員ID'];
            
            for (const field of possibleFields) {
              if (csvData[field] && csvData[field].trim()) {
                foundEmployeeId = csvData[field].trim();
                console.log(`📋 CSVから従業員ID発見: ${field} = ${foundEmployeeId}`);
                break;
              }
            }
          }
          
          if (foundEmployeeId) {
            // 従業員データを検索
            const employeeKey = `${payslipData.companyId}_${foundEmployeeId}`;
            const employee = employeeMap.get(employeeKey);
            
            if (employee) {
              // 給与明細データを更新
              const updateData = {
                userId: employee.id,
                employeeId: foundEmployeeId,
                departmentCode: employee.departmentCode || null
              };
              
              await updateDoc(doc(db, 'payslips', payslipId), updateData);
              
              console.log(`✅ 修復完了: ${payslipId} -> userId: ${employee.id}, employeeId: ${foundEmployeeId}`);
              updatedCount++;
            } else {
              console.log(`❌ 従業員データが見つかりません: ${foundEmployeeId} (company: ${payslipData.companyId})`);
              skippedCount++;
            }
          } else {
            console.log(`❌ CSVデータに従業員IDが見つかりません: ${payslipId}`);
            skippedCount++;
          }
        } else {
          console.log(`⏭️ スキップ (既に設定済み): ${payslipId}`);
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ 修復エラー: ${payslipId}`, error);
        errorCount++;
      }
    }
    
    console.log('🎉 修復処理完了');
    console.log(`📊 結果: 更新${updatedCount}件, スキップ${skippedCount}件, エラー${errorCount}件`);
    
  } catch (error) {
    console.error('❌ 修復処理全体エラー:', error);
  }
};

// 実行
fixPayslipEmployeeData(); 