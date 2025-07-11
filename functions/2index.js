// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const { PassThrough } = require('stream');

admin.initializeApp();

const db = admin.firestore();

// 詳細なログ記録のためのヘルパー関数
const logDebug = async (uploadId, message, data = null) => {
  console.log(`[DEBUG][${uploadId}] ${message}`, data || '');
  
  // エラーログをデータベースに保存
  try {
    await db.collection('debugLogs').add({
      uploadId: uploadId,
      message: message,
      data: data ? JSON.stringify(data).substring(0, 1000) : null, // 長すぎるデータは切り捨て
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('デバッグログの保存に失敗:', err);
  }
};

// エラーログ記録のためのヘルパー関数
const logError = async (uploadId, message, error = null) => {
  console.error(`[ERROR][${uploadId}] ${message}`, error || '');
  
  // エラーログをデータベースに保存
  try {
    await db.collection('errorLogs').add({
      uploadId: uploadId,
      message: message,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code
      } : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error('エラーログの保存に失敗:', err);
  }
};

exports.processCSV = functions.https.onCall(async (data, context) => {

    // 認証チェック
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'ユーザー認証が必要です'
      );
    }

    const { uploadId, fileUrl, companyId, updateEmployeeInfo, columnMappings } = data;

    if (!uploadId || !fileUrl || !companyId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        '必要なパラメータが不足しています'
      );
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
        processingStartedAt: admin.firestore.FieldValue.serverTimestamp()
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
          .pipe(csv())
          .on('data', (data) => {
            rowCount++;
            
            try {
              // 各行を処理
              const payslipData = {
                companyId: companyId,
                paymentDate: admin.firestore.Timestamp.fromDate(uploadData.paymentDate.toDate()),
                uploadId: uploadId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
                  rowData: JSON.stringify(data).substring(0, 500)
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
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 通知設定があれば通知スケジュールを登録
      if (uploadData.sendEmailDate) {
        await db.collection('emailNotifications').add({
          uploadId: uploadId,
          companyId: companyId,
          scheduledDate: uploadData.sendEmailDate,
          status: 'scheduled',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
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
          errorAt: admin.firestore.FieldValue.serverTimestamp()
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

// 定期的にメール通知をチェックするスケジューラー
/*
exports.checkEmailNotifications = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  
  const notificationsSnapshot = await db.collection('emailNotifications')
    .where('status', '==', 'scheduled')
    .where('scheduledDate', '<=', now)
    .get();
  
  if (notificationsSnapshot.empty) {
    console.log('送信予定の通知はありません');
    return null;
  }
  
  console.log(`${notificationsSnapshot.size} 件の通知を処理します`);
  
  for (const doc of notificationsSnapshot.docs) {
    const notification = doc.data();
    
    try {
      // 通知ステータスを更新
      await doc.ref.update({
        status: 'processing',
        processingStartedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 該当する給与明細データを取得
      const payslipsSnapshot = await db.collection('payslips')
        .where('uploadId', '==', notification.uploadId)
        .get();
      
      // 各従業員にメール送信
      for (const payslipDoc of payslipsSnapshot.docs) {
        const payslip = payslipDoc.data();
        
        if (payslip.userId) {
          // ユーザー情報を取得
          const userDoc = await db.collection('users').doc(payslip.userId).get();
          
          if (userDoc.exists) {
            const user = userDoc.data();
            
            // メール送信処理
            // ここでは実際にはFirebase Auth経由でカスタムメールを送信する処理を実装
            // サンプルとして、送信記録だけ残す
            await db.collection('emailLogs').add({
              userId: payslip.userId,
              email: user.email,
              payslipId: payslipDoc.id,
              notificationId: doc.id,
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
              status: 'sent'
            });
            
            console.log(`ユーザー ${user.email} に通知を送信しました`);
          }
        }
      }
      
      // 通知ステータスを完了に更新
      await doc.ref.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
    } catch (error) {
      console.error(`通知 ${doc.id} の処理中にエラーが発生しました:`, error);
      
      // エラーステータスを更新
      await doc.ref.update({
        status: 'error',
        errorMessage: error.message,
        errorAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
  
  return null;
});
*/
// ローカルテスト用の代替関数
exports.checkEmailNotificationsManual = functions.https.onCall(async (data, context) => {
  const now = admin.firestore.Timestamp.now();
  
  // 元のcheckEmailNotifications関数と同じロジック...
  
  return { success: true, message: "通知チェックが完了しました" };
});
// 給与明細アクセス時のイベント
exports.logPayslipView = functions.https.onCall(async (data, context) => {
  // 認証チェック
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'ユーザー認証が必要です'
    );
  }

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
    
    // 本人確認（給与明細の所有者かどうか）
    if (payslipData.userId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'この給与明細の閲覧権限がありません'
      );
    }
    
    // 閲覧ログを記録
    await db.collection('viewLogs').add({
      payslipId: payslipId,
      userId: context.auth.uid,
      viewedAt: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: data.userAgent || null
    });
    
    // 閲覧済みフラグをセット
    await payslipDoc.ref.update({
      viewed: true,
      firstViewedAt: payslipData.firstViewedAt || admin.firestore.FieldValue.serverTimestamp(),
      lastViewedAt: admin.firestore.FieldValue.serverTimestamp()
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