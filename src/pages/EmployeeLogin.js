// src/pages/EmployeeLogin.js
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

function EmployeeLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!email || !password) {
      return setError('メールアドレスとパスワードを入力してください');
    }
    
    try {
      setError('');
      setLoading(true);
      
      console.log('🔍 従業員ログイン試行:', { email });
      
      // 1. Firestoreで従業員情報を確認
      const employeesQuery = query(
        collection(db, 'employees'),
        where('email', '==', email.toLowerCase().trim())
      );
      const employeesSnapshot = await getDocs(employeesQuery);
      
      if (employeesSnapshot.empty) {
        throw new Error('メールアドレスが登録されていません。システム管理者にお問い合わせください。');
      }
      
      const employeeDoc = employeesSnapshot.docs[0];
      const employeeData = employeeDoc.data();
      const employeeDocId = employeeDoc.id;
      
      console.log('✅ 従業員情報確認完了:', { 
        employeeId: employeeData.employeeId,
        name: employeeData.name,
        isFirstLogin: employeeData.isFirstLogin
      });
      
      let user;
      
      // 2. 初回ログイン or 既存ユーザーかを判定
      if (employeeData.isFirstLogin === true) {
        // 初回ログイン：仮パスワードをチェック
        if (password !== employeeData.tempPassword) {
          throw new Error('仮パスワードが正しくありません。管理者から受け取った仮パスワードを入力してください。');
        }
        
        console.log('🔧 初回ログイン：Firebase Authユーザーを作成中...');
        
        // Firebase Authユーザーを作成
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        
                 // Firestoreにuidを追加し、初回ログインフラグを更新
         await updateDoc(doc(db, 'employees', employeeDocId), {
           uid: user.uid,
           isFirstLogin: false,
           status: 'active', // ステータスをアクティブに更新
           tempPassword: null, // 仮パスワードを削除
           activatedAt: new Date(),
           updatedAt: new Date()
         });
        
        console.log('✅ Firebase Authユーザー作成完了:', user.uid);
        console.log('🔄 パスワード変更画面へリダイレクト');
        navigate('/employee/change-password?first=true');
        return;
        
      } else {
        // 既存ユーザー：通常のログイン
        console.log('🔍 既存ユーザーでFirebase認証試行');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        console.log('✅ Firebase認証成功:', user.uid);
      }
      
      // 3. ダッシュボードへリダイレクト
      console.log('✅ 従業員ログイン完了');
      navigate('/employee/dashboard');
      
    } catch (error) {
      console.error('❌ 従業員ログインエラー:', error);
      
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
        default:
          errorMessage = error.message || 'ログインに失敗しました';
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">従業員ログイン</h1>
          <p className="text-gray-600">給与明細システムにアクセス</p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
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
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              パスワード <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
            />
            <p className="text-sm text-gray-500 mt-1">
              初回ログイン用のパスワードは管理者から受け取ってください
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full disabled:opacity-50"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>
        </form>
        
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600 mb-2">
            パスワードを忘れた場合は{' '}
            <Link to="/employee/forgot-password" className="text-blue-600 hover:text-blue-800">
              こちら
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

export default EmployeeLogin; 