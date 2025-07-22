// src/pages/CsvMapping/utils/mappingHelpers.js
// マッピング関連のヘルパー関数

import { 
  mainFieldKeys, 
  incomeKeywords, 
  deductionKeywords, 
  attendanceKeywords,
  CATEGORY_NAMES
} from '../constants';



/**
 * 2行入力から直接マッピングを作成（シンプル版）
 * @param {string} line1 - 1行目：項目名（例：健康保険 厚生年金）
 * @param {string} line2 - 2行目：項目コード（例：KY22_0 KY22_1）
 * @returns {Object} 完成したマッピング設定
 */
export const createDirectMappingFromTwoLines = (line1, line2) => {
  console.log('=== シンプルマッピング開始 ===');
  console.log('項目名行:', line1);
  console.log('項目コード行:', line2);
  
  // 行を分割
  const itemNames = line1.split(/[\s\t,]+/).filter(Boolean);
  const itemCodes = line2.split(/[\s\t,]+/).filter(Boolean);
  
  console.log('分割された項目名:', itemNames);
  console.log('分割された項目コード:', itemCodes);
  
  // 基本構造を作成
  const mappingConfig = {
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
    
    console.log(`[${i}] ${itemName} → ${itemCode}`);
    
    // 基本項目データ
    const itemData = {
      columnIndex: i,
      headerName: itemCode,
      itemName: itemName,
      itemCode: itemCode,
      isVisible: true,
      id: `item_${i}_${itemCode.replace(/[^a-zA-Z0-9]/g, '_')}`
    };
    
    // 必ず項目コードリストに追加
    mappingConfig.itemCodeItems.push(itemData);
    
    // 主要フィールドの判定
    if (itemCode === 'KY03' || itemName.includes('従業員')) {
      mappingConfig.mainFields.employeeCode = {
        columnIndex: i,
        headerName: itemCode,
        itemName: itemName
      };
    } else if (itemCode === 'KY02' || itemName.includes('部門')) {
      mappingConfig.mainFields.departmentCode = {
        columnIndex: i,
        headerName: itemCode,
        itemName: itemName
      };
    }
    
    // カテゴリ分類（キーワードベース）
    if (itemName.includes('控除') || itemName.includes('保険') || itemName.includes('税') || 
        itemCode.includes('22') || itemCode.includes('23')) {
      mappingConfig.deductionItems.push({...itemData, isVisible: false});
      console.log(`→ 控除項目: ${itemName}`);
    } else if (itemName.includes('給') || itemName.includes('手当') || itemName.includes('支給') ||
               itemCode.includes('21')) {
      mappingConfig.incomeItems.push({...itemData, isVisible: false});
      console.log(`→ 支給項目: ${itemName}`);
    } else if (itemName.includes('日数') || itemName.includes('時間') || itemName.includes('出勤') ||
               itemCode.includes('11') || itemCode.includes('12')) {
      mappingConfig.attendanceItems.push({...itemData, isVisible: false});
      console.log(`→ 勤怠項目: ${itemName}`);
    } else if (itemName.includes('合計') || itemName.includes('総額') || itemName.includes('差引')) {
      mappingConfig.summaryItems.push({...itemData, isVisible: true});
      console.log(`→ 合計項目: ${itemName}`);
    }
  }
  
  console.log('=== シンプルマッピング完了 ===');
  console.log('控除項目数:', mappingConfig.deductionItems.length);
  console.log('支給項目数:', mappingConfig.incomeItems.length);
  console.log('勤怠項目数:', mappingConfig.attendanceItems.length);
  console.log('項目コード数:', mappingConfig.itemCodeItems.length);
  
  return mappingConfig;
};

/**
 * 決定論的なIDを生成
 * @param {string} category - カテゴリ名
 * @param {string} headerName - ヘッダー名
 * @param {number} columnIndex - 列インデックス
 * @returns {string} 生成されたID
 */
export const generateDeterministicId = (category, headerName, columnIndex) => {
  // ヘッダー名から英数字以外を除去してIDを生成
  const sanitizedHeader = headerName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return `${category}_${sanitizedHeader}_${columnIndex}`;
};

/**
 * 項目の追加（所得、控除、勤怠）
 * @param {string} category - 項目カテゴリ（'incomeItems', 'deductionItems', 'attendanceItems', 'kyItems'）
 * @param {string} headerName - ヘッダー名
 * @param {Array} parsedHeaders - 解析済みヘッダー配列
 * @param {Object} currentMapping - 現在のマッピング設定
 * @returns {Object} 更新されたマッピング設定
 */
export const addItemToCategory = (category, headerName, parsedHeaders, currentMapping) => {
  const columnIndex = parsedHeaders.indexOf(headerName);
  if (columnIndex === -1) return currentMapping;
  
  // 決定論的なIDを生成
  const itemId = generateDeterministicId(category, headerName, columnIndex);
  
  // 項目コードの場合は空文字列、そうでなければheaderNameを設定
  const isItemCode = /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(headerName);
  
  const newItem = {
    columnIndex,
    headerName,
    itemName: '', // ユーザーが手動で項目名を入力する
    isVisible: category !== 'kyItems', // KY項目以外はデフォルトで表示
    id: itemId // ID属性を追加
  };
  
  return {
    ...currentMapping,
    [category]: [...currentMapping[category], newItem]
  };
};

/**
 * 項目の削除（所得、控除、勤怠）
 * @param {string} category - 項目カテゴリ（'incomeItems', 'deductionItems', 'attendanceItems', 'kyItems'）
 * @param {number} index - 削除する項目のインデックス
 * @param {Object} currentMapping - 現在のマッピング設定
 * @returns {Object} 更新されたマッピング設定
 */
export const removeItemFromCategory = (category, index, currentMapping) => {
  return {
    ...currentMapping,
    [category]: currentMapping[category].filter((_, i) => i !== index)
  };
};

/**
 * 項目の表示/非表示を切り替え
 * @param {string} category - 項目カテゴリ（'incomeItems', 'deductionItems', 'attendanceItems', 'kyItems'）
 * @param {number} index - 更新する項目のインデックス
 * @param {boolean} isVisible - 表示状態
 * @param {Object} currentMapping - 現在のマッピング設定
 * @returns {Object} 更新されたマッピング設定
 */
export const updateItemVisibility = (category, index, isVisible, currentMapping) => {
  const newItems = [...currentMapping[category]];
  newItems[index] = {
    ...newItems[index],
    isVisible
  };
  
  return {
    ...currentMapping,
    [category]: newItems
  };
};

/**
 * 項目の表示名を更新
 * @param {string} category - 項目カテゴリ（'incomeItems', 'deductionItems', 'attendanceItems', 'kyItems'）
 * @param {number} index - 更新する項目のインデックス
 * @param {string} itemName - 新しい表示名
 * @param {Object} currentMapping - 現在のマッピング設定
 * @returns {Object} 更新されたマッピング設定
 */
export const updateItemName = (category, index, itemName, currentMapping) => {
  const newItems = [...currentMapping[category]];
  newItems[index] = {
    ...newItems[index],
    itemName
  };
  
  return {
    ...currentMapping,
    [category]: newItems
  };
};

/**
 * csvMappings形式からCsvMapping形式へのデータ変換（逆変換）
 * @param {Object} newFormat - csvMappings形式のデータ
 * @param {Object} initialMapping - 初期マッピング設定
 * @returns {Object} CsvMapping形式のデータ
 */
export const convertFromNewFormat = (newFormat, initialMapping) => {
  console.log('=== convertFromNewFormat デバッグ開始 ===');
  console.log('新しい形式のデータ:', newFormat);
  console.log('初期マッピング:', initialMapping);
  
  // 新形式では既にカテゴリ配列形式で保存されているので、そのまま使用
  const oldFormat = {
    ...initialMapping,
    // カテゴリ配列をそのまま使用
    attendanceItems: newFormat.attendanceItems || [],
    deductionItems: newFormat.deductionItems || [],
    incomeItems: newFormat.incomeItems || [],
    itemCodeItems: newFormat.itemCodeItems || [],
    kyItems: newFormat.kyItems || [],
    
    // 合計項目配列
    totalItems: newFormat.summaryItems || newFormat.totalItems || [],
    summaryItems: newFormat.summaryItems || newFormat.totalItems || [],
    
    // 主要フィールド
    mainFields: newFormat.mainFields || initialMapping.mainFields,
    
    // ヘッダー情報
    parsedHeaders: newFormat.parsedHeaders || [],
    headerInput: newFormat.headerInput || '',
    rowBasedInput: newFormat.rowBasedInput || '',
    kyItemInput: newFormat.kyItemInput || '',
    
    // シンプルマッピング
    simpleMapping: newFormat.simpleMapping || {}
  };
  
  console.log('復元されたデータ:', oldFormat);
  
  // parsedHeadersがない場合、項目からヘッダーリストを生成
  if (!oldFormat.parsedHeaders || oldFormat.parsedHeaders.length === 0) {
    const allHeaders = [
      ...oldFormat.itemCodeItems.map(item => item.headerName),
      ...oldFormat.kyItems.map(item => item.headerName),
      ...oldFormat.incomeItems.map(item => item.headerName),
      ...oldFormat.deductionItems.map(item => item.headerName),
      ...oldFormat.attendanceItems.map(item => item.headerName)
    ].filter(Boolean);
    
    if (allHeaders.length > 0) {
      console.log('項目からparsedHeadersを生成:', allHeaders);
      oldFormat.parsedHeaders = [...new Set(allHeaders)]; // 重複除去
    }
  }
  
  console.log('=== 変換結果 ===');
  console.log('支給項目数:', oldFormat.incomeItems.length);
  console.log('控除項目数:', oldFormat.deductionItems.length);
  console.log('勤怠項目数:', oldFormat.attendanceItems.length);
  console.log('KY項目数:', oldFormat.kyItems.length);
  console.log('項目コード数:', oldFormat.itemCodeItems.length);
  console.log('parsedHeaders:', oldFormat.parsedHeaders);
  console.log('=== convertFromNewFormat デバッグ終了 ===');
  
  return oldFormat;
};

/**
 * マッピング設定のバリデーション
 * @param {Object} mappingConfig - 検証するマッピング設定
 * @returns {string|null} エラーメッセージ（エラーがない場合はnull）
 */
export const validateMappingConfig = (mappingConfig) => {
  // 基本的なデータ構造チェック
  if (!mappingConfig || typeof mappingConfig !== 'object') {
    return 'マッピング設定が無効です';
  }
  
  // itemNameとheaderNameの重複をチェック
  const allCategories = [
    ...(mappingConfig.incomeItems || []),
    ...(mappingConfig.deductionItems || []),
    ...(mappingConfig.attendanceItems || []),
    ...(mappingConfig.itemCodeItems || []),
    ...(mappingConfig.kyItems || [])
  ];
  
  const duplicateItems = allCategories.filter(item => 
    item.itemName && item.headerName && item.itemName === item.headerName
  );
  
  if (duplicateItems.length > 0) {
    console.error('❌ itemNameとheaderNameが同じ項目を検出:', duplicateItems);
    return `データ整合性エラー: ${duplicateItems.length}個の項目でitemNameとheaderNameが同じ値になっています。これは設定上の問題です。`;
  }
  
  return null;
};

/**
 * 重複マッピングのチェック
 * @param {Object} mappingConfig - 検証するマッピング設定
 * @returns {string|null} エラーメッセージ（重複がない場合はnull）
 */
export const checkForDuplicateMappings = (mappingConfig) => {
  const usedColumns = new Map();
  
  // 主要フィールドのチェック
  for (const [fieldName, field] of Object.entries(mappingConfig.mainFields || {})) {
    if (field && field.columnIndex >= 0) {
      const existing = usedColumns.get(field.columnIndex);
      if (existing) {
        return `列${field.columnIndex}が「${existing}」と「${fieldName}」で重複しています`;
      }
      usedColumns.set(field.columnIndex, fieldName);
    }
  }
  
  // 各カテゴリの項目チェック - 実際に表示される項目のみチェック
  const categories = ['incomeItems', 'deductionItems', 'attendanceItems', 'itemCodeItems'];
  for (const category of categories) {
    if (mappingConfig[category]) {
      for (const item of mappingConfig[category]) {
        if (item && item.columnIndex >= 0 && item.isVisible !== false) {
          const existing = usedColumns.get(item.columnIndex);
          if (existing) {
            return `列${item.columnIndex}が「${existing}」と「${item.headerName}」で重複しています`;
          }
          usedColumns.set(item.columnIndex, item.headerName);
        }
      }
    }
  }
  
  return null;
};

/**
 * CsvMapping形式からcsvMappings保存形式へのデータ変換
 * @param {Object} oldMapping - CsvMapping形式のデータ
 * @returns {Object} csvMappings保存形式のデータ
 */
export const convertToNewFormat = (oldMapping) => {
  console.log('=== convertToNewFormat デバッグ開始 ===');
  console.log('入力データ:', oldMapping);
  
  // 入力データの安全性確認
  if (!oldMapping || typeof oldMapping !== 'object') {
    console.error('convertToNewFormat: 無効な入力データ', oldMapping);
    return {
      attendanceItems: [],
      deductionItems: [],
      incomeItems: [],
      itemCodeItems: [],
      kyItems: [],
      summaryItems: [],
      mainFields: {},
      parsedHeaders: [],
      headerInput: '',
      rowBasedInput: '',
      kyItemInput: '',
      simpleMapping: {},
      version: 'simple_v1',
      updatedAt: new Date(),
      updatedBy: ''
    };
  }
  
  // 直接カテゴリ別配列形式で保存
  const newFormat = {
    // カテゴリ別項目配列をそのまま保存
    attendanceItems: oldMapping.attendanceItems || [],
    deductionItems: oldMapping.deductionItems || [],
    incomeItems: oldMapping.incomeItems || [],
    itemCodeItems: oldMapping.itemCodeItems || [],
    kyItems: oldMapping.kyItems || [],
    
    // 合計項目配列（totalItemsまたはsummaryItemsから）
    summaryItems: oldMapping.totalItems || oldMapping.summaryItems || [],
    
    // 主要フィールド
    mainFields: oldMapping.mainFields || {},
    
    // ヘッダー情報
    parsedHeaders: oldMapping.parsedHeaders || [],
    headerInput: oldMapping.headerInput || '',
    rowBasedInput: oldMapping.rowBasedInput || '',
    kyItemInput: oldMapping.kyItemInput || '',
    
    // シンプルマッピング（互換性のため）
    simpleMapping: oldMapping.simpleMapping || {},
    
    // バージョン情報
    version: 'simple_v1',
    updatedAt: new Date(),
    updatedBy: ''
  };
  
  console.log('変換結果:', newFormat);
  console.log('=== convertToNewFormat デバッグ終了 ===');
  
  return newFormat;
};

/**
 * デバッグ用：マッピングの両方のフォーマットを出力
 * @param {Object} mapping - CsvMapping形式のデータ
 */
export const debugMappingFormats = (mapping) => {
  console.log('=== デバッグ：マッピング形式 ===');
  console.log('元のマッピング形式:', mapping);
  
  // 入力データの安全性確認
  if (!mapping || typeof mapping !== 'object') {
    console.error('debugMappingFormats: 無効な入力データ', mapping);
    return;
  }
  
  const newFormat = convertToNewFormat(mapping);
  console.log('csvMappings形式に変換:', newFormat);
  
  // カテゴリ別項目数の表示
  console.log('主要フィールド:');
  for (const [key, value] of Object.entries(mapping.mainFields || {})) {
    console.log(`  ${key}: ${value?.headerName || 'N/A'}`);
  }
  
  // 項目IDの検証
  const categoryCounts = {
    incomeItems: mapping.incomeItems?.length || 0,
    deductionItems: mapping.deductionItems?.length || 0,
    attendanceItems: mapping.attendanceItems?.length || 0,
    kyItems: mapping.kyItems?.length || 0
  };
  
  console.log('項目IDの確認:');
  for (const category of ['incomeItems', 'deductionItems', 'attendanceItems', 'kyItems']) {
    if (mapping[category] && mapping[category].length > 0) {
      console.log(`  ${category}:`, mapping[category].map(item => ({ id: item.id, headerName: item.headerName })));
    }
  }
  
  console.log('項目数:', categoryCounts);
  console.log('カテゴリ配列形式への変換完了');
  
  return newFormat;
};

/**
 * 項目を異なるカテゴリ間で移動する
 * @param {string} fromCategory - 移動元のカテゴリ
 * @param {number} itemIndex - 移動する項目のインデックス
 * @param {string} toCategory - 移動先のカテゴリ
 * @param {Object} currentMapping - 現在のマッピング設定
 * @returns {Object} 更新されたマッピング設定
 */
export const moveItemBetweenCategories = (fromCategory, itemIndex, toCategory, currentMapping) => {
  // 移動元と移動先が同じ場合は何もしない
  if (fromCategory === toCategory) {
    return currentMapping;
  }
  
  // 移動する項目を取得
  const sourceItems = currentMapping[fromCategory] || [];
  if (itemIndex < 0 || itemIndex >= sourceItems.length) {
    console.error('無効な項目インデックス:', itemIndex);
    return currentMapping;
  }
  
  const itemToMove = sourceItems[itemIndex];
  
  // 新しいIDを生成（移動先のカテゴリに対応）
  const newId = generateDeterministicId(
    toCategory.replace('Items', ''), // 'incomeItems' -> 'income'
    itemToMove.headerName,
    itemToMove.columnIndex
  );
  
  // 移動する項目を新しいカテゴリ用に調整
  const movedItem = {
    ...itemToMove,
    id: newId
  };
  
  // 移動元から項目を削除
  const updatedSourceItems = sourceItems.filter((_, index) => index !== itemIndex);
  
  // 移動先に項目を追加
  const targetItems = currentMapping[toCategory] || [];
  const updatedTargetItems = [...targetItems, movedItem];
  
  return {
    ...currentMapping,
    [fromCategory]: updatedSourceItems,
    [toCategory]: updatedTargetItems
  };
};

/**
 * 項目の移動可能なカテゴリのオプションを取得
 * @param {string} currentCategory - 現在のカテゴリ
 * @returns {Array} 移動可能なカテゴリのオプション配列
 */
export const getCategoryMoveOptions = (currentCategory) => {
  return Object.entries(CATEGORY_NAMES)
    .filter(([key]) => key !== currentCategory)
    .map(([key, name]) => ({
      value: key,
      label: `${name}に移動`
    }));
};

/**
 * カテゴリ名を日本語表示名に変換
 * @param {string} category - カテゴリ名
 * @returns {string} 日本語表示名
 */
export const getCategoryDisplayName = (category) => {
  return CATEGORY_NAMES[category] || category;
};
