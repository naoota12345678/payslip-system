/**
 * シンプルな2行マッピングシステム
 * 複雑な処理を排除して、直接的にマッピングを作成
 */

/**
 * 2行入力から直接マッピングを作成
 * @param {string} line1 - 1行目：項目名（例：健康保険 厚生年金 出勤日数）
 * @param {string} line2 - 2行目：項目コード（例：KY22_0 KY22_1 KY11_0）
 * @returns {Object} 完成したマッピング設定
 */
export const createSimpleMapping = (line1, line2) => {
  console.log('🎯 シンプルマッピング開始');
  console.log('項目名行:', line1);
  console.log('項目コード行:', line2);
  
  // 行を分割（タブ、カンマ、スペースに対応）
  const itemNames = line1.split(/[\s\t,]+/).filter(Boolean);
  const itemCodes = line2.split(/[\s\t,]+/).filter(Boolean);
  
  console.log('項目名配列:', itemNames);
  console.log('項目コード配列:', itemCodes);
  
  // 基本構造
  const result = {
    mainFields: {},
    incomeItems: [],
    deductionItems: [], 
    attendanceItems: [],
    itemCodeItems: [],
    kyItems: [],
    summaryItems: []
  };
  
  // 項目を1つずつ処理
  const maxLength = Math.max(itemNames.length, itemCodes.length);
  
  for (let i = 0; i < maxLength; i++) {
    const itemName = itemNames[i] || '';
    const itemCode = itemCodes[i] || '';
    
    if (!itemCode) continue; // 項目コードがない場合はスキップ
    
    console.log(`[${i}] "${itemName}" → "${itemCode}"`);
    
    // 基本項目データ
    const itemData = {
      columnIndex: i,
      headerName: itemCode,
      itemName: itemName,
      itemCode: itemCode,
      isVisible: true,
      id: `simple_${i}_${itemCode.replace(/[^a-zA-Z0-9]/g, '_')}`
    };
    
    // 必ず項目コードリストに追加
    result.itemCodeItems.push(itemData);
    
    // 主要フィールドの判定
    if (itemCode === 'KY03' || itemName.includes('従業員')) {
      result.mainFields.employeeCode = {
        columnIndex: i,
        headerName: itemCode,
        itemName: itemName
      };
      console.log(`👤 従業員コード設定: ${itemName} → ${itemCode}`);
    } else if (itemCode === 'KY02' || itemName.includes('部門')) {
      result.mainFields.departmentCode = {
        columnIndex: i,
        headerName: itemCode,
        itemName: itemName
      };
      console.log(`🏢 部門コード設定: ${itemName} → ${itemCode}`);
    }
    
    // カテゴリ分類
    let category = 'その他';
    
    if (itemName.includes('控除') || itemName.includes('保険') || itemName.includes('税') || 
        itemCode.includes('22') || itemCode.includes('23')) {
      result.deductionItems.push({...itemData, isVisible: false});
      category = '控除';
    } else if (itemName.includes('給') || itemName.includes('手当') || itemName.includes('支給') ||
               itemCode.includes('21')) {
      result.incomeItems.push({...itemData, isVisible: false});
      category = '支給';
    } else if (itemName.includes('日数') || itemName.includes('時間') || itemName.includes('出勤') ||
               itemCode.includes('11') || itemCode.includes('12')) {
      result.attendanceItems.push({...itemData, isVisible: false});
      category = '勤怠';
    } else if (itemName.includes('合計') || itemName.includes('総額') || itemName.includes('差引')) {
      result.summaryItems.push({...itemData, isVisible: true});
      category = '合計';
    }
    
    console.log(`  → ${category}項目に分類`);
  }
  
  console.log('✅ シンプルマッピング完了');
  console.log(`📊 結果: 控除${result.deductionItems.length}、支給${result.incomeItems.length}、勤怠${result.attendanceItems.length}、合計${result.summaryItems.length}`);
  
  // 詳細な結果確認用
  console.log('🔍 詳細結果確認:');
  console.log('itemCodeItems:', result.itemCodeItems);
  console.log('deductionItems:', result.deductionItems);
  console.log('incomeItems:', result.incomeItems);
  console.log('attendanceItems:', result.attendanceItems);
  
  // ユーザー希望のモデル形式確認
  console.log('🎯 ユーザー希望のモデル形式での出力:');
  result.itemCodeItems.forEach((item, index) => {
    console.log(`[${index}] headerName="${item.headerName}", itemName="${item.itemName}", itemCode="${item.itemCode}"`);
  });
  
  return result;
};

/**
 * テキストエリアの2行入力を処理
 * @param {string} textInput - テキストエリアの内容
 * @returns {Object} マッピング設定
 */
export const processSimpleTextInput = (textInput) => {
  console.log('📝 テキスト入力処理開始');
  console.log('入力内容:', textInput);
  
  // 行に分割
  const lines = textInput.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length < 2) {
    throw new Error('2行の入力が必要です（1行目：項目名、2行目：項目コード）');
  }
  
  console.log(`有効な行数: ${lines.length}`);
  console.log('1行目:', lines[0]);
  console.log('2行目:', lines[1]);
  
  return createSimpleMapping(lines[0], lines[1]);
}; 