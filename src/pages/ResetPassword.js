// src/pages/ResetPassword.js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ResetPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setMessage('');
      setError('');
      setLoading(true);
      
      await resetPassword(email);
      
      setMessage('パスワードリセットメールを送信しました。メールをご確認ください。');
    } catch (error) {
      console.error("パスワードリセットエラー:", error);
      
      // エラーメッセージの日本語化
      if (error.code === 'auth/user-not-found') {
        setError('このメールアドレスは登録されていません');
      } else if (error.code === 'auth/invalid-email') {
        setError('有効なメールアドレスを入力してください');
      } else {
        setError('パスワードリセットメールの送信に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            パスワードリセット
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            登録されているメールアドレスを入力してください
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {message}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={message !== ''}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || message !== ''}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {loading ? '送信中...' : 'リセットメールを送信'}
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <Link to="/login" className="text-sm text-blue-600 hover:text-blue-800">
              ログイン画面に戻る
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

export default ResetPassword;
