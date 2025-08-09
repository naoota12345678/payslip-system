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
  
  // ユーザータイプに応じたベースパス
  const basePath = isAdmin ? '/admin' : '/employee';
  
  return (
    <nav className="w-full bg-white rounded-lg overflow-hidden">
      <div className={isMobile ? "" : "p-4 bg-blue-600 text-white"}>
        {!isMobile && <h3 className="font-medium">メニュー</h3>}
      </div>
      
      <ul className="space-y-1 p-2">
        {/* 共通メニュー */}
        <li>
          <Link 
            to={`${basePath}/dashboard`} 
            onClick={() => onItemClick()}
            className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive(`${basePath}/dashboard`)}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
            </svg>
            ダッシュボード
          </Link>
        </li>
        
        <li>
          <Link 
            to={`${basePath}/payslips`} 
            onClick={() => onItemClick()}
            className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive(`${basePath}/payslips`)}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            給与明細一覧
          </Link>
        </li>
        
        <li>
          <Link 
            to={`${basePath}/bonus-payslips`} 
            onClick={() => onItemClick()}
            className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive(`${basePath}/bonus-payslips`)}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            賞与明細一覧
          </Link>
        </li>
        
        {/* 書類一覧（従業員向け） */}
        {!isAdmin && (
          <li>
            <Link 
              to="/employee/documents" 
              onClick={() => onItemClick()}
              className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/employee/documents')}`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              書類一覧
            </Link>
          </li>
        )}
        
        <li>
          <Link 
            to={`${basePath}/profile`} 
            onClick={() => onItemClick()}
            className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive(`${basePath}/profile`)}`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
            </svg>
            アカウント
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
                to="/admin/upload" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/upload')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                給与データアップロード
              </Link>
            </li>
            
            <li>
              <Link 
                to="/admin/bonus-upload" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/bonus-upload')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                賞与データアップロード
              </Link>
            </li>
            
            <li>
              <Link 
                to="/admin/employees" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/employees')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
                従業員管理
              </Link>
            </li>
            
            <li>
              <Link 
                to="/admin/pdf-delivery" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/pdf-delivery')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707L16.414 6.414A1 1 0 0015.586 6H7a2 2 0 00-2 2v11a2 2 0 002 2zM16 8v2a1 1 0 001 1h2M12 11v6m-3-3l3 3 3-3"></path>
                </svg>
                PDF配信管理
              </Link>
            </li>
            
            <li>
              <Link 
                to="/admin/wage-ledger"
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/wage-ledger')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path>
                </svg>
                賃金台帳
              </Link>
            </li>
            
            <li>
              <Link 
                to="/admin/departments" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/departments')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
                部門設定
              </Link>
            </li>
            
            <li>
              <Link 
                to="/admin/settings" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/settings')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                会社情報
              </Link>
            </li>
            
            <li>
              <Link 
                to="/admin/settings/payroll-items" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/settings/payroll-items')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                給与項目設定
              </Link>
            </li>
            
            <li>
              <Link 
                to="/admin/settings/csv-mapping" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/settings/csv-mapping')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                給与CSVマッピング設定
              </Link>
            </li>
            
            <li>
              <Link 
                to="/admin/bonus-csv-mapping" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/bonus-csv-mapping')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                賞与CSVマッピング設定
              </Link>
            </li>
            
{/* データバックアップメニューを非表示化
            <li>
              <Link 
                to="/admin/settings/backup" 
                onClick={() => onItemClick()}
                className={`flex items-center px-4 py-2 text-sm rounded-md ${isActive('/admin/settings/backup')}`}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                </svg>
                データバックアップ
              </Link>
            </li>
            */}
          </>
        )}
      </ul>
    </nav>
  );
}

export default Navigation;