// src/pages/CsvMapping/components/ItemMappingTable.js
// 項目マッピングテーブルコンポーネント

import React from 'react';

const ItemMappingTable = ({
  title,
  items,
  onUpdateItemName,
  onUpdateItemVisibility,
  onRemoveItem,
  availableHeaders,
  onAddItem,
  category
}) => {
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
            {availableHeaders
              .filter(header => 
                category === 'itemCodeItems' ? 
                  // 項目コードパターンをチェック（KY01、A01、ITEM01など）
                  /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(header) && !items.some(item => item.headerName === header) :
                  !items.some(item => item.headerName === header)
              )
              .map((header, index) => (
                <option key={index} value={header}>{header}</option>
              ))
            }
          </select>
        </div>
      </div>
      
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 italic">マッピングされた{title}はありません</p>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CSVヘッダー
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  表示名
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  表示
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    {item.headerName}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm">
                    <input
                      type="text"
                      value={item.itemName}
                      onChange={(e) => onUpdateItemName(category, index, e.target.value)}
                      className="block w-full py-1 px-2 text-sm border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                    />
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm">
                    <input
                      type="checkbox"
                      checked={item.isVisible}
                      onChange={(e) => onUpdateItemVisibility(category, index, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
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
      )}
    </div>
  );
};

export default ItemMappingTable;
