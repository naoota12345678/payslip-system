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
        
        // 給与明細データを取得
        const payslipsQuery = query(
          collection(db, 'payslips'),
          where('companyId', '==', userDetails.companyId),
          where('employeeId', '==', employeeId),
          where('paymentDate', '>=', startDate),
          where('paymentDate', '<=', endDate),
          orderBy('paymentDate', 'asc')
        );
        
        // 賞与明細データを取得
        const bonusQuery = query(
          collection(db, 'bonusPayslips'),
          where('companyId', '==', userDetails.companyId),
          where('employeeId', '==', employeeId),
          where('paymentDate', '>=', startDate),
          where('paymentDate', '<=', endDate),
          orderBy('paymentDate', 'asc')
        );
        
        // 並行して取得
        const [payslipsSnapshot, bonusSnapshot] = await Promise.all([
          getDocs(payslipsQuery),
          getDocs(bonusQuery)
        ]);
        
        const payslips = payslipsSnapshot.docs.map(doc => ({
          id: doc.id,
          type: 'salary',
          ...doc.data()
        }));
        
        const bonusPayslips = bonusSnapshot.docs.map(doc => ({
          id: doc.id,
          type: 'bonus',
          ...doc.data()
        }));
        
        // 給与と賞与を統合
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
      let payDate;
      if (payslip.paymentDate) {
        if (payslip.paymentDate.toDate) {
          payDate = payslip.paymentDate.toDate();
        } else {
          payDate = new Date(payslip.paymentDate);
        }
      } else if (payslip.year && payslip.month) {
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

  // 期間中の全項目をマトリックス形式で生成
  const generateItemMatrix = () => {
    const allMonths = generateAllMonthsInPeriod();
    const payslipMap = getPayslipByMonth();
    
    // 全期間の全項目を収集
    const allItemsSet = new Set();
    payslipData.forEach(payslip => {
      const items = payslip.items || {};
      Object.keys(items).forEach(key => allItemsSet.add(key));
    });
    
    const allItems = Array.from(allItemsSet).sort();
    console.log('📋 全項目一覧:', allItems);
    
    // マトリックスデータを生成
    const matrix = allItems.map(itemName => {
      const row = {
        itemName,
        months: {}
      };
      
      allMonths.forEach(month => {
        const payslip = payslipMap[month.monthKey];
        if (payslip && payslip.items && payslip.items[itemName] !== undefined) {
          const value = payslip.items[itemName];
          const category = (payslip.itemCategories && payslip.itemCategories[itemName]) || 'other';
          const numericValue = typeof value === 'number' ? value : parseFloat(value || 0);
          
          row.months[month.monthKey] = {
            value: numericValue,
            category,
            type: payslip.type || 'salary',
            hasData: true
          };
        } else {
          row.months[month.monthKey] = {
            value: 0,
            category: 'other',
            type: 'salary',
            hasData: false
          };
        }
      });
      
      return row;
    });
    
    return { matrix, allMonths, allItems };
  };

  const getTotals = () => {
    const { matrix, allMonths } = generateItemMatrix();
    const totals = {};
    
    matrix.forEach(row => {
      const itemTotal = allMonths.reduce((sum, month) => {
        const monthData = row.months[month.monthKey];
        return sum + (monthData.hasData ? monthData.value : 0);
      }, 0);
      totals[row.itemName] = itemTotal;
    });
    
    return totals;
  };

  const formatPeriod = () => {
    return `${startYear}年${startMonth}月 〜 ${endYear}年${endMonth}月`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP').format(amount);
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

  const { matrix, allMonths } = generateItemMatrix();
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

      {/* 賃金台帳テーブル（マトリックス形式） */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">賃金台帳（項目別表示）</h2>
          <p className="text-sm text-gray-600 mt-1">横軸：各月、縦軸：給与明細の実際の項目</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                  項目名
                </th>
                {allMonths.map(month => (
                  <th key={month.monthKey} className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="transform -rotate-45 origin-bottom-left">
                      {month.month}月
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">
                  合計
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {matrix.map((row, index) => (
                <tr key={row.itemName} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white border-r">
                    <div className="flex items-center">
                      <span className="truncate max-w-32" title={row.itemName}>
                        {row.itemName}
                      </span>
                      {(() => {
                        // どの月かのカテゴリーを取得
                        const sampleMonth = allMonths.find(month => row.months[month.monthKey]?.hasData);
                        const category = sampleMonth ? row.months[sampleMonth.monthKey].category : 'other';
                        
                        if (category === 'income') {
                          return <span className="ml-2 px-1 py-0.5 text-xs bg-green-100 text-green-600 rounded">支給</span>;
                        } else if (category === 'deduction') {
                          return <span className="ml-2 px-1 py-0.5 text-xs bg-red-100 text-red-600 rounded">控除</span>;
                        }
                        return null;
                      })()}
                    </div>
                  </td>
                  {allMonths.map(month => {
                    const monthData = row.months[month.monthKey];
                    const value = monthData.value;
                    const hasData = monthData.hasData;
                    const isBonus = monthData.type === 'bonus';
                    
                    return (
                      <td key={month.monthKey} className="px-3 py-2 whitespace-nowrap text-sm text-right">
                        <div className="flex flex-col items-end">
                          {hasData && value !== 0 ? (
                            <>
                              <span className={`font-medium ${
                                monthData.category === 'income' ? 'text-gray-900' : 
                                monthData.category === 'deduction' ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                ¥{formatCurrency(value)}
                              </span>
                              {isBonus && (
                                <span className="text-xs px-1 py-0.5 bg-orange-100 text-orange-600 rounded mt-1">
                                  賞与
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-bold bg-gray-50">
                    {totals[row.itemName] !== 0 ? (
                      <span className={`${
                        (() => {
                          const sampleMonth = allMonths.find(month => row.months[month.monthKey]?.hasData);
                          const category = sampleMonth ? row.months[sampleMonth.monthKey].category : 'other';
                          return category === 'income' ? 'text-gray-900' : 
                                 category === 'deduction' ? 'text-red-600' : 'text-gray-600';
                        })()
                      }`}>
                        ¥{formatCurrency(totals[row.itemName])}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
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