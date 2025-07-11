// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const { PassThrough } = require('stream');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

admin.initializeApp();

const db = admin.firestore();

// タイムスタンプ生成用のヘルパー関数（エミュレータ環境対応）
const getServerTimestamp = () => {
  try {
    // 本番環境ではserverTimestamp()を使用
    return admin.firestore.FieldValue.serverTimestamp();
  } catch (err) {
    // エミュレータ環境またはエラー時は現在時刻を使用
    console.log('serverTimestamp()が使用できないため、現在時刻を使用します');
    return new Date();
  }
};

// 循環参照を安全に処理するための関数
function safeStringify(obj) {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        // 循環参照を検出した場合はシンプルなメッセージに置き換え
        return '[Circular Reference]';
      }
      cache.add(value);
    }
    return value;
  });
}

// 詳細なログ記録のためのヘルパー関数（修正版）
const logDebug = async (uploadId, message, data = null) => {
  console.log(`[DEBUG][${uploadId}] ${message}`, data || '');
  
  // エラーログをデータベースに保存
  try {
    const safeData = data ? safeStringify(data).substring(0, 1000) : null;
    await db.collection('debugLogs').add({
      uploadId: uploadId,
      message: message,
      data: safeData, // 安全な変換関数を使用
      timestamp: getServerTimestamp() // 修正: serverTimestamp()をヘルパー関数に置き換え
    });
  } catch (err) {
    console.error('デバッグログの保存に失敗:', err);
  }
};

// エラーログ記録のためのヘルパー関数（修正版）
const logError = async (uploadId, message, error = null) => {
  console.error(`[ERROR][${uploadId}] ${message}`, error || '');
  
  // エラーログをデータベースに保存
  try {
    let errorData = null;
    if (error) {
      errorData = {
        message: error.message,
        stack: error.stack,
        code: error.code
      };
    }
    await db.collection('errorLogs').add({
      uploadId: uploadId,
      message: message,
      error: errorData,
      timestamp: getServerTimestamp() // 修正: serverTimestamp()をヘルパー関数に置き換え
    });
  } catch (err) {
    console.error('エラーログの保存に失敗:', err);
  }
};

// シンプルなテスト用関数
exports.testSimpleCSV = functions.https.onCall(async (data, context) => {
  console.log("シンプルなCSVテスト開始");
  console.log("受信データ:", safeStringify(data));
  
  try {
    // 最小限のデータだけを返す
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

// 簡易版のprocessCSV関数（テスト用）- 修正版
exports.processCSVSimple = functions.https.onCall(async (data, context) => {
  console.log("簡易版processCSV実行開始");
  
  // データ構造を徹底的にログで確認
  console.log("受信データ (raw):", safeStringify(data));
  console.log("データタイプ:", typeof data);
  console.log("データ構造:", data ? Object.keys(data) : "データなし");
  
  // より堅牢なパラメータ抽出 - 修正部分
  const actualData = data.data || data || {};
  
  // パラメータを安全に抽出
  const uploadId = actualData.uploadId || null;
  const fileUrl = actualData.fileUrl || null;
  const companyId = actualData.companyId || null;
  const updateEmployeeInfo = actualData.updateEmployeeInfo !== undefined ? actualData.updateEmployeeInfo : null;
  const columnMappings = actualData.columnMappings || null;
  
  // パラメータの存在を個別に検証してログ出力
  console.log("抽出したパラメータ:", {
    uploadId: uploadId ? "あり" : "なし",
    fileUrl: fileUrl ? "あり" : "なし",
    companyId: companyId ? "あり" : "なし",
    updateEmployeeInfo: updateEmployeeInfo !== null ? "あり" : "なし",
    columnMappings: columnMappings ? "あり" : "なし"
  });
  
  // パラメータ検証
  if (!uploadId) {
    console.error("uploadIdパラメータが不足しています");
    throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: uploadId');
  }
  if (!fileUrl) {
    console.error("fileUrlパラメータが不足しています");
    throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: fileUrl');
  }
  if (!companyId) {
    console.error("companyIdパラメータが不足しています");
    throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: companyId');
  }
  if (updateEmployeeInfo === null) {
    console.error("updateEmployeeInfoパラメータが不足しています");
    throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: updateEmployeeInfo');
  }
  if (!columnMappings) {
    console.error("columnMappingsパラメータが不足しています");
    throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: columnMappings');
  }
  
  try {
    // ファイル取得や処理は省略し、成功レスポンスのみ返す
    return { 
      success: true, 
      processedCount: 1,
      employeesUpdated: 0,
      testMode: true
    };
  } catch (error) {
    console.error("処理エラー:", error);
    throw new functions.https.HttpsError(
      'internal',
      'テスト処理中にエラーが発生しました: ' + error.message
    );
  }
});

// 元のprocessCSV関数（修正版）
exports.processCSV = functions.https.onCall(async (data, context) => {
    // デバッグログを追加（改善版）
    console.log('processCSV 関数が呼び出されました');
    console.log('受信データ (RAW):', safeStringify(data));
    
    // データ構造を徹底的にログで確認
    console.log("データタイプ:", typeof data);
    console.log("データ構造:", data ? Object.keys(data) : "データなし");
    
    // 認証チェック - 一時的に無効化（開発環境のテスト用）
    /*
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'ユーザー認証が必要です'
      );
    }
    */

    // より堅牢なパラメータ抽出 - 修正部分
    const actualData = data.data || data || {};
    
    // パラメータを安全に抽出
    const uploadId = actualData.uploadId || null;
    const fileUrl = actualData.fileUrl || null;
    const companyId = actualData.companyId || null;
    const updateEmployeeInfo = actualData.updateEmployeeInfo !== undefined ? actualData.updateEmployeeInfo : null;
    const columnMappings = actualData.columnMappings || null;
    
    // パラメータの存在を個別に検証してログ出力
    console.log("抽出したパラメータ:", {
      uploadId: uploadId ? "あり" : "なし",
      fileUrl: fileUrl ? "あり" : "なし",
      companyId: companyId ? "あり" : "なし",
      updateEmployeeInfo: updateEmployeeInfo !== null ? "あり" : "なし",
      columnMappings: columnMappings ? (typeof columnMappings === 'object' ? `(${Object.keys(columnMappings).length}項目)` : '無効な形式') : "なし"
    });

    // より詳細なパラメータチェック
    if (!uploadId) {
      console.error('uploadIdパラメータが不足しています');
      throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: uploadId');
    }
    if (!fileUrl) {
      console.error('fileUrlパラメータが不足しています');
      throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: fileUrl');
    }
    if (!companyId) {
      console.error('companyIdパラメータが不足しています');
      throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: companyId');
    }
    if (updateEmployeeInfo === null) {
      console.error('updateEmployeeInfoパラメータが不足しています');
      throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: updateEmployeeInfo');
    }
    if (!columnMappings || typeof columnMappings !== 'object' || Object.keys(columnMappings).length === 0) {
      console.error('columnMappingsパラメータが不足しています:', columnMappings);
      throw new functions.https.HttpsError('invalid-argument', '必要なパラメータが不足しています: columnMappings');
    }

    try {
      await logDebug(uploadId, '処理開始', { companyId, updateEmployeeInfo });
      
      // アップロード情報を取得
      const uploadRef = db.collection('csvUploads').doc(uploadId);
      const uploadDoc = await uploadRef.get();
      
      if (!uploadDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'アップロード情報が見つかりません'
        );
      }
      
      const uploadData = uploadDoc.data();
      await logDebug(uploadId, 'アップロード情報を取得', {
        fileName: uploadData.fileName,
        paymentDate: uploadData.paymentDate
      });
      
      // 処理ステータスを更新
      await uploadRef.update({
        status: 'processing',
        processingStartedAt: getServerTimestamp() // 修正: serverTimestamp()をヘルパー関数に置き換え
      });

      // 給与項目を取得
      await logDebug(uploadId, '給与項目の取得を開始');
      const payrollItemsSnapshot = await db.collection('payrollItems')
        .where('companyId', '==', companyId)
        .get();
      
      if (payrollItemsSnapshot.empty) {
        throw new functions.https.HttpsError(
          'not-found',
          '給与項目が設定されていません'
        );
      }
      
      const payrollItems = payrollItemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      await logDebug(uploadId, `${payrollItems.length}件の給与項目を取得`);
      
      // マッピング情報の取得
      // 新しい方式: 給与項目に直接マッピング情報が含まれている場合
      const itemColumnMapping = {};
      payrollItems.forEach(item => {
        if (item.csvColumn) {
          itemColumnMapping[item.id] = item.csvColumn;
        }
      });
      
      // アップロード時に送信されたマッピング情報がある場合はそちらを優先
      const finalMappings = columnMappings || itemColumnMapping;
      
      await logDebug(uploadId, 'マッピング情報', finalMappings);
      
      if (Object.keys(finalMappings).length === 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'CSVマッピング設定が見つかりません'
        );
      }
      
      // CSVファイルを取得して処理
      await logDebug(uploadId, 'CSVファイルの取得を開始', { fileUrl });
      
      let response;
      try {
        response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
      } catch (fetchError) {
        await logError(uploadId, 'CSVファイルの取得に失敗', fetchError);
        throw new functions.https.HttpsError(
          'unknown',
          'CSVファイルの取得に失敗しました: ' + fetchError.message
        );
      }
      
      await logDebug(uploadId, 'CSVファイルを取得完了');
      
      let responseBuffer;
      try {
        responseBuffer = await response.buffer();
        await logDebug(uploadId, `CSVファイルのサイズ: ${responseBuffer.length} バイト`);
      } catch (bufferError) {
        await logError(uploadId, 'CSVファイルのバッファリングに失敗', bufferError);
        throw new functions.https.HttpsError(
          'unknown',
          'CSVファイルの読み込みに失敗しました: ' + bufferError.message
        );
      }
      
      const stream = new PassThrough();
      stream.end(responseBuffer);
      
      const results = [];
      let processedCount = 0;
      let employeesUpdated = 0;
      let rowCount = 0;
      let errorCount = 0;
      
      // CSVパーサーでストリーム処理
      await logDebug(uploadId, 'CSVパース処理を開始');
      
      await new Promise((resolve, reject) => {
        stream
          .pipe(csv({
            skipEmptyLines: true,
            trim: true
          }))
          .on('data', (data) => {
            rowCount++;
            
            try {
              // 各行を処理
              const payslipData = {
                companyId: companyId,
                paymentDate: admin.firestore.Timestamp.fromDate(uploadData.paymentDate.toDate()),
                uploadId: uploadId,
                createdAt: getServerTimestamp(), // 修正: serverTimestamp()をヘルパー関数に置き換え
                items: {}
              };
              
              // ヘッダーとデータ型のデバッグ（最初の行のみ）
              if (rowCount === 1) {
                const headers = Object.keys(data);
                const sampleValues = {};
                
                headers.forEach(key => {
                  sampleValues[key] = {
                    value: data[key],
                    type: typeof data[key]
                  };
                });
                
                logDebug(uploadId, 'CSVのヘッダー構造', {
                  headerCount: headers.length,
                  headers: headers,
                  sampleValues: sampleValues
                });
              }
              
              // 従業員ID/番号のカラム
              let employeeId = null;
              if (uploadData.employeeIdColumn && data[uploadData.employeeIdColumn] !== undefined) {
                employeeId = data[uploadData.employeeIdColumn];
                payslipData.employeeId = employeeId;
              } else {
                // 明示的なカラム指定がない場合は従来通りの検索方法
                for (const key of Object.keys(data)) {
                  if (key.toLowerCase().includes('employee') || 
                      key.toLowerCase().includes('社員') || 
                      key.toLowerCase().includes('従業員')) {
                    employeeId = data[key];
                    payslipData.employeeId = employeeId;
                    break;
                  }
                }
              }
              
              if (!employeeId) {
                logDebug(uploadId, `行 ${rowCount}: 従業員IDが見つかりませんでした`, {
                  rowDataSample: safeStringify(data).substring(0, 500)
                });
                return; // この行はスキップ
              }
              
              // 部門コード情報を取得
              let departmentCode = null;
              if (uploadData.departmentCodeColumn && data[uploadData.departmentCodeColumn] !== undefined) {
                departmentCode = data[uploadData.departmentCodeColumn];
                payslipData.departmentCode = departmentCode;
              }
              
              // マッピングに従って各カラムの値を処理
              for (const [itemId, columnName] of Object.entries(finalMappings)) {
                try {
                  if (columnName && data[columnName] !== undefined) {
                    // 該当する給与項目を探す
                    const payrollItem = payrollItems.find(item => item.id === itemId);
                    if (payrollItem) {
                      // 数値に変換して保存（デバッグ情報追加）
                      const value = data[columnName];
                      let processedValue;
                      
                      // 変換前の値の詳細をログ（データ型の問題を特定）
                      const valueType = typeof value;
                      const valueDetail = {
                        originalValue: value,
                        type: valueType,
                        isNull: value === null,
                        isUndefined: value === undefined,
                        isEmpty: value === '',
                        length: valueType === 'string' ? value.length : null,
                        asNumber: valueType === 'string' ? Number(value.replace(/,/g, '')) : Number(value)
                      };
                      
                      if (rowCount <= 3) { // 最初の数行だけ詳細にログ
                        logDebug(uploadId, `行 ${rowCount}, カラム ${columnName}, 項目 ${payrollItem.name}: 値の詳細`, valueDetail);
                      }
                      
                      try {
                        if (payrollItem.type === 'time' || payrollItem.type === 'days') {
                          // 時間・日数項目は文字列として保存
                          processedValue = value === null || value === undefined ? '' : String(value);
                        } else {
                          // 金額項目は数値に変換（より堅牢な処理）
                          const strValue = value === null || value === undefined ? '0' : 
                                        String(value).replace(/,/g, '').replace(/¥/g, '').trim();
                          const numValue = strValue === '' ? 0 : parseFloat(strValue);
                          processedValue = isNaN(numValue) ? 0 : numValue;
                        }
                      } catch (conversionErr) {
                        logError(uploadId, `行 ${rowCount}: 値の変換エラー: [${columnName}]=${value}, 項目=${payrollItem.name}`, conversionErr);
                        // エラー時はデフォルト値を設定
                        processedValue = payrollItem.type === 'time' || payrollItem.type === 'days' ? '' : 0;
                      }
                      
                      payslipData.items[itemId] = {
                        name: payrollItem.name,
                        type: payrollItem.type,
                        value: processedValue,
                        originalValue: value // デバッグ用に元の値も保存
                      };
                    }
                  }
                } catch (mappingError) {
                  errorCount++;
                  logError(uploadId, `行 ${rowCount}: マッピング処理エラー: itemId=${itemId}, column=${columnName}`, mappingError);
                  // エラーがあっても処理続行
                }
              }
              
              // 支給合計と控除合計を計算（改善版）
              let totalIncome = 0;
              let totalDeduction = 0;
              
              for (const [itemId, item] of Object.entries(payslipData.items)) {
                try {
                  if (item.type === 'income') {
                    const numValue = typeof item.value === 'string' 
                      ? parseFloat(item.value.replace(/,/g, '').replace(/¥/g, '').trim() || '0') 
                      : (item.value || 0);
                    
                    if (!isNaN(numValue)) {
                      totalIncome += numValue;
                    }
                  } else if (item.type === 'deduction') {
                    const numValue = typeof item.value === 'string' 
                      ? parseFloat(item.value.replace(/,/g, '').replace(/¥/g, '').trim() || '0') 
                      : (item.value || 0);
                    
                    if (!isNaN(numValue)) {
                      totalDeduction += numValue;
                    }
                  }
                } catch (calcError) {
                  logError(uploadId, `行 ${rowCount}: 集計エラー: ${item.name}, 値=${item.value}`, calcError);
                  // エラーがあっても処理は続行
                }
              }
              
              payslipData.totalIncome = totalIncome;
              payslipData.totalDeduction = totalDeduction;
              payslipData.netAmount = totalIncome - totalDeduction;
              
              // 従業員情報更新用のデータを追加
              if (departmentCode) {
                payslipData._departmentCode = departmentCode;
              }
              
              results.push(payslipData);
              
              // 10行ごとに進捗をログ
              if (rowCount % 10 === 0) {
                logDebug(uploadId, `${rowCount}行を処理しました`);
              }
            } catch (rowError) {
              errorCount++;
              logError(uploadId, `行 ${rowCount}: 行の処理中にエラー`, rowError);
              // エラーがあっても処理続行
            }
          })
          .on('error', (csvError) => {
            logError(uploadId, 'CSVパースエラー', csvError);
            reject(csvError);
          })
          .on('end', () => {
            logDebug(uploadId, `CSVパース完了: ${rowCount}行を処理、${results.length}件の有効データ、${errorCount}件のエラー`);
            resolve();
          });
      });

      await logDebug(uploadId, 'Firestoreへの保存を開始', { resultCount: results.length });
      
      // Firestoreに給与データを保存（バッチ処理の改善）
      const MAX_BATCH_SIZE = 450; // Firestoreの上限は500
      let currentBatch = db.batch();
      let operationCount = 0;
      let batchCount = 0;
      
      for (let i = 0; i < results.length; i++) {
        const payslipData = results[i];
        
        try {
          // 従業員IDに基づいてユーザー情報を取得
          const usersSnapshot = await db.collection('users')
            .where('companyId', '==', companyId)
            .where('employeeId', '==', payslipData.employeeId)
            .limit(1)
            .get();
          
          if (!usersSnapshot.empty) {
            const userData = usersSnapshot.docs[0].data();
            payslipData.userId = usersSnapshot.docs[0].id;
            
            // 給与明細データを保存
            const payslipRef = db.collection('payslips').doc();
            currentBatch.set(payslipRef, payslipData);
            operationCount++;
            
            // バッチサイズの上限に達したら一度コミット
            if (operationCount >= MAX_BATCH_SIZE) {
              batchCount++;
              await logDebug(uploadId, `バッチ ${batchCount}: ${operationCount}件のデータをコミット`);
              
              try {
                await currentBatch.commit();
                await logDebug(uploadId, `バッチ ${batchCount}: コミット成功`);
              } catch (commitError) {
                await logError(uploadId, `バッチ ${batchCount}: コミットエラー`, commitError);
                throw commitError; // 再スロー
              }
              
              currentBatch = db.batch();
              operationCount = 0;
            }
            
            processedCount++;
            
            // 10件ごとに進捗をログ
            if (processedCount % 10 === 0) {
              await logDebug(uploadId, `${processedCount}/${results.length} 件の給与データを処理`);
            }
          } else {
            await logDebug(uploadId, `従業員ID ${payslipData.employeeId} に対応するユーザーが見つかりません`);
          }
        } catch (itemError) {
          await logError(uploadId, `従業員ID ${payslipData.employeeId} の処理中にエラー`, itemError);
          // エラーがあっても処理続行
        }
      }
      
      // 残りのバッチ処理を実行
      if (operationCount > 0) {
        batchCount++;
        await logDebug(uploadId, `最終バッチ ${batchCount}: ${operationCount}件のデータをコミット`);
        
        try {
          await currentBatch.commit();
          await logDebug(uploadId, `最終バッチ ${batchCount}: コミット成功`);
        } catch (finalCommitError) {
          await logError(uploadId, `最終バッチ ${batchCount}: コミットエラー`, finalCommitError);
          throw finalCommitError; // 再スロー
        }
      }
      
      // 処理結果を更新
      await logDebug(uploadId, '処理結果の更新', { processedCount, employeesUpdated });
      
      await uploadRef.update({
        status: 'completed',
        processedCount: processedCount,
        employeesUpdated: employeesUpdated,
        completedAt: getServerTimestamp() // 修正: serverTimestamp()をヘルパー関数に置き換え
      });
      
      // 通知設定があれば通知スケジュールを登録
      if (uploadData.sendEmailDate) {
        await db.collection('emailNotifications').add({
          uploadId: uploadId,
          companyId: companyId,
          scheduledDate: uploadData.sendEmailDate,
          status: 'scheduled',
          createdAt: getServerTimestamp() // 修正: serverTimestamp()をヘルパー関数に置き換え
        });
        
        await logDebug(uploadId, '通知スケジュールを登録', { scheduledDate: uploadData.sendEmailDate });
      }
      
      await logDebug(uploadId, '処理完了', { processedCount, employeesUpdated });
      
      return { 
        success: true, 
        processedCount,
        employeesUpdated
      };
    } catch (error) {
      console.error(`[ERROR][${uploadId}] CSV処理エラー (トップレベル):`, error);
      console.error(`エラーの詳細: ${error.message}`);
      console.error(`スタックトレース: ${error.stack}`);
      
      // エラー情報を更新
      try {
        await db.collection('csvUploads').doc(uploadId).update({
          status: 'error',
          errorMessage: error.message,
          errorAt: getServerTimestamp() // 修正: serverTimestamp()をヘルパー関数に置き換え
        });
      } catch (updateError) {
        await logError(uploadId, 'エラーステータス更新失敗', updateError);
      }
      
      throw new functions.https.HttpsError(
        'internal',
        'CSVファイルの処理中にエラーが発生しました: ' + error.message,
        error.message
      );
    }
  });

// メール通知送信のスケジュール実行関数（一時的にコメントアウト）
// exports.checkEmailNotifications = functions.pubsub.schedule('0 */1 * * *').onRun(async (context) => {
//   console.log('通知チェックを開始します');
//   const now = admin.firestore.Timestamp.now();
//   
//   try {
//     // 今日が送信予定日の通知を取得
//     const notificationsRef = db.collection('emailNotifications');
//     const query = notificationsRef
//       .where('status', '==', 'scheduled')
//       .where('scheduledDate', '<=', now);
//     
//     const snapshot = await query.get();
//     
//     if (snapshot.empty) {
//       console.log('送信予定の通知はありません');
//       return null;
//     }
//     
//     console.log(`${snapshot.size}件の通知を処理します`);
//     
//     // 通知をひとつずつ処理
//     const promises = [];
//     snapshot.forEach(doc => {
//       const notificationData = doc.data();
//       promises.push(processNotification(doc.id, notificationData));
//     });
//     
//     await Promise.all(promises);
//     
//     return null;
//   } catch (error) {
//     console.error('通知チェック処理エラー:', error);
//     return null;
//   }
// });

// 手動での通知送信テスト
exports.sendPayslipNotificationManual = functions.https.onCall(async (data, context) => {
  // 権限チェック
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'ユーザー認証が必要です'
    );
  }
  
  const { uploadId, testMode } = data;
  
  if (!uploadId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'アップロードIDが必要です'
    );
  }
  
  try {
    // アップロード情報を取得
    const uploadDoc = await db.collection('csvUploads').doc(uploadId).get();
    
    if (!uploadDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        '指定されたアップロード情報が見つかりません'
      );
    }
    
    const uploadData = uploadDoc.data();
    
    // テストモードの場合は特定のユーザーにのみ送信
    if (testMode) {
      const testResult = await sendTestNotification(uploadId, uploadData, context.auth.uid);
      return { 
        success: true, 
        message: 'テスト通知を送信しました',
        details: testResult
      };
    }
    
    // 本番モードは通知を作成して予約
    await db.collection('emailNotifications').add({
      uploadId: uploadId,
      companyId: uploadData.companyId,
      scheduledDate: admin.firestore.Timestamp.now(),
      status: 'scheduled',
      createdAt: getServerTimestamp(),
      createdBy: context.auth.uid
    });
    
    return { 
      success: true, 
      message: '通知がスケジュールされました。数分以内に送信されます。' 
    };
  } catch (error) {
    console.error('通知送信エラー:', error);
    throw new functions.https.HttpsError(
      'internal',
      '通知の送信処理中にエラーが発生しました: ' + error.message
    );
  }
});

// 通知処理
async function processNotification(notificationId, notificationData) {
  console.log(`通知処理開始: ${notificationId}`);
  
  try {
    // ステータスを処理中に更新
    await db.collection('emailNotifications').doc(notificationId).update({
      status: 'processing',
      processingStartedAt: getServerTimestamp()
    });
    
    const { uploadId, companyId } = notificationData;
    
    // アップロード情報を取得
    const uploadDoc = await db.collection('csvUploads').doc(uploadId).get();
    
    if (!uploadDoc.exists) {
      throw new Error('アップロード情報が見つかりません');
    }
    
    const uploadData = uploadDoc.data();
    
    // 会社情報を取得
    const companyDoc = await db.collection('companies').doc(companyId).get();
    let companyData = { name: 'システム管理者' };
    
    if (companyDoc.exists) {
      companyData = companyDoc.data();
    }
    
    // 対象の給与明細を取得
    const payslipsSnapshot = await db.collection('payslips')
      .where('uploadId', '==', uploadId)
      .get();
    
    if (payslipsSnapshot.empty) {
      throw new Error('処理対象の給与明細が見つかりません');
    }
    
    // 送信対象ユーザー情報を収集
    const userPayslips = {};
    
    payslipsSnapshot.forEach(doc => {
      const payslipData = doc.data();
      if (payslipData.userId) {
        if (!userPayslips[payslipData.userId]) {
          userPayslips[payslipData.userId] = [];
        }
        
        userPayslips[payslipData.userId].push({
          id: doc.id,
          paymentDate: payslipData.paymentDate,
          totalIncome: payslipData.totalIncome,
          totalDeduction: payslipData.totalDeduction,
          netAmount: payslipData.netAmount
        });
      }
    });
    
    // 各ユーザーに通知メールを送信
    const userIds = Object.keys(userPayslips);
    console.log(`${userIds.length}人のユーザーに通知を送信します`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // メール送信メソッドの初期化
    const mailTransport = initializeMailTransport(companyData);
    
    for (const userId of userIds) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
          console.log(`ユーザーが見つかりません: ${userId}`);
          continue;
        }
        
        const userData = userDoc.data();
        
        if (!userData.email) {
          console.log(`ユーザーのメールアドレスが設定されていません: ${userId}`);
          continue;
        }
        
        // ユーザーの給与明細情報
        const payslips = userPayslips[userId];
        
        // メール送信
        await sendPayslipNotificationEmail(
          mailTransport,
          companyData,
          userData,
          uploadData.paymentDate,
          payslips[0] // 最初の給与明細を使用
        );
        
        // 送信ログを記録
        await db.collection('emailLogs').add({
          userId: userId,
          email: userData.email,
          notificationId: notificationId,
          uploadId: uploadId,
          sentAt: getServerTimestamp(),
          status: 'sent'
        });
        
        successCount++;
      } catch (userError) {
        console.error(`ユーザー ${userId} へのメール送信エラー:`, userError);
        errorCount++;
        errors.push({
          userId: userId,
          error: userError.message
        });
      }
    }
    
    // 通知ステータスを更新
    await db.collection('emailNotifications').doc(notificationId).update({
      status: 'completed',
      completedAt: getServerTimestamp(),
      successCount: successCount,
      errorCount: errorCount,
      errors: errors.length > 0 ? errors : null
    });
    
    console.log(`通知処理完了: ${notificationId}, 成功: ${successCount}, 失敗: ${errorCount}`);
    
    return { successCount, errorCount };
  } catch (error) {
    console.error(`通知処理エラー: ${notificationId}`, error);
    
    // エラー状態を記録
    await db.collection('emailNotifications').doc(notificationId).update({
      status: 'error',
      errorAt: getServerTimestamp(),
      errorMessage: error.message
    });
    
    throw error;
  }
}

// テスト用に特定ユーザーへの通知を送信
async function sendTestNotification(uploadId, uploadData, requestUserId) {
  console.log(`テスト通知処理開始: ${uploadId}, リクエストユーザー: ${requestUserId}`);
  
  try {
    // リクエストユーザーの情報を取得
    const userDoc = await db.collection('users').doc(requestUserId).get();
    
    if (!userDoc.exists) {
      throw new Error('ユーザー情報が見つかりません');
    }
    
    const userData = userDoc.data();
    
    if (!userData.email) {
      throw new Error('メールアドレスが設定されていません');
    }
    
    // 会社情報を取得
    const companyId = uploadData.companyId;
    const companyDoc = await db.collection('companies').doc(companyId).get();
    let companyData = { name: 'システム管理者（テスト送信）' };
    
    if (companyDoc.exists) {
      companyData = companyDoc.data();
      companyData.name += '（テスト送信）';
    }
    
    // サンプル給与明細データを作成
    const payslipData = {
      id: 'test-' + Date.now(),
      paymentDate: uploadData.paymentDate,
      totalIncome: 300000,
      totalDeduction: 60000,
      netAmount: 240000
    };
    
    // メール送信メソッドの初期化
    const mailTransport = initializeMailTransport(companyData);
    
    // メール送信
    await sendPayslipNotificationEmail(
      mailTransport,
      companyData,
      userData,
      uploadData.paymentDate,
      payslipData,
      true // テストモード
    );
    
    // 送信ログを記録
    await db.collection('emailLogs').add({
      userId: requestUserId,
      email: userData.email,
      uploadId: uploadId,
      sentAt: getServerTimestamp(),
      status: 'sent',
      isTest: true
    });
    
    console.log(`テスト通知送信完了: ${uploadId}, ユーザー: ${requestUserId}`);
    
    return { 
      email: userData.email,
      status: 'sent'
    };
  } catch (error) {
    console.error(`テスト通知エラー: ${uploadId}`, error);
    throw error;
  }
}

// メールトランスポートの初期化
function initializeMailTransport(companyData) {
  // デフォルトのSMTP設定（運用環境では環境変数から取得するのが望ましい）
  // ここではテスト用の設定を使用
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',  // 実際の環境では適切なSMTPサーバーに変更
    port: 587,
    secure: false,
    auth: {
      user: 'test@example.com',  // 実際の環境では環境変数から取得
      pass: 'password123'       // 実際の環境では環境変数から取得
    },
    tls: {
      rejectUnauthorized: false // 開発環境用、本番では true に変更
    }
  });
}

// 給与明細通知メールの送信
async function sendPayslipNotificationEmail(
  mailTransport,
  companyData,
  userData,
  paymentDate,
  payslipData,
  isTest = false
) {
  // メールテンプレートのコンパイル
  const templateSource = `
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Meiryo', 'Hiragino Sans', sans-serif; }
        .header { background: #f0f0f0; padding: 20px; }
        .content { padding: 20px; }
        .footer { font-size: 12px; color: #666; padding: 20px; text-align: center; }
        .button { 
          display: inline-block; 
          padding: 10px 20px; 
          background-color: #4CAF50; 
          color: white; 
          text-decoration: none; 
          border-radius: 4px; 
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>{{companyName}}</h2>
      </div>
      <div class="content">
        <p>{{userName}} 様</p>
        <p>{{year}}年{{month}}月分の給与明細が発行されました。</p>
        <p>下記のリンクから明細をご確認いただけます。</p>
        {{#if isTest}}
        <p><strong>※これはテスト送信です。実際の給与明細ではありません。</strong></p>
        {{/if}}
        <p style="margin: 30px 0; text-align: center;">
          <a href="{{payslipUrl}}" class="button">給与明細を確認する</a>
        </p>
        <table>
          <tr>
            <td style="padding-right: 20px;">支給合計:</td>
            <td>{{totalIncome}}</td>
          </tr>
          <tr>
            <td style="padding-right: 20px;">控除合計:</td>
            <td>{{totalDeduction}}</td>
          </tr>
          <tr>
            <td style="padding-right: 20px;"><strong>差引支給額:</strong></td>
            <td><strong>{{netAmount}}</strong></td>
          </tr>
        </table>
      </div>
      <div class="footer">
        <p>このメールは自動送信されています。ご不明な点がございましたら、担当者までお問い合わせください。</p>
        <p>&copy; {{year}} {{companyName}}</p>
      </div>
    </body>
    </html>
  `;
  
  const template = handlebars.compile(templateSource);
  
  // 日付データを取得
  let paymentDateObj = new Date();
  try {
    paymentDateObj = paymentDate.toDate(); // Firestoreのタイムスタンプを変換
  } catch (error) {
    if (paymentDate instanceof Date) {
      paymentDateObj = paymentDate;
    } else if (typeof paymentDate === 'string') {
      paymentDateObj = new Date(paymentDate);
    }
  }
  
  const year = paymentDateObj.getFullYear();
  const month = paymentDateObj.getMonth() + 1;
  
  // 金額フォーマット
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  // テンプレートデータを準備
  const templateData = {
    companyName: companyData.name || 'システム管理者',
    userName: userData.name || userData.displayName || userData.email.split('@')[0],
    year: year,
    month: month,
    isTest: isTest,
    payslipUrl: `https://kyuyoprint.web.app/payslips/${payslipData.id}`,  // 適切なURLに変更
    totalIncome: formatCurrency(payslipData.totalIncome),
    totalDeduction: formatCurrency(payslipData.totalDeduction),
    netAmount: formatCurrency(payslipData.netAmount)
  };
  
  // メールのHTMLを生成
  const html = template(templateData);
  
  // メール送信
  const mailOptions = {
    from: `${companyData.name} <noreply@kyuyoprint.web.app>`,  // 適切なアドレスに変更
    to: userData.email,
    subject: `${isTest ? '[テスト] ' : ''}${year}年${month}月分 給与明細が発行されました`,
    html: html
  };
  
  return mailTransport.sendMail(mailOptions);
}

// ローカルテスト用の代替関数
exports.checkEmailNotificationsManual = functions.https.onCall(async (data, context) => {
  const now = admin.firestore.Timestamp.now();
  
  try {
    // 今日が送信予定日の通知を取得
    const notificationsRef = db.collection('emailNotifications');
    const query = notificationsRef
      .where('status', '==', 'scheduled')
      .where('scheduledDate', '<=', now);
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return { success: true, message: "送信予定の通知はありません" };
    }
    
    // 通知をひとつずつ処理
    const results = [];
    
    for (const doc of snapshot.docs) {
      const notificationData = doc.data();
      try {
        const result = await processNotification(doc.id, notificationData);
        results.push({
          id: doc.id,
          result: result
        });
      } catch (error) {
        results.push({
          id: doc.id,
          error: error.message
        });
      }
    }
    
    return { 
      success: true, 
      message: `${results.length}件の通知を処理しました`,
      results: results
    };
  } catch (error) {
    console.error('通知チェック処理エラー:', error);
    throw new functions.https.HttpsError(
      'internal',
      '通知処理中にエラーが発生しました: ' + error.message
    );
  }
});

// 給与明細アクセス時のイベント
exports.logPayslipView = functions.https.onCall(async (data, context) => {
  // 認証チェック - 一時的に無効化（開発環境のテスト用）
  /*
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'ユーザー認証が必要です'
    );
  }
  */

  const { payslipId } = data;
  
  if (!payslipId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      '給与明細IDが必要です'
    );
  }

  try {
    // 給与明細の存在と閲覧権限の確認
    const payslipDoc = await db.collection('payslips').doc(payslipId).get();
    
    if (!payslipDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        '指定された給与明細が見つかりません'
      );
    }
    
    const payslipData = payslipDoc.data();
    
    // 本人確認（給与明細の所有者かどうか）- 一時的に無効化
    /*
    if (payslipData.userId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'この給与明細の閲覧権限がありません'
      );
    }
    */
    
    // 閲覧ログを記録
    await db.collection('viewLogs').add({
      payslipId: payslipId,
      userId: context.auth ? context.auth.uid : 'test-user',
      viewedAt: getServerTimestamp(), // 修正: serverTimestamp()をヘルパー関数に置き換え
      userAgent: data.userAgent || null
    });
    
    // 閲覧済みフラグをセット
    await payslipDoc.ref.update({
      viewed: true,
      firstViewedAt: payslipData.firstViewedAt || getServerTimestamp(), // 修正: serverTimestamp()をヘルパー関数に置き換え
      lastViewedAt: getServerTimestamp() // 修正: serverTimestamp()をヘルパー関数に置き換え
    });
    
    return { success: true };
  } catch (error) {
    console.error('閲覧ログ記録エラー:', error);
    throw new functions.https.HttpsError(
      'internal',
      '閲覧ログの記録中にエラーが発生しました',
      error.message
    );
  }
});

// ローカルテスト用の関数 - これはFirebase Functionsの一部として公開する
exports.testDebugLogging = functions.https.onCall(async (data, context) => {
  const testId = "test-" + Date.now();
  
  console.log("======= デバッグログテスト開始 =======");
  
  try {
    // デバッグログのテスト
    await logDebug(testId, "テストメッセージ", { test: true, value: 123 });
    await logDebug(testId, "CSVデータサンプル", { 
      headers: ["KY01", "KY02", "KY03"],
      sample: { KY01: "123", KY02: "部署A", KY03: "社員001" } 
    });
    
    // エラーログのテスト
    const testError = new Error("テストエラー");
    await logError(testId, "テストエラーメッセージ", testError);
    
    console.log("======= デバッグログテスト完了 =======");
    
    return { success: true, message: "テストログが出力されました。コンソールを確認してください。" };
  } catch (error) {
    console.error("======= デバッグログテストエラー =======", error);
    return { success: false, error: error.message };
  }
});

// URLのテスト関数
exports.testDownloadURL = functions.https.onCall(async (data, context) => {
  const { url } = data;
  
  if (!url) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'URLが指定されていません'
    );
  }
  
  console.log("URLテスト開始:", url);
  
  try {
    const response = await fetch(url);
    
    const result = {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: {}
    };
    
    // レスポンスヘッダーを取得
    for (const [name, value] of response.headers.entries()) {
      result.headers[name] = value;
    }
    
    if (response.ok) {
      // 内容のプレビュー
      const buffer = await response.buffer();
      result.contentLength = buffer.length;
      result.preview = buffer.toString().substring(0, 200);
      
      // CSVヘッダーを解析
      const lines = buffer.toString().split('\n');
      if (lines.length > 0) {
        result.firstLine = lines[0];
        result.lineCount = lines.length;
      }
    }
    
    return result;
  } catch (error) {
    console.error("URLテストエラー:", error);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
});

// 簡易的なデバッグ用の関数 - HTTP直接アクセス用
exports.testDebug = functions.https.onRequest((req, res) => {
  console.log("===== デバッグテスト開始 =====");
  console.log("テストメッセージ", { test: true, value: 123 });
  
  try {
    // 意図的なエラーをテスト
    const obj = null;
    console.log("これは表示されません", obj.property);
  } catch (error) {
    console.error("テストエラー捕捉:", error);
  }
  
  console.log("===== デバッグテスト終了 =====");
  
  res.status(200).json({ success: true, message: "デバッグテスト完了" });
});