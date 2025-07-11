// src/pages/CsvUpload/components/EmployeeSettings.js

import React from 'react';

/**
 * 従業員情報更新設定パネルコンポーネント
 */
const EmployeeSettings = ({
  updateEmployeeInfo,
  setUpdateEmployeeInfo,
  employeeIdColumn,
  departmentCodeColumn,
  registerNewEmployees,
  setRegisterNewEmployees,
  isLoading,
  csvHeaders = []
}) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">従業員情報更新設定</h2>
        
        {/* 新機能マーク */}
        <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">新機能</span>
      </div>
      
      <p className="text-gray-600 mb-4">
        CSVデータから従業員情報を更新したり、新規従業員を自動登録したりすることができます。
      </p>
      
      <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={updateEmployeeInfo}
            onChange={(e) => setUpdateEmployeeInfo(e.target.checked)}
            className="h-5 w-5 text-blue-600 border-gray-300 rounded"
            disabled={isLoading}
          />
          <span className="ml-2 text-base font-medium text-gray-700">
            CSVアップロード時に従業員情報を更新する
          </span>
        </label>
      </div>
      
      {/* 従業員の新規登録オプション - より目立つデザイン */}
      {updateEmployeeInfo && (
        <div className="mb-6 mt-2 pl-6 ml-6 border-l-4 border-blue-400 bg-blue-50 p-4 rounded-r-md">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={registerNewEmployees}
              onChange={(e) => setRegisterNewEmployees(e.target.checked)}
              className="h-5 w-5 text-blue-600 border-gray-300 rounded"
              disabled={isLoading}
            />
            <span className="ml-2 text-base font-medium text-blue-700">
              CSVに存在する新規従業員を自動登録する
            </span>
          </label>
          <p className="text-sm text-blue-600 mt-2 ml-7">
            CSVファイルにシステムに登録されていない従業員が含まれている場合、自動的に新規登録します。
            従業員番号と氏名が新規従業員として登録されます。
          </p>
        </div>
      )}
      
      {updateEmployeeInfo && (
        <div className="border-t pt-4 mt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">
            従業員情報更新に使用するカラム設定：
          </p>
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded border border-gray-200">
            <div>
              <p className="text-sm font-medium">従業員番号カラム:</p>
              <p className="text-md font-semibold">{employeeIdColumn || "未設定"}</p>
              {employeeIdColumn && csvHeaders.length > 0 && (
                <div className="mt-1">
                  {csvHeaders.includes(employeeIdColumn) ? (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">✓ CSVに存在します</span>
                  ) : (
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">❌ CSVに存在しません</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">部門コードカラム:</p>
              <p className="text-md font-semibold">{departmentCodeColumn || "未設定"}</p>
              {departmentCodeColumn && csvHeaders.length > 0 && (
                <div className="mt-1">
                  {csvHeaders.includes(departmentCodeColumn) ? (
                    <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">✓ CSVに存在します</span>
                  ) : (
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">❌ CSVに存在しません</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            この設定は給与項目設定画面で変更できます。
          </p>
          
          {/* 新規従業員登録に関する追加情報 - デザイン改善 */}
          {registerNewEmployees && (
            <div className="mt-6 bg-blue-50 p-4 rounded-md border border-blue-200">
              <p className="text-base font-semibold text-blue-800 mb-2">新規従業員登録について</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-blue-700 mb-2">
                    新規従業員を登録する場合、<span className="font-semibold">従業員番号カラム</span>は必須です。
                    システムに存在しない従業員番号を持つレコードが検出された場合、その情報を元に新しい従業員レコードが作成されます。
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800 mb-1">CSVから取得される情報:</p>
                  <ul className="list-disc pl-5 text-sm text-blue-700">
                    <li className="mb-1">従業員番号（必須）</li>
                    <li className="mb-1">部門コード（設定されている場合）</li>
                    <li className="mb-1">氏名（CSVにある場合）</li>
                    <li className="mb-1">メールアドレス（CSVにある場合）</li>
                  </ul>
                </div>
              </div>
              <div className="mt-3 border-t border-blue-200 pt-3">
                <p className="text-xs text-blue-600">
                  注意: 新規従業員は初期状態では給与明細の閲覧権限のみが付与されます。必要に応じて管理画面から権限設定を変更してください。
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeSettings;
