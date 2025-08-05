// src/components/Layout.js
import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navigation from './Navigation';

function Layout() {
  const { currentUser, userDetails, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pageTitle, setPageTitle] = useState('');

  // 現在のパスに基づいてページタイトルを設定
  useEffect(() => {
    const path = location.pathname;
    
    // パスに基づいてタイトルを設定
    if (path === '/') {
      setPageTitle('ダッシュボード');
    } else if (path === '/payslips') {
      setPageTitle('給与明細一覧');
    } else if (path.startsWith('/payslips/')) {
      if (path.includes('/print')) {
        setPageTitle('給与明細印刷');
      } else {
        setPageTitle('給与明細詳細');
      }
    } else if (path === '/upload') {
      setPageTitle('給与データアップロード');
    } else if (path === '/users') {
      setPageTitle('従業員管理');
    } else if (path.startsWith('/users/')) {
      if (path.includes('/new')) {
        setPageTitle('従業員追加');
      } else if (path.includes('/edit')) {
        setPageTitle('従業員編集');
      } else {
        setPageTitle('従業員詳細');
      }
    } else if (path === '/settings') {
      setPageTitle('システム設定');
    } else if (path === '/settings/departments') {
      setPageTitle('部門設定');
    } else if (path === '/settings/payroll-items') {
      setPageTitle('給与項目設定');
    } else if (path === '/settings/csv-mapping') {
      setPageTitle('CSVマッピング設定');
    } else if (path === '/settings/notifications') {
      setPageTitle('通知設定');
    } else if (path === '/profile') {
      setPageTitle('プロフィール');
    } else if (path === '/admin/pdf-delivery') {
      setPageTitle('PDF配信管理');
    } else if (path === '/employee/documents') {
      setPageTitle('書類一覧');
    } else {
      setPageTitle('');
    }
    
    // モバイルメニューを閉じる
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  // ユーザーやユーザー詳細がない場合は、Outletのみを表示（ログインページなど）
  if (!currentUser) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            {/* ロゴとモバイルメニュートグル */}
            <div className="flex items-center">
              {/* モバイルメニューボタン */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="mr-4 md:hidden focus:outline-none"
                aria-label="メニュー"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isMobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 6h16M4 12h16m-7 6h7"
                    />
                  )}
                </svg>
              </button>
            
              {/* ロゴ */}
              <Link to="/" className="flex items-center">
                <div className="text-xl font-bold text-blue-600">給与明細</div>
              </Link>
            </div>
            
            {/* ページタイトル（モバイルでは非表示） */}
            <div className="hidden md:block">
              <h1 className="text-xl font-semibold text-gray-800">{pageTitle}</h1>
            </div>
            
            {/* ユーザーメニュー */}
            <div className="flex items-center">
              <div className="mr-4 text-sm text-gray-700 hidden md:block">
                <span className="font-medium">
                  {userDetails?.displayName || currentUser.email}
                </span>
                {(userDetails?.role === 'admin' || userDetails?.userType === 'company' || userDetails?.userType === 'company_admin') && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                    管理者
                  </span>
                )}
              </div>
              
              {/* ドロップダウンメニュー（簡易版） */}
              <div className="relative">
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* モバイルナビゲーション（モバイル表示時） */}
      <div className={`md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'} bg-white shadow-lg`}>
        <div className="px-4 py-2">
          <Navigation isMobile={true} onItemClick={() => setIsMobileMenuOpen(false)} />
        </div>
      </div>
      
      {/* メインコンテンツエリア */}
      <div className="flex-grow flex">
        {/* サイドナビゲーション（デスクトップ表示時） */}
        <aside className="hidden md:block w-64 bg-white shadow-md p-4">
          <Navigation />
        </aside>
        
        {/* メインコンテンツ */}
        <main className="flex-grow p-4">
          {/* モバイル用ページタイトル */}
          <div className="md:hidden mb-4">
            <h1 className="text-xl font-semibold text-gray-800">{pageTitle}</h1>
          </div>
          
          {/* ページコンテンツ */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
      
      {/* フッター */}
      <footer className="bg-white border-t mt-auto py-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center space-x-4">
            <div className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()}
            </div>
            <div className="text-sm text-gray-500">
              Version 0.1.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;