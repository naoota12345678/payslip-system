// src/pages/SignUp.js
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [userType, setUserType] = useState('company_admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 入力検証
    if (!email || !password || !confirmPassword) {
      setError('すべての必須フィールドを入力してください');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    
    if (password.length < 6) {
      setError('パスワードは6文字以上である必要があります');
      return;
    }
    
    if (userType === 'company_admin' && !companyId) {
      setError('管理者の場合は会社IDを入力してください');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      // ユーザー登録の実行
      await signup(email, password, userType, companyId);
      
      setSuccess('アカウントが正常に作成されました。ログインページに移動します...');
      
      // 少し待ってからログインページへリダイレクト
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      console.error('登録エラー:', err);
      setError('アカウントの作成に失敗しました: ' + (err.message || 'エラーが発生しました'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            アカウント登録
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            すでにアカウントをお持ちの方は{' '}
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
              こちらからログイン
            </Link>
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
            {success}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
              />
            </div>
            
            <div>
              <label htmlFor="userType" className="block text-sm font-medium text-gray-700">
                ユーザータイプ
              </label>
              <select
                id="userType"
                name="userType"
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="company_admin">会社管理者</option>
                <option value="employee">従業員</option>
              </select>
            </div>
            
            {userType === 'company_admin' && (
              <div>
                <label htmlFor="companyId" className="block text-sm font-medium text-gray-700">
                  会社ID
                </label>
                <input
                  id="companyId"
                  name="companyId"
                  type="text"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
                />
                <p className="mt-1 text-xs text-gray-500">
                  新規会社の場合は空欄、既存会社の場合は会社IDを入力してください
                </p>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {loading ? '処理中...' : 'アカウント作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SignUp;