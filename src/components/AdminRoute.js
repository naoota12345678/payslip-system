// src/components/AdminRoute.js
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function AdminRoute() {
  const { currentUser, userDetails, loading } = useAuth();
  
  // 認証状態のロード中は何も表示しない
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }
  
  // 認証されていない場合はログインページにリダイレクト
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  // ユーザー詳細がない場合はプロフィール設定ページにリダイレクト
  if (!userDetails) {
    return <Navigate to="/profile" />;
  }
  
  // 管理者でない場合はダッシュボードにリダイレクト
  // userType は 'company_admin' または 'company' または 'employee'
  // role は 'admin' または 'employee' など
  const isAdmin = userDetails.userType === 'company_admin' || userDetails.userType === 'company' || userDetails.role === 'admin';
  if (!isAdmin) {
    return <Navigate to="/" />;
  }
  
  // 管理者の場合は子コンポーネントを表示
  return <Outlet />;
}

export default AdminRoute;