// src/pages/Login.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
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
      
      // エミュレータ環境対応：userDetailsがnullまたはundefinedの場合、
      // またはuserTypeが存在しない場合のデフォルト値を設定
      const userType = userDetails?.userType || 'company';
      
      console.log("使用するユーザータイプ:", userType);
      
      // ユーザータイプに基づいてリダイレクト
      if (userType === 'employee') {
        navigate('/payslips');
      } else {
        navigate('/');
      }
    } catch (error) {
      setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
      console.error("ログインエラー:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            給与明細システム
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            アカウントにログインしてください
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">メールアドレス</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">パスワード</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <Link to="/reset-password" className="text-sm text-blue-600 hover:text-blue-800">
              パスワードを忘れた方
            </Link>
            <Link to="/register" className="text-sm text-blue-600 hover:text-blue-800">
              新規アカウント登録
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;