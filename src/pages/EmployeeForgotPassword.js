// src/pages/EmployeeForgotPassword.js
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

function EmployeeForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!email) {
      return setError('メールアドレスを入力してください');
    }
    
    try {
      setMessage('');
      setError('');
      setLoading(true);
      
      console.log('🔍 パスワードリセットメール送信試行:', { email });
      
      // Firebase Authenticationでパスワードリセットメールを送信
      await sendPasswordResetEmail(auth, email);
      
      console.log('✅ パスワードリセットメール送信完了');
      setMessage('パスワードリセット用のメールを送信しました。メールをご確認ください。');
      
    } catch (error) {
      console.error('❌ パスワードリセットメール送信エラー:', error);
      
      // Firebase Authエラーメッセージの日本語化
      let errorMessage = 'パスワードリセットメールの送信に失敗しました';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'このメールアドレスは登録されていません';
          break;
        case 'auth/invalid-email':
          errorMessage = 'メールアドレスの形式が正しくありません';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'リクエストが多すぎます。しばらく時間をおいてから再試行してください';
          break;
        default:
          errorMessage = error.message || 'パスワードリセットメールの送信に失敗しました';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">パスワードリセット</h1>
          <p className="text-gray-600">メールアドレスを入力してください</p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
              メールアドレス <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@company.com"
            />
            <p className="text-sm text-gray-500 mt-1">
              登録済みのメールアドレスを入力してください
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full disabled:opacity-50"
            >
              {loading ? '送信中...' : 'パスワードリセットメールを送信'}
            </button>
          </div>
        </form>
        
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600 mb-2">
            <Link to="/employee/login" className="text-blue-600 hover:text-blue-800">
              ← ログイン画面に戻る
            </Link>
          </p>
          <p className="text-sm text-gray-600">
            <Link to="/" className="text-gray-500 hover:text-gray-700">
              ← トップページに戻る
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default EmployeeForgotPassword; 