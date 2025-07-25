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
    
    // 合計項目を追加
    if (mappingData.totalItems && Array.isArray(mappingData.totalItems)) {
      mappingData.totalItems.forEach((item, index) => {
        if (item.headerName && item.itemName) {
          items.push({
            id: item.id || `total_${index}`,
            name: item.itemName,
            type: 'total',
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

    // csvMappings コレクションから直接データを取得（推奨形式）
    const mappingDoc = await getDoc(doc(db, "csvMappings", companyId));
    if (mappingDoc.exists()) {
      const mappingData = mappingDoc.data();
      
      console.log('[強制Debug] csvMappingsから設定を発見:', mappingData);
      console.log('[強制Debug] データ構造確認:', {
        hasIncomeItems: !!(mappingData.incomeItems && Array.isArray(mappingData.incomeItems)),
        incomeItemsLength: mappingData.incomeItems ? mappingData.incomeItems.length : 0,
        hasDeductionItems: !!(mappingData.deductionItems && Array.isArray(mappingData.deductionItems)),
        deductionItemsLength: mappingData.deductionItems ? mappingData.deductionItems.length : 0,
        hasAttendanceItems: !!(mappingData.attendanceItems && Array.isArray(mappingData.attendanceItems)),
        attendanceItemsLength: mappingData.attendanceItems ? mappingData.attendanceItems.length : 0
      });
      
      // Firestoreの既存データ構造を直接使用（簡素化）
      const categories = ['incomeItems', 'deductionItems', 'attendanceItems', 'totalItems'];
      
      categories.forEach(category => {
        if (mappingData[category] && Array.isArray(mappingData[category])) {
          console.log(`[強制Debug] ${category}を処理中:`, mappingData[category]);
          mappingData[category].forEach((item, index) => {
            console.log(`[強制Debug] ${category}[${index}]:`, item);
            if (item.headerName && item.itemName && item.isVisible !== false) {
              const categoryType = category.replace('Items', ''); // incomeItems -> income
              const newItem = {
                id: item.id || `${categoryType}_${index}`,
                name: item.itemName,
                type: categoryType === 'income' ? 'income' : 
                      categoryType === 'deduction' ? 'deduction' : 
                      categoryType === 'attendance' ? 'attendance' : 'total',
                csvColumn: item.headerName,
                isVisible: true
              };
              console.log(`[強制Debug] 生成された項目:`, newItem);
              generatedItems.push(newItem);
            } else {
              console.log(`[強制Debug] スキップされた項目 (条件不一致):`, {
                hasHeaderName: !!item.headerName,
                hasItemName: !!item.itemName,
                isVisible: item.isVisible
              });
            }
          });
        } else {
          console.log(`[強制Debug] ${category}が見つからないかArray型ではありません`);
        }
      });
      
      mappingsFound = true;
      
    } else if (debugMode) {
      console.log('[Debug] csvMappings設定が見つかりません');
    }
    
    // マッピングの有無を確認
    const hasMappings = generatedItems.length > 0;
    
    console.log('[強制Debug] 最終結果:', {
      itemsCount: generatedItems.length,
      hasMappings: hasMappings,
      mappingsFound: mappingsFound,
      items: generatedItems.map(item => ({ id: item.id, name: item.name, type: item.type, csvColumn: item.csvColumn }))
    });
    
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
