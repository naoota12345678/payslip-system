// src/pages/UserForm.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

function UserForm() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { userDetails: currentUserDetails } = useAuth();
  const auth = getAuth();
  
  // 編集モードかどうか
  const isEditMode = !!userId;
  
  // フォームの状態
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [userType, setUserType] = useState('employee');
  
  // UI状態
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode); // 編集モードの場合は初期ロード中
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  
  // 部門情報の取得
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!currentUserDetails?.companyId) return;
      
      try {
        const deptQuery = query(
          collection(db, 'departments'),
          where('companyId', '==', currentUserDetails.companyId)
        );
        
        const snapshot = await getDocs(deptQuery);
        
        const deptList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setDepartments(deptList);
      } catch (err) {
        console.error('部門情報取得エラー:', err);
        // 部門情報取得失敗は致命的ではないので処理続行
      }
    };
    
    fetchDepartments();
  }, [currentUserDetails]);
  
  // 編集モードの場合、既存のユーザーデータを取得して表示
  useEffect(() => {
    const fetchUserData = async () => {
      if (!isEditMode || !currentUserDetails?.companyId) {
        setInitialLoading(false);
        return;
      }
      
      try {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          setError('指定されたユーザーが見つかりません');
          setInitialLoading(false);
          return;
        }
        
        const userData = userDoc.data();
        
        // ユーザーが同じ会社に所属しているか確認（セキュリティチェック）
        if (userData.companyId !== currentUserDetails.companyId) {
          setError('このユーザーの情報を編集する権限がありません');
          setInitialLoading(false);
          return;
        }
        
        // フォームに値をセット
        setEmail(userData.email || '');
        setDisplayName(userData.displayName || '');
        setEmployeeId(userData.employeeId || '');
        setPhone(userData.phone || '');
        setPosition(userData.position || '');
        setDepartmentId(userData.departmentId || '');
        setUserType(userData.userType || 'employee');
        
        setInitialLoading(false);
      } catch (err) {
        console.error('ユーザーデータ取得エラー:', err);
        setError('ユーザー情報の取得中にエラーが発生しました');
        setInitialLoading(false);
      }
    };
    
    fetchUserData();
  }, [isEditMode, userId, currentUserDetails]);
  
  // フォーム送信ハンドラ
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 入力検証
    if (!email || (!isEditMode && (!password || !confirmPassword))) {
      setError('必須項目を入力してください');
      return;
    }
    
    if (!isEditMode && password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }
    
    if (!isEditMode && password.length < 6) {
      setError('パスワードは6文字以上である必要があります');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      if (isEditMode) {
        // 既存ユーザーの更新
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          displayName,
          employeeId,
          phone,
          position,
          departmentId,
          userType,
          updatedAt: new Date()
        });
        
        // 更新完了後にユーザー詳細ページに戻る
        navigate(`/users/${userId}`);
      } else {
        // 新規ユーザーの作成
        // 1. Firebaseの認証でユーザーを作成
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        // 2. Firestoreにユーザー情報を保存
        await setDoc(doc(db, 'users', newUser.uid), {
          email,
          displayName,
          employeeId,
          phone,
          position,
          departmentId,
          userType,
          companyId: currentUserDetails.companyId,
          createdAt: new Date()
        });
        
        // 登録完了後にユーザー一覧ページに戻る
        navigate('/users');
      }
    } catch (err) {
      console.error('ユーザー保存エラー:', err);
      setError('ユーザー情報の保存中にエラーが発生しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // 初期ロード中
  if (initialLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {isEditMode ? 'ユーザー編集' : '新規ユーザー登録'}
        </h1>
        <button
          onClick={() => navigate(isEditMode ? `/users/${userId}` : '/users')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          {isEditMode ? '詳細に戻る' : '一覧に戻る'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* 基本情報 */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">基本情報</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    メールアドレス *
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isEditMode} // 編集モードではメールアドレス変更不可
                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm border-gray-300 py-2 px-3 border ${
                      isEditMode ? 'bg-gray-100' : 'focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    required
                  />
                  {isEditMode && (
                    <p className="mt-1 text-xs text-gray-500">
                      メールアドレスは編集できません
                    </p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                    表示名
                  </label>
                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
                    従業員ID
                  </label>
                  <input
                    id="employeeId"
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
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
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="departmentId" className="block text-sm font-medium text-gray-700">
                    部門
                  </label>
                  <select
                    id="departmentId"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">-- 部門を選択 --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="userType" className="block text-sm font-medium text-gray-700">
                    ユーザータイプ *
                  </label>
                  <select
                    id="userType"
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  >
                    <option value="employee">従業員</option>
                    <option value="company_admin">管理者</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* パスワード設定 (新規作成時のみ) */}
            {!isEditMode && (
              <div className="border-t pt-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">パスワード設定</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      パスワード *
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      6文字以上のパスワードを設定してください
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                      パスワード (確認) *
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* 送信ボタン */}
            <div className="pt-5">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate(isEditMode ? `/users/${userId}` : '/users')}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                >
                  {loading ? '処理中...' : isEditMode ? '更新する' : '登録する'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UserForm;