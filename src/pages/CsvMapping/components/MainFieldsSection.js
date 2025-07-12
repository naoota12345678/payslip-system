// src/pages/CsvMapping/components/MainFieldsSection.js
// 基本項目マッピングセクションコンポーネント

import React from 'react';

const MainFieldsSection = ({ mappingConfig, updateMainFieldMapping, parsedHeaders }) => {
  // 安全性を確保
  const safeMainFields = mappingConfig?.mainFields || {};
  const safeIdentificationCode = safeMainFields.identificationCode || { columnIndex: -1, headerName: '' };
  const safeEmployeeCode = safeMainFields.employeeCode || { columnIndex: -1, headerName: '' };
  const safeParsedHeaders = parsedHeaders || [];
  
  return (
    <div>
      <h3 className="text-md font-medium mb-2">基本項目マッピング</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            識別コード <span className="text-red-500">*</span>
          </label>
          <select
            value={safeIdentificationCode.columnIndex}
            onChange={(e) => updateMainFieldMapping('identificationCode', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            従業員コード <span className="text-red-500">*</span>
          </label>
          <select
            value={safeEmployeeCode.columnIndex}
            onChange={(e) => updateMainFieldMapping('employeeCode', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {safeParsedHeaders.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            従業員氏名
          </label>
          <select
            value={mappingConfig.mainFields.employeeName.columnIndex}
            onChange={(e) => updateMainFieldMapping('employeeName', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {parsedHeaders.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            部門コード
          </label>
          <select
            value={mappingConfig.mainFields.departmentCode.columnIndex}
            onChange={(e) => updateMainFieldMapping('departmentCode', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {parsedHeaders.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            部門名
          </label>
          <select
            value={mappingConfig.mainFields.departmentName.columnIndex}
            onChange={(e) => updateMainFieldMapping('departmentName', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {parsedHeaders.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            基本給
          </label>
          <select
            value={mappingConfig.mainFields.basicSalary.columnIndex}
            onChange={(e) => updateMainFieldMapping('basicSalary', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {parsedHeaders.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            総支給額
          </label>
          <select
            value={mappingConfig.mainFields.totalIncome.columnIndex}
            onChange={(e) => updateMainFieldMapping('totalIncome', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {parsedHeaders.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            総控除額
          </label>
          <select
            value={mappingConfig.mainFields.totalDeduction.columnIndex}
            onChange={(e) => updateMainFieldMapping('totalDeduction', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {parsedHeaders.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            差引支給額
          </label>
          <select
            value={mappingConfig.mainFields.netAmount.columnIndex}
            onChange={(e) => updateMainFieldMapping('netAmount', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {parsedHeaders.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            支払日
          </label>
          <select
            value={mappingConfig.mainFields.paymentDate.columnIndex}
            onChange={(e) => updateMainFieldMapping('paymentDate', e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="-1">選択してください</option>
            {parsedHeaders.map((header, index) => (
              <option key={index} value={index}>{header}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default MainFieldsSection;
