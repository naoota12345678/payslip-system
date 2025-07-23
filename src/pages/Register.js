// src/pages/Register.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, collection } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { db } from '../firebase';

function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signup } = useAuth();
  const auth = getAuth();

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
      
      // 1. まずFirebase Authでユーザー作成
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 2. employeesコレクションにユーザー情報を保存
      await setDoc(doc(collection(db, 'employees')), {
        uid: user.uid,
        email: email,
        name: companyName,
        employeeId: `ADMIN_${Date.now()}`,
        position: '管理者',
        userType: 'company_admin',
        role: 'admin',
        companyId: user.uid,
        isActive: true,
        phone: '',
        departmentCode: '',
        createdAt: new Date()
      });

      // 3. 会社情報を作成
      await setDoc(doc(db, 'companies', user.uid), {
        name: companyName,
        ownerId: user.uid,
        createdAt: new Date(),
        isActive: true
      });

      // 管理者ダッシュボードへリダイレクト
      navigate('/admin/dashboard');
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">管理者アカウント登録</h1>
          <p className="text-gray-600">会社情報を入力して管理者アカウントを作成してください</p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1">
              会社名
            </label>
            <input
              id="company-name"
              name="companyName"
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="株式会社サンプル"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="6文字以上"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
              パスワード（確認）
            </label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="パスワードを再入力"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登録中...' : 'アカウントを作成'}
          </button>
        </form>
        
        <div className="mt-6 text-center space-y-2">
          <Link
            to="/admin/login"
            className="text-sm text-blue-600 hover:underline"
          >
            既にアカウントをお持ちの方はこちら
          </Link>
          
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

export default Register;
