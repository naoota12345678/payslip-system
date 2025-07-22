// src/utils/mappingUtils.js
// CSVマッピング関連のユーティリティ関数

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * CSVマッピング設定を新しい形式で保存
 * @param {string} companyId - 会社ID
 * @param {Object} mappingData - マッピングデータ
 * @param {Array} mappingData.attendanceItems - 勤怠項目の配列
 * @param {Array} mappingData.incomeItems - 支給項目の配列
 * @param {Array} mappingData.deductionItems - 控除項目の配列
 * @param {Array} mappingData.totalItems - 合計項目の配列
 * @param {Object} mappingData.simpleMapping - シンプルマッピング（ヘッダー名 → 表示名）
 * @param {Object} mappingData.itemCategories - 項目カテゴリ（ヘッダー名 → カテゴリ）
 * @param {Object} mappingData.visibilitySettings - 表示設定（ヘッダー名 → 表示/非表示）
 */
export const saveMappingSettings = async (companyId, mappingData) => {
  try {
    console.log('📤 マッピング設定を保存中...', companyId);
    
    const mappingDoc = {
      // 勤怠項目
      attendanceItems: mappingData.attendanceItems || [],
      // 支給項目  
      incomeItems: mappingData.incomeItems || [],
      // 控除項目
      deductionItems: mappingData.deductionItems || [],
      // 合計項目
      totalItems: mappingData.totalItems || [],
      // シンプルマッピング（ヘッダー名 → 表示名）
      simpleMapping: mappingData.simpleMapping || {},
      // 項目カテゴリ（ヘッダー名 → カテゴリ）
      itemCategories: mappingData.itemCategories || {},
      // 表示設定（ヘッダー名 → 表示/非表示）
      visibilitySettings: mappingData.visibilitySettings || {},
      // 従業員マッピング
      employeeMapping: mappingData.employeeMapping || {},
      // メタデータ
      updatedAt: new Date(),
      updatedBy: mappingData.updatedBy || 'system'
    };
    
    await setDoc(doc(db, 'csvMappings', companyId), mappingDoc);
    console.log('✅ マッピング設定保存完了');
    return { success: true };
  } catch (error) {
    console.error('❌ マッピング設定保存エラー:', error);
    return { success: false, error: error.message };
  }
};

/**
 * CSVマッピング設定を取得
 * @param {string} companyId - 会社ID
 */
export const loadMappingSettings = async (companyId) => {
  try {
    console.log('📥 マッピング設定を取得中...', companyId);
    
    const mappingDoc = await getDoc(doc(db, 'csvMappings', companyId));
    
    if (mappingDoc.exists()) {
      const data = mappingDoc.data();
      console.log('✅ マッピング設定取得完了');
      return {
        success: true,
        data: {
          attendanceItems: data.attendanceItems || [],
          incomeItems: data.incomeItems || [],
          deductionItems: data.deductionItems || [],
          totalItems: data.totalItems || [],
          simpleMapping: data.simpleMapping || {},
          itemCategories: data.itemCategories || {},
          visibilitySettings: data.visibilitySettings || {},
          employeeMapping: data.employeeMapping || {}
        }
      };
    } else {
      console.log('⚠️ マッピング設定が見つかりません');
      return {
        success: true,
        data: {
          attendanceItems: [],
          incomeItems: [],
          deductionItems: [],
          totalItems: [],
          simpleMapping: {},
          itemCategories: {},
          visibilitySettings: {},
          employeeMapping: {}
        }
      };
    }
  } catch (error) {
    console.error('❌ マッピング設定取得エラー:', error);
    return { success: false, error: error.message };
  }
};

/**
 * ヘッダー情報から項目配列を生成
 * @param {Array} headers - CSVヘッダー配列
 * @param {Object} categoryMapping - カテゴリマッピング
 * @param {Object} simpleMapping - シンプルマッピング
 * @param {Object} visibilitySettings - 表示設定
 */
export const generateItemArrays = (headers, categoryMapping, simpleMapping, visibilitySettings) => {
  const attendanceItems = [];
  const incomeItems = [];
  const deductionItems = [];
  const totalItems = [];
  
  headers.forEach((header, index) => {
    if (!header || header.trim() === '') return;
    
    const category = categoryMapping[header] || 'other';
    const itemName = simpleMapping[header] || header;
    const isVisible = visibilitySettings[header] !== false;
    
    const itemData = {
      columnIndex: index,                    // 正しい連番（0, 1, 2, 3...）
      headerName: header,                    // 元のCSVヘッダー名
      id: `${category}_${header}_${index}`,
      isVisible: isVisible,
      itemName: itemName                     // 日本語表示名
    };
    
    // デバッグ: データ確認
    console.log(`🔧 generateItemArrays - 項目${index}: "${header}" → "${itemName}" (${category})`);
    console.log(`   columnIndex: ${index}, headerName: "${header}", itemName: "${itemName}"`);
    console.log(`   ---`);
    
    switch (category) {
      case 'attendance':
        attendanceItems.push(itemData);
        break;
      case 'income':
        incomeItems.push(itemData);
        break;
      case 'deduction':
        deductionItems.push(itemData);
        break;
      case 'total':
        totalItems.push(itemData);
        break;
      default:
        // その他の項目は支給項目として扱う
        incomeItems.push({...itemData, id: `income_${header}_${index}`});
    }
  });
    
    return {
    attendanceItems,
    incomeItems, 
    deductionItems,
    totalItems
  };
}; 

/**
 * 給与明細データから4セクション表示用のデータを生成
 * @param {Object} payslipData - 給与明細データ
 * @param {Object} mappingSettings - マッピング設定
 */
export const generatePayslipSections = (payslipData, mappingSettings) => {
  if (!payslipData || !mappingSettings) {
    return {
      attendance: [],
      income: [],
      deduction: [],
      total: []
    };
  }
  
  const sections = {
    attendance: [],
    income: [],
    deduction: [],
    total: []
  };
  
  // 各カテゴリの項目を処理
  Object.entries(payslipData.items || {}).forEach(([key, value]) => {
    const category = payslipData.itemCategories?.[key] || mappingSettings.itemCategories?.[key] || 'income';
    const isVisible = payslipData.itemVisibility?.[key] !== false && mappingSettings.visibilitySettings?.[key] !== false;
    const displayName = mappingSettings.simpleMapping?.[key] || key;
    
    if (isVisible) {
      const item = {
        key: key,
        name: displayName,
        value: value,
        originalValue: value
      };
      
      switch (category) {
        case 'attendance':
          sections.attendance.push(item);
          break;
        case 'income':
          sections.income.push(item);
          break;
        case 'deduction':
          sections.deduction.push(item);
          break;
        case 'total':
          sections.total.push(item);
          break;
      }
    }
  });
  
  return sections;
};

/**
 * 給与明細の合計値を計算
 * @param {Object} sections - セクションデータ
 */
export const calculateTotals = (sections) => {
  const totalIncome = sections.income.reduce((sum, item) => {
    const value = typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0;
    return sum + (value > 0 ? value : 0);
  }, 0);
  
  const totalDeduction = sections.deduction.reduce((sum, item) => {
    const value = typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0;
    return sum + (value > 0 ? value : 0);
  }, 0);
  
  const netAmount = totalIncome - totalDeduction;
  
    return {
    totalIncome,
    totalDeduction,
    netAmount
  };
}; 