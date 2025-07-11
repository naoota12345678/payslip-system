// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import ErrorBoundary from './components/ErrorBoundary';

// 認証関連ページ
import Login from './pages/Login';
import Register from './pages/Register';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// ダッシュボード関連
import Dashboard from './pages/Dashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';

// ユーザー管理関連
import Profile from './pages/Profile';
import UserList from './pages/UserList';
import UserDetail from './pages/UserDetail';
import UserForm from './pages/UserForm';

// 給与管理関連
import CsvUpload from './pages/CsvUpload';
import CsvMapping from './pages/CsvMapping';
import PayrollItemSettings from './pages/PayrollItemSettings';

// 給与明細関連（新規追加）
import PayslipList from './pages/PayslipList';
import PayslipDetail from './pages/PayslipDetail';
import PayslipPrint from './pages/PayslipPrint';

// システム設定関連
import CompanySettings from './pages/CompanySettings';
import DepartmentSettings from './pages/DepartmentSettings';
import NotificationSettings from './pages/NotificationSettings';
import DataBackup from './pages/DataBackup';

// エラーページ
import NotFound from './pages/NotFound';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
        <Routes>
          {/* 認証ページ（レイアウトなし） */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* レイアウト付きの保護されたルート */}
          <Route element={<Layout />}>
            {/* 認証が必要なルート */}
            <Route element={<PrivateRoute />}>
              {/* ダッシュボード */}
              <Route path="/" element={<Dashboard />} />
              
              {/* プロフィール */}
              <Route path="/profile" element={<Profile />} />
              
              {/* 給与明細関連（一般ユーザーもアクセス可能） */}
              <Route path="/payslips" element={<PayslipList />} />
              <Route path="/payslips/:payslipId" element={<PayslipDetail />} />
              <Route path="/payslips/:payslipId/print" element={<PayslipPrint />} />
            </Route>
            
            {/* 管理者専用機能 */}
            <Route element={<AdminRoute />}>
              {/* ユーザー管理 */}
              <Route path="/users" element={<UserList />} />
              <Route path="/users/new" element={<UserForm />} />
              <Route path="/users/:userId" element={<UserDetail />} />
              <Route path="/users/:userId/edit" element={<UserForm />} />
              
              {/* 給与データ管理 */}
              <Route path="/upload" element={<CsvUpload />} />
              <Route path="/settings/csv-mapping" element={<CsvMapping />} />
              <Route path="/settings/payroll-items" element={<PayrollItemSettings />} />
              
              {/* システム設定 */}
              <Route path="/settings" element={<CompanySettings />} />
              <Route path="/settings/departments" element={<DepartmentSettings />} />
              <Route path="/settings/notifications" element={<NotificationSettings />} />
              <Route path="/settings/backup" element={<DataBackup />} />
            </Route>
          </Route>
          
          {/* 404ページ */}
          <Route path="/not-found" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;