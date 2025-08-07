// src/pages/admin/WageLedger/WageLedgerPeriodSelect.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function WageLedgerPeriodSelect() {
  const navigate = useNavigate();
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState(1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(12);
  const [error, setError] = useState('');

  // 年の選択肢（過去5年から未来2年）
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let year = currentYear - 5; year <= currentYear + 2; year++) {
    yearOptions.push(year);
  }

  // 月の選択肢
  const monthOptions = [];
  for (let month = 1; month <= 12; month++) {
    monthOptions.push(month);
  }

  // 期間バリデーション
  const validatePeriod = () => {
    const startDate = new Date(startYear, startMonth - 1, 1);
    const endDate = new Date(endYear, endMonth - 1, 1);
    
    if (startDate > endDate) {
      setError('開始年月は終了年月より前である必要があります');
      return false;
    }
    
    // 月数計算
    const monthDiff = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    if (monthDiff > 12) {
      setError('期間は最大12ヶ月までです');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleNext = () => {
    if (validatePeriod()) {
      // URLパラメータで期間を渡す
      const params = new URLSearchParams({
        startYear: startYear.toString(),
        startMonth: startMonth.toString(),
        endYear: endYear.toString(),
        endMonth: endMonth.toString()
      });
      navigate(`/admin/wage-ledger/employees?${params.toString()}`);
    }
  };

  const getMonthCount = () => {
    if (startYear && startMonth && endYear && endMonth) {
      return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
    }
    return 0;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <nav className="text-sm breadcrumbs mb-4">
          <span className="text-gray-500">賃金台帳</span>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-blue-600 font-medium">期間選択</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">期間選択</h1>
        <p className="text-gray-600 mt-2">
          賃金台帳を作成する期間を選択してください（最大12ヶ月）
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl">
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* 開始年月 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              開始年月
            </label>
            <div className="flex space-x-4">
              <select
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value))}
                className="block w-32 rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(parseInt(e.target.value))}
                className="block w-24 rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {monthOptions.map(month => (
                  <option key={month} value={month}>{month}月</option>
                ))}
              </select>
            </div>
          </div>

          {/* 終了年月 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              終了年月
            </label>
            <div className="flex space-x-4">
              <select
                value={endYear}
                onChange={(e) => setEndYear(parseInt(e.target.value))}
                className="block w-32 rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(parseInt(e.target.value))}
                className="block w-24 rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {monthOptions.map(month => (
                  <option key={month} value={month}>{month}月</option>
                ))}
              </select>
            </div>
          </div>

          {/* 期間の表示 */}
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-blue-900 mb-2">選択された期間</h3>
            <p className="text-blue-800">
              {startYear}年{startMonth}月 〜 {endYear}年{endMonth}月 
              <span className="ml-2 text-sm">
                ({getMonthCount()}ヶ月間)
              </span>
            </p>
            {getMonthCount() > 12 && (
              <p className="text-red-600 text-sm mt-1">
                ⚠️ 期間は最大12ヶ月までです
              </p>
            )}
          </div>
        </div>

        {/* アクションボタン */}
        <div className="mt-8 flex justify-between">
          <button
            onClick={() => navigate('/admin/wage-ledger')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            戻る
          </button>
          <button
            onClick={handleNext}
            disabled={getMonthCount() > 12}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            次へ（従業員選択）
          </button>
        </div>
      </div>
    </div>
  );
}

export default WageLedgerPeriodSelect;