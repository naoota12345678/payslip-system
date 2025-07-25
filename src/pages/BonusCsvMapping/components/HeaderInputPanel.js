// src/pages/CsvMapping/components/HeaderInputPanel.js
// CSVヘッダーの入力パネルコンポーネント

import React, { useEffect } from 'react';

const HeaderInputPanel = ({
  kyMappingMode,
  setKyMappingMode,
  headerInput,
  setHeaderInput,
  kyItemInput,
  setKyItemInput,
  rowMappingMode,
  setRowMappingMode,
  rowBasedInput,
  setRowBasedInput,
  handleHeadersParse,
  handleKyMapping,
  handleRowBasedMapping,
  handleDirectSave,  // 新しく追加
  saving            // 新しく追加
}) => {
  
  try {
    // 🔍 デバッグ：現在の状態をログ出力
    console.log('=== HeaderInputPanel デバッグ ===');
    console.log('kyMappingMode:', kyMappingMode);
    console.log('rowMappingMode:', rowMappingMode);
    console.log('シンプル保存ボタン表示条件:', !kyMappingMode && rowMappingMode);
    console.log('handleDirectSave関数:', typeof handleDirectSave);
    console.log('saving状態:', saving);
    
    // ⚠️ 自動実行を無効化：保存されたデータがあっても自動でマッピング処理は実行しない
    // ユーザーが明示的にボタンを押した時のみ実行するため、この useEffect は削除
    // 
    // useEffect(() => {
    //   if (rowBasedInput && rowBasedInput.trim() !== '') {
    //     setRowMappingMode(true);
    //     setKyMappingMode(false);
    //   } else if (kyItemInput && kyItemInput.trim() !== '') {
    //     setKyMappingMode(true);
    //     setRowMappingMode(false);
    //   } else if (headerInput && headerInput.trim() !== '') {
    //     setKyMappingMode(false);
    //     setRowMappingMode(false);
    //   }
    // }, [rowBasedInput, kyItemInput, headerInput, setKyMappingMode, setRowMappingMode]);

    return (
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">CSVヘッダーの一括入力</h2>
        
        <div className="flex space-x-2 mb-4">
          <button
            onClick={() => { 
              setKyMappingMode(false); 
              setRowMappingMode(false);
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md ${!kyMappingMode && !rowMappingMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            通常モード
          </button>
          <button
            onClick={() => { 
              setKyMappingMode(true); 
              setRowMappingMode(false);
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md ${kyMappingMode && !rowMappingMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            項目コードマッピングモード
          </button>
          {/* 新しいモード追加 */}
          <button
            onClick={() => { 
              setKyMappingMode(false); 
              setRowMappingMode(true);
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md ${!kyMappingMode && rowMappingMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            行ベースマッピングモード
          </button>
        </div>
        
        {/* 通常モード */}
        {!kyMappingMode && !rowMappingMode && (
          <>
            <div className="mb-4">
              <label htmlFor="headerInput" className="block text-sm font-medium text-gray-700 mb-1">
                ヘッダー行をコピー＆ペーストしてください
              </label>
              <textarea
                id="headerInput"
                rows="3"
                value={headerInput}
                onChange={(e) => setHeaderInput(e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
                placeholder="エクセルのヘッダー行をそのままコピーして貼り付けてください"
              ></textarea>
              <p className="mt-1 text-xs text-gray-500">
                エクセルやCSVファイルのヘッダー行をそのままコピーして貼り付けてください。タブ区切り、カンマ区切り、改行区切りなど各種形式に対応しています。
              </p>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleHeadersParse}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ヘッダーを解析
              </button>
            </div>
          </>
        )}
        
        {/* KY項目マッピングモード */}
        {kyMappingMode && !rowMappingMode && (
          <>
            <div className="mb-4">
              <label htmlFor="kyItemInput" className="block text-sm font-medium text-gray-700 mb-1">
                項目コードリストをコピー＆ペーストしてください
              </label>
              <textarea
                id="kyItemInput"
                rows="3"
                value={kyItemInput}
                onChange={(e) => setKyItemInput(e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
                placeholder="例: KY01 KY02 KY03 A01 A02 ITEM01 ITEM02 ..."
              ></textarea>
              <p className="mt-1 text-xs text-gray-500">
                項目コードリストを入力してください。各項目コードは組み込みの列定義（識別コード、部門コードなど）に順番に対応付けされます。
                KY01、A01、ITEM01など、様々な給与ソフトの項目コード形式に対応しています。
              </p>
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="text-sm font-medium text-blue-700 mb-2">マッピング一覧</h3>
                <div className="text-xs text-blue-700 max-h-40 overflow-y-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="py-1 text-left">項目コード</th>
                        <th className="py-1 text-left">対応する列</th>
                      </tr>
                    </thead>
                                          <tbody>
                        {/* サンプル項目の表示（汎用化） */}
                        <tr>
                          <td className="py-1 pr-4">例）</td>
                          <td className="py-1">従業員コード, 氏名, 基本給, 残業手当 等</td>
                        </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-blue-600">
                  入力した項目コードが上記の順番で列に対応付けられます。
                  例：1番目の項目コードが識別コード、2番目が部門コードとして扱われます。
                </p>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleKyMapping}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                項目コードマッピングを生成
              </button>
            </div>
          </>
        )}

        {/* 新しい行ベースマッピングモード */}
        {!kyMappingMode && rowMappingMode && (
          <>
            <div className="mb-4">
              <label htmlFor="rowBasedInput" className="block text-sm font-medium text-gray-700 mb-1">
                2行のデータをコピー＆ペーストしてください
              </label>
              <textarea
                id="rowBasedInput"
                rows="4"
                value={rowBasedInput}
                onChange={(e) => setRowBasedInput(e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
                placeholder="健康保険 厚生年金 出勤日数 基本給&#10;KY22_0 KY22_1 KY11_0 KY21_0"
              ></textarea>
              <p className="mt-1 text-xs text-gray-500">
                <strong>1行目：</strong>項目名（画面で表示される名前）<br/>
                <strong>2行目：</strong>項目コード（システム内で使用される識別子）<br/>
                <strong>🎯 新しいシンプルシステム：</strong>複雑な処理を排除して直接マッピング
              </p>
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="text-sm font-medium text-blue-700 mb-2">📋 行ベースマッピングの使い方</h3>
                
                <div className="text-xs text-blue-600 mb-3">
                  <strong>🎯 新しいシンプルシステム：</strong><br/>
                  1. エクセルで、1行目=項目名（健康保険、基本給など）、2行目=項目コード（KY22_0、KY21_0など）を準備<br/>
                  2. 2行を選択してコピー<br/>
                  3. 上のテキストエリアに貼り付け<br/>
                  4. 「行ベースマッピングを実行」ボタンをクリック<br/>
                  <strong>⚡ 複雑な処理を排除して直接マッピング作成</strong>
                </div>
                
                <div className="mt-2 text-xs text-blue-700 bg-blue-100 p-2 rounded">
                  <strong>✨ シンプルマッピング例：</strong><br/>
                  🔸 健康保険 → KY22_0 (健康保険が項目名、KY22_0が項目コード)<br/>
                  🔸 基本給 → KY21_0 (基本給が項目名、KY21_0が項目コード)<br/>
                  🔸 出勤日数 → KY11_0 (出勤日数が項目名、KY11_0が項目コード)<br/>
                  <strong>⚡ 複雑な処理なし！直接的にマッピング</strong>
                </div>
                
                <div className="mt-2 text-xs text-blue-600">
                  <strong>対応する項目コード形式：</strong><br />
                  KY01、A01、ITEM01、CODE01、NUM01、KY11_0、KY21_0、KY22_0 など
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleRowBasedMapping(rowBasedInput.split('\n').filter(row => row.trim().length > 0))}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                行ベースマッピングを実行
              </button>
            </div>
          </>
        )}
      </div>
    );
  } catch (error) {
    console.error("HeaderInputPanel component error:", error);
    return (
      <div className="bg-red-100 border border-red-200 text-red-800 px-4 py-3 rounded relative mb-4" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> An error occurred while rendering the Header Input Panel.</span>
        <span className="absolute top-0 bottom-0 right-0 px-4 py-3">
          <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.03a1.2 1.2 0 0 1 1.697 1.697l-2.758 3.15 2.759 3.152z"/></svg>
        </span>
      </div>
    );
  }
};

export default HeaderInputPanel;
