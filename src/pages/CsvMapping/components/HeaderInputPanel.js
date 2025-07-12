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
  systemColumns
}) => {
  // 入力データがある場合は対応するモードを自動選択
  useEffect(() => {
    if (rowBasedInput && rowBasedInput.trim() !== '') {
      setRowMappingMode(true);
      setKyMappingMode(false);
    } else if (kyItemInput && kyItemInput.trim() !== '') {
      setKyMappingMode(true);
      setRowMappingMode(false);
    } else if (headerInput && headerInput.trim() !== '') {
      setKyMappingMode(false);
      setRowMappingMode(false);
    }
  }, [rowBasedInput, kyItemInput, headerInput, setKyMappingMode, setRowMappingMode]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
      <div className="p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">CSVヘッダーの一括入力</h2>
        
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
                      {systemColumns.slice(0, 10).map((col, idx) => (
                        <tr key={idx}>
                          <td className="py-1 pr-4">{`順番${idx + 1}`}</td>
                          <td className="py-1">{col}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan="2" className="py-1 text-center">…その他約{systemColumns.length - 10}項目</td>
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
                rows="5"
                value={rowBasedInput}
                onChange={(e) => setRowBasedInput(e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
                placeholder="例:
識別コード※ 部門コード 部門名 従業員コード※ 従業員氏名 ...
KY01 KY02 KY03 A01 A02 ..."
              ></textarea>
              <p className="mt-1 text-xs text-gray-500">
                エクセルから、1行目（ヘッダー行）と2行目（項目コード行）を一緒にコピーして貼り付けてください。
                同じ列にある項目同士が自動的にマッピングされます。
              </p>
              
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="text-sm font-medium text-blue-700 mb-2">行ベースマッピングの使い方</h3>
                <p className="text-xs text-blue-600">
                  1. エクセルなどで、1行目がヘッダー行（識別コードなど）、2行目が項目コード（KY01、A01など）になっているデータを選択<br />
                  2. 2行全体を選択してコピー<br />
                  3. 上のテキストエリアに貼り付け<br />
                  4. 「行ベースマッピングを実行」ボタンをクリック
                </p>
                <div className="mt-2 text-xs text-blue-700">
                  マッピング例：<br />
                  ヘッダー行：識別コード※ 部門コード 部門名<br />
                  項目行　　：KY01 A02 ITEM03<br />
                  ↓<br />
                  「識別コード※」と「KY01」がマッピング<br />
                  「部門コード」と「A02」がマッピング<br />
                  「部門名」と「ITEM03」がマッピング<br />
                  <br />
                  <strong>対応する項目コード形式：</strong><br />
                  KY01、A01、ITEM01、CODE01、NUM01 など
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => handleRowBasedMapping(rowBasedInput.split('\n').filter(row => row.trim().length > 0))}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                行ベースマッピングを実行
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HeaderInputPanel;
