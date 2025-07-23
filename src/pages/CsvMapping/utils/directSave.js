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
  
  // 🔧 分割（空の要素も保持するように修正）
  // タブ区切りの場合
  let headerNames, itemNames;
  if (line1.includes('\t')) {
    headerNames = line1.split('\t');  // 1行目 = 記号
    itemNames = line2.split('\t');    // 2行目 = 日本語名
    console.log('タブ区切りで分割しました');
  }
  // カンマ区切りの場合
  else if (line1.includes(',')) {
    headerNames = line1.split(',');   // 1行目 = 記号
    itemNames = line2.split(',');     // 2行目 = 日本語名
    console.log('カンマ区切りで分割しました');
  }
  // スペース区切りの場合（空のセルは保持できない）
  else {
    headerNames = line1.split(/\s+/); // 1行目 = 記号
    itemNames = line2.split(/\s+/);   // 2行目 = 日本語名
    console.log('スペース区切りで分割しました（空のセルは保持されません）');
  }
  
  // trim処理（空の要素は空文字列のまま保持）
  headerNames = headerNames.map(item => item ? item.trim() : '');
  itemNames = itemNames.map(item => item ? item.trim() : '');
  
  console.log('🔍 分割後の確認:');
  console.log('1行目（記号 = headerNames）:', headerNames);
  console.log('2行目（日本語名 = itemNames）:', itemNames);
  
  // 🔍 空のセルの詳細確認
  console.log('📊 詳細分析:');
  console.log(`headerNames.length: ${headerNames.length}`);
  console.log(`itemNames.length: ${itemNames.length}`);
  
  headerNames.forEach((header, index) => {
    const item = itemNames[index] || '(なし)';
    console.log(`[${index}] "${header}" (${header.length}文字) → "${item}" (${item ? item.length : 0}文字)`);
  });
  
  // 🔍 最初の10個の詳細確認
  console.log('🔍 最初の10個の詳細マッピング確認:');
  for (let i = 0; i < Math.min(10, Math.max(headerNames.length, itemNames.length)); i++) {
    const header = headerNames[i] || '(空)';
    const item = itemNames[i] || '(空)';
    console.log(`  [${i}] 記号:"${header}" → 日本語:"${item}"`);
  }
  
  // 最大長を取得（どちらか長い方に合わせる）
  const maxLength = Math.max(headerNames.length, itemNames.length);
  
    // 🔧 配列を同じ長さに調整（足りない部分は空文字で埋める）
    while (headerNames.length < maxLength) headerNames.push('');
    while (itemNames.length < maxLength) itemNames.push('');
    
    console.log('調整後 記号配列:', headerNames);
    console.log('調整後 日本語名配列:', itemNames);
  
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
    const symbol = headerNames[i] || '';           // 1行目 = 記号（既にtrim済み）
    const japaneseName = itemNames[i] || '';       // 2行目 = 日本語名（既にtrim済み）
    
    // 空の項目でもデータを作成（indexのずれを防ぐため）
    const data = {
      headerName: symbol,                           // 記号を headerName に
      itemName: japaneseName,                       // 日本語名を itemName に
      columnIndex: i,
      isVisible: true,                              // 空の項目も表示する
      id: `direct_${i}`,
      isEmpty: !symbol && !japaneseName            // 両方とも空の場合のみ空項目
    };
    
    console.log(`[${i}] "${symbol}" → "${japaneseName}" (空: ${data.isEmpty})`);
    
    // 必ずitemCodeItemsに追加（空の項目も含む）
    firebaseData.itemCodeItems.push(data);
    
    if (!data.isEmpty) {
      // 基本項目の判定
      if (symbol === 'KY03' || japaneseName.includes('従業員')) {
        firebaseData.mainFields.employeeCode = {
          columnIndex: i,
          headerName: symbol,      // 記号を保存
          itemName: japaneseName   // 日本語名を保存
        };
        console.log(`👤 従業員コード設定: ${japaneseName} → ${symbol}`);
      } else if (symbol === 'KY02' || japaneseName.includes('部門')) {
        firebaseData.mainFields.departmentCode = {
          columnIndex: i,
          headerName: symbol,      // 記号を保存
          itemName: japaneseName   // 日本語名を保存
        };
        console.log(`🏢 部門コード設定: ${japaneseName} → ${symbol}`);
      } else if (symbol === 'KY01' || japaneseName.includes('識別')) {
        firebaseData.mainFields.identificationCode = {
          columnIndex: i,
          headerName: symbol,      // 記号を保存
          itemName: japaneseName   // 日本語名を保存
        };
        console.log(`🆔 識別コード設定: ${japaneseName} → ${symbol}`);
      }
      
      // ハードコーディングされた自動分類を削除
      // ユーザーがCSVマッピング設定で手動で項目を各カテゴリに移動させる方式に変更
      console.log(`📋 項目をitemCodeItemsに追加: ${symbol} → ${japaneseName}`);
      // 自動分類は行わず、すべてitemCodeItemsに保存（ユーザーが後で分類を調整）
    }
  }
  
  console.log('🔍 作成されたitemCodeItems:');
  firebaseData.itemCodeItems.forEach((item, index) => {
    console.log(`  [${index}] ${item.headerName} → ${item.itemName} (表示: ${item.isVisible})`);
  });
  
  console.log('Firebase保存データ:', firebaseData);
  return firebaseData;
}; 