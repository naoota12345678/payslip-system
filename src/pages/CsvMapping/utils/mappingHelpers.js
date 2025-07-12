// src/pages/CsvMapping/utils/mappingHelpers.js
// マッピング関連のヘルパー関数

import { 
  mainFieldKeys, 
  incomeKeywords, 
  deductionKeywords, 
  attendanceKeywords,
  systemColumns
} from '../constants';

/**
 * CSVヘッダーから必須項目の自動マッピングを生成
 * @param {Array} headers - CSVヘッダー配列
 * @param {Object} currentMapping - 現在のマッピング設定
 * @returns {Object} 更新されたマッピング設定
 */
export const autoMapRequiredFields = (headers, currentMapping) => {
  const newMapping = { ...currentMapping };
  
  // 主要フィールドの自動マッピング
  for (const [field, possibleNames] of Object.entries(mainFieldKeys)) {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.includes(name));
      if (index !== -1) {
        newMapping.mainFields[field] = {
          columnIndex: index,
          headerName: headers[index]
        };
        break;
      }
    }
  }
  
  // 所得項目、控除項目、勤怠項目、項目コードの自動検出
  const existingIncomeItems = new Set(newMapping.incomeItems.map(item => item.headerName));
  const existingDeductionItems = new Set(newMapping.deductionItems.map(item => item.headerName));
  const existingAttendanceItems = new Set(newMapping.attendanceItems.map(item => item.headerName));
  const existingItemCodeItems = new Set(newMapping.itemCodeItems ? newMapping.itemCodeItems.map(item => item.headerName) : []);

  // 項目コードを自動検出（KY項目以外も含む）
  const itemCodePattern = /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/; // KY01, A01, ITEM01, CODE01, KY11_0などのパターン
  
  for (const header of headers) {
    if (existingItemCodeItems.has(header)) continue;
    
    // 項目コードの自動検出
    if (itemCodePattern.test(header)) {
      const itemId = generateDeterministicId('itemCode', header, headers.indexOf(header));
      newMapping.itemCodeItems = newMapping.itemCodeItems || [];
      newMapping.itemCodeItems.push({
        columnIndex: headers.indexOf(header),
        headerName: header,
        itemName: header, // 初期値として同じ値を設定
        isVisible: true,
        id: itemId
      });
      continue;
    }
    
    // 従来の項目分類
    if (incomeKeywords.some(keyword => header.includes(keyword))) {
      if (!existingIncomeItems.has(header)) {
        const itemId = generateDeterministicId('income', header, headers.indexOf(header));
        newMapping.incomeItems.push({
          columnIndex: headers.indexOf(header),
          headerName: header,
          itemName: header,
          isVisible: true,
          id: itemId
        });
      }
    }
    else if (deductionKeywords.some(keyword => header.includes(keyword))) {
      if (!existingDeductionItems.has(header)) {
        const itemId = generateDeterministicId('deduction', header, headers.indexOf(header));
        newMapping.deductionItems.push({
          columnIndex: headers.indexOf(header),
          headerName: header,
          itemName: header,
          isVisible: true,
          id: itemId
        });
      }
    }
    else if (attendanceKeywords.some(keyword => header.includes(keyword))) {
      if (!existingAttendanceItems.has(header)) {
        const itemId = generateDeterministicId('attendance', header, headers.indexOf(header));
        newMapping.attendanceItems.push({
          columnIndex: headers.indexOf(header),
          headerName: header,
          itemName: header,
          isVisible: true,
          id: itemId
        });
      }
    }
  }
  
  return newMapping;
};

/**
 * KY項目と給与システム列のマッピングを生成
 * @param {Array} kyItems - KY項目の配列
 * @returns {Object} 生成されたマッピング設定
 */
export const generateKyMapping = (kyItems) => {
  // マッピング設定を生成
  const mappings = [];
  const minLength = Math.min(kyItems.length, systemColumns.length);
  
  // KY項目と対応する列の一括マッピング
  for (let i = 0; i < minLength; i++) {
    mappings.push({
      kyItem: kyItems[i],
      systemColumn: systemColumns[i],
      columnIndex: i
    });
  }
  
  // 組み立てたマッピングから設定を生成
  const newMappingConfig = {
    mainFields: {},
    incomeItems: [],
    deductionItems: [],
    attendanceItems: [],
    kyItems: [] // 全てのKY項目の設定を保存
  };
  
  // 主要フィールドの設定を生成
  for (const [fieldKey, possibleNames] of Object.entries(mainFieldKeys)) {
    for (const mapping of mappings) {
      if (possibleNames.some(name => mapping.systemColumn.includes(name))) {
        newMappingConfig.mainFields[fieldKey] = {
          columnIndex: mapping.columnIndex,
          headerName: mapping.systemColumn,
          kyItem: mapping.kyItem
        };
        break;
      }
    }
  }
  
  // 組み立てたマッピングを分類
  mappings.forEach(mapping => {
    // 主要フィールドとして既に分類済みの項目はスキップ
    const isMainField = Object.values(newMappingConfig.mainFields).some(
      field => field.columnIndex === mapping.columnIndex
    );
    
    if (isMainField) return;
    
    // KY項目を全て保存
    newMappingConfig.kyItems.push({
      columnIndex: mapping.columnIndex,
      headerName: mapping.kyItem,
      itemName: mapping.systemColumn,
      kyItem: mapping.kyItem,
      isVisible: true,
      id: generateDeterministicId('ky', mapping.kyItem, mapping.columnIndex) // 決定論的なID属性を追加
    });
    
    // カテゴリにも分類
    const item = {
      columnIndex: mapping.columnIndex,
      headerName: mapping.kyItem,  // KY項目名をヘッダー名として保存
      itemName: mapping.systemColumn, // システム列名を表示名として保存
      kyItem: mapping.kyItem,
      isVisible: true,
      id: generateDeterministicId(
        incomeKeywords.some(keyword => mapping.systemColumn.includes(keyword)) ? 'income' :
        deductionKeywords.some(keyword => mapping.systemColumn.includes(keyword)) ? 'deduction' :
        attendanceKeywords.some(keyword => mapping.systemColumn.includes(keyword)) ? 'attendance' : 'other',
        mapping.kyItem,
        mapping.columnIndex
      ) // 決定論的なID属性を追加
    };
    
    if (incomeKeywords.some(keyword => mapping.systemColumn.includes(keyword))) {
      newMappingConfig.incomeItems.push(item);
    }
    else if (deductionKeywords.some(keyword => mapping.systemColumn.includes(keyword))) {
      newMappingConfig.deductionItems.push(item);
    }
    else if (attendanceKeywords.some(keyword => mapping.systemColumn.includes(keyword))) {
      newMappingConfig.attendanceItems.push(item);
    }
  });
  
  return newMappingConfig;
};

/**
 * 行ベースのマッピング（ヘッダー行とKY項目行）から設定を生成
 * @param {Array} headers - ヘッダー配列
 * @param {Array} kyItems - KY項目配列
 * @returns {Object} 生成されたマッピング設定
 */
export const generateRowBasedMapping = (headers, kyItems) => {
  console.log('=== generateRowBasedMapping デバッグ開始 ===');
  console.log('入力ヘッダー:', headers);
  console.log('入力KY項目:', kyItems);

  // マッピング設定を生成
  const mappings = [];
  const minLength = Math.min(headers.length, kyItems.length);
  
  // ヘッダーとKY項目を列ごとに紐づけ
  for (let i = 0; i < minLength; i++) {
    mappings.push({
      headerName: headers[i],
      kyItem: kyItems[i],
      columnIndex: i
    });
  }

  console.log('生成されたマッピング:', mappings);
  
  // 新しいマッピング設定
  const newMappingConfig = {
    mainFields: {},
    incomeItems: [],
    deductionItems: [],
    attendanceItems: [],
    itemCodeItems: [], // 全ての項目コードの設定を保存
    kyItems: [] // 旧形式との互換性のため
  };
  
  // 主要フィールドのマッピング
  for (const [fieldKey, possibleNames] of Object.entries(mainFieldKeys)) {
    for (const mapping of mappings) {
      if (possibleNames.some(name => mapping.headerName.includes(name))) {
        newMappingConfig.mainFields[fieldKey] = {
          columnIndex: mapping.columnIndex,
          headerName: mapping.headerName,  // 日本語項目名をヘッダー名として保存
          itemName: mapping.headerName,    // 日本語項目名を表示名として保存
          itemCode: mapping.kyItem         // 項目コードを保存
        };
        console.log(`主要フィールド ${fieldKey} をマッピング:`, newMappingConfig.mainFields[fieldKey]);
        break;
      }
    }
  }
  
  // 各項目を適切なカテゴリに分類
  mappings.forEach(mapping => {
    // 主要フィールドとして既に分類済みの項目はスキップ
    const isMainField = Object.values(newMappingConfig.mainFields).some(
      field => field.columnIndex === mapping.columnIndex
    );
    
    if (isMainField) {
      console.log(`列 ${mapping.columnIndex} は主要フィールドとして分類済み、スキップ`);
      return;
    }
    
    // 決定論的なIDを生成
    const categoryName = incomeKeywords.some(keyword => mapping.headerName.includes(keyword)) ? 'income' :
                       deductionKeywords.some(keyword => mapping.headerName.includes(keyword)) ? 'deduction' :
                       attendanceKeywords.some(keyword => mapping.headerName.includes(keyword)) ? 'attendance' : 'other';
    const itemId = generateDeterministicId(categoryName, mapping.kyItem, mapping.columnIndex);
    
    console.log(`列 ${mapping.columnIndex} (${mapping.headerName}) をカテゴリ ${categoryName} に分類`);
    
    // 項目コードを全て保存
    const itemCodeData = {
      columnIndex: mapping.columnIndex,
      headerName: mapping.headerName,  // 日本語項目名をヘッダー名として保存
      itemName: mapping.headerName,    // 日本語項目名を表示名として保存
      itemCode: mapping.kyItem,        // 項目コードを保存
      isVisible: true,
      id: generateDeterministicId('itemCode', mapping.kyItem, mapping.columnIndex) // 決定論的なID属性を追加
    };
    
    console.log('項目コードデータ:', itemCodeData);
    newMappingConfig.itemCodeItems.push(itemCodeData);
    
    // 旧形式との互換性のため、kyItemsにも同じデータを保存
    newMappingConfig.kyItems.push({
      ...itemCodeData,
      kyItem: mapping.kyItem, // 旧形式のプロパティ名も保存
      matchedHeader: mapping.headerName
    });
    
    // カテゴリにも分類
    const item = {
      columnIndex: mapping.columnIndex,
      headerName: mapping.headerName,  // 日本語項目名をヘッダー名として保存
      itemName: mapping.headerName,    // 日本語項目名を表示名として保存
      itemCode: mapping.kyItem,        // 項目コードを保存
      isVisible: true,
      id: itemId // ID属性を追加
    };
    
    // ヘッダー名に基づいてカテゴリ分類
    if (incomeKeywords.some(keyword => mapping.headerName.includes(keyword))) {
      console.log('支給項目に追加:', item);
      newMappingConfig.incomeItems.push(item);
    }
    else if (deductionKeywords.some(keyword => mapping.headerName.includes(keyword))) {
      console.log('控除項目に追加:', item);
      newMappingConfig.deductionItems.push(item);
    }
    else if (attendanceKeywords.some(keyword => mapping.headerName.includes(keyword))) {
      console.log('勤怠項目に追加:', item);
      newMappingConfig.attendanceItems.push(item);
    }
  });
  
  console.log('=== 最終的なマッピング設定 ===');
  console.log('項目コード数:', newMappingConfig.itemCodeItems.length);
  console.log('項目コード:', newMappingConfig.itemCodeItems);
  console.log('旧形式KY項目数:', newMappingConfig.kyItems.length);
  console.log('旧形式KY項目:', newMappingConfig.kyItems);
  console.log('=== generateRowBasedMapping デバッグ終了 ===');
  
  return newMappingConfig;
};

/**
 * 主要フィールドのマッピングを更新
 * @param {string} field - フィールド名
 * @param {number} columnIndex - 選択された列インデックス
 * @param {Array} parsedHeaders - 解析済みヘッダー配列
 * @param {Object} currentMapping - 現在のマッピング設定
 * @returns {Object} 更新されたマッピング設定
 */
export const updateMainFieldMapping = (field, columnIndex, parsedHeaders, currentMapping) => {
  const index = parseInt(columnIndex);
  
  return {
    ...currentMapping,
    mainFields: {
      ...currentMapping.mainFields,
      [field]: {
        columnIndex: index,
        headerName: index >= 0 ? parsedHeaders[index] : ''
      }
    }
  };
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
  
  const newItem = {
    columnIndex,
    headerName,
    itemName: headerName,
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
 * マッピング設定のバリデーション
 * @param {Object} mappingConfig - 検証するマッピング設定
 * @returns {string|null} エラーメッセージ（エラーがない場合はnull）
 */
export const validateMappingConfig = (mappingConfig) => {
  // 必須フィールドの検証
  if (!mappingConfig.mainFields?.identificationCode || mappingConfig.mainFields.identificationCode.columnIndex === -1) {
    return '識別コードのマッピングは必須です';
  }
  
  if (!mappingConfig.mainFields?.employeeCode || mappingConfig.mainFields.employeeCode.columnIndex === -1) {
    return '従業員コードのマッピングは必須です';
  }
  
  // 重複チェック
  const duplicateCheck = checkForDuplicateMappings(mappingConfig);
  if (duplicateCheck) {
    return duplicateCheck;
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
  for (const [fieldName, field] of Object.entries(mappingConfig.mainFields)) {
    if (field.columnIndex >= 0) {
      const existing = usedColumns.get(field.columnIndex);
      if (existing) {
        return `列${field.columnIndex}が「${existing}」と「${fieldName}」で重複しています`;
      }
      usedColumns.set(field.columnIndex, fieldName);
    }
  }
  
  // 各カテゴリの項目チェック
  const categories = ['incomeItems', 'deductionItems', 'attendanceItems', 'kyItems'];
  for (const category of categories) {
    if (mappingConfig[category]) {
      for (const item of mappingConfig[category]) {
        if (item.columnIndex >= 0) {
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
 * CsvMapping形式からCsvUpload形式へのデータ変換
 * @param {Object} oldMapping - CsvMapping形式のデータ
 * @returns {Object} CsvUpload形式のデータ
 */
export const convertToNewFormat = (oldMapping) => {
  const newFormat = {};
  
  // 項目のIDとヘッダー名のマッピングを作成
  if (oldMapping.incomeItems) {
    oldMapping.incomeItems.forEach(item => {
      if (item.id && item.headerName) {
        newFormat[item.id] = item.headerName;
      }
    });
  }
  
  if (oldMapping.deductionItems) {
    oldMapping.deductionItems.forEach(item => {
      if (item.id && item.headerName) {
        newFormat[item.id] = item.headerName;
      }
    });
  }
  
  if (oldMapping.attendanceItems) {
    oldMapping.attendanceItems.forEach(item => {
      if (item.id && item.headerName) {
        newFormat[item.id] = item.headerName;
      }
    });
  }
  
  if (oldMapping.kyItems) {
    oldMapping.kyItems.forEach(item => {
      if (item.id && item.headerName) {
        newFormat[item.id] = item.headerName;
      }
    });
  }
  
  // 従業員マッピング情報を抽出
  const employeeMapping = {
    employeeIdColumn: oldMapping.mainFields?.employeeCode?.headerName || '',
    departmentCodeColumn: oldMapping.mainFields?.departmentCode?.headerName || ''
  };
  
  return {
    mappings: newFormat,
    employeeMapping: employeeMapping
  };
};

/**
 * デバッグ用：マッピングの両方のフォーマットを出力
 * @param {Object} mapping - CsvMapping形式のデータ
 */
export const debugMappingFormats = (mapping) => {
  console.log('=== デバッグ：マッピング形式 ===');
  console.log('元のマッピング形式:', mapping);
  
  const newFormat = convertToNewFormat(mapping);
  console.log('新形式に変換:', newFormat);
  
  // 主要フィールドの変換検証
  console.log('主要フィールド:');
  for (const [key, value] of Object.entries(mapping.mainFields)) {
    console.log(`  ${key}: ${value.headerName}`);
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
  console.log('新形式のマッピング数:', Object.keys(newFormat.mappings).length);
  
  return newFormat;
};
