// 従業員UIDを修正するユーティリティ
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export const fixEmployeeUIDs = async () => {
  try {
    console.log('🔧 従業員UID修正を開始...');
    
    // fixEmployeeUIDs関数を呼び出し
    const fixEmployeeUIDsFunction = httpsCallable(functions, 'fixEmployeeUIDs');
    const result = await fixEmployeeUIDsFunction();
    
    console.log('🎉 UID修正結果:', result.data);
    return result.data;
    
  } catch (error) {
    console.error('❌ UID修正エラー:', error);
    throw error;
  }
};