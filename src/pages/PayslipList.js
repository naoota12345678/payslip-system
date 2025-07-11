// src/pages/PayslipList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function PayslipList() {
  const { currentUser, userDetails } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'month', 'year'
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const fetchPayslips = async () => {
      if (!currentUser || !userDetails) return;
      
      try {
        setLoading(true);
        setError('');
        
        let q;
        
        // 会社管理者の場合は会社全体の明細を取得
        if (userDetails.role === 'admin') {
          q = query(
            collection(db, "payslips"),
            where("companyId", "==", userDetails.companyId),
            orderBy("paymentDate", "desc")
          );
        } else {
          // 一般ユーザーの場合は自分の明細のみ取得
          q = query(
            collection(db, "payslips"),
            where("userId", "==", currentUser.uid),
            orderBy("paymentDate", "desc")
          );
        }
        
        const querySnapshot = await getDocs(q);
        const payslipList = [];
        
        querySnapshot.forEach((doc) => {
          payslipList.push({
            id: doc.id,
            ...doc.data(),
            paymentDate: doc.data().paymentDate?.toDate() // Timestamp→Date変換
          });
        });
        
        setPayslips(payslipList);
      } catch (err) {
        console.error("明細データの取得エラー:", err);
        setError("給与明細データの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchPayslips();
  }, [currentUser, userDetails]);

  // 期間でのフィルタリング
  const filteredPayslips = () => {
    if (filter === 'all') return payslips;
    
    const currentDate = new Date(selectedDate);
    
    return payslips.filter(payslip => {
      if (!payslip.paymentDate) return false;
      
      const payslipDate = new Date(payslip.paymentDate);
      
      if (filter === 'month') {
        return payslipDate.getMonth() === currentDate.getMonth() && 
               payslipDate.getFullYear() === currentDate.getFullYear();
      }
      
      if (filter === 'year') {
        return payslipDate.getFullYear() === currentDate.getFullYear();
      }
      
      return true;
    });
  };

  // 日付を整形する関数
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  // 金額を整形する関数
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '¥0';
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY' 
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">給与明細一覧</h1>
      
      {/* フィルターコントロール */}
      <div className="bg-white p-4 mb-6 rounded shadow-md">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-1">表示期間</label>
            <select
              id="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border rounded px-3 py-2 w-32"
            >
              <option value="all">全期間</option>
              <option value="month">月別</option>
              <option value="year">年別</option>
            </select>
          </div>
          
          {filter !== 'all' && (
            <div>
              <label htmlFor="datePicker" className="block text-sm font-medium text-gray-700 mb-1">
                {filter === 'month' ? '年月を選択' : '年を選択'}
              </label>
              <input
                id="datePicker"
                type={filter === 'month' ? 'month' : 'number'}
                value={filter === 'month' 
                  ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}` 
                  : selectedDate.getFullYear()
                }
                onChange={(e) => {
                  if (filter === 'month') {
                    const [year, month] = e.target.value.split('-').map(Number);
                    setSelectedDate(new Date(year, month - 1));
                  } else {
                    setSelectedDate(new Date(parseInt(e.target.value), 0));
                  }
                }}
                min={filter === 'year' ? 2020 : undefined}
                max={filter === 'year' ? 2100 : undefined}
                className="border rounded px-3 py-2"
              />
            </div>
          )}
        </div>
      </div>
      
      {/* エラーメッセージ */}
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* ローディング表示 */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      ) : (
        <>
          {filteredPayslips().length > 0 ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        支払日
                      </th>
                      {userDetails?.role === 'admin' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          従業員
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        支給額
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        控除額
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        手取り額
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPayslips().map((payslip) => (
                      <tr key={payslip.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatDate(payslip.paymentDate)}
                        </td>
                        {userDetails?.role === 'admin' && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {payslip.employeeId || 'N/A'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {formatCurrency(payslip.totalIncome)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {formatCurrency(payslip.totalDeduction)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                          {formatCurrency(payslip.netAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            to={`/payslips/${payslip.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            詳細
                          </Link>
                          <button 
                            className="ml-3 text-green-600 hover:text-green-900"
                            onClick={() => window.open(`/payslips/${payslip.id}/print`, '_blank')}
                          >
                            印刷
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* ページ下部の合計表示 */}
              <div className="bg-gray-50 px-6 py-3">
                <p className="text-sm text-gray-500">
                  表示件数: {filteredPayslips().length}件
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500">表示する給与明細がありません</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PayslipList;