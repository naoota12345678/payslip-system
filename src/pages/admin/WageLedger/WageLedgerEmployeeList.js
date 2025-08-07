// src/pages/admin/WageLedger/WageLedgerEmployeeList.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';

function WageLedgerEmployeeList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userDetails } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [payslipData, setPayslipData] = useState({});

  // URLパラメータから期間を取得
  const startYear = parseInt(searchParams.get('startYear'));
  const startMonth = parseInt(searchParams.get('startMonth'));
  const endYear = parseInt(searchParams.get('endYear'));
  const endMonth = parseInt(searchParams.get('endMonth'));

  // 期間の開始日と終了日を計算
  const startDate = new Date(startYear, startMonth - 1, 1);
  const endDate = new Date(endYear, endMonth, 0); // 月末日

  useEffect(() => {
    const fetchData = async () => {
      if (!userDetails?.companyId) return;

      try {
        setLoading(true);
        
        // 期間内の給与明細データを取得
        const payslipsQuery = query(
          collection(db, 'payslips'),
          where('companyId', '==', userDetails.companyId),
          where('payDate', '>=', startDate.toISOString().split('T')[0]),
          where('payDate', '<=', endDate.toISOString().split('T')[0])
        );
        
        const payslipsSnapshot = await getDocs(payslipsQuery);
        const payslips = payslipsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // 従業員ごとに給与明細をグループ化
        const employeePayslips = {};
        payslips.forEach(payslip => {
          const employeeId = payslip.employeeId;
          if (!employeePayslips[employeeId]) {
            employeePayslips[employeeId] = [];
          }
          employeePayslips[employeeId].push(payslip);
        });

        setPayslipData(employeePayslips);

        // 従業員マスタデータを取得
        const employeesQuery = query(
          collection(db, 'employees'),
          where('companyId', '==', userDetails.companyId)
        );
        
        const employeesSnapshot = await getDocs(employeesQuery);
        const employeesData = employeesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // 期間内に給与明細があるアクティブな従業員のみフィルタリング
        const activeEmployeesWithPayslips = employeesData.filter(employee => {
          return employeePayslips[employee.employeeId] && 
                 employeePayslips[employee.employeeId].length > 0 &&
                 employee.isActive !== false; // 退職者を除外
        });

        setEmployees(activeEmployeesWithPayslips);
        setLoading(false);
      } catch (err) {
        console.error('データ取得エラー:', err);
        setError('データの取得中にエラーが発生しました');
        setLoading(false);
      }
    };

    fetchData();
  }, [userDetails, startDate, endDate]);

  const handleEmployeeSelect = (employee) => {
    const params = new URLSearchParams({
      startYear: startYear.toString(),
      startMonth: startMonth.toString(),
      endYear: endYear.toString(),
      endMonth: endMonth.toString(),
      employeeId: employee.employeeId,
      employeeName: employee.name
    });
    navigate(`/admin/wage-ledger/view?${params.toString()}`);
  };

  const getPayslipCount = (employeeId) => {
    return payslipData[employeeId]?.length || 0;
  };

  const formatPeriod = () => {
    return `${startYear}年${startMonth}月 〜 ${endYear}年${endMonth}月`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
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
          <span className="text-blue-600 font-medium">従業員選択</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">従業員選択</h1>
        <p className="text-gray-600 mt-2">
          期間: {formatPeriod()}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        {employees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="mx-auto w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium text-gray-900 mb-2">
              該当する従業員がいません
            </p>
            <p className="text-gray-600">
              選択された期間（{formatPeriod()}）に給与明細データがある従業員が見つかりませんでした。
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                該当従業員 ({employees.length}名)
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                従業員を選択すると賃金台帳が表示されます
              </p>
            </div>
            
            <div className="divide-y divide-gray-200">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  onClick={() => handleEmployeeSelect(employee)}
                  className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900">
                          {employee.name}
                        </h3>
                        <span className="ml-3 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {employee.employeeId}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <span>{employee.email}</span>
                        {employee.departmentCode && (
                          <>
                            <span className="mx-2">•</span>
                            <span>{employee.departmentCode}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {getPayslipCount(employee.employeeId)}件
                        </p>
                        <p className="text-xs text-gray-500">給与明細</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* アクションボタン */}
      <div className="mt-6 flex justify-start">
        <button
          onClick={() => navigate('/admin/wage-ledger/period-select')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          期間を変更
        </button>
      </div>
    </div>
  );
}

export default WageLedgerEmployeeList;