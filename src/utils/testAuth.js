// テスト用Firebase Auth診断ツール
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

export const testFirebaseAuth = async () => {
  console.log('🔧 Firebase Auth診断テスト開始...');
  
  const createEmployeeAccount = httpsCallable(functions, 'createEmployeeAccount');
  
  // テスト用のダミーデータ
  const testData = {
    email: `test${Date.now()}@example.com`, // ユニークなメールアドレス
    name: 'テストユーザー',
    employeeData: {
      employeeId: `TEST${Date.now()}`,
      name: 'テストユーザー',
      email: `test${Date.now()}@example.com`,
      companyId: 'test-company'
    }
  };
  
  try {
    console.log('📝 テストデータ:', testData);
    
    const result = await createEmployeeAccount(testData);
    
    console.log('✅ テスト成功:', result);
    return { success: true, result };
    
  } catch (error) {
    console.error('❌ テスト失敗:', error);
    console.error('エラーコード:', error.code);
    console.error('エラーメッセージ:', error.message);
    console.error('エラー詳細:', error.details);
    console.error('エラーオブジェクト全体:', error);
    
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
  window.testFirebaseAuth = testFirebaseAuth;
}