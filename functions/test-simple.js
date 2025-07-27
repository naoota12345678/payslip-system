const { onCall } = require('firebase-functions/v2/https');

// 単純なテスト関数
exports.simpleTest = onCall(async (request) => {
  console.log('🔥 simpleTest 関数が呼び出されました');
  console.log('受信データ:', request.data);
  
  return {
    success: true,
    message: 'テスト関数が正常に動作しています',
    timestamp: new Date().toISOString(),
    receivedData: request.data
  };
});