// src/pages/admin/WageLedger/WageLedgerView.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';

function WageLedgerView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userDetails } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payslipData, setPayslipData] = useState([]);
  const [employeeInfo, setEmployeeInfo] = useState(null);

  // URLパラメータから期間と従業員情報を取得
  const startYear = parseInt(searchParams.get('startYear'));
  const startMonth = parseInt(searchParams.get('startMonth'));
  const endYear = parseInt(searchParams.get('endYear'));
  const endMonth = parseInt(searchParams.get('endMonth'));
  const employeeId = searchParams.get('employeeId');
  const employeeName = searchParams.get('employeeName');

  useEffect(() => {
    const fetchWageLedgerData = async () => {
      if (!userDetails?.companyId || !employeeId) return;

      try {
        setLoading(true);
        
        // 期間の開始日と終了日を計算（useEffect内で実行）
        const startDate = new Date(startYear, startMonth - 1, 1);
        const endDate = new Date(endYear, endMonth, 0);
        
        console.log('🔍 賃金台帳詳細データ取得開始');
        console.log('従業員ID:', employeeId);
        console.log('期間:', startDate.toISOString().split('T')[0], '〜', endDate.toISOString().split('T')[0]);
        
        // 従業員の給与明細データを取得
        const payslipsQuery = query(
          collection(db, 'payslips'),
          where('companyId', '==', userDetails.companyId),
          where('employeeId', '==', employeeId),
          where('paymentDate', '>=', startDate),
          where('paymentDate', '<=', endDate),
          orderBy('paymentDate', 'asc')
        );
        
        const payslipsSnapshot = await getDocs(payslipsQuery);
        const payslips = payslipsSnapshot.docs.map(doc => ({
          id: doc.id,
          type: 'payslip', // 給与明細としてマーク
          ...doc.data()
        }));
        
        // 賞与明細データも取得（賃金台帳に含める）
        const bonusPayslipsQuery = query(
          collection(db, 'bonusPayslips'),
          where('companyId', '==', userDetails.companyId),
          where('employeeId', '==', employeeId),
          where('paymentDate', '>=', startDate),
          where('paymentDate', '<=', endDate),
          orderBy('paymentDate', 'asc')
        );
        
        const bonusPayslipsSnapshot = await getDocs(bonusPayslipsQuery);
        const bonusPayslips = bonusPayslipsSnapshot.docs.map(doc => ({
          id: doc.id,
          type: 'bonus', // 賞与明細としてマーク
          ...doc.data()
        }));
        
        // 給与と賞与を結合して日付順にソート
        const allPayslips = [...payslips, ...bonusPayslips].sort((a, b) => {
          const dateA = a.paymentDate?.toDate ? a.paymentDate.toDate() : new Date(a.paymentDate);
          const dateB = b.paymentDate?.toDate ? b.paymentDate.toDate() : new Date(b.paymentDate);
          return dateA - dateB;
        });
        
        console.log('📄 該当する給与明細:', payslips.length, '件');
        console.log('🎁 該当する賞与明細:', bonusPayslips.length, '件');
        console.log('📊 合計データ:', allPayslips.length, '件');
        
        setPayslipData(allPayslips);

        // 従業員情報を取得
        const employeeQuery = query(
          collection(db, 'employees'),
          where('companyId', '==', userDetails.companyId),
          where('employeeId', '==', employeeId)
        );
        
        const employeeSnapshot = await getDocs(employeeQuery);
        if (!employeeSnapshot.empty) {
          setEmployeeInfo(employeeSnapshot.docs[0].data());
          console.log('👤 従業員情報取得完了');
        }

        setLoading(false);
      } catch (err) {
        console.error('❌ 賃金台帳データ取得エラー:', err);
        setError('データの取得中にエラーが発生しました');
        setLoading(false);
      }
    };

    fetchWageLedgerData();
  }, [userDetails, employeeId, startYear, startMonth, endYear, endMonth]);

  // 給与明細データを賃金台帳形式に変換
  const formatPayslipForWageLedger = (payslip) => {
    // 給与明細の詳細データを解析 - 実際のデータ構造に合わせて修正
    const items = payslip.items || {};
    const itemCategories = payslip.itemCategories || {};
    
    console.log('🔍 賃金台帳フォーマット変換:', {
      payslipId: payslip.id,
      type: payslip.type || 'payslip',
      itemsKeys: Object.keys(items),
      totalIncome: payslip.totalIncome,
      totalDeduction: payslip.totalDeduction,
      netAmount: payslip.netAmount
    });
    
    // 基本給の計算（各種手当を除く基本的な支給額）
    let basicWage = 0;
    let overtime = 0;
    let allowances = 0;
    let totalGross = 0;
    let totalDeductions = 0;
    let netAmount = payslip.netAmount || 0;

    // 実際のデータ構造に合わせて項目を分類
    Object.entries(items).forEach(([key, value]) => {
      // 数値への変換
      const numericValue = typeof value === 'number' ? value : parseFloat(value || 0);
      const amount = isNaN(numericValue) ? 0 : numericValue;
      
      // 項目カテゴリを取得
      const category = itemCategories[key];
      
      console.log(`🔍 項目分析: ${key} = ${value} (種別: ${category}, 金額: ${amount})`);
      
      if (category === 'income') {
        totalGross += amount;
        
        // 項目名で分類
        if (key.includes('基本給') || key.includes('基準内賃金') || key.includes('基本給与')) {
          basicWage += amount;
        } else if (key.includes('残業') || key.includes('時間外') || key.includes('オーバータイム')) {
          overtime += amount;
        } else {
          allowances += amount;
        }
      } else if (category === 'deduction') {
        totalDeductions += amount;
      }
    });

    // 総支給額がない場合は保存された合計から取得または詳細から計算
    if (totalGross === 0) {
      totalGross = payslip.totalIncome || basicWage + overtime + allowances;
    }
    
    // 控除合計がない場合は保存された合計から取得
    if (totalDeductions === 0) {
      totalDeductions = payslip.totalDeduction || 0;
    }
    
    console.log('📊 金額集計結果:', {
      basicWage,
      overtime,
      allowances,
      totalGross,
      totalDeductions,
      netAmount,
      calculatedNet: totalGross - totalDeductions
    });

    // 勤怠情報の取得 - 実際のデータ構造に合わせて修正
    const getAttendanceValue = (fieldName) => {
      const value = items[fieldName];
      return typeof value === 'number' ? value : parseFloat(value || 0) || 0;
    };
    
    const workingDays = getAttendanceValue('出勤日数') || 
                       getAttendanceValue('勤務日数') || 
                       getAttendanceValue('所定労働日数') || 
                       22; // デフォルト値

    const workingHours = getAttendanceValue('労働時間') || 
                        getAttendanceValue('勤務時間') || 
                        getAttendanceValue('所定労働時間') || 
                        workingDays * 8; // デフォルト値

    const overtimeHours = getAttendanceValue('残業時間') || 
                         getAttendanceValue('時間外労働時間') || 
                         getAttendanceValue('時間外時間') ||
                         0;
                         
    console.log('🕰️ 勤怠情報:', {
      workingDays,
      workingHours,
      overtimeHours,
      availableKeys: Object.keys(items).filter(k => 
        k.includes('時間') || k.includes('日数') || k.includes('勤務') || k.includes('労働')
      )
    });

    return {
      payDate: payslip.paymentDate, // paymentDateフィールドを使用
      type: payslip.type || 'payslip', // 給与/賞与の区別
      basicWage: Math.floor(basicWage),
      overtime: Math.floor(overtime),
      allowances: Math.floor(allowances),
      totalGross: Math.floor(totalGross),
      totalDeductions: Math.floor(totalDeductions),
      netPay: Math.floor(netAmount),
      workingDays: workingDays,
      workingHours: workingHours,
      overtimeHours: overtimeHours
    };
  };

  const formatPeriod = () => {
    return `${startYear}年${startMonth}月 〜 ${endYear}年${endMonth}月`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP').format(amount);
  };

  const formatMonth = (payDate) => {
    const date = new Date(payDate);
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };

  // 期間中の全ての月を生成する関数
  const generateAllMonthsInPeriod = () => {
    const months = [];
    let currentDate = new Date(startYear, startMonth - 1, 1);
    const endDate = new Date(endYear, endMonth - 1, 1);
    
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      
      months.push({
        year,
        month,
        monthKey,
        displayText: `${year}年${month}月`
      });
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return months;
  };

  // 給与明細データを月別にマップ化
  const getPayslipByMonth = () => {
    const payslipMap = {};
    
    payslipData.forEach(payslip => {
      // paymentDateはDateオブジェクトまたはFirestore Timestampの可能性がある
      let payDate;
      if (payslip.paymentDate) {
        // Firestore Timestampの場合
        if (payslip.paymentDate.toDate) {
          payDate = payslip.paymentDate.toDate();
        } else {
          payDate = new Date(payslip.paymentDate);
        }
      } else if (payslip.year && payslip.month) {
        // year/monthフィールドから日付を生成
        payDate = new Date(payslip.year, payslip.month - 1, 1);
      } else {
        console.warn('給与明細の日付が取得できません:', payslip);
        return;
      }
      
      const monthKey = `${payDate.getFullYear()}-${(payDate.getMonth() + 1).toString().padStart(2, '0')}`;
      payslipMap[monthKey] = payslip;
    });
    
    return payslipMap;
  };

  // 期間中の全月の賃金台帳データを生成（ブランク月含む）
  const generateCompleteWageLedgerData = () => {
    const allMonths = generateAllMonthsInPeriod();
    const payslipMap = getPayslipByMonth();
    
    return allMonths.map(month => {
      const payslip = payslipMap[month.monthKey];
      
      if (payslip) {
        // データがある月は通常の処理
        return {
          ...formatPayslipForWageLedger(payslip),
          displayText: month.displayText,
          hasData: true
        };
      } else {
        // データがない月はブランクデータ
        return {
          payDate: `${month.year}-${month.month.toString().padStart(2, '0')}-01`,
          basicWage: 0,
          overtime: 0,
          allowances: 0,
          totalGross: 0,
          totalDeductions: 0,
          netPay: 0,
          workingDays: 0,
          workingHours: 0,
          overtimeHours: 0,
          displayText: month.displayText,
          hasData: false
        };
      }
    });
  };

  const getTotals = () => {
    const completeData = generateCompleteWageLedgerData();
    const totals = completeData.reduce((acc, data) => {
      if (data.hasData) {
        return {
          basicWage: acc.basicWage + data.basicWage,
          overtime: acc.overtime + data.overtime,
          allowances: acc.allowances + data.allowances,
          totalGross: acc.totalGross + data.totalGross,
          totalDeductions: acc.totalDeductions + data.totalDeductions,
          netPay: acc.netPay + data.netPay,
          workingDays: acc.workingDays + data.workingDays,
          workingHours: acc.workingHours + data.workingHours,
          overtimeHours: acc.overtimeHours + data.overtimeHours
        };
      }
      return acc;
    }, {
      basicWage: 0,
      overtime: 0,
      allowances: 0,
      totalGross: 0,
      totalDeductions: 0,
      netPay: 0,
      workingDays: 0,
      workingHours: 0,
      overtimeHours: 0
    });

    return totals;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">賃金台帳を生成中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 text-red-700 p-4 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  const totals = getTotals();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ブレッドクラム */}
      <div className="mb-6">
        <nav className="text-sm breadcrumbs mb-4">
          <span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/wage-ledger')}>
            賃金台帳
          </span>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/wage-ledger/period-select')}>
            期間選択
          </span>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-gray-500 cursor-pointer" onClick={() => navigate(`/admin/wage-ledger/employees?${searchParams.toString()}`)}>
            従業員選択
          </span>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-blue-600 font-medium">賃金台帳</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">賃金台帳</h1>
        <p className="text-gray-600 mt-2">
          {employeeName}さんの賃金台帳（{formatPeriod()}）
        </p>
      </div>

      {/* 従業員情報ヘッダー */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">従業員情報</h2>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">従業員ID</label>
              <p className="text-gray-900">{employeeId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">氏名</label>
              <p className="text-gray-900">{employeeName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">部門</label>
              <p className="text-gray-900">{employeeInfo?.departmentCode || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">対象期間</label>
              <p className="text-gray-900">{formatPeriod()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 賃金台帳テーブル */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">賃金台帳（法定様式準拠）</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  年月
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  種別
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  基本給
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  残業代
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  諸手当
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  総支給額
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  控除計
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  実支給額
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  出勤日数
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  労働時間
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  残業時間
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {generateCompleteWageLedgerData().map((data, index) => (
                <tr key={index} className={data.hasData ? "hover:bg-gray-50" : "hover:bg-gray-50 bg-gray-25"}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {data.displayText}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    {data.hasData ? (
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        data.type === 'bonus' 
                          ? 'bg-orange-100 text-orange-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {data.type === 'bonus' ? '賞与' : '給与'}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {data.hasData ? `¥${formatCurrency(data.basicWage)}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {data.hasData ? `¥${formatCurrency(data.overtime)}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {data.hasData ? `¥${formatCurrency(data.allowances)}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                    {data.hasData ? `¥${formatCurrency(data.totalGross)}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                    {data.hasData ? `¥${formatCurrency(data.totalDeductions)}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-medium">
                    {data.hasData ? `¥${formatCurrency(data.netPay)}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {data.hasData && data.workingDays > 0 ? `${data.workingDays}日` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {data.hasData && data.workingHours > 0 ? `${data.workingHours}h` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {data.hasData && data.overtimeHours > 0 ? `${data.overtimeHours}h` : '-'}
                  </td>
                </tr>
              ))}
              {/* 合計行 */}
              <tr className="bg-gray-100 font-medium">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  合計
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold">
                  -
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                  ¥{formatCurrency(totals.basicWage)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                  ¥{formatCurrency(totals.overtime)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                  ¥{formatCurrency(totals.allowances)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                  ¥{formatCurrency(totals.totalGross)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-bold">
                  ¥{formatCurrency(totals.totalDeductions)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-blue-600 font-bold">
                  ¥{formatCurrency(totals.netPay)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                  {totals.workingDays > 0 ? `${totals.workingDays}日` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                  {totals.workingHours > 0 ? `${totals.workingHours}h` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-bold">
                  {totals.overtimeHours > 0 ? `${totals.overtimeHours}h` : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => navigate(`/admin/wage-ledger/employees?${searchParams.toString()}`)}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          従業員選択に戻る
        </button>
        <div className="space-x-4">
          <button
            onClick={() => alert('PDF出力機能は今後実装予定です')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            PDF出力
          </button>
          <button
            onClick={() => alert('Excel出力機能は今後実装予定です')}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Excel出力
          </button>
        </div>
      </div>
    </div>
  );
}

export default WageLedgerView;