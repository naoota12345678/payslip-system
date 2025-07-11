// src/pages/CsvUpload/components/FileUploadPanel.js

import React from 'react';

/**
 * ファイルアップロードパネルコンポーネント
 */
const FileUploadPanel = ({
  handleFileChange,
  fileName,
  paymentDate,
  setPaymentDate,
  sendEmailDate,
  setSendEmailDate,
  handleUpload,
  isLoading,
  file
}) => {
  // 日付変更ハンドラー
  const handleDateChange = (e) => {
    setPaymentDate(e.target.value);
  };

  // メール通知日変更ハンドラー
  const handleEmailDateChange = (e) => {
    setSendEmailDate(e.target.value);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">CSVファイルアップロード</h2>
        <p className="text-gray-600 mb-4">
          給与データのCSVファイルをアップロードすると、設定されたマッピングに従って自動的に処理されます。
        </p>
        
        {/* ファイル選択 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CSVファイル選択
          </label>
          <input
            type="file"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
            accept=".csv"
          />
          {fileName && (
            <p className="mt-1 text-sm text-gray-500">
              選択されたファイル: {fileName}
            </p>
          )}
        </div>
        
        {/* 日付設定 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              給与支払日
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={handleDateChange}
              className="w-full border rounded-md px-3 py-2"
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              給与明細に表示される支払日です
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              メール通知日（任意）
            </label>
            <input
              type="date"
              value={sendEmailDate}
              onChange={handleEmailDateChange}
              className="w-full border rounded-md px-3 py-2"
            />
            <p className="mt-1 text-sm text-gray-500">
              従業員に通知メールを送信する日付（空白の場合は通知なし）
            </p>
          </div>
        </div>
        
        {/* アップロードボタン */}
        <button
          onClick={handleUpload}
          disabled={isLoading || !file || !paymentDate}
          className={`px-4 py-2 rounded-md text-white font-medium 
            ${isLoading || !file || !paymentDate
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isLoading ? 'アップロード中...' : 'アップロードして処理'}
        </button>
      </div>
    </div>
  );
};

export default FileUploadPanel;
