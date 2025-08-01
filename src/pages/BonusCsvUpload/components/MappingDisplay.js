// src/pages/CsvUpload/components/MappingDisplay.js

import React from 'react';

/**
 * マッピング情報表示コンポーネント
 */
const MappingDisplay = ({ payrollItems, refreshSettings, onCategoryChange, onSaveMapping, isSaving = false }) => {
  if (!payrollItems || payrollItems.length === 0) return null;
  
  // マッピングが設定されている項目数を計算
  const mappedItemsCount = payrollItems.filter(item => item.csvColumn).length;

  // カテゴリ名の表示用変換
  const getTypeDisplayName = (type) => {
    const typeMap = {
      'income': '支給項目',
      'deduction': '控除項目',
      'attendance': '勤怠項目'
    };
    return typeMap[type] || type;
  };

  // カテゴリ変更ボタンの表示
  const renderCategoryButtons = (item) => {
    const currentType = item.type;
    const availableTypes = ['income', 'deduction', 'attendance'].filter(type => type !== currentType);
    
    return (
      <div className="flex space-x-1">
        {availableTypes.map(type => (
          <button
            key={type}
            onClick={() => onCategoryChange && onCategoryChange(item.id, type)}
            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200 transition-colors"
            title={`${getTypeDisplayName(type)}へ移動`}
          >
            {getTypeDisplayName(type)}へ
          </button>
        ))}
      </div>
    );
  };

  // カテゴリ別に項目を分類
  const itemsByCategory = {
    income: payrollItems.filter(item => item.type === 'income'),
    deduction: payrollItems.filter(item => item.type === 'deduction'),
    attendance: payrollItems.filter(item => item.type === 'attendance')
  };

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
      
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-3">
          {mappedItemsCount} / {payrollItems.length} 項目がマッピングされています
        </p>
        {mappedItemsCount === 0 && (
          <div className="p-3 bg-yellow-100 border border-yellow-300 rounded">
            <p className="text-sm text-yellow-800">
              ⚠️ CSVマッピングが設定されていません。下記のリンクから設定を行ってください。
            </p>
          </div>
        )}
      </div>
      
      {/* カテゴリ別表示 */}
      {Object.entries(itemsByCategory).map(([category, items]) => (
        <div key={category} className="mb-6">
          <h3 className="text-lg font-medium mb-3 text-gray-800 border-b pb-2">
            {getTypeDisplayName(category)} ({items.length}項目)
          </h3>
          
          {items.length === 0 ? (
            <p className="text-gray-500 text-sm italic">項目がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">給与項目</th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-sm font-medium">CSVカラム</th>
                    <th className="border border-gray-300 px-3 py-2 text-center text-sm font-medium">カテゴリ変更</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2 font-medium">{item.name}</td>
                      <td className="border border-gray-300 px-3 py-2">
                        {item.csvColumn ? (
                          <span className="text-green-600 font-medium">{item.csvColumn}</span>
                        ) : (
                          <span className="text-red-500 text-sm">マッピングなし</span>
                        )}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        {onCategoryChange ? renderCategoryButtons(item) : (
                          <span className="text-gray-400 text-sm">変更不可</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600">
            項目のカテゴリを変更したい場合は、各項目の「○○へ」ボタンをクリックしてください。
          </p>
          <a href="/settings/csv-mapping" className="text-blue-600 hover:underline text-sm">
            CSVマッピング設定画面で詳細設定
          </a>
        </div>
        
        {/* 保存ボタン */}
        {onSaveMapping && (
          <div className="flex justify-center">
            <button
              onClick={onSaveMapping}
              disabled={isSaving}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </span>
              ) : (
                'マッピング設定を保存'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MappingDisplay;
