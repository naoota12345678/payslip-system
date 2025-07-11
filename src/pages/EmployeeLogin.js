// src/pages/EmployeeLogin.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function EmployeeLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, fetchUserDetails } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    
    try {
      setError('');
      setLoading(true);
      const userCredential = await login(email, password);
      
      // ユーザー詳細情報を取得
      const userDetails = await fetchUserDetails(userCredential.user);
      
      console.log("取得したユーザー詳細:", userDetails);
      
      // 従業員権限チェック
      const isEmployee = userDetails?.userType === 'employee' || 
                        userDetails?.role === 'employee';
      
      if (!isEmployee) {
        setError('従業員アカウントでログインしてください。管理者の方は管理者ログインページをご利用ください。');
        setLoading(false);
        return;
      }
      
      // 従業員ダッシュボードにリダイレクト
      navigate('/employee/dashboard');
    } catch (error) {
      setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
      console.error("ログインエラー:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">従業員ログイン</h1>
          <p className="text-gray-600">従業員アカウントでログインして給与明細を確認してください</p>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* ログインフォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="employee@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        {/* フッターリンク */}
        <div className="mt-6 text-center space-y-2">
          <Link
            to="/forgot-password"
            className="text-sm text-green-600 hover:underline"
          >
            パスワードを忘れた方はこちら
          </Link>
          
          <div className="text-sm text-gray-500">
            アカウントについてご不明な点は会社の管理者にお問い合わせください
          </div>
          
          <div className="border-t pt-4 mt-4">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← トップページに戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeLogin; 