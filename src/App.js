// src/App.js
import React from 'react';
import { testFirebaseAuth } from './utils/testAuth';
import { testSimpleFunction } from './utils/simpleTest';
import { fixEmployeeUIDs } from './utils/fixEmployeeUIDs';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import ErrorBoundary from './components/ErrorBoundary';

// 認証関連ページ
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
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

// 従業員管理関連
import EmployeeManagement from './pages/EmployeeManagement';
import EmployeeDetail from './pages/EmployeeDetail';
import EmployeeForm from './pages/EmployeeForm';
import EmployeeRegister from './pages/EmployeeRegister';
import EmployeeLogin from './pages/EmployeeLogin';
import EmployeeForgotPassword from './pages/EmployeeForgotPassword';
import EmployeeChangePassword from './pages/EmployeeChangePassword';

// 給与管理関連
import CsvUpload from './pages/CsvUpload';
import SimpleCSVUpload from './pages/SimpleCSVUpload';
import CsvMapping from './pages/CsvMapping';
import PayrollItemSettings from './pages/PayrollItemSettings';

// 給与明細関連（新規追加）
import PayslipList from './pages/PayslipList';
import PayslipDetail from './pages/PayslipDetail';
import PayslipPrint from './pages/PayslipPrint';

// 賞与明細関連
import BonusPayslipList from './pages/BonusPayslipList';
import BonusPayslipDetail from './pages/BonusPayslipDetail';
import BonusPayslipPrint from './pages/BonusPayslipPrint';
import BonusCSVUpload from './pages/BonusSimpleCSVUpload';
import BonusCsvMapping from './pages/BonusCsvMapping';

// システム設定関連
import CompanySettings from './pages/CompanySettings';
import DepartmentSettings from './pages/DepartmentSettings';
import NotificationSettings from './pages/NotificationSettings';
import DataBackup from './pages/DataBackup';

// PDF配信関連
import PdfDeliveryManagement from './pages/admin/PdfDelivery';
import EmployeeDocuments from './pages/employee/Documents';

// デバッグツール
import AuthDebug from './pages/admin/AuthDebug';

// 賃金台帳関連
import WageLedgerIndex from './pages/admin/WageLedger/WageLedgerIndex';
import WageLedgerPeriodSelect from './pages/admin/WageLedger/WageLedgerPeriodSelect';
import WageLedgerEmployeeList from './pages/admin/WageLedger/WageLedgerEmployeeList';
import WageLedgerView from './pages/admin/WageLedger/WageLedgerView';
import WageLedgerBonusMapping from './pages/admin/WageLedger/WageLedgerBonusMapping';

// エラーページ
import NotFound from './pages/NotFound';

// テスト用にグローバルにアクセス可能にする
if (typeof window !== 'undefined') {
  window.testFirebaseAuth = testFirebaseAuth;
  window.testSimpleFunction = testSimpleFunction;
  window.fixEmployeeUIDs = fixEmployeeUIDs;
  
  // 従業員データ診断関数
  window.debugEmployeeData = async function() {
    const { db } = await import('./firebase');
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    
    try {
      console.log('=== 従業員データ診断開始 ===');
      
      // 1. 全従業員データを確認
      console.log('1. 全従業員データ:');
      const employeesQuery = query(collection(db, 'employees'));
      const employeesSnapshot = await getDocs(employeesQuery);
      
      employeesSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`従業員: ${data.name} | Email: ${data.email} | UID: ${data.uid} | EmployeeId: ${data.employeeId} | CompanyId: ${data.companyId}`);
      });
      
      // 2. 給与明細データを確認
      console.log('\n2. 給与明細データ:');
      const payslipsQuery = query(collection(db, 'payslips'));
      const payslipsSnapshot = await getDocs(payslipsQuery);
      
      console.log(`給与明細総数: ${payslipsSnapshot.size}`);
      
      // 各従業員の給与明細数をカウント
      const employeePayslipCount = {};
      payslipsSnapshot.forEach((doc) => {
        const data = doc.data();
        const empId = data.employeeId;
        if (!employeePayslipCount[empId]) {
          employeePayslipCount[empId] = 0;
        }
        employeePayslipCount[empId]++;
      });
      
      console.log('従業員別給与明細数:');
      Object.entries(employeePayslipCount).forEach(([empId, count]) => {
        console.log(`  ${empId}: ${count}件`);
      });
      
      return {
        employeesCount: employeesSnapshot.size,
        payslipsCount: payslipsSnapshot.size,
        employeePayslipCount
      };
      
    } catch (error) {
      console.error('診断エラー:', error);
      return { error: error.message };
    }
  };
  
  // 特定のメールアドレスでの検索
  window.findEmployeeByEmail = async function(email) {
    const { db } = await import('./firebase');
    const { collection, query, where, getDocs } = await import('firebase/firestore');
    
    try {
      console.log(`=== ${email} の従業員データ検索 ===`);
      
      const employeeQuery = query(
        collection(db, 'employees'),
        where('email', '==', email)
      );
      
      const employeeSnapshot = await getDocs(employeeQuery);
      
      if (employeeSnapshot.empty) {
        console.log('❌ 該当する従業員データが見つかりません');
        return null;
      }
      
      const employeeData = employeeSnapshot.docs[0].data();
      console.log('✅ 従業員データ見つかりました:', employeeData);
      
      // その従業員の給与明細を検索
      const payslipQuery = query(
        collection(db, 'payslips'),
        where('employeeId', '==', employeeData.employeeId),
        where('companyId', '==', employeeData.companyId)
      );
      
      const payslipSnapshot = await getDocs(payslipQuery);
      console.log(`給与明細数: ${payslipSnapshot.size}件`);
      
      payslipSnapshot.forEach((doc) => {
        const payslip = doc.data();
        console.log(`  - ${payslip.paymentDate?.toDate().toLocaleDateString('ja-JP')} | 支給額: ¥${payslip.netAmount}`);
      });
      
      return {
        employee: employeeData,
        payslipCount: payslipSnapshot.size
      };
      
    } catch (error) {
      console.error('検索エラー:', error);
      return { error: error.message };
    }
  };
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
        <Routes>
          {/* トップページ - 入り口選択 */}
          <Route path="/" element={<HomePage />} />
          
          {/* 管理者向けルート */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/register" element={<Register />} />
          <Route path="/admin/signup" element={<SignUp />} />
          
          {/* 従業員向けルート */}
          <Route path="/employee" element={<Navigate to="/employee/login" />} />
          <Route path="/employee/login" element={<EmployeeLogin />} />
          
          {/* 共通認証ページ */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* レイアウト付きの保護されたルート */}
          <Route element={<Layout />}>
            {/* 管理者専用機能 */}
            <Route path="/admin" element={<AdminRoute />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="profile" element={<Profile />} />
              

              
              {/* 従業員管理 */}
              <Route path="employees" element={<EmployeeManagement />} />
              <Route path="employees/new" element={<EmployeeForm />} />
              <Route path="employees/:employeeId" element={<EmployeeDetail />} />
              <Route path="employees/:employeeId/edit" element={<EmployeeForm />} />
              <Route path="register-employee" element={<EmployeeRegister />} />
              
              {/* 部門管理 */}
              <Route path="departments" element={<DepartmentSettings />} />
              
              {/* 給与データ管理 */}
              <Route path="upload" element={<SimpleCSVUpload />} />
              <Route path="settings/csv-mapping" element={<CsvMapping />} />
              <Route path="settings/payroll-items" element={<PayrollItemSettings />} />
              
              {/* 給与明細管理 */}
              <Route path="payslips" element={<PayslipList />} />
              <Route path="payslips/:payslipId" element={<PayslipDetail />} />
              <Route path="payslips/:payslipId/print" element={<PayslipPrint />} />
              
              {/* PDF配信管理 */}
              <Route path="pdf-delivery" element={<PdfDeliveryManagement />} />
              
              {/* 賃金台帳管理 */}
              <Route path="wage-ledger" element={<WageLedgerIndex />} />
              <Route path="wage-ledger/period-select" element={<WageLedgerPeriodSelect />} />
              <Route path="wage-ledger/employees" element={<WageLedgerEmployeeList />} />
              <Route path="wage-ledger/view" element={<WageLedgerView />} />
              <Route path="wage-ledger/bonus-mapping" element={<WageLedgerBonusMapping />} />
              
              {/* 賞与明細管理 */}
              <Route path="bonus-upload" element={<BonusCSVUpload />} />
              <Route path="bonus-csv-mapping" element={<BonusCsvMapping />} />
              <Route path="bonus-payslips" element={<BonusPayslipList />} />
              <Route path="bonus-payslips/:payslipId" element={<BonusPayslipDetail />} />
              <Route path="bonus-payslips/:payslipId/print" element={<BonusPayslipPrint />} />
              
              {/* システム設定 */}
              <Route path="settings" element={<CompanySettings />} />
              <Route path="settings/departments" element={<DepartmentSettings />} />
              <Route path="settings/notifications" element={<NotificationSettings />} />
              <Route path="settings/backup" element={<DataBackup />} />
              
              {/* デバッグツール */}
              <Route path="debug/auth" element={<AuthDebug />} />
            </Route>
            
            {/* 従業員パスワードリセット（認証前） */}
            <Route path="/employee/forgot-password" element={<EmployeeForgotPassword />} />
            
            {/* 従業員専用機能（認証後） */}
            <Route path="/employee" element={<PrivateRoute />}>
              <Route path="dashboard" element={<EmployeeDashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="change-password" element={<EmployeeChangePassword />} />
              
              {/* 給与明細閲覧 */}
              <Route path="payslips" element={<PayslipList />} />
              <Route path="payslips/:payslipId" element={<PayslipDetail />} />
              <Route path="payslips/:payslipId/print" element={<PayslipPrint />} />
              
              {/* 書類一覧 */}
              <Route path="documents" element={<EmployeeDocuments />} />
              
              {/* 賞与明細閲覧 */}
              <Route path="bonus-payslips" element={<BonusPayslipList />} />
              <Route path="bonus-payslips/:payslipId" element={<BonusPayslipDetail />} />
              <Route path="bonus-payslips/:payslipId/print" element={<BonusPayslipPrint />} />
            </Route>
            
            {/* 共通ルート（ロール無関係でアクセス可能） */}
            <Route path="/" element={<PrivateRoute />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              
              {/* 給与明細関連 */}
              <Route path="payslips" element={<PayslipList />} />
              <Route path="payslips/:payslipId" element={<PayslipDetail />} />
              <Route path="payslips/:payslipId/print" element={<PayslipPrint />} />
              
              {/* 賞与明細関連 */}
              <Route path="bonus-payslips" element={<BonusPayslipList />} />
              <Route path="bonus-payslips/:payslipId" element={<BonusPayslipDetail />} />
              <Route path="bonus-payslips/:payslipId/print" element={<BonusPayslipPrint />} />
              
              {/* 通知設定 */}
              <Route path="notifications" element={<NotificationSettings />} />
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

// ホームページコンポーネント（入り口選択）
function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">給与明細システム</h1>
          <p className="text-gray-600">ご利用される立場をお選びください</p>
        </div>
        
        <div className="space-y-4">
          <Link 
            to="/admin"
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
            </svg>
            管理者としてログイン
          </Link>
          
          <Link 
            to="/employee/login"
            className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            従業員としてログイン
          </Link>
        </div>
        
      </div>
    </div>
  );
}

export default App;