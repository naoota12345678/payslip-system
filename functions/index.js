// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const { PassThrough } = require('stream');

admin.initializeApp();
const db = admin.firestore();

// タイムスタンプ生成用のヘルパー関数
const getServerTimestamp = () => {
  try {
    return admin.firestore.FieldValue.serverTimestamp();
  } catch (err) {
    console.log('serverTimestamp()が使用できないため、現在時刻を使用します');
    return new Date();
  }
};

// 安全なJSON文字列化関数
const safeStringify = (obj) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (err) {
    return '[JSON変換エラー: ' + err.message + ']';
  }
};

// ログ関数
const logDebug = async (uploadId, message, data = null) => {
  const logEntry = {
    uploadId,
    level: 'debug',
    message,
    timestamp: new Date().toISOString(),
    data: data ? safeStringify(data) : null
  };
  
  console.log(`[DEBUG][${uploadId}] ${message}`, data || '');
  
  try {
    await db.collection('processLogs').add(logEntry);
  } catch (err) {
    console.error('ログ保存エラー:', err);
  }
};

const logError = async (uploadId, message, error) => {
  const logEntry = {
    uploadId,
    level: 'error',
    message,
    error: error.message || error,
    timestamp: new Date().toISOString()
  };
  
  console.error(`[ERROR][${uploadId}] ${message}:`, error);
  
  try {
    await db.collection('processLogs').add(logEntry);
  } catch (err) {
    console.error('エラーログ保存エラー:', err);
  }
};

// CSVマッピング設定から給与項目を生成する関数
const generatePayrollItemsFromMappings = async (companyId) => {
  try {
    console.log(`[DEBUG] CSVマッピング設定から給与項目を生成開始: companyId=${companyId}`);
    
    const items = [];
    
    // 方式1: 新しい方式 (csvMappings) - 給与項目と個別のマッピング
    console.log('[DEBUG] 新しい方式 (csvMappings) を確認中...');
    const mappingDoc = await db.collection('csvMappings').doc(companyId).get();
    
    if (mappingDoc.exists) {
      const mappingData = mappingDoc.data();
      console.log('[DEBUG] csvMappings データ:', JSON.stringify(mappingData, null, 2));
      
      // 給与項目を取得
      const payrollItemsSnapshot = await db.collection('payrollItems')
        .where('companyId', '==', companyId)
        .get();
      
      if (!payrollItemsSnapshot.empty) {
        console.log(`[DEBUG] 給与項目を${payrollItemsSnapshot.docs.length}件取得`);
        
        const payrollItems = payrollItemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // マッピング情報を適用
        const mappings = mappingData.mappings || {};
        console.log('[DEBUG] マッピング情報:', JSON.stringify(mappings, null, 2));
        
        payrollItems.forEach(item => {
          const csvColumn = mappings[item.id];
          if (csvColumn) {
            items.push({
              id: item.id,
              name: item.name,
              type: item.type,
              csvColumn: csvColumn,
              isVisible: item.isVisible !== false
            });
          }
        });
        
        console.log(`[DEBUG] 新しい方式で${items.length}件のマッピング済み項目を生成`);
      }
    }
    
    // 方式2: 古い方式 (csvMapping) - 項目とマッピングが一体化
    if (items.length === 0) {
      console.log('[DEBUG] 古い方式 (csvMapping) を確認中...');
      const oldMappingDoc = await db.collection('csvMapping').doc(companyId).get();
      
      if (oldMappingDoc.exists) {
        const oldMappingData = oldMappingDoc.data();
        console.log('[DEBUG] csvMapping データ:', JSON.stringify(oldMappingData, null, 2));
        
        const csvMapping = oldMappingData.csvMapping || oldMappingData;
        
        // 支給項目を追加
        if (csvMapping.incomeItems && Array.isArray(csvMapping.incomeItems)) {
          csvMapping.incomeItems.forEach((item, index) => {
            if (item.headerName && item.itemName) {
              items.push({
                id: item.id || `income_${index}`,
                name: item.itemName,
                type: 'income',
                csvColumn: item.headerName,
                isVisible: item.isVisible !== false
              });
            }
          });
        }
        
        // 控除項目を追加
        if (csvMapping.deductionItems && Array.isArray(csvMapping.deductionItems)) {
          csvMapping.deductionItems.forEach((item, index) => {
            if (item.headerName && item.itemName) {
              items.push({
                id: item.id || `deduction_${index}`,
                name: item.itemName,
                type: 'deduction',
                csvColumn: item.headerName,
                isVisible: item.isVisible !== false
              });
            }
          });
        }
        
        // 勤怠項目を追加
        if (csvMapping.attendanceItems && Array.isArray(csvMapping.attendanceItems)) {
          csvMapping.attendanceItems.forEach((item, index) => {
            if (item.headerName && item.itemName) {
              items.push({
                id: item.id || `attendance_${index}`,
                name: item.itemName,
                type: 'attendance',
                csvColumn: item.headerName,
                isVisible: item.isVisible !== false
              });
            }
          });
        }
        
        // 項目コード項目を追加
        if (csvMapping.itemCodeItems && Array.isArray(csvMapping.itemCodeItems)) {
          csvMapping.itemCodeItems.forEach((item, index) => {
            if (item.headerName && item.itemName) {
              const itemType = item.type || 'income';
              items.push({
                id: item.id || `itemcode_${index}`,
                name: item.itemName,
                type: itemType,
                csvColumn: item.headerName,
                isVisible: item.isVisible !== false
              });
            }
          });
        }
        
        console.log(`[DEBUG] 古い方式で${items.length}件のマッピング済み項目を生成`);
      }
    }
    
    // 項目が見つからない場合のエラー処理
    if (items.length === 0) {
      console.log('[DEBUG] マッピング済み項目が見つかりませんでした');
      throw new Error('CSVマッピング設定から給与項目を取得できませんでした');
    }
    
    console.log(`[DEBUG] CSVマッピングから生成された給与項目: ${items.length}件`);
    return items;
    
  } catch (err) {
    console.error('[ERROR] CSVマッピングから給与項目を生成できませんでした:', err);
    throw err;
  }
};

// メインのCSV処理関数
exports.processCSV = functions.https.onCall(async (data, context) => {
  console.log('processCSV 関数が呼び出されました');
  console.log('受信データ (RAW):', safeStringify(data));
  
  // 認証チェック（一時的に無効化）
  /*
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'ユーザー認証が必要です'
    );
  }
  */
  
  // パラメータの詳細デバッグ
  console.log('=== パラメータデバッグ開始 ===');
  console.log('data:', data);
  console.log('data type:', typeof data);
  console.log('data keys:', data ? Object.keys(data) : 'null');
  
  // dataオブジェクトが複雑な構造の場合、実際のデータを探す
  let actualData = data;
  if (data && typeof data === 'object') {
    // 実際のパラメータを含む可能性のあるプロパティを探す
    if (data.uploadId) {
      actualData = data;
    } else if (data.data && data.data.uploadId) {
      actualData = data.data;
    } else if (data.body && data.body.uploadId) {
      actualData = data.body;
    } else {
      // dataオブジェクトの中から実際のデータを探す
      console.log('データ構造を詳細に調査中...');
      console.log('uploadId直接アクセス:', data.uploadId);
      console.log('data.data:', data.data);
      console.log('data.body:', data.body);
      
      // dataオブジェクトの各プロパティを確認
      for (const key in data) {
        if (data[key] && typeof data[key] === 'object') {
          console.log(`data.${key}のプロパティ:`, Object.keys(data[key]));
          if (data[key].uploadId) {
            console.log(`実際のデータはdata.${key}にあります`);
            actualData = data[key];
            break;
          }
        }
      }
    }
  }
  
  console.log('actualData:', actualData);
  console.log('actualData keys:', actualData ? Object.keys(actualData) : 'null');
  if (actualData) {
    console.log('uploadId:', actualData.uploadId, 'type:', typeof actualData.uploadId);
    console.log('fileUrl:', actualData.fileUrl, 'type:', typeof actualData.fileUrl);
    console.log('companyId:', actualData.companyId, 'type:', typeof actualData.companyId);
  }
  console.log('=== パラメータデバッグ終了 ===');
  
  // 安全なパラメータ取得
  const uploadId = actualData ? actualData.uploadId : null;
  const fileUrl = actualData ? actualData.fileUrl : null;
  const companyId = actualData ? actualData.companyId : null;
  const updateEmployeeInfo = actualData ? actualData.updateEmployeeInfo : false;
  const registerNewEmployees = actualData ? actualData.registerNewEmployees : false;
  const employeeIdColumn = actualData ? actualData.employeeIdColumn : null;
  const departmentCodeColumn = actualData ? actualData.departmentCodeColumn : null;
  const columnMappings = actualData ? actualData.columnMappings : {};
  
  // パラメータ検証（一時的に無効化してテスト）
  console.log('パラメータ検証開始');
  console.log('uploadId値:', uploadId, 'type:', typeof uploadId, 'truthy:', !!uploadId);
  console.log('fileUrl値:', fileUrl, 'type:', typeof fileUrl, 'truthy:', !!fileUrl);
  console.log('companyId値:', companyId, 'type:', typeof companyId, 'truthy:', !!companyId);
  
  if (!uploadId) {
    console.error('uploadId検証失敗:', uploadId);
    throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: uploadId');
  }
  if (!fileUrl) {
    console.error('fileUrl検証失敗:', fileUrl);
    throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: fileUrl');
  }
  if (!companyId) {
    console.error('companyId検証失敗:', companyId);
    throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: companyId');
  }
  
  console.log('すべてのパラメータ検証通過');
  
  try {
    await logDebug(uploadId, '処理開始', { companyId, updateEmployeeInfo });
    
    // アップロード情報を取得
    const uploadRef = db.collection('csvUploads').doc(uploadId);
    const uploadDoc = await uploadRef.get();
    
    if (!uploadDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'アップロード情報が見つかりません');
    }
    
    const uploadData = uploadDoc.data();
    await logDebug(uploadId, 'アップロード情報を取得', {
      fileName: uploadData.fileName,
      paymentDate: uploadData.paymentDate
    });
    
    // 処理ステータスを更新
    await uploadRef.update({
      status: 'processing',
      processingStartedAt: getServerTimestamp()
    });
    
    // CSVマッピング設定から給与項目を生成
    await logDebug(uploadId, 'CSVマッピングから給与項目を生成開始');
    const payrollItems = await generatePayrollItemsFromMappings(companyId);
    
    if (!payrollItems || payrollItems.length === 0) {
      throw new functions.https.HttpsError('not-found', 'CSVマッピング設定から給与項目を取得できませんでした');
    }
    
    await logDebug(uploadId, `${payrollItems.length}件の給与項目を生成`);
    
    // マッピング情報を構築
    const finalMappings = {};
    payrollItems.forEach(item => {
      if (item.csvColumn) {
        finalMappings[item.id] = item.csvColumn;
      }
    });
    
    await logDebug(uploadId, 'マッピング情報', finalMappings);
    
    if (Object.keys(finalMappings).length === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'CSVマッピング設定が見つかりません');
    }
    
    // CSVファイルを取得して処理
    await logDebug(uploadId, 'CSVファイルの取得を開始', { fileUrl });
    
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    await logDebug(uploadId, 'CSVファイルを取得完了');
    const responseBuffer = await response.buffer();
    
    const stream = new PassThrough();
    stream.end(responseBuffer);
    
    const results = [];
    let rowCount = 0;
    
    // CSVパーサーでストリーム処理
    await logDebug(uploadId, 'CSVパース処理を開始');
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv({ skipEmptyLines: true, trim: true }))
        .on('data', (data) => {
          rowCount++;
          
          try {
            // 各行を処理
            const payslipData = {
              companyId: companyId,
              paymentDate: admin.firestore.Timestamp.fromDate(uploadData.paymentDate.toDate()),
              uploadId: uploadId,
              createdAt: getServerTimestamp(),
              items: {}
            };
            
            // 従業員ID/番号の取得
            let employeeId = null;
            if (employeeIdColumn && data[employeeIdColumn]) {
              employeeId = String(data[employeeIdColumn]).trim();
            }
            
            // 部署コードの取得
            let departmentCode = null;
            if (departmentCodeColumn && data[departmentCodeColumn]) {
              departmentCode = String(data[departmentCodeColumn]).trim();
            }
            
            // 給与項目データを処理
            let totalIncome = 0;
            let totalDeduction = 0;
            
            payrollItems.forEach(item => {
              if (item.csvColumn && data[item.csvColumn] !== undefined) {
                const value = parseFloat(data[item.csvColumn]) || 0;
                
                payslipData.items[item.id] = {
                  name: item.name,
                  type: item.type,
                  value: value
                };
                
                if (item.type === 'income') {
                  totalIncome += value;
                } else if (item.type === 'deduction') {
                  totalDeduction += value;
                }
              }
            });
            
            payslipData.totalIncome = totalIncome;
            payslipData.totalDeduction = totalDeduction;
            payslipData.netAmount = totalIncome - totalDeduction;
            payslipData.employeeId = employeeId;
            payslipData.departmentCode = departmentCode;
            
            results.push(payslipData);
            
          } catch (rowError) {
            console.error(`行 ${rowCount}: 行の処理中にエラー`, rowError);
          }
        })
        .on('error', (csvError) => {
          console.error('CSVパースエラー', csvError);
          reject(csvError);
        })
        .on('end', () => {
          console.log(`CSVパース完了: ${rowCount}行を処理、${results.length}件の有効データ`);
          resolve();
        });
    });
    
    await logDebug(uploadId, 'Firestoreへの保存を開始', { resultCount: results.length });
    
    // Firestoreに給与データを保存
    const batch = db.batch();
    results.forEach(payslipData => {
      const docRef = db.collection('payslips').doc();
      batch.set(docRef, payslipData);
    });
    
    await batch.commit();
    await logDebug(uploadId, 'Firestoreへの保存完了');
    
    // 処理完了ステータスを更新
    await uploadRef.update({
      status: 'completed',
      processedCount: results.length,
      completedAt: getServerTimestamp()
    });
    
    await logDebug(uploadId, '処理完了', { processedCount: results.length });
    
    return {
      success: true,
      processedCount: results.length,
      message: `${results.length}件の給与データを処理しました`
    };
    
  } catch (error) {
    console.error(`[ERROR][${uploadId}] CSV処理エラー:`, error);
    
    // エラー情報を更新
    try {
      await db.collection('csvUploads').doc(uploadId).update({
        status: 'error',
        errorMessage: error.message,
        errorAt: getServerTimestamp()
      });
    } catch (updateError) {
      console.error('エラーステータス更新失敗', updateError);
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'CSVファイルの処理中にエラーが発生しました: ' + error.message
    );
  }
});

// テスト用の簡易関数
exports.testSimpleCSV = functions.https.onCall(async (data, context) => {
  console.log("シンプルなCSVテスト開始");
  console.log("受信データ:", safeStringify(data));
  
  try {
    return {
      success: true,
      message: "テスト成功",
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("テストエラー:", error);
    throw new functions.https.HttpsError(
      'internal',
      'テスト中にエラーが発生しました: ' + error.message
    );
  }
});