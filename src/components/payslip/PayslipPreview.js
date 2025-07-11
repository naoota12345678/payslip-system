// src/components/payslip/PayslipPreview.js
import React from 'react';

// 給与明細プレビューコンポーネント
const PayslipPreview = ({ payslipData, showDetailedInfo = true }) => {
  // データがない場合
  if (!payslipData) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center">
        <p className="text-gray-500">給与明細データがありません</p>
      </div>
    );
  }

  // 日付フォーマット関数
  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    // Firestoreのタイムスタンプか確認
    let dateObj;
    if (date.toDate && typeof date.toDate === 'function') {
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      try {
        dateObj = new Date(date);
      } catch {
        return 'N/A';
      }
    }
    
    return dateObj.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  // 金額フォーマット関数
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '¥0';
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // 項目を種類ごとに分類
  const incomeItems = [];
  const deductionItems = [];
  const otherItems = [];
  
  if (payslipData.items) {
    Object.entries(payslipData.items).forEach(([id, item]) => {
      if (item.type === 'income') {
        incomeItems.push({ id, ...item });
      } else if (item.type === 'deduction') {
        deductionItems.push({ id, ...item });
      } else {
        otherItems.push({ id, ...item });
      }
    });
  }
  
  // 各項目を名前順でソート
  incomeItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  deductionItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  otherItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
      {/* ヘッダー部分 */}
      <div className="bg-blue-50 p-4 border-b border-gray-300">
        <h2 className="text-xl font-semibold text-center mb-2">給与明細</h2>
        <p className="text-center text-gray-600">
          支払日: {formatDate(payslipData.paymentDate)}
        </p>
      </div>
      
      {/* 基本情報 */}
      {showDetailedInfo && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">従業員ID:</p>
              <p className="font-medium">{payslipData.employeeId || '-'}</p>
            </div>
            {payslipData.departmentCode && (
              <div>
                <p className="text-sm text-gray-600">部門:</p>
                <p className="font-medium">{payslipData.departmentCode}</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 給与サマリー */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold mb-2">給与サマリー</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-sm text-gray-600">支給合計</p>
            <p className="text-lg font-semibold text-blue-700">
              {formatCurrency(payslipData.totalIncome)}
            </p>
          </div>
          <div className="bg-red-50 p-3 rounded">
            <p className="text-sm text-gray-600">控除合計</p>
            <p className="text-lg font-semibold text-red-700">
              {formatCurrency(payslipData.totalDeduction)}
            </p>
          </div>
          <div className="bg-green-50 p-3 rounded">
            <p className="text-sm text-gray-600">差引支給額</p>
            <p className="text-lg font-semibold text-green-700">
              {formatCurrency(payslipData.netAmount)}
            </p>
          </div>
        </div>
      </div>
      
      {/* 項目詳細 */}
      <div className="p-4">
        {/* 支給項目 */}
        {incomeItems.length > 0 && (
          <div className="mb-4">
            <h4 className="text-md font-semibold mb-2 pb-1 border-b border-gray-200">支給項目</h4>
            <div className="space-y-1">
              {incomeItems.map(item => (
                <div key={item.id} className="flex justify-between items-center">
                  <span className="text-gray-800">{item.name}</span>
                  <span className="font-medium">
                    {typeof item.value === 'number' 
                      ? formatCurrency(item.value) 
                      : item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* 控除項目 */}
        {deductionItems.length > 0 && (
          <div className="mb-4">
            <h4 className="text-md font-semibold mb-2 pb-1 border-b border-gray-200">控除項目</h4>
            <div className="space-y-1">
              {deductionItems.map(item => (
                <div key={item.id} className="flex justify-between items-center">
                  <span className="text-gray-800">{item.name}</span>
                  <span className="font-medium">
                    {typeof item.value === 'number' 
                      ? formatCurrency(item.value) 
                      : item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* その他項目 */}
        {otherItems.length > 0 && (
          <div className="mb-4">
            <h4 className="text-md font-semibold mb-2 pb-1 border-b border-gray-200">その他項目</h4>
            <div className="space-y-1">
              {otherItems.map(item => (
                <div key={item.id} className="flex justify-between items-center">
                  <span className="text-gray-800">{item.name}</span>
                  <span className="font-medium">
                    {typeof item.value === 'number' 
                      ? formatCurrency(item.value) 
                      : item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* フッター */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
        <p className="text-xs text-gray-500">
          発行日: {new Date().toLocaleDateString('ja-JP')}
        </p>
      </div>
    </div>
  );
};

export default PayslipPreview;