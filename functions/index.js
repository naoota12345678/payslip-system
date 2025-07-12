// functions/index-minimal.js - 最小限の機能
const functions = require('firebase-functions');
const admin = require('firebase-admin');

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

// シンプルなテスト用関数
exports.testSimpleCSV = functions.https.onCall(async (data, context) => {
  console.log("シンプルなCSVテスト開始");
  console.log("受信データ:", JSON.stringify(data));
  
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

// 基本的なCSV処理関数（簡易版）
exports.processCSVSimple = functions.https.onCall(async (data, context) => {
  console.log("簡易版processCSV実行開始");
  
  try {
    const { uploadId, fileUrl, companyId } = data;
    
    // パラメータ検証
    if (!uploadId || !fileUrl || !companyId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
        '必要なパラメータが不足しています'
      );
    }

    // 簡単な処理ログ
    await db.collection('processLogs').add({
      uploadId,
      message: '処理開始',
      timestamp: getServerTimestamp()
    });
    
    return { 
      success: true, 
      processedCount: 1,
      message: 'CSV処理が完了しました（簡易版）'
    };
  } catch (error) {
    console.error("処理エラー:", error);
    throw new functions.https.HttpsError(
      'internal',
      '処理中にエラーが発生しました: ' + error.message
    );
  }
});