// src/pages/EmployeeChangePassword.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { updatePassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

function EmployeeChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // URLパラメータで初回ログインかどうかをチェック
    const firstLogin = searchParams.get('first');
    setIsFirstLogin(firstLogin === 'true');
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    
    // バリデーション
    if (!currentPassword || !newPassword || !confirmPassword) {
      return setError('すべての項目を入力してください');
    }
    
    if (newPassword !== confirmPassword) {
      return setError('新しいパスワードと確認用パスワードが一致しません');
    }
    
    if (newPassword.length < 6) {
      return setError('新しいパスワードは6文字以上で入力してください');
    }
    
    if (currentPassword === newPassword) {
      return setError('新しいパスワードは現在のパスワードと異なるものを入力してください');
    }
    
    try {
      setError('');
      setLoading(true);
      
      console.log('🔍 パスワード変更試行');
      
      // Firebase Authenticationでパスワードを更新
      if (currentUser) {
        await updatePassword(currentUser, newPassword);
        console.log('✅ パスワード変更完了');
        
        if (isFirstLogin) {
          alert('パスワードの変更が完了しました。\n従業員ダッシュボードに移動します。');
          navigate('/employee/dashboard');
        } else {
          alert('パスワードを正常に変更しました。');
          navigate('/employee/profile');
        }
      } else {
        throw new Error('ユーザー情報が取得できません');
      }
      
    } catch (error) {
      console.error('❌ パスワード変更エラー:', error);
      
      // Firebase Authエラーメッセージの日本語化
      let errorMessage = 'パスワードの変更に失敗しました';
      switch (error.code) {
        case 'auth/weak-password':
          errorMessage = 'パスワードが弱すぎます。より強力なパスワードを設定してください';
          break;
        case 'auth/requires-recent-login':
          errorMessage = 'セキュリティのため、再度ログインしてからパスワードを変更してください';
          break;
        default:
          errorMessage = error.message || 'パスワードの変更に失敗しました';
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isFirstLogin ? '初回パスワード設定' : 'パスワード変更'}
          </h1>
          <p className="text-gray-600">
            {isFirstLogin 
              ? '初回ログインです。安全なパスワードに変更してください' 
              : '新しいパスワードを設定してください'
            }
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="currentPassword">
              {isFirstLogin ? '現在のパスワード（仮パスワード）' : '現在のパスワード'} <span className="text-red-500">*</span>
            </label>
            <input
              id="currentPassword"
              type="password"
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={isFirstLogin ? '管理者から受け取った仮パスワード' : '現在のパスワード'}
            />
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="newPassword">
              新しいパスワード <span className="text-red-500">*</span>
            </label>
            <input
              id="newPassword"
              type="password"
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="6文字以上で入力"
            />
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
              新しいパスワード（確認） <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="確認のため再度入力"
            />
          </div>
          
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full disabled:opacity-50"
            >
              {loading ? '変更中...' : 'パスワードを変更'}
            </button>
          </div>
        </form>
        
        {!isFirstLogin && (
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              <button 
                onClick={() => navigate('/employee/profile')}
                className="text-gray-500 hover:text-gray-700"
              >
                ← プロフィールに戻る
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployeeChangePassword; 