// functions/index.js
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const { PassThrough } = require('stream');
// const sgMail = require('@sendgrid/mail'); // 一時的に無効化

// Global options設定
setGlobalOptions({ region: 'asia-northeast1' });

admin.initializeApp();
const db = admin.firestore();

// SendGrid設定 - 一時的に無効化（審査待ちのため）
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// メール送信関数 - 一時的に無効化（SendGrid審査待ちのため）
const sendEmail = async (to, subject, htmlContent, textContent = null) => {
  console.log(`📧 メール送信はSendGrid審査待ちのため無効化中: ${to} - ${subject}`);
  return { success: false, error: 'SendGrid設定待ちのためメール送信は無効化されています' };
};

// 招待メールテンプレート
const createInvitationEmailContent = (employeeName, tempPassword, loginUrl) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background-color: #4A90E2; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background-color: #ffffff; }
    .login-info { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>給与明細システム ログイン情報</h1>
    </div>
    <div class="content">
      <h2>${employeeName} 様</h2>
      <p>給与明細システムへのアクセス権が付与されました。</p>
      
      <div class="login-info">
        <h3>ログイン情報</h3>
        <p><strong>ログインページ:</strong><br>
        <a href="${loginUrl}" class="button">給与明細システムにログイン</a></p>
        
        <p><strong>初回ログイン用パスワード:</strong><br>
        <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${tempPassword}</code></p>
      </div>
      
      <h3>ログイン手順</h3>
      <ol>
        <li>上記のログインページにアクセス</li>
        <li>メールアドレスと初回ログイン用パスワードでログイン</li>
        <li>初回ログイン時に新しいパスワードを設定</li>
        <li>以降は新しいパスワードでログイン</li>
      </ol>
      
      <p><strong>注意:</strong> 初回ログイン用パスワードは一度きりの使用です。必ず新しいパスワードに変更してください。</p>
    </div>
    <div class="footer">
      <p>このメールに心当たりがない場合は、システム管理者にお問い合わせください。</p>
    </div>
  </div>
</body>
</html>`;
};

// 給与明細通知メールテンプレート
const createPayslipNotificationContent = (employeeName, paymentDate, loginUrl) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background-color: #ffffff; }
    .payslip-info { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>給与明細のお知らせ</h1>
    </div>
    <div class="content">
      <h2>${employeeName} 様</h2>
      <p>${paymentDate}の給与明細をご確認いただけます。</p>
      
      <div class="payslip-info">
        <h3>給与明細確認</h3>
        <p>下記のボタンをクリックして給与明細システムにログインし、明細をご確認ください。</p>
        <a href="${loginUrl}" class="button">給与明細を確認する</a>
      </div>
      
      <p><strong>注意事項:</strong></p>
      <ul>
        <li>給与明細は機密情報です。第三者に開示しないでください。</li>
        <li>内容に関するご質問は人事部までお問い合わせください。</li>
      </ul>
    </div>
    <div class="footer">
      <p>このメールに心当たりがない場合は、システム管理者にお問い合わせください。</p>
    </div>
  </div>
</body>
</html>`;
};

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
exports.processCSV = onCall(async (request) => {
  const { data, auth } = request;
  console.log('processCSV 関数が呼び出されました');
  console.log('受信データ (RAW):', safeStringify(data));
  
  // 認証チェック（一時的に無効化）
  /*
  if (!auth) {
    throw new HttpsError(
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
      // CSVマッピング設定から従業員IDと部門コードのヘッダー名を取得
    let employeeIdColumn = null;
    let departmentCodeColumn = null;
    
    if (actualData && actualData.mappingConfig) {
      const mapping = actualData.mappingConfig;
      if (mapping.mainFields) {
        employeeIdColumn = mapping.mainFields.employeeCode?.headerName || null;
        departmentCodeColumn = mapping.mainFields.departmentCode?.headerName || null;
      }
    }
    
    console.log(`[DEBUG] 従業員IDカラム: ${employeeIdColumn}, 部門コードカラム: ${departmentCodeColumn}`);
  const columnMappings = actualData ? actualData.columnMappings : {};
  
  // パラメータ検証（一時的に無効化してテスト）
  console.log('パラメータ検証開始');
  console.log('uploadId値:', uploadId, 'type:', typeof uploadId, 'truthy:', !!uploadId);
  console.log('fileUrl値:', fileUrl, 'type:', typeof fileUrl, 'truthy:', !!fileUrl);
  console.log('companyId値:', companyId, 'type:', typeof companyId, 'truthy:', !!companyId);
  
  if (!uploadId) {
    console.error('uploadId検証失敗:', uploadId);
    throw new HttpsError('invalid-argument', '必要なパラメータが不足しています: uploadId');
  }
  if (!fileUrl) {
    console.error('fileUrl検証失敗:', fileUrl);
    throw new HttpsError('invalid-argument', '必要なパラメータが不足しています: fileUrl');
  }
  if (!companyId) {
    console.error('companyId検証失敗:', companyId);
    throw new HttpsError('invalid-argument', '必要なパラメータが不足しています: companyId');
  }
  
  console.log('すべてのパラメータ検証通過');
  
  try {
    await logDebug(uploadId, '処理開始', { companyId, updateEmployeeInfo });
    
    // アップロード情報を取得
    const uploadRef = db.collection('csvUploads').doc(uploadId);
    const uploadDoc = await uploadRef.get();
    
    if (!uploadDoc.exists) {
      throw new HttpsError('not-found', 'アップロード情報が見つかりません');
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
      throw new HttpsError('not-found', 'CSVマッピング設定から給与項目を取得できませんでした');
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
      throw new HttpsError('failed-precondition', 'CSVマッピング設定が見つかりません');
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
    
    throw new HttpsError(
      'internal',
      'CSVファイルの処理中にエラーが発生しました: ' + error.message
    );
  }
});

// テスト用の簡易関数
exports.testSimpleCSV = onCall(async (request) => {
  const { data, auth } = request;
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
    throw new HttpsError(
      'internal',
      'テスト中にエラーが発生しました: ' + error.message
    );
  }
});

// 招待メール送信Function - 一時的に無効化
/*
exports.sendInvitationEmail = onDocumentUpdated('employees/{employeeId}', async (event) => {
    const change = event.data;
    const newData = change.after.data();
    const oldData = change.before.data();
    const employeeId = event.params.employeeId;
    
    try {
      // statusが 'preparation' → 'auth_created' に変更された場合のみ招待メール送信
      if (oldData.status === 'preparation' && newData.status === 'auth_created') {
        console.log(`📧 招待メール送信処理開始: ${employeeId}`);
        
        if (!newData.email || !newData.tempPassword || !newData.name) {
          console.error('招待メール送信に必要な情報が不足:', {
            email: !!newData.email,
            tempPassword: !!newData.tempPassword,
            name: !!newData.name
          });
          return;
        }
        
        const loginUrl = 'https://kyuyoprint.web.app/employee/login';
        const htmlContent = createInvitationEmailContent(newData.name, newData.tempPassword, loginUrl);
        const subject = '【給与明細システム】ログイン情報のお知らせ';
        
        const result = await sendEmail(newData.email, subject, htmlContent);
        
        if (result.success) {
          // メール送信成功をFirestoreに記録
          await change.after.ref.update({
            invitationEmailSent: true,
            invitationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            lastEmailResult: 'success'
          });
          console.log(`✅ 招待メール送信完了: ${newData.email}`);
        } else {
          // メール送信失敗をFirestoreに記録
          await change.after.ref.update({
            invitationEmailSent: false,
            lastEmailResult: 'failed',
            lastEmailError: result.error
          });
          console.error(`❌ 招待メール送信失敗: ${newData.email}`, result.error);
        }
      }
    } catch (error) {
      console.error('招待メール送信Function エラー:', error);
      
      // エラーをFirestoreに記録
      try {
        await change.after.ref.update({
          lastEmailResult: 'error',
          lastEmailError: error.message
        });
      } catch (updateError) {
        console.error('エラー記録失敗:', updateError);
      }
    }
  });
*/

// 給与明細通知メール送信Function - 一時的に無効化
/*
exports.sendPayslipNotifications = onCall(async (request) => {
  try {
    const { data, auth } = request;
    console.log('📧 給与明細通知メール一括送信開始');
    
    const { uploadId, paymentDate } = data;
    
    if (!uploadId || !paymentDate) {
      throw new HttpsError(
        'invalid-argument',
        'uploadId と paymentDate は必須です'
      );
    }
    
    // 該当する給与明細データを取得
    const payslipsSnapshot = await admin.firestore()
      .collection('payslips')
      .where('uploadId', '==', uploadId)
      .get();
      
    if (payslipsSnapshot.empty) {
      throw new HttpsError(
        'not-found',
        '指定されたuploadIdの給与明細が見つかりません'
      );
    }
    
    const loginUrl = 'https://kyuyoprint.web.app/employee/login';
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    console.log(`📧 ${payslipsSnapshot.size}件の給与明細通知メールを送信します`);
    
    // 各従業員にメール送信
    for (const payslipDoc of payslipsSnapshot.docs) {
      const payslipData = payslipDoc.data();
      
      try {
        // 従業員情報を取得
        const employeeSnapshot = await admin.firestore()
          .collection('employees')
          .where('employeeId', '==', payslipData.employeeId)
          .where('companyId', '==', payslipData.companyId)
          .get();
          
        if (employeeSnapshot.empty) {
          console.warn(`従業員が見つかりません: ${payslipData.employeeId}`);
          failCount++;
          continue;
        }
        
        const employeeData = employeeSnapshot.docs[0].data();
        
        if (!employeeData.email) {
          console.warn(`メールアドレスが設定されていません: ${payslipData.employeeId}`);
          failCount++;
          continue;
        }
        
        // メール送信
        const htmlContent = createPayslipNotificationContent(
          employeeData.name || payslipData.employeeId,
          paymentDate,
          loginUrl
        );
        const subject = `【給与明細】${paymentDate}の給与明細のお知らせ`;
        
        const result = await sendEmail(employeeData.email, subject, htmlContent);
        
        if (result.success) {
          successCount++;
          console.log(`✅ 給与明細通知メール送信成功: ${employeeData.email}`);
        } else {
          failCount++;
          console.error(`❌ 給与明細通知メール送信失敗: ${employeeData.email}`, result.error);
        }
        
        results.push({
          employeeId: payslipData.employeeId,
          email: employeeData.email,
          success: result.success,
          error: result.error || null
        });
        
        // API制限を避けるため少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (employeeError) {
        console.error(`従業員処理エラー: ${payslipData.employeeId}`, employeeError);
        failCount++;
        results.push({
          employeeId: payslipData.employeeId,
          email: null,
          success: false,
          error: employeeError.message
        });
      }
    }
    
    console.log(`📧 給与明細通知メール一括送信完了: 成功 ${successCount}件、失敗 ${failCount}件`);
    
    return {
      success: true,
      totalCount: payslipsSnapshot.size,
      successCount,
      failCount,
      results
    };
    
  } catch (error) {
    console.error('給与明細通知メール一括送信エラー:', error);
    throw new HttpsError(
      'internal',
      '給与明細通知メール送信中にエラーが発生しました: ' + error.message
    );
  }
});
*/

// 賞与CSVデータを処理してbonusPayslipsコレクションに保存
exports.processBonusCSV = onCall(async (request) => {
  const { data, auth } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'ユーザー認証が必要です');
  }

  const { uploadId, fileUrl, companyId, paymentDate, employeeIdColumn, departmentCodeColumn, mappingSettings } = data;

  if (!uploadId || !fileUrl || !companyId || !paymentDate) {
    throw new HttpsError('invalid-argument', '必要なパラメータが不足しています');
  }

  try {
    console.log('📋 賞与CSV処理開始:', { uploadId, companyId, paymentDate });

    // アップロード情報を取得
    const uploadRef = db.collection('csvUploads').doc(uploadId);
    const uploadDoc = await uploadRef.get();
    
    if (!uploadDoc.exists) {
      throw new HttpsError('not-found', 'アップロード情報が見つかりません');
    }

    const uploadData = uploadDoc.data();
    console.log('📄 アップロード情報:', uploadData);

    // 処理ステータスを更新
    await uploadRef.update({
      status: 'processing',
      processingStartedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // CSVファイルを取得
    console.log('📥 CSVファイル取得開始:', fileUrl);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`CSVファイル取得エラー: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    console.log('📄 CSVファイル取得完了、サイズ:', csvText.length);

    // CSVを解析
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSVファイルにデータが含まれていません');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataLines = lines.slice(1);

    console.log('📊 CSV解析結果:', {
      ヘッダー数: headers.length,
      データ行数: dataLines.length,
      ヘッダー: headers
    });

    // 従業員マッピング用のデータを準備
    const employeesSnapshot = await db.collection('employees')
      .where('companyId', '==', companyId)
      .get();

    const employeeMap = new Map();
    employeesSnapshot.forEach(doc => {
      const employeeData = doc.data();
      const employeeId = employeeData.employeeId || employeeData.employeeNumber;
      if (employeeId) {
        employeeMap.set(String(employeeId), {
          userId: doc.id,
          data: employeeData
        });
      }
    });

    console.log('👥 従業員マッピング準備完了:', employeeMap.size, '件');

    let processedCount = 0;
    let errorCount = 0;
    const batch = db.batch();

    // 各データ行を処理
    for (let i = 0; i < dataLines.length; i++) {
      try {
        const line = dataLines[i];
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        
        if (values.length !== headers.length) {
          console.warn(`⚠️ 行 ${i + 2}: 列数が一致しません (期待: ${headers.length}, 実際: ${values.length})`);
          errorCount++;
          continue;
        }

        // 行データをオブジェクト形式に変換
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        // 従業員IDを取得
        const employeeId = employeeIdColumn ? rowData[employeeIdColumn] : '';
        if (!employeeId) {
          console.warn(`⚠️ 行 ${i + 2}: 従業員IDが見つかりません`);
          errorCount++;
          continue;
        }

        // 従業員情報を検索
        const employeeInfo = employeeMap.get(String(employeeId));
        if (!employeeInfo) {
          console.warn(`⚠️ 行 ${i + 2}: 従業員ID ${employeeId} が従業員マスタに見つかりません`);
          errorCount++;
          continue;
        }

        // 部門コードを取得
        const departmentCode = departmentCodeColumn ? rowData[departmentCodeColumn] : employeeInfo.data.departmentCode || '';

        // 項目データを構築
        const items = {};
        Object.keys(rowData).forEach(key => {
          // 従業員ID・部門コード以外の項目を処理
          if (key !== employeeIdColumn && key !== departmentCodeColumn && key && key.trim() !== '') {
            const itemName = mappingSettings.simpleMapping?.[key] || key;
            const itemType = mappingSettings.itemCategories?.[key] || 'income';
            const isVisible = mappingSettings.visibilitySettings?.[key] !== false;
            
            let value = rowData[key] || '';
            value = String(value).trim();
            
            // 数値変換を試行
            if (value !== '' && !isNaN(value)) {
              value = Number(value);
            }
            
            items[key] = {
              value: value,
              name: itemName,
              type: itemType,
              isVisible: isVisible
            };
          }
        });

        // 賞与明細データを作成
        const bonusPayslipData = {
          userId: employeeInfo.userId,
          employeeId: employeeId,
          companyId: companyId,
          departmentCode: departmentCode,
          paymentDate: new Date(paymentDate),
          items: items,
          payslipType: 'bonus',
          uploadId: uploadId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: auth.uid
        };

        // バッチに追加（bonusPayslipsコレクション）
        const payslipRef = db.collection('bonusPayslips').doc();
        batch.set(payslipRef, bonusPayslipData);
        
        processedCount++;

      } catch (rowError) {
        console.error(`❌ 行 ${i + 2} 処理エラー:`, rowError);
        errorCount++;
      }
    }

    // バッチでFirestoreに書き込み
    if (processedCount > 0) {
      console.log('💾 Firestoreバッチ書き込み開始:', processedCount, '件');
      await batch.commit();
      console.log('✅ Firestoreバッチ書き込み完了');
    }

    // アップロード情報を更新
    await uploadRef.update({
      status: 'completed',
      processedCount: processedCount,
      errorCount: errorCount,
      completedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('🎉 賞与CSV処理完了:', {
      処理件数: processedCount,
      エラー件数: errorCount
    });

    return {
      success: true,
      processedCount: processedCount,
      errorCount: errorCount,
      message: `賞与明細 ${processedCount} 件を作成しました（エラー: ${errorCount} 件）`
    };

  } catch (error) {
    console.error('❌ 賞与CSV処理エラー:', error);
    
    // エラー時もアップロード情報を更新
    try {
      await db.collection('csvUploads').doc(uploadId).update({
        status: 'error',
        errorMessage: error.message,
        errorAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (updateError) {
      console.error('アップロード情報更新エラー:', updateError);
    }

    throw new HttpsError('internal', '賞与CSV処理中にエラーが発生しました: ' + error.message);
  }
});

// 賞与明細通知メール一括送信 - 一時的に無効化
/*
exports.sendBonusPayslipNotifications = onCall(async (request) => {
  const { data, auth } = request;
  
  if (!auth) {
    throw new HttpsError('unauthenticated', 'ユーザー認証が必要です');
  }

  const { uploadId, paymentDate } = data;

  if (!uploadId || !paymentDate) {
    throw new HttpsError('invalid-argument', 'uploadId と paymentDate は必須です');
  }

  try {
    console.log('📧 賞与明細通知メール一括送信開始:', { uploadId, paymentDate });

    // 対象の賞与明細を取得
    const payslipsSnapshot = await db.collection('bonusPayslips')
      .where('uploadId', '==', uploadId)
      .get();

    if (payslipsSnapshot.empty) {
      throw new HttpsError('not-found', '対象の賞与明細が見つかりません');
    }

    console.log(`📋 対象賞与明細: ${payslipsSnapshot.size} 件`);

    let successCount = 0;
    let failCount = 0;
    const results = [];

    // 各賞与明細に対してメール送信
    for (const payslipDoc of payslipsSnapshot.docs) {
      const payslipData = payslipDoc.data();
      
      try {
        // 従業員情報を取得
        const employeeDoc = await db.collection('employees').doc(payslipData.userId).get();
        
        if (!employeeDoc.exists()) {
          throw new Error('従業員情報が見つかりません');
        }

        const employeeData = employeeDoc.data();
        const employeeEmail = employeeData.email;

        if (!employeeEmail) {
          throw new Error('従業員のメールアドレスが設定されていません');
        }

        // 賞与明細通知メールを送信
        const subject = `【賞与明細】${paymentDate} の賞与明細をご確認ください`;
        const htmlContent = `
          <html>
            <body>
              <h2>賞与明細のお知らせ</h2>
              <p>${employeeData.name || employeeData.displayName} 様</p>
              <p>${paymentDate} の賞与明細が発行されました。</p>
              <p>システムにログインしてご確認ください。</p>
              <p><a href="${process.env.APP_URL || 'https://kyuyoprint.web.app'}/employee/bonus-payslips">賞与明細を確認する</a></p>
              <hr>
              <p><small>このメールは自動送信されています。</small></p>
            </body>
          </html>
        `;

        const emailResult = await sendEmail(employeeEmail, subject, htmlContent);
        
        if (emailResult.success) {
          successCount++;
          results.push({
            employeeId: payslipData.employeeId,
            email: employeeEmail,
            success: true
          });
        } else {
          throw new Error(emailResult.error || 'メール送信に失敗しました');
        }

      } catch (employeeError) {
        console.error(`❌ 従業員 ${payslipData.employeeId} メール送信エラー:`, employeeError);
        failCount++;
        results.push({
          employeeId: payslipData.employeeId,
          email: null,
          success: false,
          error: employeeError.message
        });
      }
    }
    
    console.log(`📧 賞与明細通知メール一括送信完了: 成功 ${successCount}件、失敗 ${failCount}件`);
    
    return {
      success: true,
      totalCount: payslipsSnapshot.size,
      successCount,
      failCount,
      results
    };
    
  } catch (error) {
    console.error('賞与明細通知メール一括送信エラー:', error);
    throw new HttpsError(
      'internal',
      '賞与明細通知メール送信中にエラーが発生しました: ' + error.message
    );
  }
});
*/