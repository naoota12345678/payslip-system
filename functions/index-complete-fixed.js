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
    
    // 方法1: 新しい方法(csvMappings) - 給与項目と個別のマッピング
    console.log('[DEBUG] 新しい方法(csvMappings) を確認中...');
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
              formula: item.formula || null,
              isRequired: item.isRequired || false,
              description: item.description || ''
            });
          }
        });
        
        console.log(`[DEBUG] 新しい方法で${items.length}個の項目を設定`);
        if (items.length > 0) {
          return items;
        }
      }
    }
    
    // 方法2: 古い方法(companies/{companyId}/csvSettings)
    console.log('[DEBUG] 古い方法を確認中...');
    const csvSettingsDoc = await db.collection('companies').doc(companyId)
      .collection('csvSettings').doc('default').get();
    
    if (csvSettingsDoc.exists) {
      const csvSettings = csvSettingsDoc.data();
      console.log('[DEBUG] csvSettings データ:', JSON.stringify(csvSettings, null, 2));
      
      if (csvSettings.payrollItems && Array.isArray(csvSettings.payrollItems)) {
        csvSettings.payrollItems.forEach(item => {
          items.push({
            id: item.id || `item_${Date.now()}_${Math.random()}`,
            name: item.name,
            type: item.type || 'other',
            csvColumn: item.csvColumn,
            formula: item.formula || null,
            isRequired: item.isRequired || false,
            description: item.description || ''
          });
        });
        
        console.log(`[DEBUG] 古い方法で${items.length}個の項目を設定`);
        if (items.length > 0) {
          return items;
        }
      }
    }
    
    // どちらの方法でも設定が見つからない場合はデフォルト項目を作成
    console.log('[DEBUG] デフォルト項目を作成');
    return [
      { id: 'default_income', name: '基本給', type: 'income', csvColumn: '基本給', isRequired: true },
      { id: 'default_deduction', name: '所得税', type: 'deduction', csvColumn: '所得税', isRequired: false }
    ];
    
  } catch (error) {
    console.error('給与項目生成エラー:', error);
    return [];
  }
};

// 従業員名を検出する関数
const detectEmployeeNameColumn = (headers) => {
  const nameColumns = ['氏名', '名前', 'name', 'Name', '社員名'];
  return headers.find(header => nameColumns.includes(header));
};

// メールアドレスを検出する関数
const detectEmailColumn = (headers) => {
  const emailColumns = ['メールアドレス', 'email', 'Email', 'mail', 'Mail'];
  return headers.find(header => emailColumns.includes(header));
};

// 従業員IDを検出する関数
const detectEmployeeIdColumn = (headers) => {
  const idColumns = ['社員番号', '従業員ID', 'employeeId', 'employee_id', 'ID', 'id'];
  return headers.find(header => idColumns.includes(header));
};

// 新規従業員を登録する関数
const registerNewEmployee = async (companyId, employeeData, existingUserIds) => {
  try {
    const { employeeId, name, email, departmentCode } = employeeData;
    
    // 重複チェック
    if (existingUserIds.has(employeeId)) {
      console.log(`[DEBUG] 従業員ID ${employeeId} は既に存在します`);
      return null;
    }
    
    // Firebase Authenticationでユーザーアカウントを作成（初期パスワード固定）
    let authUserId = null;
    if (email) {
      try {
        const userRecord = await admin.auth().createUser({
          email: email,
          password: '11111111', // 初期パスワード固定
          displayName: name
        });
        authUserId = userRecord.uid;
        console.log(`[DEBUG] Firebase Auth ユーザー作成: ${email} -> ${authUserId}`);
      } catch (authError) {
        console.warn(`[WARN] Firebase Auth ユーザー作成失敗 (${email}):`, authError.message);
        // Firebase Auth の作成に失敗してもFirestoreには保存を続行
      }
    }
    
    // usersコレクションに保存（authUserIdがある場合は指定のドキュメントIDで保存）
    const newUserData = {
      employeeId: employeeId,
      displayName: name,
      name: name,
      email: email || null,
      userType: 'employee',
      companyId: companyId,
      departmentCode: departmentCode || null,
      createdAt: getServerTimestamp(),
      createdBy: 'csv_auto_register',
      isActive: true,
      isAutoRegistered: true
    };
    
    let userRef;
    if (authUserId) {
      // Firebase Auth のUIDを使用してドキュメント作成
      userRef = db.collection('users').doc(authUserId);
      await userRef.set(newUserData);
    } else {
      // 通常の自動ID生成
      userRef = await db.collection('users').add(newUserData);
    }
    
    const finalUserId = authUserId || userRef.id;
    console.log(`[DEBUG] 新規従業員を登録: ${employeeId} (${name}) -> ${finalUserId}`);
    
    return finalUserId;
    
  } catch (error) {
    console.error(`[ERROR] 従業員登録エラー (${employeeData.employeeId}):`, error);
    return null;
  }
};

// 従業員とユーザーのマッピングを取得する関数
const getEmployeeUserMapping = async (companyId, registerNewEmployees = false, csvHeaders = [], csvData = []) => {
  try {
    console.log(`[DEBUG] 従業員マッピング取得開始: companyId=${companyId}, registerNewEmployees=${registerNewEmployees}`);
    
    // 既存のユーザーを取得
    const usersSnapshot = await db.collection('users')
      .where('companyId', '==', companyId)
      .get();
    
    const mapping = {};
    const existingUserIds = new Set();
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.employeeId) {
        mapping[userData.employeeId] = doc.id;
        existingUserIds.add(userData.employeeId);
      }
    });
    
    console.log(`[DEBUG] 既存ユーザーマッピング: ${Object.keys(mapping).length}件`);
    
    // 新規従業員登録が有効な場合
    if (registerNewEmployees && csvHeaders.length > 0 && csvData.length > 0) {
      console.log('[DEBUG] 新規従業員の自動登録を開始');
      
      // CSVヘッダーから必要な列を検出
      const nameColumn = detectEmployeeNameColumn(csvHeaders);
      const emailColumn = detectEmailColumn(csvHeaders);
      const employeeIdColumn = detectEmployeeIdColumn(csvHeaders);
      
      console.log(`[DEBUG] 検出した列: 氏名=${nameColumn}, メール=${emailColumn}, 従業員ID=${employeeIdColumn}`);
      
      if (nameColumn && employeeIdColumn) {
        let employeesCreated = 0;
        
        for (const row of csvData) {
          const employeeId = row[employeeIdColumn];
          const name = row[nameColumn];
          const email = row[emailColumn];
          
          if (employeeId && name && !existingUserIds.has(employeeId)) {
            const newUserId = await registerNewEmployee(companyId, {
              employeeId,
              name,
              email,
              departmentCode: row['部署コード'] || null
            }, existingUserIds);
            
            if (newUserId) {
              mapping[employeeId] = newUserId;
              existingUserIds.add(employeeId);
              employeesCreated++;
            }
          }
        }
        
        console.log(`[DEBUG] ${employeesCreated}件の新規従業員を登録しました`);
        return { mapping, employeesCreated };
      }
    }
    
    return { mapping, employeesCreated: 0 };
    
  } catch (error) {
    console.error('従業員マッピング取得エラー:', error);
    return { mapping: {}, employeesCreated: 0 };
  }
};

// CSVファイルを処理する関数
exports.processCSV = functions.https.onCall(async (data, context) => {
  const uploadId = data.uploadId || `upload_${Date.now()}`;
  
  try {
    console.log(`[INFO][${uploadId}] CSV処理開始`);
    await logDebug(uploadId, 'CSV処理開始', data);
    
    const { csvUrl, companyId, registerNewEmployees = false } = data;
    
    if (!csvUrl || !companyId) {
      throw new functions.https.HttpsError('invalid-argument', 'csvUrlとcompanyIdが必要です');
    }
    
    // アップロード状態を更新
    await db.collection('csvUploads').doc(uploadId).update({
      status: 'processing',
      startedAt: getServerTimestamp()
    });
    
    // 給与項目設定を取得
    const payrollItems = await generatePayrollItemsFromMappings(companyId);
    await logDebug(uploadId, '給与項目設定取得完了', { itemCount: payrollItems.length, items: payrollItems });
    
    if (payrollItems.length === 0) {
      throw new functions.https.HttpsError('failed-precondition', '給与項目の設定が見つかりません');
    }
    
    // CSVファイルをダウンロード
    await logDebug(uploadId, 'CSVダウンロード開始', { csvUrl });
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new functions.https.HttpsError('not-found', `CSVファイルのダウンロードに失敗しました: ${response.status}`);
    }
    
    // CSVデータを解析
    const csvData = [];
    const csvHeaders = [];
    
    await new Promise((resolve, reject) => {
      const stream = new PassThrough();
      stream.end(response.body);
      
      stream
        .pipe(csv())
        .on('headers', (headers) => {
          csvHeaders.push(...headers);
          console.log(`[DEBUG][${uploadId}] CSVヘッダー:`, headers);
        })
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', () => {
          console.log(`[DEBUG][${uploadId}] CSV解析完了: ${csvData.length}行`);
          resolve();
        })
        .on('error', (error) => {
          console.error(`[ERROR][${uploadId}] CSV解析エラー:`, error);
          reject(error);
        });
    });
    
    await logDebug(uploadId, 'CSV解析完了', { rowCount: csvData.length, headers: csvHeaders });
    
    if (csvData.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'CSVファイルにデータが含まれていません');
    }
    
    // 従業員とユーザーのマッピングを取得（必要に応じて新規登録も実行）
    const { mapping: employeeUserMapping, employeesCreated } = await getEmployeeUserMapping(
      companyId, 
      registerNewEmployees, 
      csvHeaders, 
      csvData
    );
    
    await logDebug(uploadId, '従業員マッピング取得完了', { 
      mappingCount: Object.keys(employeeUserMapping).length,
      employeesCreated
    });
    
    // CSVデータを処理
    const results = [];
    const batch = db.batch();
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNumber = i + 1;
      
      try {
        // 必須フィールドの確認
        const employeeIdColumn = detectEmployeeIdColumn(csvHeaders);
        if (!employeeIdColumn || !row[employeeIdColumn]) {
          console.warn(`[WARN][${uploadId}] 行${rowNumber}: 従業員IDが見つかりません`);
          continue;
        }
        
        const employeeId = row[employeeIdColumn];
        const userId = employeeUserMapping[employeeId];
        
        if (!userId) {
          console.warn(`[WARN][${uploadId}] 行${rowNumber}: 従業員ID ${employeeId} に対応するユーザーが見つかりません`);
          continue;
        }
        
        // 給与明細データを構築
        const payslipData = {
          companyId: companyId,
          employeeId: employeeId,
          userId: userId, // 重要: userIdを設定
          uploadId: uploadId,
          paymentDate: getServerTimestamp(),
          createdAt: getServerTimestamp(),
          items: {},
          totalIncome: 0,
          totalDeduction: 0,
          netAmount: 0
        };
        
        // 各給与項目を処理
        payrollItems.forEach(item => {
          if (row[item.csvColumn]) {
            const value = parseFloat(row[item.csvColumn]) || 0;
            
            payslipData.items[item.id] = {
              name: item.name,
              type: item.type,
              value: value,
              formula: item.formula || null
            };
            
            // 合計金額を計算
            if (item.type === 'income') {
              payslipData.totalIncome += value;
            } else if (item.type === 'deduction') {
              payslipData.totalDeduction += value;
            }
          }
        });
        
        // 手取り額を計算
        payslipData.netAmount = payslipData.totalIncome - payslipData.totalDeduction;
        
        // Firestoreに保存
        const payslipRef = db.collection('payslips').doc();
        batch.set(payslipRef, payslipData);
        
        results.push({
          employeeId: employeeId,
          userId: userId,
          totalIncome: payslipData.totalIncome,
          totalDeduction: payslipData.totalDeduction,
          netAmount: payslipData.netAmount,
          itemCount: Object.keys(payslipData.items).length
        });
        
      } catch (rowError) {
        console.error(`[ERROR][${uploadId}] 行${rowNumber}の処理エラー:`, rowError);
        await logError(uploadId, `行${rowNumber}の処理エラー`, rowError);
      }
    }
    
    // バッチコミット
    await batch.commit();
    await logDebug(uploadId, 'バッチコミット完了', { processedCount: results.length });
    
    // アップロード状態を更新
    await db.collection('csvUploads').doc(uploadId).update({
      status: 'completed',
      processedCount: results.length,
      employeesCreated: employeesCreated,
      completedAt: getServerTimestamp()
    });
    
    await logDebug(uploadId, '処理完了', { processedCount: results.length, employeesCreated });
    
    let message = `${results.length}件の給与データを処理しました`;
    if (employeesCreated > 0) {
      message += `、${employeesCreated}件の新規従業員を登録しました`;
    }
    
    return {
      success: true,
      processedCount: results.length,
      employeesCreated: employeesCreated,
      message: message
    };
    
  } catch (error) {
    console.error(`[ERROR][${uploadId}] CSV処理エラー:`, error);
    
    // エラー状態を更新
    try {
      await db.collection('csvUploads').doc(uploadId).update({
        status: 'error',
        errorMessage: error.message,
        errorAt: getServerTimestamp()
      });
    } catch (updateError) {
      console.error('エラーステータス更新失敗:', updateError);
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

// 給与明細データの構造確認用デバッグ関数
exports.debugPayslipData = functions.https.onCall(async (data, context) => {
  console.log("給与明細データの構造確認開始");
  
  try {
    const companyId = data.companyId;
    if (!companyId) {
      throw new functions.https.HttpsError('invalid-argument', 'companyIdが必要です');
    }
    
    // 最新の給与明細データを5件取得
    const payslipsQuery = await db.collection('payslips')
      .where('companyId', '==', companyId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    const payslips = [];
    payslipsQuery.forEach(doc => {
      const data = doc.data();
      payslips.push({
        id: doc.id,
        employeeId: data.employeeId,
        userId: data.userId,
        totalIncome: data.totalIncome,
        totalDeduction: data.totalDeduction,
        netAmount: data.netAmount,
        itemsCount: data.items ? Object.keys(data.items).length : 0,
        hasItems: !!data.items,
        itemsStructure: data.items ? Object.keys(data.items).slice(0, 3) : [],
        paymentDate: data.paymentDate
      });
    });
    
    // ユーザー情報も確認
    const usersQuery = await db.collection('users')
      .where('companyId', '==', companyId)
      .limit(5)
      .get();
    
    const users = [];
    usersQuery.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        employeeId: data.employeeId,
        displayName: data.displayName,
        name: data.name,
        email: data.email,
        userType: data.userType
      });
    });
    
    return {
      success: true,
      payslips: payslips,
      users: users,
      payslipCount: payslips.length,
      userCount: users.length
    };
    
  } catch (error) {
    console.error("デバッグエラー:", error);
    throw new functions.https.HttpsError(
      'internal',
      'デバッグ中にエラーが発生しました: ' + error.message
    );
  }
});

// 給与明細データにuserIdを追加する修正関数
exports.fixPayslipUserIds = functions.https.onCall(async (data, context) => {
  console.log("給与明細データのuserId修正開始");
  
  try {
    const companyId = data.companyId;
    if (!companyId) {
      throw new functions.https.HttpsError('invalid-argument', 'companyIdが必要です');
    }
    
    // 従業員とユーザーのマッピングを取得
    const { mapping: employeeUserMapping } = await getEmployeeUserMapping(companyId);
    
    // userIdが設定されていない給与明細を取得
    const payslipsQuery = await db.collection('payslips')
      .where('companyId', '==', companyId)
      .get();
    
    const batch = db.batch();
    let fixedCount = 0;
    
    payslipsQuery.forEach(doc => {
      const data = doc.data();
      
      // userIdが未設定で、employeeIdが存在し、マッピングがある場合
      if (!data.userId && data.employeeId && employeeUserMapping[data.employeeId]) {
        const userId = employeeUserMapping[data.employeeId];
        batch.update(doc.ref, { userId: userId });
        fixedCount++;
        console.log(`修正: ${doc.id} -> employeeId: ${data.employeeId}, userId: ${userId}`);
      }
    });
    
    if (fixedCount > 0) {
      await batch.commit();
    }
    
    return {
      success: true,
      fixedCount: fixedCount,
      message: `${fixedCount}件の給与明細データにuserIdを追加しました`
    };
    
  } catch (error) {
    console.error("修正エラー:", error);
    throw new functions.https.HttpsError(
      'internal',
      '修正中にエラーが発生しました: ' + error.message
    );
  }
});

// データ確認用のHTTPS関数（CORS回避）
exports.checkData = functions.https.onRequest(async (req, res) => {
  // CORS設定
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const companyId = req.query.companyId;
    if (!companyId) {
      res.status(400).json({ error: 'companyIdが必要です' });
      return;
    }
    
    // 給与明細データを確認
    const payslipsQuery = await db.collection('payslips')
      .where('companyId', '==', companyId)
      .limit(10)
      .get();
    
    const payslips = [];
    payslipsQuery.forEach(doc => {
      const data = doc.data();
      payslips.push({
        id: doc.id,
        employeeId: data.employeeId,
        hasUserId: !!data.userId,
        totalIncome: data.totalIncome,
        itemsKeys: data.items ? Object.keys(data.items).slice(0, 5) : []
      });
    });
    
    // ユーザーデータを確認
    const usersQuery = await db.collection('users')
      .where('companyId', '==', companyId)
      .limit(10)
      .get();
    
    const users = [];
    usersQuery.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        hasEmployeeId: !!data.employeeId,
        employeeId: data.employeeId,
        displayName: data.displayName
      });
    });
    
    res.json({
      success: true,
      payslips: payslips,
      users: users
    });
    
  } catch (error) {
    console.error("データ確認エラー:", error);
    res.status(500).json({ error: error.message });
  }
});

// データ修正用のHTTPS関数（CORS回避）
exports.fixData = functions.https.onRequest(async (req, res) => {
  // CORS設定
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const companyId = req.query.companyId;
    if (!companyId) {
      res.status(400).json({ error: 'companyIdが必要です' });
      return;
    }
    
    // 従業員とユーザーのマッピングを取得
    const { mapping: employeeUserMapping } = await getEmployeeUserMapping(companyId);
    
    // userIdが設定されていない給与明細を取得
    const payslipsQuery = await db.collection('payslips')
      .where('companyId', '==', companyId)
      .get();
    
    const batch = db.batch();
    let fixedCount = 0;
    
    payslipsQuery.forEach(doc => {
      const data = doc.data();
      
      // userIdが未設定で、employeeIdが存在し、マッピングがある場合
      if (!data.userId && data.employeeId && employeeUserMapping[data.employeeId]) {
        const userId = employeeUserMapping[data.employeeId];
        batch.update(doc.ref, { userId: userId });
        fixedCount++;
      }
    });
    
    if (fixedCount > 0) {
      await batch.commit();
    }
    
    res.json({
      success: true,
      fixedCount: fixedCount,
      message: `${fixedCount}件の給与明細データにuserIdを追加しました`
    });
    
  } catch (error) {
    console.error("データ修正エラー:", error);
    res.status(500).json({ error: error.message });
  }
}); 