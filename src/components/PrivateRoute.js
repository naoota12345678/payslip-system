// src/components/PrivateRoute.js
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function PrivateRoute() {
  const { currentUser, loading } = useAuth();
  
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
  
  // 認証されている場合は子コンポーネントを表示
  return <Outlet />;
}

export default PrivateRoute;