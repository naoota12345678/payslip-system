// src/pages/EmployeeDashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function EmployeeDashboard() {
  const { currentUser, userDetails } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [latestPayslip, setLatestPayslip] = useState(null);
  const [stats, setStats] = useState({
    totalPayslips: 0,
    averageNetAmount: 0,
    yearlyIncome: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPayslipData = async () => {
      if (!currentUser || !userDetails) return;
      
      try {
        setLoading(true);
        setError('');
        
        // 自分の給与明細のみ取得（最新5件）
        const q = query(
          collection(db, "payslips"),
          where("employeeId", "==", userDetails.employeeId),
          where("companyId", "==", userDetails.companyId),
          orderBy("paymentDate", "desc"),
          limit(5)
        );
        
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
        
        // 最新の給与明細
        if (payslipList.length > 0) {
          setLatestPayslip(payslipList[0]);
        }
        
        // 集計データの計算
        await calculateStats();
      } catch (err) {
        console.error("給与データの取得エラー:", err);
        setError("給与データの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };
    
    // 年間の給与総額などを計算
    const calculateStats = async () => {
      try {
        // 過去12ヶ月の給与明細を取得
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const yearlyQuery = query(
          collection(db, "payslips"),
          where("employeeId", "==", userDetails.employeeId),
          where("companyId", "==", userDetails.companyId),
          where("paymentDate", ">=", Timestamp.fromDate(oneYearAgo)),
          orderBy("paymentDate", "desc")
        );
        
        const yearlySnapshot = await getDocs(yearlyQuery);
        const yearlyPayslips = [];
        
        yearlySnapshot.forEach((doc) => {
          yearlyPayslips.push(doc.data());
        });
        
        // 集計計算
        const totalPayslips = yearlyPayslips.length;
        let totalNetAmount = 0;
        let yearlyIncomeTotal = 0;
        
        yearlyPayslips.forEach(payslip => {
          totalNetAmount += payslip.netAmount || 0;
          yearlyIncomeTotal += payslip.totalIncome || 0;
        });
        
        const averageNetAmount = totalPayslips > 0 ? totalNetAmount / totalPayslips : 0;
        
        setStats({
          totalPayslips,
          averageNetAmount,
          yearlyIncome: yearlyIncomeTotal
        });
      } catch (err) {
        console.error("集計データの計算エラー:", err);
      }
    };

    fetchPayslipData();
  }, [currentUser, userDetails]);

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
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">マイ給与ダッシュボード</h1>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      ) : (
        <>
          {/* メインカード */}
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <div className="flex flex-wrap items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-700">ようこそ</h2>
                <p className="text-gray-600">{userDetails?.displayName || currentUser?.email}</p>
              </div>
              <div className="mt-2 sm:mt-0">
                <Link 
                  to="/payslips" 
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  給与明細一覧を見る
                </Link>
              </div>
            </div>
          </div>
          
          {/* ステータスカード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* 最新の給与 */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">最新の給与</h3>
              {latestPayslip ? (
                <>
                  <p className="text-2xl font-bold text-blue-600 mb-2">
                    {formatCurrency(latestPayslip.netAmount)}
                  </p>
                  <p className="text-sm text-gray-500 mb-3">
                    支払日: {formatDate(latestPayslip.paymentDate)}
                  </p>
                  <div className="flex justify-between text-sm">
                    <div>
                      <p className="text-gray-600">支給額</p>
                      <p className="font-medium">{formatCurrency(latestPayslip.totalIncome)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">控除額</p>
                      <p className="font-medium">{formatCurrency(latestPayslip.totalDeduction)}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link 
                      to={`/payslips/${latestPayslip.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      詳細を見る →
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">給与明細データがありません</p>
              )}
            </div>
            
            {/* 年間所得 */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">年間所得（過去12ヶ月）</h3>
              <p className="text-2xl font-bold text-green-600 mb-2">
                {formatCurrency(stats.yearlyIncome)}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                給与明細数: {stats.totalPayslips}件
              </p>
              <div>
                <p className="text-gray-600 text-sm">平均月額給与</p>
                <p className="font-medium">
                  {formatCurrency(stats.averageNetAmount)}
                </p>
              </div>
            </div>
            
            {/* クイックリンク */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">クイックリンク</h3>
              <ul className="space-y-3">
                <li>
                  <Link 
                    to="/payslips" 
                    className="flex items-center text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path>
                    </svg>
                    全ての給与明細を見る
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/profile" 
                    className="flex items-center text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                    </svg>
                    プロフィール設定
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/notifications" 
                    className="flex items-center text-blue-600 hover:text-blue-800"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path>
                    </svg>
                    お知らせ設定
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          
          {/* 最近の給与明細 */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-700">最近の給与明細</h3>
              <Link 
                to="/payslips" 
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                全て表示 →
              </Link>
            </div>
            
            {payslips.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        支払日
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        支給額
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        控除額
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        手取り額
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payslips.map((payslip) => (
                      <tr key={payslip.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {formatDate(payslip.paymentDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {formatCurrency(payslip.totalIncome)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {formatCurrency(payslip.totalDeduction)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right font-medium">
                          {formatCurrency(payslip.netAmount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            to={`/payslips/${payslip.id}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            詳細
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">給与明細データがありません</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default EmployeeDashboard;