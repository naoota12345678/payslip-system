// src/pages/CsvMapping/components/ItemMappingTable.js
// 項目マッピングテーブルコンポーネント

import React, { useState } from 'react';
import { getCategoryMoveOptions, getCategoryDisplayName } from '../utils/mappingHelpers';

const ItemMappingTable = ({
  title,
  items,
  onUpdateItemName,
  onUpdateItemVisibility,
  onUpdateItemZeroDisplay,
  onRemoveItem,
  onMoveItem,
  availableHeaders,
  onAddItem,
  category
}) => {
  // 安全性を確保
  const safeItems = items || [];
  const safeAvailableHeaders = availableHeaders || [];
  
  // 移動先カテゴリの選択状態を管理
  const [selectedMoveCategory, setSelectedMoveCategory] = useState({});
  
  // 項目移動ハンドラ
  const handleMoveItem = (itemIndex, targetCategory) => {
    if (onMoveItem && targetCategory) {
      onMoveItem(category, itemIndex, targetCategory);
      // 選択状態をリセット
      setSelectedMoveCategory(prev => ({
        ...prev,
        [itemIndex]: ''
      }));
    }
  };
  
  // 移動先カテゴリの選択肢を取得
  const moveOptions = getCategoryMoveOptions(category);
  
  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium text-gray-700">{title}</h4>
        <div className="relative">
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                onAddItem(category, e.target.value);
                e.target.value = '';
              }
            }}
            className="block w-full pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="">項目を追加...</option>
            {safeAvailableHeaders
              .filter(header => 
                category === 'itemCodeItems' ? 
                  // 項目コードパターンをチェック（KY01、A01、ITEM01など）
                  /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(header) && !safeItems.some(item => item.headerName === header) :
                  !safeItems.some(item => item.headerName === header)
              )
              .map((header, index) => (
                <option key={index} value={header}>
                  {header}
                </option>
              ))}
          </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ヘッダー名
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                項目名
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                表示
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                0値表示
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                移動
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                アクション
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {safeItems.map((item, index) => (
              <tr key={item.id || index}>
                <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                  {item.headerName || ''}
                </td>
                <td className="px-6 py-2 whitespace-nowrap text-sm">
                  <input
                    type="text"
                    value={item.itemName || ''}
                    onChange={(e) => onUpdateItemName(category, index, e.target.value)}
                    placeholder={`${item.headerName}の表示名を入力`}
                    className="block w-full py-1 px-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                    title="この項目の画面上での表示名を入力してください（例：出勤日数、基本給、社会保険料など）"
                  />
                  {(!item.itemName || item.itemName.trim() === '') && (
                    <p className="text-xs text-red-500 mt-1">
                      ⚠️ 表示名を入力してください
                    </p>
                  )}
                </td>
                <td className="px-6 py-2 whitespace-nowrap text-sm">
                  <input
                    type="checkbox"
                    checked={item.isVisible || false}
                    onChange={(e) => onUpdateItemVisibility(category, index, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </td>
                <td className="px-6 py-2 whitespace-nowrap text-sm">
                  <input
                    type="checkbox"
                    checked={item.showZeroValue || false}
                    onChange={(e) => onUpdateItemZeroDisplay && onUpdateItemZeroDisplay(category, index, e.target.checked)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    title="値が0の場合でも給与明細に表示する場合はチェックしてください"
                  />
                </td>
                <td className="px-6 py-2 whitespace-nowrap text-sm">
                  <div className="flex space-x-2">
                    <select
                      value={selectedMoveCategory[index] || ''}
                      onChange={(e) => setSelectedMoveCategory(prev => ({
                        ...prev,
                        [index]: e.target.value
                      }))}
                      className="block w-full py-1 px-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                    >
                      <option value="">移動先を選択...</option>
                      {moveOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleMoveItem(index, selectedMoveCategory[index])}
                      disabled={!selectedMoveCategory[index]}
                      className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      移動
                    </button>
                  </div>
                </td>
                <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(category, index)}
                    className="text-red-600 hover:text-red-900"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ItemMappingTable;
