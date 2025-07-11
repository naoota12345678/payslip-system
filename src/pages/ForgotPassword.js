// src/pages/ForgotPassword.js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      return setError('メールアドレスを入力してください');
    }
    
    try {
      setError('');
      setMessage('');
      setLoading(true);
      
      await resetPassword(email);
      
      setMessage('パスワードリセットの手順をメールで送信しました。メールボックスを確認してください。');
    } catch (err) {
      console.error('パスワードリセットエラー:', err);
      setError('パスワードリセットに失敗しました: ' + (err.message || 'エラーが発生しました'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            パスワードをリセット
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            アカウントに関連付けられたメールアドレスを入力してください
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
            {message}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
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
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {loading ? '処理中...' : 'リセットリンクを送信'}
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                ログインページに戻る
              </Link>
            </div>
            <div className="text-sm">
              <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500">
                新規アカウント作成
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;