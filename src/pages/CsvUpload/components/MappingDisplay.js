// src/pages/CsvUpload/components/MappingDisplay.js

import React from 'react';

/**
 * マッピング情報表示コンポーネント
 */
const MappingDisplay = ({ payrollItems, refreshSettings }) => {
  if (!payrollItems || payrollItems.length === 0) return null;
  
  // マッピングが設定されている項目数を計算
  const mappedItemsCount = payrollItems.filter(item => item.csvColumn).length;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">現在のCSVマッピング設定</h2>
        <button 
          onClick={refreshSettings}
          className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          再読み込み
        </button>
      </div>
      
      <p className="text-sm text-gray-600 mb-3">
        {mappedItemsCount} / {payrollItems.length} 項目がマッピングされています
      </p>
      
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2 text-left">給与項目ID</th>
              <th className="border px-4 py-2 text-left">給与項目</th>
              <th className="border px-4 py-2 text-left">CSVカラム</th>
            </tr>
          </thead>
          <tbody>
            {payrollItems.map(item => (
              <tr key={item.id}>
                <td className="border px-4 py-2 text-xs text-gray-500">{item.id}</td>
                <td className="border px-4 py-2">{item.name}</td>
                <td className="border px-4 py-2">
                  {item.csvColumn 
                    ? item.csvColumn
                    : <span className="text-red-500">マッピングなし</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <a href="/settings/csv-mapping" className="text-blue-600 hover:underline">
          マッピング設定を変更する
        </a>
      </div>
    </div>
  );
};

export default MappingDisplay;
