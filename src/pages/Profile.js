// src/pages/Profile.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

function Profile() {
  const { currentUser, userDetails, logout, fetchUserDetails } = useAuth();
  
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // 新しいパスワード設定用
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ユーザーデータの初期ロード
  useEffect(() => {
    if (currentUser && userDetails) {
      setEmail(currentUser.email || '');
      setDisplayName(userDetails.displayName || '');
      setPhone(userDetails.phone || '');
      setPosition(userDetails.position || '');
    }
  }, [currentUser, userDetails]);

  // プロフィール情報更新
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    try {
      setError('');
      setMessage('');
      setLoading(true);
      
      // 従業員情報をFirestoreで更新（名前は除外）
      const employeeQuery = query(
        collection(db, 'employees'),
        where('uid', '==', currentUser.uid)
      );
      
      const employeeSnapshot = await getDocs(employeeQuery);
      if (!employeeSnapshot.empty) {
        const employeeDocRef = doc(db, 'employees', employeeSnapshot.docs[0].id);
        await updateDoc(employeeDocRef, {
          // name: displayName, // 名前の更新を無効化
          phone,
          position,
          updatedAt: new Date()
        });
      }
      
      // ユーザー詳細を再取得
      await fetchUserDetails(currentUser);
      
      setMessage('プロフィールが正常に更新されました');
      
      // メッセージを一定時間後に消す
      setTimeout(() => {
        setMessage('');
      }, 3000);
    } catch (err) {
      console.error('プロフィール更新エラー:', err);
      setError('プロフィールの更新に失敗しました: ' + (err.message || 'エラーが発生しました'));
    } finally {
      setLoading(false);
    }
  };

  // パスワード変更（注：この機能をサポートするためにはFirebase Authの追加設定が必要）
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    // 入力検証
    if (!currentPassword || !newPassword || !confirmPassword) {
      return setPasswordError('すべての項目を入力してください');
    }
    
    if (newPassword !== confirmPassword) {
      return setPasswordError('新しいパスワードが一致しません');
    }
    
    if (newPassword.length < 6) {
      return setPasswordError('パスワードは6文字以上である必要があります');
    }
    
    try {
      setPasswordError('');
      setMessage('');
      setLoading(true);
      
      // 注：実際のパスワード変更機能は Firebase Authentication と連携する必要があります
      // 現在のパスワードを検証し、新しいパスワードを設定する機能
      
      // ここでは、この機能はまだ実装されていないことを示すメッセージを表示
      setMessage('パスワード変更機能は現在開発中です');
      
      // フォームをリセット
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('パスワード変更エラー:', err);
      setPasswordError('パスワードの変更に失敗しました: ' + (err.message || 'エラーが発生しました'));
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser || !userDetails) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">プロフィール設定</h1>
      
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
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* アカウント情報セクション */}
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold mb-4">アカウント情報</h2>
          
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  メールアドレス
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  メールアドレスは変更できません
                </p>
              </div>
              
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                  表示名（管理者のみ編集可能）
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed rounded-md shadow-sm py-2 px-3 sm:text-sm"
                  disabled
                  readOnly
                />
                <p className="mt-1 text-xs text-gray-500">
                  名前の変更は管理者にお問い合わせください。給与明細の正確性のため、従業員による名前変更は制限されています。
                </p>
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  電話番号
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                  役職
                </label>
                <input
                  id="position"
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
            
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
              >
                {loading ? '更新中...' : 'プロフィールを更新'}
              </button>
            </div>
          </form>
        </div>
        
        {/* パスワード変更セクション */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">パスワード変更</h2>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-blue-800">
                  パスワードの変更
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>セキュリティのため、パスワード変更は専用ページで行います。</p>
                </div>
                <div className="mt-4">
                  <div className="-mx-2 -my-1.5 flex">
                    <a
                      href="/employee/change-password"
                      className="bg-blue-50 px-2 py-1.5 rounded-md text-sm font-medium text-blue-800 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      パスワード変更ページへ
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;