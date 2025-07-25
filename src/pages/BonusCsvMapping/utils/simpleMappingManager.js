/**
 * シンプルなCSVマッピング管理
 * 複雑な変換処理を排除し、直接的な保存・読み込み・表示機能のみ提供
 */

/**
 * 項目IDを生成する
 * @param {string} headerName - ヘッダー名（2行目）
 * @param {number} columnIndex - 列インデックス
 * @returns {string} ID
 */
const generateItemId = (headerName, columnIndex) => {
  if (!headerName) {
    return `item_${columnIndex}`;
  }
  
  const cleanCode = headerName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `itemCode_${cleanCode}_${columnIndex}`;
};

/**
 * 2行入力から直接マッピングデータを作成
 * @param {string} line1 - 1行目（項目名）
 * @param {string} line2 - 2行目（項目コード）
 * @returns {Object} マッピングデータ
 */
export const createMappingFromInput = (line1, line2) => {
  console.log('=== シンプルマッピング作成開始 ===');
  console.log('line1:', line1);
  console.log('line2:', line2);
  
  // 分割処理（空欄も保持）
  let itemNames, headerNames;
  
  if (line1.includes('\t')) {
    itemNames = line1.split('\t');      // 1行目 = itemName
    headerNames = line2.split('\t');    // 2行目 = headerName
  } else if (line1.includes(',')) {
    itemNames = line1.split(',');       // 1行目 = itemName
    headerNames = line2.split(',');     // 2行目 = headerName
  } else {
    itemNames = line1.split(/\s+/);     // 1行目 = itemName
    headerNames = line2.split(/\s+/);   // 2行目 = headerName
  }
  
  // 安全なtrim処理
  itemNames = itemNames.map(h => h ? h.trim() : '');
  headerNames = headerNames.map(c => c ? c.trim() : '');
  
  // 最大長に合わせる
  const maxLength = Math.max(itemNames.length, headerNames.length);
  while (itemNames.length < maxLength) itemNames.push('');
  while (headerNames.length < maxLength) headerNames.push('');
  
  console.log('処理後:', { itemNames, headerNames, maxLength });
  
  // 動的マッピングデータ作成（KYコード分類あり）
  const mappingData = {
      incomeItems: [],
  deductionItems: [],
  attendanceItems: [],
  totalItems: [], // summaryItems → totalItems
  itemCodeItems: [],
    mainFields: {},
    parsedHeaders: headerNames.slice(), // 2行目をヘッダーとして使用
    headerInput: line1,
    rowBasedInput: `${line1}\n${line2}`,
    updatedAt: new Date(),
    version: 'dynamic_v2'
  };
  
  // 各項目を純粋に保存（自動分類なし、ユーザーが手動分類）
  for (let i = 0; i < maxLength; i++) {
    const itemName = itemNames[i] || '';        // 1行目 = itemName
    const headerName = headerNames[i] || '';    // 2行目 = headerName
    
    const itemData = {
      headerName: headerName,  // 2行目（ヘッダー名）
      itemName: itemName,      // 1行目（項目名）
      columnIndex: i,
      isVisible: true,
      id: generateItemId(headerName, i)
    };
    
    // すべての項目をitemCodeItemsに保存（分類はユーザーが手動で行う）
    mappingData.itemCodeItems.push(itemData);
  }
  
  console.log('作成完了:', mappingData);
  return mappingData;
};

/**
 * Firestoreからマッピングデータを読み込み
 * @param {Object} firestoreData - Firestoreから取得したデータ
 * @returns {Object} UI表示用データ
 */
export const loadMappingFromFirestore = (firestoreData) => {
  console.log('=== マッピングデータ読み込み ===');
  console.log('Firestoreデータ:', firestoreData);
  
  if (!firestoreData) {
    return {
          mappingConfig: {
      incomeItems: [],
      deductionItems: [],
      attendanceItems: [],
      totalItems: [], // summaryItems → totalItems
      itemCodeItems: [],
      mainFields: {}
    },
      parsedHeaders: [],
      headerInput: '',
      rowBasedInput: ''
    };
  }
  
  // そのまま使用（変換処理なし）
  const result = {
    mappingConfig: {
      incomeItems: firestoreData.incomeItems || [],
      deductionItems: firestoreData.deductionItems || [],
      attendanceItems: firestoreData.attendanceItems || [],
      totalItems: firestoreData.totalItems || firestoreData.summaryItems || [], // 新旧両方に対応
      itemCodeItems: firestoreData.itemCodeItems || [],
      mainFields: firestoreData.mainFields || {}
    },
    parsedHeaders: firestoreData.parsedHeaders || [],
    headerInput: firestoreData.headerInput || '',
    rowBasedInput: firestoreData.rowBasedInput || ''
  };
  
  console.log('読み込み完了:', result);
  return result;
};

/**
 * UI表示用データをFirestore保存形式に変換
 * @param {Object} uiData - UI表示用データ
 * @returns {Object} Firestore保存用データ
 */
export const prepareMappingForSave = (uiData) => {
  console.log('=== 保存用データ準備 ===');
  console.log('UIデータ:', uiData);
  
  const saveData = {
    incomeItems: uiData.mappingConfig?.incomeItems || [],
    deductionItems: uiData.mappingConfig?.deductionItems || [],
    attendanceItems: uiData.mappingConfig?.attendanceItems || [],
    totalItems: uiData.mappingConfig?.totalItems || [], // summaryItems → totalItems に修正
    itemCodeItems: uiData.mappingConfig?.itemCodeItems || [],
    mainFields: uiData.mappingConfig?.mainFields || {},
    parsedHeaders: uiData.parsedHeaders || [],
    headerInput: uiData.headerInput || '',
    rowBasedInput: uiData.rowBasedInput || '',
    updatedAt: new Date(),
    version: 'dynamic_v2'
  };
  
  console.log('保存用データ:', saveData);
  return saveData;
};

/**
 * 空欄を含む安全なヘッダー復元
 * @param {Array} itemCodeItems - 項目コード配列
 * @returns {Array} parsedHeaders配列
 */
export const restoreHeadersFromItems = (itemCodeItems) => {
  if (!Array.isArray(itemCodeItems) || itemCodeItems.length === 0) {
    return [];
  }
  
  // columnIndex順でソート
  const sortedItems = itemCodeItems
    .slice()
    .sort((a, b) => (a.columnIndex || 0) - (b.columnIndex || 0));
  
  // headerNameを順序通りに取得（空欄も保持）
  return sortedItems.map(item => item.headerName || '');
}; 