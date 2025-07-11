// src/components/Navigation.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Navigation({ isMobile = false, onItemClick = () => {} }) {
  const { userDetails } = useAuth();
  const location = useLocation();
  
  const isActive = (path) => {
    return location.pathname === path ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100';
  };
  
  // ユーザーロールを確認
  const isAdmin = userDetails?.role === 'admin' || userDetails?.userType === 'company_admin' || userDetails?.userType === 'company';
  
  return (
    <nav className="w-full bg-white rounded-lg overflow-hidden">
      <div className={isMobile ? "" : "p-4 bg-blue-600 text-white"}>
        {!isMobile && <h3 className="font-medium">メニュー</h3>}
      </div>
      
      <ul className="space-y-1 p-2">
        {/* 共通メニュー */}
        <li>
          <Link 
            to="/" 
            onClick={() => onItemClick()}
            className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/')}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
            </svg>
            ダッシュボード
          </Link>
        </li>
        
        <li>
          <Link 
            to="/payslips" 
            onClick={() => onItemClick()}
            className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/payslips')}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            給与明細一覧
          </Link>
        </li>
        
        <li>
          <Link 
            to="/profile" 
            onClick={() => onItemClick()}
            className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/profile')}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            プロフィール
          </Link>
        </li>
        
        {/* 管理者向けメニュー */}
        {isAdmin && (
          <>
            <div className="pt-2 pb-1">
              <div className="border-t border-gray-200"></div>
              <h4 className="px-4 pt-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                管理者機能
              </h4>
            </div>
            
            <li>
              <Link 
                to="/upload" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/upload')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                給与データアップロード
              </Link>
            </li>
            
            <li>
              <Link 
                to="/users" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/users')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
                従業員管理
              </Link>
            </li>
            
            <li>
              <Link 
                to="/settings" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/settings')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                システム設定
              </Link>
            </li>
            
            <li>
              <Link 
                to="/settings/payroll-items" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/settings/payroll-items')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                給与項目設定
              </Link>
            </li>
            
            <li>
              <Link 
                to="/settings/csv-mapping" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/settings/csv-mapping')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                CSVマッピング設定
              </Link>
            </li>
            
            <li>
              <Link 
                to="/settings/backup" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/settings/backup')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                </svg>
                データバックアップ
              </Link>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

export default Navigation;