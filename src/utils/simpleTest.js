// 簡単なテスト用Firebase Functions呼び出し
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

export const testSimpleFunction = async () => {
  console.log('🔧 Firebase Functions 基本テスト開始...');
  
  const simpleTest = httpsCallable(functions, 'simpleTest');
  
  try {
    console.log('📝 テスト用データ送信中...');
    
    const result = await simpleTest({ test: 'hello', timestamp: new Date().toISOString() });
    
    console.log('✅ テスト成功:', result);
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ テスト失敗:', error);
    console.error('エラーコード:', error.code);
    console.error('エラーメッセージ:', error.message);
    console.error('エラー詳細:', error.details);
    
    return { 
      success: false, 
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        fullError: error
      }
    };
  }
};

// ブラウザのコンソールからテストを実行できるようにグローバルに公開
if (typeof window !== 'undefined') {
  window.testSimpleFunction = testSimpleFunction;
}