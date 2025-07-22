/**
 * シンプル：2行入力を直接Firebaseに保存
 */

/**
 * 2行入力を解析してFirebaseに直接保存
 * @param {string} line1 - 項目名行
 * @param {string} line2 - 項目コード行
 * @returns {Object} Firebase保存用のデータ
 */
export const createDirectFirebaseData = (line1, line2) => {
  console.log('シンプル保存開始');
  console.log('項目名:', line1);
  console.log('項目コード:', line2);
  
  // 分割（空の要素も保持）
  const itemNames = line1.split(/[\s\t,]+/);
  const itemCodes = line2.split(/[\s\t,]+/);
  
  console.log('項目名配列（元）:', itemNames);
  console.log('項目コード配列（元）:', itemCodes);
  
  // 最大長を取得（どちらか長い方に合わせる）
  const maxLength = Math.max(itemNames.length, itemCodes.length);
  
  // 配列を同じ長さに調整（足りない部分は空文字で埋める）
  while (itemNames.length < maxLength) itemNames.push('');
  while (itemCodes.length < maxLength) itemCodes.push('');
  
  console.log('調整後 項目名配列:', itemNames);
  console.log('調整後 項目コード配列:', itemCodes);
  
  // Firebase保存用データ（シンプル）
  const firebaseData = {
    deductionItems: [],
    incomeItems: [],
    attendanceItems: [],
    itemCodeItems: [],
    mainFields: {},
    updatedAt: new Date(),
    version: 'simple_direct'
  };
  
  // 全ての項目を処理（空の項目も含む）
  for (let i = 0; i < maxLength; i++) {
    const itemName = itemNames[i] ? itemNames[i].trim() : '';
    const itemCode = itemCodes[i] ? itemCodes[i].trim() : '';
    
    // 空の項目でもデータを作成（indexのずれを防ぐため）
    const data = {
      headerName: itemName || `空の項目_${i}`,     // 日本語項目名（空の場合はプレースホルダー）
      itemName: itemCode || `EMPTY_${i}`,          // 記号項目コード（空の場合はプレースホルダー）
      columnIndex: i,
      isVisible: itemName && itemCode ? true : false,  // 両方ある場合のみ表示
      id: `direct_${i}`,
      isEmpty: !itemName || !itemCode  // 空の項目かどうかのフラグ
    };
    
    console.log(`[${i}] "${itemName}" → "${itemCode}" (空: ${data.isEmpty})`);
    
    // 必ずitemCodeItemsに追加（空の項目も含む）
    firebaseData.itemCodeItems.push(data);
    
    // 空でない場合のみ分類処理
    if (!data.isEmpty) {
      // キーワードで分類（シンプル）
      if (itemName.includes('保険') || itemName.includes('税')) {
        firebaseData.deductionItems.push({...data, isVisible: false});
      } else if (itemName.includes('給') || itemName.includes('手当')) {
        firebaseData.incomeItems.push({...data, isVisible: false});
      } else if (itemName.includes('日数') || itemName.includes('時間')) {
        firebaseData.attendanceItems.push({...data, isVisible: false});
      }
    }
  }
  
  console.log('🔍 作成されたitemCodeItems:');
  firebaseData.itemCodeItems.forEach((item, index) => {
    console.log(`  [${index}] ${item.headerName} → ${item.itemName} (表示: ${item.isVisible})`);
  });
  
  console.log('Firebase保存データ:', firebaseData);
  return firebaseData;
}; 