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
  onUpdateItemCommuterAllowance,
  onUpdateItemGrossTotal,
  onRemoveItem,
  onMoveItem,
  availableHeaders,
  onAddItem,
  onManualAddItem,
  category
}) => {
  // 安全性を確保
  const safeItems = items || [];
  const safeAvailableHeaders = availableHeaders || [];

  // 移動先カテゴリの選択状態を管理
  const [selectedMoveCategory, setSelectedMoveCategory] = useState({});

  // 手動追加用の入力状態
  const [manualHeaderName, setManualHeaderName] = useState('');
  const [manualItemName, setManualItemName] = useState('');

  const handleManualAdd = () => {
    if (!manualHeaderName.trim()) return;
    if (safeItems.some(item => item.headerName === manualHeaderName.trim())) {
      alert('このヘッダー名は既に登録されています');
      return;
    }
    if (onManualAddItem) {
      onManualAddItem(category, manualHeaderName.trim(), manualItemName.trim());
      setManualHeaderName('');
      setManualItemName('');
    }
  };
  
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
      <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
        <h4 className="text-sm font-medium text-gray-700">{title}</h4>
        <div className="flex flex-wrap items-center gap-2">
          {/* 既存のドロップダウン */}
          <select
            value=""
            onChange={(e) => {
              const selectedValue = e.target.value;
              console.log('📌 ドロップダウン選択:', { category, selectedValue });
              if (selectedValue) {
                onAddItem(category, selectedValue);
              }
            }}
            className="block pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
          >
            <option value="">項目を追加...</option>
            {safeAvailableHeaders
              .filter(header => {
                if (!header || !header.trim()) return false;
                if (category === 'itemCodeItems') {
                  return /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(header) && !safeItems.some(item => item.headerName === header);
                }
                return !safeItems.some(item => item.headerName === header);
              })
              .map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
          </select>
          {/* 手動追加 */}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={manualHeaderName}
              onChange={(e) => setManualHeaderName(e.target.value)}
              placeholder="ヘッダー名（例：KY21_10）"
              className="w-40 py-1 px-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              value={manualItemName}
              onChange={(e) => setManualItemName(e.target.value)}
              placeholder="項目名（例：通勤手当）"
              className="w-36 py-1 px-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleManualAdd}
              disabled={!manualHeaderName.trim()}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              追加
            </button>
          </div>
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
              {onUpdateItemCommuterAllowance && (
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  通勤手当
                </th>
              )}
              {onUpdateItemGrossTotal && (
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  総支給額
                </th>
              )}
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
                {onUpdateItemCommuterAllowance && (
                  <td className="px-6 py-2 whitespace-nowrap text-sm">
                    <input
                      type="checkbox"
                      checked={item.isCommuterAllowance || false}
                      onChange={(e) => onUpdateItemCommuterAllowance(category, index, e.target.checked)}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      title="通勤手当として扱う場合はチェック（年収の壁の税計算で除外されます）"
                    />
                  </td>
                )}
                {onUpdateItemGrossTotal && (
                  <td className="px-6 py-2 whitespace-nowrap text-sm">
                    <input
                      type="checkbox"
                      checked={item.isGrossTotal || false}
                      onChange={(e) => onUpdateItemGrossTotal(category, index, e.target.checked)}
                      className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                      title="総支給額として扱う場合はチェック（年収の壁の累計計算に使用）"
                    />
                  </td>
                )}
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
