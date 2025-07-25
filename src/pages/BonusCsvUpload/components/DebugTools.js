// src/pages/CsvUpload/components/DebugTools.js

import React from 'react';

/**
 * デバッグツールパネルコンポーネント
 */
const DebugTools = ({
  debugMode,
  setDebugMode,
  viewDebugLogs,
  testCSVProcessing,
  testSimpleFunction,
  testSimpleCSVProcessing,
  savedSettings,
  saveCurrentSettings,
  loadSavedSettingsList,
  applySavedSetting,
  deleteSavedSetting,
  employeeSettings,
  payrollItems,
  refreshSettings
}) => {
  return (
    <div className="bg-gray-100 p-4 mb-6 rounded-lg">
      <h3 className="font-bold text-gray-700 mb-2">開発者向けデバッグツール</h3>
      <div className="flex space-x-2 mb-2">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={(e) => setDebugMode(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">
            デバッグモード
          </span>
        </label>
      </div>
      <div className="flex space-x-2 mb-2">
        <button 
          onClick={testCSVProcessing}
          className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
        >
          CSVテスト実行
        </button>
        <button 
          onClick={viewDebugLogs}
          className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
        >
          デバッグログ表示
        </button>
        <button 
          onClick={refreshSettings}
          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          設定再読み込み
        </button>
      </div>
      <div className="flex space-x-2 mb-2">
        <button 
          onClick={testSimpleFunction}
          className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
        >
          シンプルテスト実行
        </button>
        <button 
          onClick={testSimpleCSVProcessing}
          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          簡易CSV処理テスト
        </button>
      </div>
      
      {/* テスト設定の保存ボタン */}
      <div className="flex space-x-2 mt-3 border-t pt-3">
        <button 
          onClick={() => saveCurrentSettings(employeeSettings, payrollItems)}
          className="px-3 py-1 bg-purple-500 text-white text-sm rounded hover:bg-purple-600"
        >
          現在の設定を保存
        </button>
        <button 
          onClick={loadSavedSettingsList}
          className="px-3 py-1 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600"
        >
          設定一覧を更新
        </button>
      </div>
      
      {/* 保存済み設定一覧 */}
      {savedSettings.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-semibold">保存済み設定：</p>
          <div className="max-h-40 overflow-y-auto mt-1 bg-white rounded border">
            {savedSettings.map((setting, index) => (
              <div key={index} className="flex items-center justify-between border-b p-2 hover:bg-gray-50">
                <div className="flex-1">
                  <p className="text-sm font-medium">{setting.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(setting.timestamp).toLocaleString()} - 
                    {setting.payrollMappings?.length || 0}項目のマッピング
                  </p>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => applySavedSetting(setting)}
                    className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  >
                    適用
                  </button>
                  <button
                    onClick={() => deleteSavedSetting(index)}
                    className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugTools;
