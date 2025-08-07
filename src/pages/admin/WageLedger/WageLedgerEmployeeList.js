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

  // URLパラメータから期間とタイプを取得
  const ledgerType = searchParams.get('type') || 'salary';
  const startYear = parseInt(searchParams.get('startYear'));
  const startMonth = parseInt(searchParams.get('startMonth'));
  const endYear = parseInt(searchParams.get('endYear'));
  const endMonth = parseInt(searchParams.get('endMonth'));

  useEffect(() => {
    const fetchData = async () => {
      if (!userDetails?.companyId) return;
      
      // URLパラメータの検証
      if (isNaN(startYear) || isNaN(startMonth) || isNaN(endYear) || isNaN(endMonth)) {
        console.error('❌ URLパラメータが無効です:', { startYear, startMonth, endYear, endMonth });
        setError('期間の設定が正しくありません。期間選択からやり直してください。');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(''); // エラーをクリア
        
        // 期間の開始日と終了日を計算（useEffect内で実行）
        const startDate = new Date(startYear, startMonth - 1, 1);
        const endDate = new Date(endYear, endMonth, 0); // 月末日
        
        // 日付の妥当性チェック
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.error('❌ 日付計算エラー:', { startYear, startMonth, endYear, endMonth });
          setError('期間の日付が正しくありません。');
          setLoading(false);
          return;
        }
        
        console.log('🔍 賃金台帳データ取得開始');
        console.log('URLパラメータ:', { startYear, startMonth, endYear, endMonth });
        console.log('期間:', startDate.toISOString().split('T')[0], '〜', endDate.toISOString().split('T')[0]);
        console.log('会社ID:', userDetails.companyId);
        
        // タイプに応じて適切なデータを取得
        console.log('📄 Firestoreクエリ実行中...', `タイプ: ${ledgerType}`);
        let allPayslips = [];
        
        if (ledgerType === 'bonus') {
          // 賞与賃金台帳の場合：賞与明細のみ取得
          const bonusQuery = query(
            collection(db, 'bonusPayslips'),
            where('companyId', '==', userDetails.companyId),
            where('paymentDate', '>=', startDate),
            where('paymentDate', '<=', endDate)
          );
          
          console.log('🎁 賞与明細クエリ実行中...');
          const bonusSnapshot = await Promise.race([
            getDocs(bonusQuery),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('bonusクエリタイムアウト（30秒）')), 30000)
            )
          ]);
          
          console.log('🎁 賞与クエリ完了. 取得数:', bonusSnapshot.size);
          
          const bonusPayslips = bonusSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'bonus',
            ...doc.data()
          }));
          
          allPayslips = bonusPayslips;
          console.log('🎁 取得した賞与明細:', bonusPayslips.length, '件');
        } else {
          // 給与賃金台帳の場合：給与明細のみ取得
          const payslipsQuery = query(
            collection(db, 'payslips'),
            where('companyId', '==', userDetails.companyId),
            where('paymentDate', '>=', startDate),
            where('paymentDate', '<=', endDate)
          );
          
          console.log('📄 給与明細クエリ実行中...');
          const payslipsSnapshot = await Promise.race([
            getDocs(payslipsQuery),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('payslipsクエリタイムアウト（30秒）')), 30000)
            )
          ]);
          
          console.log('📄 給与クエリ完了. 取得数:', payslipsSnapshot.size);
          
          const payslips = payslipsSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'salary',
            ...doc.data()
          }));
          
          allPayslips = payslips;
          console.log('📄 取得した給与明細:', payslips.length, '件');
        }
        
        console.log('📊 対象明細合計:', allPayslips.length, '件');

        // 従業員ごとに明細データをグループ化（給与・賞与統合）
        const employeePayslips = {};
        allPayslips.forEach(payslip => {
          const employeeId = payslip.employeeId;
          if (!employeePayslips[employeeId]) {
            employeePayslips[employeeId] = [];
          }
          employeePayslips[employeeId].push(payslip);
        });

        console.log('👥 明細データがある従業員数:', Object.keys(employeePayslips).length);
        setPayslipData(employeePayslips);

        // 従業員マスタデータを取得
        console.log('👤 従業員データクエリ実行中...');
        const employeesQuery = query(
          collection(db, 'employees'),
          where('companyId', '==', userDetails.companyId)
        );
        
        const employeesSnapshot = await Promise.race([
          getDocs(employeesQuery),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('従業員データクエリタイムアウト（30秒）')), 30000)
          )
        ]);
        console.log('👤 従業員データクエリ完了. 取得数:', employeesSnapshot.size);
        
        const employeesData = employeesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log('👤 全従業員数:', employeesData.length);
        console.log('👤 従業員データサンプル:', employeesData.slice(0, 3));

        // 全従業員を表示（退職者含む）
        // 賃金台帳は法定帳簿のため退職者も期間中の在籍記録が必要
        const allEmployees = employeesData;
        
        console.log('📊 給与明細データ詳細:', Object.keys(employeePayslips).map(empId => ({
          employeeId: empId,
          payslipCount: employeePayslips[empId]?.length || 0
        })));
        
        console.log('✅ 該当従業員数:', allEmployees.length);

        setEmployees(allEmployees);
        setLoading(false);
      } catch (err) {
        console.error('❌ データ取得エラー:', err);
        setError('データの取得中にエラーが発生しました');
        setLoading(false);
      }
    };

    fetchData();
  }, [userDetails, startYear, startMonth, endYear, endMonth]);

  const handleEmployeeSelect = (employee) => {
    const params = new URLSearchParams({
      type: ledgerType,
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
          <span className="text-gray-500 cursor-pointer" onClick={() => navigate(`/admin/wage-ledger/period-select?type=${ledgerType}`)}>
            {ledgerType === 'bonus' ? '賞与' : '給与'}期間選択
          </span>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-blue-600 font-medium">従業員選択</span>
        </nav>
        <div className="flex items-center space-x-3 mb-2">
          <div className={`w-3 h-3 rounded-full ${ledgerType === 'bonus' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
          <h1 className="text-2xl font-bold text-gray-900">
            {ledgerType === 'bonus' ? '賞与' : '給与'}賃金台帳 - 従業員選択
          </h1>
        </div>
        <p className="text-gray-600 mt-2">
          対象期間: {formatPeriod()} | タイプ: {ledgerType === 'bonus' ? '賞与明細' : '給与明細'}
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
                        {employee.isActive === false && (
                          <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                            退職済み
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <span>{employee.email}</span>
                        {employee.departmentCode && (
                          <>
                            <span className="mx-2">•</span>
                            <span>{employee.departmentCode}</span>
                          </>
                        )}
                        {employee.isActive === false && employee.retiredDate && (
                          <>
                            <span className="mx-2">•</span>
                            <span>退職日: {employee.retiredDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {getPayslipCount(employee.employeeId)}件
                        </p>
                        <p className="text-xs text-gray-500">
                          {getPayslipCount(employee.employeeId) > 0 ? '明細データ' : '全期間表示可能'}
                        </p>
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
          onClick={() => navigate(`/admin/wage-ledger/period-select?type=${ledgerType}`)}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          期間を変更
        </button>
      </div>
    </div>
  );
}

export default WageLedgerEmployeeList;