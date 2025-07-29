// src/pages/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import SystemMonitor from '../components/SystemMonitor';

function AdminDashboard() {
  const { currentUser, userDetails } = useAuth();
  const [recentPayslips, setRecentPayslips] = useState([]);
  // const [recentUploads, setRecentUploads] = useState([]); // csvUploads削除のためコメントアウト
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalPayslips: 0,
    monthlyPayslips: 0,
    totalAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // 管理者権限チェック
    if (userDetails?.role !== 'admin') {
      setError("このページへのアクセス権限がありません");
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      if (!currentUser || !userDetails?.companyId) return;
      
      try {
        setLoading(true);
        setError('');
        
        await Promise.all([
          fetchRecentPayslips(),
          calculateStats()
        ]);
      } catch (err) {
        console.error("ダッシュボードデータの取得エラー:", err);
        setError("データの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };
    
    // 最近の給与明細を取得
    const fetchRecentPayslips = async () => {
      try {
        console.log('🔍 AdminDashboard: payslipsクエリ実行中...', userDetails.companyId);
        const q = query(
          collection(db, "payslips"),
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
            paymentDate: doc.data().paymentDate?.toDate()
          });
        });
        
        setRecentPayslips(payslipList);
      } catch (err) {
        console.error("❌ AdminDashboard: 給与明細データの取得エラー:", err);
        console.error("エラー詳細:", {
          code: err.code,
          message: err.message,
          companyId: userDetails.companyId
        });
      }
    };
    
    // csvUploads削除のため、この関数は無効化
    // const fetchRecentUploads = async () => { ... };
    
    // 統計データ計算
    const calculateStats = async () => {
      try {
        // 全従業員数
        const employeesQuery = query(
          collection(db, "employees"),
          where("companyId", "==", userDetails.companyId)
        );
        const employeesSnapshot = await getDocs(employeesQuery);
        const totalEmployees = employeesSnapshot.size;
        
        // 給与明細の総数
        const allPayslipsQuery = query(
          collection(db, "payslips"),
          where("companyId", "==", userDetails.companyId)
        );
        const allPayslipsSnapshot = await getDocs(allPayslipsQuery);
        const totalPayslips = allPayslipsSnapshot.size;
        
        // 最新の支払日の給与明細を取得
        console.log('🔍 AdminDashboard: 最新の支払日を検索中...');
        const latestPaymentQuery = query(
          collection(db, "payslips"),
          where("companyId", "==", userDetails.companyId),
          orderBy("paymentDate", "desc"),
          limit(1)
        );
        const latestPaymentSnapshot = await getDocs(latestPaymentQuery);
        
        let monthlyPayslips = 0;
        let totalAmount = 0;
        
        if (!latestPaymentSnapshot.empty) {
          const latestPaymentDate = latestPaymentSnapshot.docs[0].data().paymentDate;
          console.log('🔍 AdminDashboard: 最新支払日の給与明細を取得中...', {
            paymentDate: latestPaymentDate?.toDate()
          });
          
          // 同じ支払日の全ての給与明細を取得
          const samePaymentDateQuery = query(
            collection(db, "payslips"),
            where("companyId", "==", userDetails.companyId),
            where("paymentDate", "==", latestPaymentDate)
          );
          const samePaymentDateSnapshot = await getDocs(samePaymentDateQuery);
          monthlyPayslips = samePaymentDateSnapshot.size;
          
          // 総支給額計算
          console.log(`🔍 AdminDashboard: 支給額を計算中... (明細数: ${samePaymentDateSnapshot.size})`);
          samePaymentDateSnapshot.forEach(doc => {
            const data = doc.data();
            const income = data.totalIncome || 0;
            totalAmount += income;
            console.log(`従業員: ${data.employeeId}, 支給額: ${income}`);
          });
          console.log(`📊 最新支払日の総支給額: ${totalAmount}`);
        } else {
          console.log('⚠️ AdminDashboard: 給与明細データがありません');
        }
        
        setStats({
          totalEmployees,
          totalPayslips,
          monthlyPayslips,
          totalAmount
        });
      } catch (err) {
        console.error("統計データの計算エラー:", err);
      }
    };

    fetchDashboardData();
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
        <Link to="/" className="text-blue-600 hover:underline">ダッシュボードに戻る</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">管理ダッシュボード</h1>
      
      {/* システム監視 */}
      <SystemMonitor />
      
      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* 従業員数 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">従業員数</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.totalEmployees}</p>
          <p className="text-sm text-gray-500 mt-2">
            登録済みユーザー数
          </p>
        </div>
        
        {/* 給与明細総数 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">給与明細総数</h3>
          <p className="text-2xl font-bold text-green-600">{stats.totalPayslips}</p>
          <p className="text-sm text-gray-500 mt-2">
            処理済み給与明細の総数
          </p>
        </div>
        
        {/* 最新支払日の支給数 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">最新支払日の支給数</h3>
          <p className="text-2xl font-bold text-indigo-600">{stats.monthlyPayslips}</p>
          <p className="text-sm text-gray-500 mt-2">
            最新支払日の給与明細件数
          </p>
        </div>
        
        {/* 最新支払日の支給総額 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">最新支払日の支給総額</h3>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalAmount)}</p>
          <p className="text-sm text-gray-500 mt-2">
            最新支払日の総支給額
          </p>
        </div>
      </div>
      
      {/* クイックアクション */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-lg font-semibold mb-4">クイックアクション</h2>
        <div className="flex flex-wrap gap-4">
          <Link 
            to="/upload" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd"></path>
            </svg>
            給与データアップロード
          </Link>
          <Link 
            to="/payslips" 
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path>
            </svg>
            給与明細一覧
          </Link>
          <Link 
            to="/admin/bonus-upload" 
            className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"></path>
            </svg>
            賞与データアップロード
          </Link>
          <Link 
            to="/admin/bonus-payslips" 
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path>
            </svg>
            賞与明細一覧
          </Link>
          <Link 
            to="/admin/employees" 
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"></path>
            </svg>
            従業員管理
          </Link>
          <Link 
            to="/admin/departments" 
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd"></path>
              <path d="M6 8a1 1 0 100 2h8a1 1 0 100-2H6zM6 11a1 1 0 100 2h4a1 1 0 100-2H6z"></path>
            </svg>
            部門設定
          </Link>
          <Link 
            to="/settings" 
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"></path>
            </svg>
            システム設定
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 最近の給与明細 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">最近の給与明細</h3>
            <Link 
              to="/payslips" 
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              全て表示 →
            </Link>
          </div>
          
          {recentPayslips.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      従業員ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      支払日
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      支給額
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentPayslips.map((payslip) => (
                    <tr key={payslip.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {payslip.employeeId || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(payslip.paymentDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {formatCurrency(payslip.totalIncome)}
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
        
        {/* csvUploads削除のため、アップロード履歴セクションを削除 */}
      </div>
    </div>
  );
}

export default AdminDashboard;