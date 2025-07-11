// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

// 従業員ダッシュボード
import EmployeeDashboard from './EmployeeDashboard';
// 管理者ダッシュボード
import AdminDashboard from './AdminDashboard';

function Dashboard() {
  const { currentUser, userDetails, loading } = useAuth();
  const [stats, setStats] = useState({
    payslipCount: 0,
    latestPayslip: null,
    userCount: 0,
    employeeCount: 0
  });
  const [recentUploads, setRecentUploads] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    // 認証とユーザー情報の読み込みが完了するのを待つ
    if (loading) return;
    
    // 未ログインの場合は何もしない（リダイレクトはレンダリング時に行う）
    if (!currentUser) return;
    
    // ユーザー詳細情報がない場合も何もしない
    if (!userDetails) return;
    
    // 権限分離: ユーザーロールに応じて、新しいダッシュボードコンポーネントへリダイレクト
    const isAdmin = userDetails.role === 'admin';
    
    // 管理者の場合は管理者ダッシュボードを表示、
    // 一般ユーザーの場合は従業員ダッシュボードを表示する流れに変更するため、
    // 以下の取得処理は行わない
    
    /* 
    // 以下は元の実装と思われる全体的な統計情報取得コード
    const fetchDashboardData = async () => {
      try {
        setDashboardLoading(true);
        setError('');
        
        // 会社IDの取得
        const companyId = userDetails.companyId;
        if (!companyId) {
          setError('会社情報が設定されていません');
          setDashboardLoading(false);
          return;
        }
        
        // 統計情報の取得
        await Promise.all([
          fetchPayslipStats(companyId),
          fetchUserStats(companyId),
          fetchRecentUploads(companyId)
        ]);
      } catch (err) {
        console.error("ダッシュボードデータの取得エラー:", err);
        setError('データの読み込み中にエラーが発生しました');
      } finally {
        setDashboardLoading(false);
      }
    };
    
    // 給与明細の統計情報を取得
    const fetchPayslipStats = async (companyId) => {
      try {
        let payslipQuery;
        
        // 権限によるクエリの変更
        if (userDetails.role === 'admin') {
          // 管理者: 会社全体の給与明細
          payslipQuery = query(
            collection(db, "payslips"),
            where("companyId", "==", companyId),
            orderBy("paymentDate", "desc"),
            limit(1)
          );
        } else {
          // 一般ユーザー: 自分の給与明細のみ
          payslipQuery = query(
            collection(db, "payslips"),
            where("userId", "==", currentUser.uid),
            orderBy("paymentDate", "desc"),
            limit(1)
          );
        }
        
        // 最新の給与明細を取得
        const payslipSnapshot = await getDocs(payslipQuery);
        let latestPayslip = null;
        
        if (!payslipSnapshot.empty) {
          const doc = payslipSnapshot.docs[0];
          latestPayslip = {
            id: doc.id,
            ...doc.data(),
            paymentDate: doc.data().paymentDate?.toDate()
          };
        }
        
        // 給与明細の総数
        const countQuery = userDetails.role === 'admin'
          ? query(collection(db, "payslips"), where("companyId", "==", companyId))
          : query(collection(db, "payslips"), where("userId", "==", currentUser.uid));
        
        const countSnapshot = await getDocs(countQuery);
        
        setStats(prev => ({
          ...prev,
          payslipCount: countSnapshot.size,
          latestPayslip
        }));
      } catch (err) {
        console.error("給与明細統計の取得エラー:", err);
      }
    };
    
    // ユーザー統計情報の取得
    const fetchUserStats = async (companyId) => {
      // 管理者のみが取得できる情報
      if (userDetails.role !== 'admin') return;
      
      try {
        const usersQuery = query(
          collection(db, "users"),
          where("companyId", "==", companyId)
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        
        let employeeCount = 0;
        usersSnapshot.forEach(doc => {
          // 管理者以外のユーザー数をカウント
          if (doc.data().role !== 'admin') {
            employeeCount++;
          }
        });
        
        setStats(prev => ({
          ...prev,
          userCount: usersSnapshot.size,
          employeeCount
        }));
      } catch (err) {
        console.error("ユーザー統計の取得エラー:", err);
      }
    };
    
    // 最近のアップロード情報の取得
    const fetchRecentUploads = async (companyId) => {
      // 管理者のみが取得できる情報
      if (userDetails.role !== 'admin') return;
      
      try {
        const uploadsQuery = query(
          collection(db, "csvUploads"),
          where("companyId", "==", companyId),
          orderBy("uploadDate", "desc"),
          limit(5)
        );
        
        const uploadsSnapshot = await getDocs(uploadsQuery);
        const uploads = [];
        
        uploadsSnapshot.forEach(doc => {
          uploads.push({
            id: doc.id,
            ...doc.data(),
            uploadDate: doc.data().uploadDate?.toDate(),
            paymentDate: doc.data().paymentDate?.toDate()
          });
        });
        
        setRecentUploads(uploads);
      } catch (err) {
        console.error("アップロード情報の取得エラー:", err);
      }
    };
    
    fetchDashboardData();
    */
  }, [currentUser, userDetails, loading]);
  
  // 認証とユーザー情報の読み込み中
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }
  
  // 未ログインの場合はログインページにリダイレクト
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  // ユーザー詳細情報がない場合
  if (!userDetails) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 text-yellow-700 p-4 rounded mb-4">
          ユーザープロフィールの設定が完了していません。プロフィール設定を完了してください。
        </div>
        <div className="mt-4">
          <Link to="/profile" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            プロフィール設定へ
          </Link>
        </div>
      </div>
    );
  }
  
  // ユーザーロールに基づいて適切なダッシュボードを表示
  const isAdmin = userDetails.role === 'admin';
  
  return isAdmin ? <AdminDashboard /> : <EmployeeDashboard />;
  
  /* 元の実装と思われるDashboardの内容
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ダッシュボード</h1>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
      )}
      
      {dashboardLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">データを読み込み中...</p>
        </div>
      ) : (
        <div>
          {/* ダッシュボードの内容 (ここも役割に応じてコンポーネントを分離) *
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* 統計カード *
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-gray-700">給与明細</h3>
              <p className="text-3xl font-bold mt-2">{stats.payslipCount}</p>
              <p className="text-sm text-gray-500 mt-1">
                {userDetails.role === 'admin' ? '全従業員の給与明細数' : 'あなたの給与明細数'}
              </p>
            </div>
            
            {userDetails.role === 'admin' && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-medium text-gray-700">従業員数</h3>
                <p className="text-3xl font-bold mt-2">{stats.employeeCount}</p>
                <p className="text-sm text-gray-500 mt-1">登録済み従業員の数</p>
              </div>
            )}
            
            {/* 最終給与明細 *
            <div className="bg-white p-6 rounded-lg shadow-md md:col-span-2 lg:col-span-2">
              <h3 className="text-lg font-medium text-gray-700">最新の給与明細</h3>
              {stats.latestPayslip ? (
                <div className="mt-2">
                  <p className="mb-1">
                    支払日: {stats.latestPayslip.paymentDate ? 
                      stats.latestPayslip.paymentDate.toLocaleDateString('ja-JP') : 'N/A'}
                  </p>
                  <p className="mb-1">
                    支給額: {stats.latestPayslip.totalIncome ? 
                      new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })
                        .format(stats.latestPayslip.totalIncome) : '¥0'}
                  </p>
                  <p className="mb-3">
                    手取り額: {stats.latestPayslip.netAmount ? 
                      new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' })
                        .format(stats.latestPayslip.netAmount) : '¥0'}
                  </p>
                  <Link 
                    to={`/payslips/${stats.latestPayslip.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    詳細を見る
                  </Link>
                </div>
              ) : (
                <p className="text-gray-500 mt-2">給与明細データがありません</p>
              )}
            </div>
          </div>
          
          {/* クイックアクション *
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-lg font-semibold mb-4">クイックアクション</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link 
                to="/payslips" 
                className="px-4 py-3 bg-blue-600 text-white rounded text-center hover:bg-blue-700"
              >
                給与明細一覧
              </Link>
              
              {userDetails.role === 'admin' && (
                <>
                  <Link 
                    to="/upload" 
                    className="px-4 py-3 bg-green-600 text-white rounded text-center hover:bg-green-700"
                  >
                    給与データアップロード
                  </Link>
                  <Link 
                    to="/users" 
                    className="px-4 py-3 bg-purple-600 text-white rounded text-center hover:bg-purple-700"
                  >
                    従業員管理
                  </Link>
                  <Link 
                    to="/settings" 
                    className="px-4 py-3 bg-gray-600 text-white rounded text-center hover:bg-gray-700"
                  >
                    システム設定
                  </Link>
                </>
              )}
            </div>
          </div>
          
          {/* 管理者向け: 最近のアップロード *
          {userDetails.role === 'admin' && recentUploads.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold mb-4">最近のCSVアップロード</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ファイル名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        アップロード日
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        支払日
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ステータス
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentUploads.map(upload => (
                      <tr key={upload.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{upload.fileName}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {upload.uploadDate?.toLocaleDateString('ja-JP') || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {upload.paymentDate?.toLocaleDateString('ja-JP') || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${upload.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : upload.status === 'error' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-yellow-100 text-yellow-800'}`}
                          >
                            {upload.status === 'completed' ? '完了' : 
                             upload.status === 'error' ? 'エラー' : '処理中'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
  */
}

export default Dashboard;