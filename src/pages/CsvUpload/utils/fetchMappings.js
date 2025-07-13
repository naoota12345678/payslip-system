// src/pages/CsvUpload/utils/fetchMappings.js

import { doc, getDoc } from 'firebase/firestore';

/**
 * CSVマッピング設定から給与項目を生成する
 * @param {Object} mappingData CSVマッピング設定データ
 * @param {boolean} debugMode デバッグモードの有無
 * @returns {Array} 給与項目の配列
 */
const generatePayrollItemsFromMapping = (mappingData, debugMode = false) => {
  const items = [];
  
  try {
    // 支給項目を追加
    if (mappingData.incomeItems && Array.isArray(mappingData.incomeItems)) {
      mappingData.incomeItems.forEach((item, index) => {
        if (item.headerName && item.itemName) {
          items.push({
            id: item.id || `income_${index}`,
            name: item.itemName,
            type: 'income',
            csvColumn: item.headerName,
            isVisible: item.isVisible !== false
          });
        }
      });
    }
    
    // 控除項目を追加
    if (mappingData.deductionItems && Array.isArray(mappingData.deductionItems)) {
      mappingData.deductionItems.forEach((item, index) => {
        if (item.headerName && item.itemName) {
          items.push({
            id: item.id || `deduction_${index}`,
            name: item.itemName,
            type: 'deduction',
            csvColumn: item.headerName,
            isVisible: item.isVisible !== false
          });
        }
      });
    }
    
    // 勤怠項目を追加
    if (mappingData.attendanceItems && Array.isArray(mappingData.attendanceItems)) {
      mappingData.attendanceItems.forEach((item, index) => {
        if (item.headerName && item.itemName) {
          items.push({
            id: item.id || `attendance_${index}`,
            name: item.itemName,
            type: 'attendance',
            csvColumn: item.headerName,
            isVisible: item.isVisible !== false
          });
        }
      });
    }
    
    // 項目コード項目を追加
    if (mappingData.itemCodeItems && Array.isArray(mappingData.itemCodeItems)) {
      mappingData.itemCodeItems.forEach((item, index) => {
        if (item.headerName && item.itemName) {
          // 項目コードのタイプを推定（または設定から取得）
          const itemType = item.type || 'income'; // デフォルトは支給項目
          items.push({
            id: item.id || `itemcode_${index}`,
            name: item.itemName,
            type: itemType,
            csvColumn: item.headerName,
            isVisible: item.isVisible !== false
          });
        }
      });
    }
    
    if (debugMode) {
      console.log('[Debug] CSVマッピングから生成された給与項目:', items);
    }
    
  } catch (err) {
    console.error('給与項目生成エラー:', err);
  }
  
  return items;
};

/**
 * 会社のマッピング情報を取得する
 * @param {Object} db Firestore DBインスタンス
 * @param {string} companyId 会社ID
 * @param {Array} items 給与項目リスト（使用しない、後方互換性のため残す）
 * @param {boolean} debugMode デバッグモードの有無
 * @returns {Object} 給与項目とマッピング状態
 */
export const fetchCompanyMappings = async (db, companyId, items = [], debugMode = false) => {
  let mappingsFound = false;
  let generatedItems = [];

  try {
    if (debugMode) {
      console.log('[Debug] CSVマッピング設定から給与項目を取得開始');
    }

    // 新しい形式のマッピングを確認 (csvMapping)
    const mappingDoc = await getDoc(doc(db, "csvMapping", companyId));
    if (mappingDoc.exists() && mappingDoc.data().csvMapping) {
      const mappingData = mappingDoc.data().csvMapping;
      
      if (debugMode) {
        console.log('[Debug] CSVマッピング設定を発見:', mappingData);
      }
      
      // CSVマッピング設定から給与項目を生成
      generatedItems = generatePayrollItemsFromMapping(mappingData, debugMode);
      mappingsFound = true;
      
    } else if (debugMode) {
      console.log('[Debug] CSVマッピング設定が見つかりません');
    }
    
    // 新しい形式のマッピングも確認 (csvMappings)
    if (!mappingsFound) {
      const newMappingDoc = await getDoc(doc(db, "csvMappings", companyId));
      if (newMappingDoc.exists() && newMappingDoc.data().mappings) {
        const mappings = newMappingDoc.data().mappings;
        
        if (debugMode) {
          console.log('[Debug] 新形式のマッピング設定を発見:', mappings);
        }
        
        // 新形式のマッピングから給与項目を生成
        Object.entries(mappings).forEach(([itemId, headerName]) => {
          // IDからタイプを推定
          let itemType = 'income'; // デフォルト
          let itemName = headerName; // デフォルトは同じ名前
          
          if (itemId.startsWith('income_')) {
            itemType = 'income';
          } else if (itemId.startsWith('deduction_')) {
            itemType = 'deduction';
          } else if (itemId.startsWith('attendance_')) {
            itemType = 'attendance';
          }
          
          generatedItems.push({
            id: itemId,
            name: itemName,
            type: itemType,
            csvColumn: headerName,
            isVisible: true
          });
        });
        
        mappingsFound = true;
      }
    }
    
    // マッピングの有無を確認
    const hasMappings = generatedItems.length > 0;
    
    if (debugMode) {
      console.log('[Debug] 生成された給与項目:', {
        itemsCount: generatedItems.length,
        hasMappings: hasMappings,
        items: generatedItems.map(item => ({ id: item.id, name: item.name, type: item.type, csvColumn: item.csvColumn }))
      });
    }
    
    return {
      items: generatedItems,
      hasMappings
    };
  } catch (err) {
    console.error("マッピング情報取得エラー:", err);
    return {
      items: [],
      hasMappings: false,
      error: err.message
    };
  }
};
