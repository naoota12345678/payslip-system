// src/pages/Register.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();

    // バリデーション
    if (password !== confirmPassword) {
      return setError('パスワードが一致しません');
    }

    if (password.length < 6) {
      return setError('パスワードは6文字以上で設定してください');
    }

    if (!companyName.trim()) {
      return setError('会社名を入力してください');
    }

    try {
      setError('');
      setLoading(true);
      
      // Firebaseでユーザーを作成
      const userCredential = await register(email, password);
      const user = userCredential.user;
      
      // Firestoreにユーザー情報を保存
      await setDoc(doc(db, 'users', user.uid), {
        email: email,
        userType: 'company',
        companyId: user.uid, // 初期は自身のUIDを使用
        companyName: companyName,
        displayName: companyName,
        createdAt: new Date(),
        isActive: true
      });

      // 会社情報を作成
      await setDoc(doc(db, 'companies', user.uid), {
        name: companyName,
        ownerId: user.uid,
        createdAt: new Date(),
        isActive: true
      });

      // ダッシュボードへリダイレクト
      navigate('/');
    } catch (error) {
      console.error("登録エラー:", error);
      
      // エラーメッセージの日本語化
      if (error.code === 'auth/email-already-in-use') {
        setError('このメールアドレスは既に使用されています');
      } else if (error.code === 'auth/invalid-email') {
        setError('有効なメールアドレスを入力してください');
      } else if (error.code === 'auth/weak-password') {
        setError('パスワードは6文字以上で設定してください');
      } else {
        setError('登録に失敗しました。もう一度お試しください。');
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
            新規アカウント登録
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            会社情報を入力してアカウントを作成してください
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="company-name" className="block text-sm font-medium text-gray-700">
                会社名
              </label>
              <input
                id="company-name"
                name="companyName"
                type="text"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="株式会社サンプル"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

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
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="6文字以上"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                パスワード（確認）
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="パスワードを再入力"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {loading ? '登録中...' : 'アカウントを作成'}
            </button>
          </div>
          
          <div className="text-center">
            <Link to="/login" className="text-sm text-blue-600 hover:text-blue-800">
              既にアカウントをお持ちの方はこちら
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;
