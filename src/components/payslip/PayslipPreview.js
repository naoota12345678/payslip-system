// src/components/payslip/PayslipPreview.js
import React from 'react';

function PayslipPreview({ payslipData, showDetailedInfo = false }) {
  // PayslipDetailで既に分類済みの項目を使用



  // 金額フォーマット関数
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '¥0';
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // 日付フォーマット関数
  const formatDate = (date) => {
    if (!date) return 'N/A';
    if (date.toDate) return date.toDate().toLocaleDateString('ja-JP');
    return new Date(date).toLocaleDateString('ja-JP');
  };

  // セクションタイトルのスタイル
  const getSectionStyle = (sectionType) => {
    const baseStyle = "text-white text-center py-2 font-medium";
    switch (sectionType) {
      case 'attendance':
        return `${baseStyle} bg-green-500`;
      case 'income':
        return `${baseStyle} bg-blue-500`;
      case 'deduction':
        return `${baseStyle} bg-yellow-500`;
      case 'total':
        return `${baseStyle} bg-red-500`;
      default:
        return `${baseStyle} bg-gray-500`;
    }
  };

  // セクション名の取得
  const getSectionTitle = (sectionType) => {
    switch (sectionType) {
      case 'attendance': return '勤怠';
      case 'income': return '支給';
      case 'deduction': return '控除';
      case 'total': return '合計';
      default: return '';
    }
  };



  return (
    <div className="bg-white border rounded-lg overflow-hidden" style={{ minHeight: '600px' }}>
      {/* ヘッダー部分 */}
      <div className="text-center bg-gray-100 p-4">
        <h1 className="text-lg font-bold text-gray-800">給与明細</h1>
      </div>

      {/* 基本情報 */}
      <div className="p-4 border-b">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">対象年月:</span>
            <span className="ml-2 font-medium">
              {formatDate(payslipData?.paymentDate)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-gray-600">会社名:</span>
                            <span className="ml-2 font-medium">{payslipData.companyName || 'N/A'}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm mt-2">
          <div>
            <span className="text-gray-600">社員名:</span>
            <span className="ml-2 font-medium">{payslipData?.employeeName || 'N/A'}</span>
          </div>
          <div className="text-right">
            {payslipData?.departmentName && (
              <>
                <span className="text-gray-600">部署名:</span>
                <span className="ml-2 font-medium">{payslipData.departmentName}</span>
              </>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm mt-2">
          <div>
            <span className="text-gray-600">社員コード:</span>
            <span className="ml-2 font-medium">{payslipData?.employeeId || 'N/A'}</span>
          </div>
          <div className="text-right">
            {/* 右側の従業員番号を削除（重複のため） */}
          </div>
        </div>
      </div>

      {/* 4セクション表示 */}
      <div className="grid grid-cols-4 gap-0 border-b">
        {/* 勤怠セクション */}
        <div className="border-r">
          <div className={getSectionStyle('attendance')}>
            勤怠
          </div>
          <div className="p-2">
            {payslipData.attendanceItems && payslipData.attendanceItems.length > 0 ? (
              payslipData.attendanceItems.map((item, index) => (
                <div key={index} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-b-0">
                  <span>{item.name}</span>
                  <span>{item.value}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 text-center py-2">
                データなし
              </div>
            )}
          </div>
        </div>

        {/* 支給セクション */}
        <div className="border-r">
          <div className={getSectionStyle('income')}>
            支給
          </div>
          <div className="p-2">
            {payslipData.incomeItems && payslipData.incomeItems.length > 0 ? (
              payslipData.incomeItems.map((item, index) => (
                <div key={index} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-b-0">
                  <span>{item.name}</span>
                  <span className="text-right">
                    {typeof item.value === 'number' ? formatCurrency(item.value) : item.value}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 text-center py-2">
                データなし
              </div>
            )}
          </div>
        </div>

        {/* 控除セクション */}
        <div className="border-r">
          <div className={getSectionStyle('deduction')}>
            控除
          </div>
          <div className="p-2">
            {payslipData.deductionItems && payslipData.deductionItems.length > 0 ? (
              payslipData.deductionItems.map((item, index) => (
                <div key={index} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-b-0">
                  <span>{item.name}</span>
                  <span className="text-right">
                    {typeof item.value === 'number' ? formatCurrency(item.value) : item.value}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 text-center py-2">
                データなし
              </div>
            )}
          </div>
        </div>

        {/* 合計セクション */}
        <div>
          <div className={getSectionStyle('total')}>
            合計
          </div>
          <div className="p-2">
            {/* CSVの合計データをそのまま表示 */}
            {payslipData.otherItems && payslipData.otherItems.length > 0 ? (
              payslipData.otherItems.map((item, index) => (
                <div key={index} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-b-0">
                  <span>{item.name}</span>
                  <span className="text-right">
                    {typeof item.value === 'number' ? formatCurrency(item.value) : item.value}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 text-center py-2">
                データなし
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 詳細情報表示は合計項目が重複するため削除 */}

      {/* フッター */}
    </div>
  );
}

export default PayslipPreview;