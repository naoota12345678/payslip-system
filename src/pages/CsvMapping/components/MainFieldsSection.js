// src/pages/CsvMapping/components/MainFieldsSection.js
// 基本項目マッピングセクションコンポーネント（headerName直接版）

import React from 'react';

const MainFieldsSection = ({ mappingConfig, updateMainFieldMapping, parsedHeaders }) => {
  console.log('🔥 MainFieldsSection: 受け取ったmappingConfig:', mappingConfig);
  console.log('🔥 MainFieldsSection: 各カテゴリの項目数:', {
    itemCodeItems: mappingConfig?.itemCodeItems?.length || 0,
    incomeItems: mappingConfig?.incomeItems?.length || 0,
    deductionItems: mappingConfig?.deductionItems?.length || 0,
    attendanceItems: mappingConfig?.attendanceItems?.length || 0,
    kyItems: mappingConfig?.kyItems?.length || 0,
    totalItems: mappingConfig?.totalItems?.length || 0
  });

  const safeMainFields = mappingConfig?.mainFields || {};

  // すべての項目を収集（itemCodeItemsが主要な保存場所）
  const allItemsRaw = [
    ...(mappingConfig?.itemCodeItems || []),
    ...(mappingConfig?.incomeItems || []),
    ...(mappingConfig?.deductionItems || []),
    ...(mappingConfig?.attendanceItems || []),
    ...(mappingConfig?.kyItems || []),
    ...(mappingConfig?.totalItems || [])  // 合計項目（総支給額、総控除額、差引支給額等）
  ];
  console.log('🔥 MainFieldsSection: allItemsRaw（フィルタ前）:', allItemsRaw.length, '件');
  console.log('🔥 MainFieldsSection: allItemsRaw最初の3個:', allItemsRaw.slice(0, 3));

  // headerNameがある項目のみ使用（空文字も許可するよう変更）
  const allItems = allItemsRaw.filter(item => item && (item.headerName || item.itemName));

  console.log('🔥 MainFieldsSection: allItems数:', allItems.length);
  console.log('🔥 MainFieldsSection: allItemsの最初の5個:', allItems.slice(0, 5));
  
  // 重複を除去（headerNameまたはitemNameをキーとして使用）
  const uniqueItemsMap = new Map();
  allItems.forEach(item => {
    const key = item.headerName || item.itemName || `col_${item.columnIndex}`;
    if (!uniqueItemsMap.has(key)) {
      uniqueItemsMap.set(key, item);
    }
  });
  const fixedItems = Array.from(uniqueItemsMap.values());

  console.log('🔧 アイテムをそのまま使用（最初の3個）:', fixedItems.slice(0, 3));

  // 記号（headerNameまたはitemName）を表示するように変更
  const availableSymbols = fixedItems.map(item => item.headerName || item.itemName).filter(s => s && s.trim());
  
  // mainFieldsから正しい記号を取得するヘルパー関数
  const getSymbolFromMainField = (mainField) => {
    if (!mainField) return '';

    // mainField.headerNameまたはitemNameがある場合はそのまま返す
    if (mainField.headerName) {
      return mainField.headerName;
    }
    if (mainField.itemName) {
      return mainField.itemName;
    }

    // columnIndexから探す
    if (mainField.columnIndex >= 0) {
      const matchedItem = fixedItems.find(item => item.columnIndex === mainField.columnIndex);
      return matchedItem?.headerName || matchedItem?.itemName || '';
    }

    return '';
  };

  // 表示用の項目名を取得するヘルパー関数
  const getDisplayNameFromSymbol = (symbol) => {
    if (!symbol) return symbol;
    const matchedItem = fixedItems.find(item =>
      item.headerName === symbol || item.itemName === symbol
    );
    return matchedItem?.itemName || symbol;
  };
  
  console.log('🔍 基本項目マッピング（記号版）:');
  console.log('- 利用可能な記号（headerName）:', availableSymbols);
  console.log('- 利用可能な記号（最初の10個）:', availableSymbols.slice(0, 10));
  console.log('- mainFields:', safeMainFields);
  console.log('- 全項目数:', allItems.length);
  console.log('- 全項目（最初の3個）:', allItems.slice(0, 3));

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">基本項目マッピング</h3>
      
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              識別コード
            </label>
            <select
              value={getSymbolFromMainField(safeMainFields.identificationCode)}
              onChange={(e) => updateMainFieldMapping('identificationCode', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {availableSymbols.map((symbol, index) => (
                <option key={index} value={symbol}>{symbol} - {getDisplayNameFromSymbol(symbol)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              従業員コード
            </label>
            <select
              value={getSymbolFromMainField(safeMainFields.employeeCode)}
              onChange={(e) => updateMainFieldMapping('employeeCode', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {availableSymbols.map((symbol, index) => (
                <option key={index} value={symbol}>{symbol} - {getDisplayNameFromSymbol(symbol)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              従業員氏名
            </label>
            <select
              value={getSymbolFromMainField(safeMainFields.employeeName)}
              onChange={(e) => updateMainFieldMapping('employeeName', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {availableSymbols.map((symbol, index) => (
                <option key={index} value={symbol}>{symbol} - {getDisplayNameFromSymbol(symbol)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              支給額
            </label>
            <select
              value={getSymbolFromMainField(safeMainFields.totalSalary)}
              onChange={(e) => updateMainFieldMapping('totalSalary', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {availableSymbols.map((symbol, index) => (
                <option key={index} value={symbol}>{symbol} - {getDisplayNameFromSymbol(symbol)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              控除額
            </label>
            <select
              value={getSymbolFromMainField(safeMainFields.totalDeductions)}
              onChange={(e) => updateMainFieldMapping('totalDeductions', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {availableSymbols.map((symbol, index) => (
                <option key={index} value={symbol}>{symbol} - {getDisplayNameFromSymbol(symbol)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              差引支給額
            </label>
            <select
              value={getSymbolFromMainField(safeMainFields.netSalary)}
              onChange={(e) => updateMainFieldMapping('netSalary', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {availableSymbols.map((symbol, index) => (
                <option key={index} value={symbol}>{symbol} - {getDisplayNameFromSymbol(symbol)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              部門コード
            </label>
            <select
              value={getSymbolFromMainField(safeMainFields.departmentCode)}
              onChange={(e) => updateMainFieldMapping('departmentCode', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {availableSymbols.map((symbol, index) => (
                <option key={index} value={symbol}>{symbol} - {getDisplayNameFromSymbol(symbol)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              支給年月
            </label>
            <select
              value={getSymbolFromMainField(safeMainFields.paymentDate)}
              onChange={(e) => updateMainFieldMapping('paymentDate', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {availableSymbols.map((symbol, index) => (
                <option key={index} value={symbol}>{symbol} - {getDisplayNameFromSymbol(symbol)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainFieldsSection;
