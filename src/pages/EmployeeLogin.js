// src/pages/EmployeeLogin.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

function EmployeeLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // 既にログインしている場合はダッシュボードへリダイレクト
  useEffect(() => {
    if (currentUser) {
      navigate('/employee/dashboard');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    console.log('🔄 従業員ログイン処理開始...');
    console.log('📧 メールアドレス:', email);
    console.log('📱 デバイス情報:', {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    });
    
    try {
      // Firebase Authenticationでログイン（Firestoreアクセスは行わない）
      console.log('🔐 Firebase認証を実行中...');
      console.log('入力されたメール:', email);
      console.log('入力されたパスワード長:', password.length);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('✅ Firebase認証成功:', user.uid);
      
      // AuthContextが自動的にuserDetailsを設定するまで待機
      console.log('✅ Firebase認証成功、AuthContextによる自動処理を待機中...');
      
      // モバイルデバイスの場合は待機時間を長くする
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const waitTime = isMobile ? 2500 : 1000;
      
      console.log(`📱 デバイス: ${isMobile ? 'モバイル' : 'PC'} - 待機時間: ${waitTime}ms`);
      
      // 待機してからリダイレクト
      setTimeout(() => {
        console.log('🚀 ダッシュボードへリダイレクト実行');
        navigate('/employee/dashboard');
      }, waitTime);
      
    } catch (error) {
      console.error('❌ 従業員ログインエラー:', error);
      console.error('エラーコード:', error.code);
      console.error('エラーメッセージ:', error.message);
      console.error('詳細:', error);
      
      // Firebase Authエラーメッセージの日本語化
      let errorMessage = 'ログインに失敗しました';
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'このメールアドレスは登録されていません';
          break;
        case 'auth/wrong-password':
          errorMessage = 'パスワードが正しくありません';
          break;
        case 'auth/invalid-email':
          errorMessage = 'メールアドレスの形式が正しくありません';
          break;
        case 'auth/user-disabled':
          errorMessage = 'このアカウントは無効化されています';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'ログイン試行回数が多すぎます。しばらく時間をおいてから再試行してください';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'メールアドレスまたはパスワードが正しくありません';
          break;
        default:
          // Firestoreのパーミッションエラーをキャッチ
          if (error.message && error.message.includes('Missing or insufficient permissions')) {
            errorMessage = 'アカウント情報の取得に失敗しました。管理者にお問い合わせください。';
            console.error('🚨 Firestore権限エラー - 従業員データへのアクセスが拒否されました');
          } else {
            errorMessage = error.message || 'ログインに失敗しました';
          }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          従業員ログイン
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          給与明細システムにアクセス
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link
                to="/employee/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                パスワードをお忘れの方
              </Link>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                }`}
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="text-center text-sm text-gray-600">
              初回ログインの方は、システム管理者から配布されたパスワードをご利用ください。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeLogin;