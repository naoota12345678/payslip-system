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
  
  headerNames = headerNames.map(item => item.trim());
  itemNames = itemNames.map(item => item.trim());
  
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
  
    // 🔧 記号が不足している場合の自動補完
    if (headerNames.length > itemNames.length) {
      console.log(`⚠️ 日本語名が不足しています（記号:${headerNames.length}, 日本語名:${itemNames.length}）`);
      console.log('🔧 不足分の日本語名を自動生成します');
      
      for (let i = itemNames.length; i < headerNames.length; i++) {
        const placeholderName = `空の項目_${i}`;
        itemNames.push(placeholderName);
        console.log(`🔧 自動生成: ${headerNames[i]} → ${placeholderName}`);
      }
    }
    
    // 配列を同じ長さに調整（足りない部分は空文字で埋める）
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
    const symbol = headerNames[i] ? headerNames[i].trim() : '';      // 1行目 = 記号
    const japaneseName = itemNames[i] ? itemNames[i].trim() : '';     // 2行目 = 日本語名
    
    // 空の項目でもデータを作成（indexのずれを防ぐため）
    const data = {
      headerName: symbol || `EMPTY_${i}`,           // 記号を headerName に
      itemName: japaneseName || `空の項目_${i}`,    // 日本語名を itemName に
      columnIndex: i,
      isVisible: symbol && japaneseName ? true : false,  // 両方ある場合のみ表示
      id: `direct_${i}`,
      isEmpty: !symbol || !japaneseName  // 空の項目かどうかのフラグ
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
      
      // キーワードで分類（シンプル）
      if (japaneseName.includes('保険') || japaneseName.includes('税')) {
        firebaseData.deductionItems.push({...data, isVisible: false});
      } else if (japaneseName.includes('給') || japaneseName.includes('手当')) {
        firebaseData.incomeItems.push({...data, isVisible: false});
      } else if (japaneseName.includes('日数') || japaneseName.includes('時間')) {
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