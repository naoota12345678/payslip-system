// 従業員情報更新セクションの強化部分

// src/pages/CsvUpload.js 内の従業員情報更新セクションを以下のコードに置き換え

{/* 従業員情報更新設定 */}
<div className="bg-white p-6 rounded-lg shadow-md mb-8">
  <h2 className="text-xl font-semibold mb-4">従業員情報更新</h2>
  <p className="text-gray-600 mb-4">
    CSVデータから従業員情報を更新するかどうかを設定します。
  </p>
  
  <div className="mb-4">
    <label className="flex items-center">
      <input
        type="checkbox"
        checked={updateEmployeeInfo}
        onChange={(e) => setUpdateEmployeeInfo(e.target.checked)}
        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
      />
      <span className="ml-2 text-sm text-gray-700">
        CSVアップロード時に従業員情報を更新する
      </span>
    </label>
  </div>
  
  {updateEmployeeInfo && (
    <div className="border-t pt-4 mt-4">
      <h3 className="text-md font-medium mb-3">従業員情報更新の設定</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            従業員番号カラム
          </label>
          <select
            value={employeeIdColumn}
            onChange={(e) => setEmployeeIdColumn(e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">選択してください</option>
            {csvHeaders.map((header, index) => (
              <option key={index} value={header}>{header}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            従業員を識別するための列です（必須）
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            部門コードカラム
          </label>
          <select
            value={departmentCodeColumn}
            onChange={(e) => setDepartmentCodeColumn(e.target.value)}
            className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">選択してください</option>
            {csvHeaders.map((header, index) => (
              <option key={index} value={header}>{header}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            従業員の所属部門を更新するための列です
          </p>
        </div>
      </div>
      
      <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mb-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">更新される情報</h4>
        <ul className="list-disc pl-5 text-xs text-blue-700">
          <li>従業員番号を使用して、既存のユーザーを検索します</li>
          <li>既存の従業員のみが更新され、新規従業員は自動作成されません</li>
          <li>部門コードが指定されている場合、従業員の所属部門が更新されます</li>
          <li>基本情報（氏名など）はCSVから更新されません</li>
        </ul>
      </div>
      
      {/* 設定保存ボタン */}
      <div className="flex justify-end">
        <button
          onClick={saveEmployeeSettings}
          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          設定を保存
        </button>
      </div>
    </div>
  )}
</div>
