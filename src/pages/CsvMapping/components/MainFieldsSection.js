// src/pages/CsvMapping/components/MainFieldsSection.js
// 基本項目マッピングセクションコンポーネント

import React from 'react';

const MainFieldsSection = ({ mappingConfig, updateMainFieldMapping, parsedHeaders }) => {
  // 🔍 デバッグ：parsedHeadersの内容を確認
  console.log('=== MainFieldsSection デバッグ ===');
  console.log('parsedHeaders:', parsedHeaders);
  console.log('parsedHeaders長さ:', parsedHeaders?.length);
  console.log('最初の10個:', parsedHeaders?.slice(0, 10));
  
  // 🔍 従業員コード※の調査
  console.log('🔍 従業員コード※の調査:');
  console.log('- 従業員コード含む項目:', parsedHeaders?.filter(h => h?.includes('従業員')));
  console.log('- ※含む項目:', parsedHeaders?.filter(h => h?.includes('※')));
  console.log('- 日本語含む項目:', parsedHeaders?.filter(h => /[ひらがなカタカナ漢字]/.test(h)));
  console.log('- KY以外の項目:', parsedHeaders?.filter(h => !h?.startsWith('KY')));
  
  // 安全性を確保
  const safeMainFields = mappingConfig?.mainFields || {};
  const safeIdentificationCode = safeMainFields.identificationCode || { columnIndex: -1, headerName: '' };
  const safeEmployeeCode = safeMainFields.employeeCode || { columnIndex: -1, headerName: '' };
  const safeDepartmentCode = safeMainFields.departmentCode || { columnIndex: -1, headerName: '' };
  const safeDepartmentName = safeMainFields.departmentName || { columnIndex: -1, headerName: '' };
  const safeParsedHeaders = parsedHeaders || [];
  
  console.log('🔍 基本情報マッピング詳細デバッグ:');
  console.log('- employeeCode詳細:', safeEmployeeCode);
  console.log('- employeeCode.columnIndex:', safeEmployeeCode.columnIndex);
  console.log('- employeeCode.headerName:', safeEmployeeCode.headerName);
  console.log('- parsedHeaders[safeEmployeeCode.columnIndex]:', parsedHeaders?.[safeEmployeeCode.columnIndex]);
  console.log('- safeParsedHeaders長さ:', safeParsedHeaders.length);
  console.log('- mappingConfig全体:', mappingConfig);
  
  // ヘッダー名から対応する項目名を取得するヘルパー関数
  const getItemNameForHeader = (headerName) => {
    // 全てのカテゴリから該当する項目を検索
    const allItems = [
      ...(mappingConfig?.incomeItems || []),
      ...(mappingConfig?.deductionItems || []),
      ...(mappingConfig?.attendanceItems || []),
      ...(mappingConfig?.itemCodeItems || []),
      ...(mappingConfig?.kyItems || [])
    ];
    
    // デバッグ: 実際のデータ構造を確認
    console.log('🔍 getItemNameForHeader デバッグ:');
    console.log('検索対象headerName（記号）:', headerName);
    console.log('利用可能な項目サンプル（最初の3つ）:');
    allItems.slice(0, 3).forEach((item, index) => {
      console.log(`  [${index}] headerName="${item.headerName}"（日本語）, itemName="${item.itemName}"（記号）`);
    });
    
    // 記号（headerName）に対応する項目を itemName で検索
    const matchedItem = allItems.find(item => item.itemName === headerName);
    
    console.log('マッチした項目:', matchedItem);
    
    if (matchedItem && matchedItem.headerName && matchedItem.headerName.trim() !== '') {
      // 日本語項目名（headerName）を記号（itemName）と一緒に表示
      const result = `${matchedItem.headerName} (${matchedItem.itemName})`;
      console.log(`✅ 表示結果: ${result}`);
      return result;
    }
    
    console.log(`⚠️ マッチなし、元のヘッダー名（記号）を返す: ${headerName}`);
    return headerName;
  };
  
  return (
    <div>
      <h3 className="text-md font-medium mb-2">基本項目マッピング</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            識別コード
          </label>
          <select
            value={safeIdentificationCode.columnIndex}
            onChange={(e) => updateMainFieldMapping('identificationCode', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{getItemNameForHeader(header)}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            従業員コード
          </label>
          <select
            value={safeEmployeeCode.columnIndex}
            onChange={(e) => updateMainFieldMapping('employeeCode', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{getItemNameForHeader(header)}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            従業員氏名
          </label>
          <select
            value={safeMainFields.employeeName?.columnIndex ?? -1}
            onChange={(e) => updateMainFieldMapping('employeeName', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{getItemNameForHeader(header)}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            部門コード
          </label>
          <select
            value={safeDepartmentCode.columnIndex}
            onChange={(e) => updateMainFieldMapping('departmentCode', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{getItemNameForHeader(header)}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            部門名
          </label>
          <select
            value={safeDepartmentName.columnIndex}
            onChange={(e) => updateMainFieldMapping('departmentName', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{getItemNameForHeader(header)}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            基本給
          </label>
          <select
            value={safeMainFields.basicSalary?.columnIndex ?? -1}
            onChange={(e) => updateMainFieldMapping('basicSalary', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{getItemNameForHeader(header)}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            総支給額
          </label>
          <select
            value={safeMainFields.totalIncome?.columnIndex ?? -1}
            onChange={(e) => updateMainFieldMapping('totalIncome', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{getItemNameForHeader(header)}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            総控除額
          </label>
          <select
            value={safeMainFields.totalDeduction?.columnIndex ?? -1}
            onChange={(e) => updateMainFieldMapping('totalDeduction', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{getItemNameForHeader(header)}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            差引支給額
          </label>
          <select
            value={safeMainFields.netAmount?.columnIndex ?? -1}
            onChange={(e) => updateMainFieldMapping('netAmount', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{getItemNameForHeader(header)}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            支払日
          </label>
          <select
            value={safeMainFields.paymentDate?.columnIndex ?? -1}
            onChange={(e) => updateMainFieldMapping('paymentDate', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{getItemNameForHeader(header)}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default MainFieldsSection;
