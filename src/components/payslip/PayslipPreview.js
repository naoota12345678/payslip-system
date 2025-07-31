// src/components/payslip/PayslipPreview.js
import React from 'react';

function PayslipPreview({ payslipData, showDetailedInfo = false, isBonus = false }) {
  // PayslipDetailで既に分類済みの項目を使用
  
  // デバッグ: 各項目の内容を確認
  console.log('📊 PayslipPreview - 受け取ったデータ:');
  console.log('支給項目:', payslipData?.incomeItems);
  console.log('控除項目:', payslipData?.deductionItems);
  console.log('勤怠項目:', payslipData?.attendanceItems);
  console.log('その他項目:', payslipData?.otherItems);



  // 金額フォーマット関数
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '¥0';
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // 勤怠項目用フォーマット関数（小数点第2位まで表示）
  const formatAttendanceValue = (value) => {
    if (value === undefined || value === null || value === '') return '0.00';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value; // 数値でない場合はそのまま表示
    return numValue.toFixed(2); // 小数点第2位まで表示
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
    <div className="bg-white border rounded-lg overflow-hidden print:border-0 print:rounded-none" style={{ minHeight: '600px' }}>
      {/* 印刷時のみ表示されるヘッダー */}
      <div className="hidden print:block text-center mb-1">
        <h1 className="text-base font-bold">{isBonus ? '賞与支払明細書' : '給与支払明細書'}</h1>
      </div>
      
      {/* 基本情報 */}
      <div className="p-4 print:p-1 border-b">
        <div className="grid grid-cols-2 gap-4 text-sm print:text-xs print:gap-2">
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
        
        <div className="grid grid-cols-2 gap-4 text-sm mt-2 print:mt-1 print:gap-2">
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
        
        <div className="grid grid-cols-2 gap-4 text-sm mt-2 print:mt-1 print:gap-2">
          <div>
            <span className="text-gray-600">社員コード:</span>
            <span className="ml-2 font-medium">{payslipData?.employeeId || 'N/A'}</span>
          </div>
          <div className="text-right">
            {/* 右側の従業員番号を削除（重複のため） */}
          </div>
        </div>
      </div>

      {/* 4セクション表示 - モバイルでは2×2グリッド、印刷時は4列 */}
      <div className="grid grid-cols-2 md:grid-cols-4 print:!grid-cols-4 gap-0 border-b">
        {/* 勤怠セクション */}
        <div className="border-r border-b md:border-b-0">
          <div className={getSectionStyle('attendance')}>
            勤怠
          </div>
          <div className="p-2 print:p-1">
            {payslipData.attendanceItems && payslipData.attendanceItems.length > 0 ? (
              payslipData.attendanceItems
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((item, index) => (
                <div key={index} className="flex justify-between text-xs print:text-[0.6rem] py-1 print:py-0.5 border-b border-gray-100 last:border-b-0">
                  <span>{item.name}</span>
                  <span>{formatAttendanceValue(item.value)}</span>
                </div>
              ))
            ) : (
              <div className="text-xs print:text-[0.6rem] text-gray-500 text-center py-2 print:py-1">
                データなし
              </div>
            )}
          </div>
        </div>

        {/* 支給セクション */}
        <div className="md:border-r border-b md:border-b-0">
          <div className={getSectionStyle('income')}>
            支給
          </div>
          <div className="p-2 print:p-1">
            {payslipData.incomeItems && payslipData.incomeItems.length > 0 ? (
              payslipData.incomeItems
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((item, index) => (
                <div key={index} className="flex justify-between text-xs print:text-[0.6rem] py-1 print:py-0.5 border-b border-gray-100 last:border-b-0">
                  <span>{item.name}</span>
                  <span className="text-right">
                    {typeof item.value === 'number' ? formatCurrency(item.value) : item.value}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs print:text-[0.6rem] text-gray-500 text-center py-2 print:py-1">
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
          <div className="p-2 print:p-1">
            {payslipData.deductionItems && payslipData.deductionItems.length > 0 ? (
              payslipData.deductionItems
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((item, index) => (
                <div key={index} className="flex justify-between text-xs print:text-[0.6rem] py-1 print:py-0.5 border-b border-gray-100 last:border-b-0">
                  <span>{item.name}</span>
                  <span className="text-right">
                    {typeof item.value === 'number' ? formatCurrency(item.value) : item.value}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs print:text-[0.6rem] text-gray-500 text-center py-2 print:py-1">
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
          <div className="p-2 print:p-1">
            {/* CSVの合計データをそのまま表示 */}
            {payslipData.otherItems && payslipData.otherItems.length > 0 ? (
              payslipData.otherItems
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((item, index) => (
                <div key={index} className="flex justify-between text-xs print:text-[0.6rem] py-1 print:py-0.5 border-b border-gray-100 last:border-b-0">
                  <span>{item.name}</span>
                  <span className="text-right">
                    {typeof item.value === 'number' ? formatCurrency(item.value) : item.value}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-xs print:text-[0.6rem] text-gray-500 text-center py-2 print:py-1">
                データなし
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 印刷時のみ表示されるフッター */}
      <div className="hidden print:block mt-1 pt-0.5 border-t text-center">
        <p className="text-xs text-gray-600">
          発行日: {new Date().toLocaleDateString('ja-JP')}
        </p>
      </div>
    </div>
  );
}

export default PayslipPreview;