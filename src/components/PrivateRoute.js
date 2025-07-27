// src/components/PrivateRoute.js
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function PrivateRoute() {
  const { currentUser, userDetails, loading } = useAuth();
  const location = useLocation();
  
  console.log('🛡️ PrivateRoute チェック:', {
    path: location.pathname,
    loading,
    currentUser: currentUser ? `${currentUser.email}` : 'null',
    userDetails: userDetails ? `${userDetails.name} (${userDetails.employeeId})` : 'null'
  });
  
  // 認証状態のロード中は何も表示しない
  if (loading) {
    console.log('⏳ PrivateRoute: loading中');
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }
  
  // 認証されていない場合のリダイレクト処理
  if (!currentUser) {
    console.log('🚫 PrivateRoute: currentUser無し - リダイレクト');
    // 従業員向けページの場合は従業員ログインページにリダイレクト
    if (location.pathname.startsWith('/employee/')) {
      console.log('👷 PrivateRoute: 従業員ログインへリダイレクト');
      return <Navigate to="/employee/login" />;
    }
    // その他の場合は汎用ログインページにリダイレクト
    console.log('👤 PrivateRoute: 汎用ログインへリダイレクト');
    return <Navigate to="/login" />;
  }
  
  // currentUserは存在するがuserDetailsがまだ読み込まれていない場合
  if (currentUser && !userDetails) {
    console.log('⏳ PrivateRoute: userDetails読み込み待機中');
    
    // 10秒以上待ってもuserDetailsが取得できない場合は適切なログインページにリダイレクト
    React.useEffect(() => {
      const timer = setTimeout(() => {
        if (currentUser && !userDetails) {
          console.log('⚠️ userDetails取得がタイムアウト - ログインページにリダイレクト');
          // 従業員向けページの場合は従業員ログインページにリダイレクト
          if (location.pathname.startsWith('/employee/')) {
            console.log('👷 従業員ページタイムアウト - 従業員ログインへ');
            // Navigate コンポーネントを使用してリダイレクト
            window.location.replace('/employee/login');
          } else {
            console.log('👤 管理者ページタイムアウト - 管理者ログインへ');
            window.location.replace('/login');
          }
        }
      }, 10000); // 10秒に延長

      return () => clearTimeout(timer);
    }, [currentUser, userDetails, location.pathname]);
    
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-500">ユーザー情報を読み込み中...</p>
          <p className="text-xs text-gray-400 mt-2">権限の確認に時間がかかっています...</p>
          <p className="text-xs text-gray-300 mt-1">10秒経過後に自動でログイン画面に戻ります</p>
        </div>
      </div>
    );
  }
  
  // 認証されている場合は子コンポーネントを表示
  console.log('✅ PrivateRoute: 認証完了 - コンテンツ表示');
  return <Outlet />;
}

export default PrivateRoute;