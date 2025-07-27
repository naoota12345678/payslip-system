// functions/index.js
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const { PassThrough } = require('stream');
const { Resend } = require('resend');
// const sgMail = require('@sendgrid/mail'); // 一時的に無効化

// Global options設定（CORS設定を追加）
setGlobalOptions({ 
  region: 'asia-northeast1'
});

admin.initializeApp();
const db = admin.firestore();

// Resend設定
const resend = new Resend(process.env.RESEND_API_KEY);

// メール送信関数（Resend使用）
const sendEmail = async (to, subject, htmlContent, textContent = null) => {
  try {
    console.log(`📧 Resend経由でメール送信中: ${to} - ${subject}`);
    
    const emailData = {
      from: process.env.FROM_EMAIL || 'noreply@atelier-temma.com',
      to: to,
      subject: subject,
      html: htmlContent
    };
    
    if (textContent) {
      emailData.text = textContent;
    }
    
    const result = await resend.emails.send(emailData);
    console.log('✅ メール送信成功:', result);
    return { success: true, result };
  } catch (error) {
    console.error('❌ メール送信エラー:', error);
    return { success: false, error: error.message };
  }
};

// テスト用固定パスワード
const TEST_PASSWORD = '000000';

// 簡単なテスト関数
exports.simpleTest = onCall(async (request) => {
  console.log('🔥 simpleTest 関数が呼び出されました');
  console.log('受信データ:', request.data);
  
  // 認証状態をログ出力
  console.log('認証状態:', request.auth ? '認証済み' : '未認証');
  if (request.auth) {
    console.log('認証ユーザーUID:', request.auth.uid);
  }
  
  return {
    success: true,
    message: 'テスト関数が正常に動作しています',
    timestamp: new Date().toISOString(),
    receivedData: request.data
  };
});

// 従業員作成時にFirebase Authアカウントも作成
// 従業員UIDを修正する一時的な関数
exports.fixEmployeeUIDs = onCall({ 
  enforceAppCheck: false,
  invoker: 'public'
}, async (request) => {
  console.log('🔧 従業員UID修正関数が呼び出されました');
  
  // 認証確認
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'この機能を使用するには管理者認証が必要です');
  }
  
  try {
    // 全ての従業員を取得
    const employeesSnapshot = await db.collection('employees').get();
    console.log(`📊 ${employeesSnapshot.size}件の従業員データを確認中...`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    const results = [];
    
    for (const doc of employeesSnapshot.docs) {
      const employeeData = doc.data();
      const docId = doc.id;
      
      // UIDが既に設定されている場合はスキップ  
      if (employeeData.uid) {
        console.log(`⏭️  スキップ: ${employeeData.email} (UID既に設定済み)`);
        skippedCount++;
        results.push({ email: employeeData.email, status: 'skipped', reason: 'UID既に設定済み' });
        continue;
      }
      
      // メールアドレスがない場合はスキップ
      if (!employeeData.email) {
        console.log(`⚠️  スキップ: ${docId} (メールアドレスなし)`);
        skippedCount++;
        results.push({ docId, status: 'skipped', reason: 'メールアドレスなし' });
        continue;
      }
      
      try {
        // Firebase Authでユーザーをメールアドレスで検索
        const userRecord = await admin.auth().getUserByEmail(employeeData.email);
        
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
        results.push({ email: employeeData.email, status: 'fixed', uid: userRecord.uid });
        
      } catch (authError) {
        if (authError.code === 'auth/user-not-found') {
          console.log(`❌ 未修正: ${employeeData.email} (Firebase Authユーザーが存在しません)`);
          results.push({ email: employeeData.email, status: 'not_found', reason: 'Firebase Authユーザーが存在しません' });
        } else {
          console.error(`❌ エラー: ${employeeData.email}`, authError.message);
          results.push({ email: employeeData.email, status: 'error', reason: authError.message });
        }
        skippedCount++;
      }
    }
    
    const summary = {
      fixed: fixedCount,
      skipped: skippedCount,
      total: fixedCount + skippedCount,
      results: results
    };
    
    console.log(`🎉 修正完了: 修正${fixedCount}件、スキップ${skippedCount}件`);
    return summary;
    
  } catch (error) {
    console.error('❌ UID修正処理でエラー:', error);
    throw new HttpsError('internal', `UID修正処理でエラーが発生しました: ${error.message}`);
  }
});

exports.createEmployeeAccount = onCall({ 
  enforceAppCheck: false,
  invoker: 'public'
}, async (request) => {
  console.log('🔥 createEmployeeAccount 関数の最初の行に到達');
  console.log('🔍 Request情報:', {
    hasAuth: !!request.auth,
    authUid: request.auth?.uid,
    origin: request.rawRequest?.headers?.origin,
    method: request.rawRequest?.method
  });
  
  // 認証確認（より厳密に）
  if (!request.auth || !request.auth.uid) {
    console.error('❌ 認証されていないリクエスト');
    console.error('Auth情報:', request.auth);
    throw new HttpsError('unauthenticated', 'この機能を使用するには管理者認証が必要です');
  }
  
  // 管理者権限確認（必要に応じて）
  try {
    const userRecord = await admin.auth().getUser(request.auth.uid);
    console.log('認証済みユーザーEmail:', userRecord.email);
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    throw new HttpsError('permission-denied', '無効なユーザーです');
  }
  
  console.log('✅ 認証済みユーザー:', request.auth.uid);
  
  try {
    console.log('🚀 createEmployeeAccount 関数開始');
    console.log('📥 受信データ:', JSON.stringify(request.data, null, 2));
    
    // Firebase Admin SDK の初期化確認
    console.log('🔧 Firebase Admin SDK 初期化状況確認...');
    try {
      const testAuth = admin.auth();
      console.log('✅ Firebase Auth SDK 初期化成功');
    } catch (initError) {
      console.error('❌ Firebase Auth SDK 初期化失敗:', initError);
      throw new Error(`Firebase Auth SDK 初期化エラー: ${initError.message}`);
    }
    
    const { email, name, employeeData } = request.data;
    
    // 入力パラメータの詳細検証
    if (!email) {
      throw new Error('emailパラメータが必要です');
    }
    if (!name) {
      throw new Error('nameパラメータが必要です');
    }
    
    // メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`無効なメールアドレス形式: ${email}`);
    }
    
    console.log('✅ パラメータ検証完了:', { email, name });
    
    // 既存ユーザーの確認
    try {
      const existingUser = await admin.auth().getUserByEmail(email);
      console.log('⚠️ 既存ユーザーが見つかりました:', existingUser.uid);
      
      return {
        success: true,
        uid: existingUser.uid,
        email: email,
        testPassword: TEST_PASSWORD,
        message: '既存のアカウントを使用しました（既に存在していました）'
      };
    } catch (getUserError) {
      // ユーザーが存在しない場合（期待される動作）
      if (getUserError.code === 'auth/user-not-found') {
        console.log('✅ 新規ユーザー作成を続行します');
      } else {
        console.error('❌ ユーザー検索時のエラー:', getUserError);
        throw getUserError;
      }
    }
    
    console.log('👤 Firebase Authユーザー作成開始...');
    
    // Firebase Authでユーザー作成
    const userRecord = await admin.auth().createUser({
      email: email,
      password: TEST_PASSWORD, // テスト用固定パスワード
      displayName: name,
      emailVerified: false
    });
    
    console.log('✅ 従業員アカウント作成完了:', {
      uid: userRecord.uid,
      email: email,
      displayName: userRecord.displayName,
      emailVerified: userRecord.emailVerified,
      creationTime: userRecord.metadata.creationTime
    });
    
    // 従業員データにuidを追加
    console.log('🔄 Firestoreの従業員データにUIDを更新中...');
    
    try {
      // メールアドレスで従業員ドキュメントを検索
      const employeesQuery = db.collection('employees').where('email', '==', email);
      const employeesSnapshot = await employeesQuery.get();
      
      if (!employeesSnapshot.empty) {
        // 従業員ドキュメントが見つかった場合、UIDを更新
        const employeeDoc = employeesSnapshot.docs[0];
        await employeeDoc.ref.update({
          uid: userRecord.uid,
          userType: 'employee', // 従業員として明示的に設定
          role: 'employee', // 従業員ロール
          status: 'auth_created',
          isFirstLogin: true,
          tempPassword: TEST_PASSWORD,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ 従業員データのUID更新完了:', {
          docId: employeeDoc.id,
          uid: userRecord.uid,
          email: email
        });
      } else {
        console.warn('⚠️ メールアドレスに対応する従業員データが見つかりません:', email);
      }
    } catch (firestoreError) {
      console.error('❌ Firestore更新エラー:', firestoreError);
      // Firestoreエラーでもユーザー作成は成功しているので続行
    }
    
    // メール送信（現在は無効化中）
    try {
      await sendEmployeeInvitationEmail(email, name, TEST_PASSWORD);
    } catch (mailError) {
      console.log('メール送信エラー（無視）:', mailError.message);
    }
    
    console.log('🎉 createEmployeeAccount 関数完了');
    
    return {
      success: true,
      uid: userRecord.uid,
      email: email,
      testPassword: TEST_PASSWORD,
      message: '従業員アカウントが作成されました'
    };
    
  } catch (error) {
    console.error('❌ 従業員アカウント作成エラー (詳細):', {
      message: error.message,
      code: error.code,
      details: error.details,
      stack: error.stack
    });
    
    // エラーの詳細な分析
    if (error.code === 'auth/email-already-exists') {
      console.log('🔍 原因: メールアドレスが既に使用されています');
    } else if (error.code === 'auth/invalid-email') {
      console.log('🔍 原因: 無効なメールアドレス形式です');
    } else if (error.code === 'auth/weak-password') {
      console.log('🔍 原因: パスワードが弱すぎます');
    } else if (error.code === 'auth/quota-exceeded') {
      console.log('🔍 原因: APIクォータを超過しました');
    } else {
      console.log('🔍 原因: 不明なエラー');
    }
    
    throw new HttpsError('internal', `アカウント作成に失敗しました: [${error.code || 'UNKNOWN'}] ${error.message}`);
  }
});

// 従業員招待メール送信関数
const sendEmployeeInvitationEmail = async (email, name, tempPassword) => {
  const loginUrl = 'https://kyuyoprint.web.app/employee/login';
  const subject = '給与明細システム - ログイン情報';
  const htmlContent = createInvitationEmailContent(name, tempPassword, loginUrl);
  
  console.log(`📧 従業員招待メール送信準備: ${email}`);
  console.log(`📋 ログイン情報 - Email: ${email}, Password: ${tempPassword}`);
  
  // 実際のメール送信は現在無効化中
  return await sendEmail(email, subject, htmlContent);
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
const createPayslipNotificationContent = (employeeName, paymentDate, loginUrl, type = 'payslip') => {
  const isBonus = type === 'bonus';
  const title = isBonus ? '賞与明細のお知らせ' : '給与明細のお知らせ';
  const description = isBonus ? '賞与明細' : '給与明細';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background-color: ${isBonus ? '#fd7e14' : '#28a745'}; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px; background-color: #ffffff; }
    .payslip-info { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .button { display: inline-block; background-color: ${isBonus ? '#fd7e14' : '#28a745'}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
    </div>
    <div class="content">
      <h2>${employeeName} 様</h2>
      <p>${paymentDate}の${description}をご確認いただけます。</p>
      
      <div class="payslip-info">
        <h3>${description}確認</h3>
        <p>下記のボタンをクリックして給与明細システムにログインし、明細をご確認ください。</p>
        <a href="${loginUrl}" class="button">${description}を確認する</a>
      </div>
      
      <p><strong>注意事項:</strong></p>
      <ul>
        <li>${description}は機密情報です。第三者に開示しないでください。</li>
        <li>内容に関するご質問は人事部までお問い合わせください。</li>
        <li>ログインできない場合は、システム管理者にお問い合わせください。</li>
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

// 給与明細通知メール送信Function
exports.sendPayslipNotifications = onCall(async (request) => {
  const { data, auth } = request;
  
  // 認証チェック
  if (!auth) {
    throw new HttpsError('unauthenticated', 'ユーザー認証が必要です');
  }
  
  const { 
    uploadId, 
    paymentDate, 
    scheduleDate, // 送信予定日時（指定日の9時）
    type = 'payslip' // 'payslip' または 'bonus'
  } = data;
  
  if (!uploadId || !paymentDate) {
    throw new HttpsError('invalid-argument', 'uploadId と paymentDate は必須です');
  }
  
  try {
    console.log('📧 給与明細通知メール送信開始:', { uploadId, paymentDate, type, scheduleDate });
    
    // 対象コレクションを決定
    const collectionName = type === 'bonus' ? 'bonusPayslips' : 'payslips';
    
    // 該当する明細データを取得
    const payslipsSnapshot = await db.collection(collectionName)
      .where('uploadId', '==', uploadId)
      .get();
      
    if (payslipsSnapshot.empty) {
      throw new HttpsError('not-found', `指定されたuploadIdの${type === 'bonus' ? '賞与' : '給与'}明細が見つかりません`);
    }
    
    console.log(`📋 対象明細数: ${payslipsSnapshot.size}件`);
    
    // スケジュール送信の場合は通知設定を保存して終了
    if (scheduleDate) {
      const notificationDoc = {
        uploadId,
        paymentDate,
        type,
        scheduleDate: new Date(scheduleDate),
        status: 'scheduled',
        targetCount: payslipsSnapshot.size,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.uid
      };
      
      await db.collection('emailNotifications').add(notificationDoc);
      
      console.log('📅 スケジュール送信設定完了:', scheduleDate);
      return {
        success: true,
        message: `${scheduleDate}に${payslipsSnapshot.size}件の通知メール送信をスケジュールしました`,
        scheduledCount: payslipsSnapshot.size,
        scheduleDate
      };
    }
    
    // 即座に送信する場合
    const loginUrl = process.env.APP_URL || 'https://kyuyoprint.web.app/employee/login';
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    // 各従業員にメール送信
    for (const payslipDoc of payslipsSnapshot.docs) {
      const payslipData = payslipDoc.data();
      
      try {
        // 従業員情報を取得
        let employeeData = null;
        
        // userIdがある場合はそれを使用
        if (payslipData.userId) {
          const employeeDoc = await db.collection('employees').doc(payslipData.userId).get();
          if (employeeDoc.exists) {
            employeeData = employeeDoc.data();
          }
        }
        
        // userIdがない場合はemployeeIdで検索
        if (!employeeData && payslipData.employeeId) {
          const employeeSnapshot = await db.collection('employees')
            .where('employeeId', '==', payslipData.employeeId)
            .where('companyId', '==', payslipData.companyId)
            .get();
            
          if (!employeeSnapshot.empty) {
            employeeData = employeeSnapshot.docs[0].data();
          }
        }
        
        if (!employeeData || !employeeData.email) {
          console.warn(`⚠️ 従業員情報またはメールアドレスが見つかりません: ${payslipData.employeeId}`);
          failCount++;
          results.push({
            employeeId: payslipData.employeeId,
            email: null,
            success: false,
            error: '従業員情報またはメールアドレスが見つかりません'
          });
          continue;
        }
        
        // メール送信
        const subjectPrefix = type === 'bonus' ? '【賞与明細】' : '【給与明細】';
        const subject = `${subjectPrefix}${paymentDate}の明細のお知らせ`;
        const htmlContent = createPayslipNotificationContent(
          employeeData.name || payslipData.employeeId,
          paymentDate,
          loginUrl,
          type
        );
        
        const result = await sendEmail(employeeData.email, subject, htmlContent);
        
        if (result.success) {
          successCount++;
          console.log(`✅ ${type}明細通知メール送信成功: ${employeeData.email}`);
        } else {
          failCount++;
          console.error(`❌ ${type}明細通知メール送信失敗: ${employeeData.email}`, result.error);
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
        console.error(`❌ 従業員処理エラー: ${payslipData.employeeId}`, employeeError);
        failCount++;
        results.push({
          employeeId: payslipData.employeeId,
          email: null,
          success: false,
          error: employeeError.message
        });
      }
    }
    
    console.log(`📧 ${type}明細通知メール送信完了: 成功 ${successCount}件、失敗 ${failCount}件`);
    
    return {
      success: true,
      totalCount: payslipsSnapshot.size,
      successCount,
      failCount,
      results,
      type
    };
    
  } catch (error) {
    console.error(`❌ ${type}明細通知メール送信エラー:`, error);
    throw new HttpsError('internal', `${type}明細通知メール送信中にエラーが発生しました: ` + error.message);
  }
});

// スケジュールされた通知を実行するFunction（毎日朝9時に自動実行）
exports.scheduledEmailNotifications = onSchedule({
  schedule: '0 9 * * *',  // 毎日9時0分
  timeZone: 'Asia/Tokyo', // 日本時間
  memory: '512MiB',       // メモリ増量（大量処理対応）
}, async (event) => {
  try {
    console.log('⏰ 毎日9時の通知処理開始');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 今日送信予定の通知を取得
    const notificationsSnapshot = await db.collection('emailNotifications')
      .where('status', '==', 'scheduled')
      .where('scheduleDate', '>=', admin.firestore.Timestamp.fromDate(today))
      .where('scheduleDate', '<', admin.firestore.Timestamp.fromDate(tomorrow))
      .get();
    
    if (notificationsSnapshot.empty) {
      console.log('⏰ 本日の送信予定はありません');
      return null;
    }
    
    console.log(`⏰ ${notificationsSnapshot.size}件の通知を処理します`);
    
    // バッチ処理で効率化
    const batchSize = 10; // 10件ずつ並列処理
    const notifications = notificationsSnapshot.docs;
    
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      
      // 並列処理
      await Promise.all(batch.map(async (notificationDoc) => {
        const notificationData = notificationDoc.data();
        
        try {
          // 通知ステータスを実行中に更新
          await notificationDoc.ref.update({
            status: 'executing',
            executionStartedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // 実際の通知を送信
          const result = await exports.sendPayslipNotifications({
            data: {
              uploadId: notificationData.uploadId,
              paymentDate: notificationData.paymentDate,
              type: notificationData.type
            },
            auth: { uid: notificationData.createdBy }
          });
          
          // 実行完了に更新
          await notificationDoc.ref.update({
            status: 'completed',
            executionCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
            executionResult: result
          });
          
          console.log(`✅ 通知完了: ${notificationDoc.id}`);
          
        } catch (notificationError) {
          console.error(`❌ 通知エラー: ${notificationDoc.id}`, notificationError);
          
          // エラーステータスに更新
          await notificationDoc.ref.update({
            status: 'error',
            executionError: notificationError.message,
            executionErrorAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }));
      
      // APIレート制限対策
      if (i + batchSize < notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
      }
    }
    
    console.log('⏰ 毎日9時の通知処理完了');
    return null;
    
  } catch (error) {
    console.error('⏰ スケジュール実行エラー:', error);
    // エラーログをFirestoreに記録
    await db.collection('systemLogs').add({
      type: 'scheduled_notification_error',
      error: error.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});