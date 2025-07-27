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
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-500">ユーザー情報を読み込み中...</p>
        </div>
      </div>
    );
  }
  
  // 認証されている場合は子コンポーネントを表示
  console.log('✅ PrivateRoute: 認証完了 - コンテンツ表示');
  return <Outlet />;
}

export default PrivateRoute;