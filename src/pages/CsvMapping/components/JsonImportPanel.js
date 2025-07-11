// src/pages/CsvMapping/components/JsonImportPanel.js
// JSONインポートパネルコンポーネント

import React from 'react';

const JsonImportPanel = ({ 
  showJsonImport, 
  setShowJsonImport, 
  jsonInput, 
  setJsonInput, 
  handleJsonImport 
}) => {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-900">マッピング設定</h2>
        
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setShowJsonImport(!showJsonImport)}
            className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
          >
            {showJsonImport ? 'キャンセル' : 'JSON設定インポート'}
          </button>
        </div>
      </div>
      
      {showJsonImport && (
        <div className="mb-6 p-4 border border-gray-200 rounded-md">
          <h3 className="text-md font-medium mb-2">JSON設定インポート</h3>
          <textarea
            rows="5"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
            placeholder='{"csvMapping": {"mainFields": {...}, "incomeItems": [...], ...}}'
          ></textarea>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={handleJsonImport}
              className="inline-flex justify-center py-1 px-3 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              インポート
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JsonImportPanel;
