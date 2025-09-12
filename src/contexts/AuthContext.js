// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password, userType, companyId = null, additionalData = {}) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // employees コレクションに保存
      await setDoc(doc(collection(db, 'employees')), {
        uid: user.uid,
        email,
        userType, // 'company_admin' または 'employee'
        companyId,
        employeeId: additionalData.employeeId || `USER_${user.uid.substring(0, 8)}`,
        name: additionalData.name || email.split('@')[0],
        departmentCode: additionalData.departmentCode || '',
        position: additionalData.position || '',
        role: userType === 'company_admin' ? 'admin' : 'employee',
        isActive: true,
        phone: additionalData.phone || '',
        createdAt: new Date()
      });
      
      return user;
    } catch (error) {
      console.error("Error signing up (employees版):", error);
      throw error;
    }
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  async function fetchUserDetails(user) {
    try {
      console.log('=== fetchUserDetails 開始 (employees版) ===');
      console.log('user:', user);
      console.log('user.uid:', user.uid);
      
      // employees コレクションから uid で検索
      const employeeQuery = query(
        collection(db, 'employees'),
        where('uid', '==', user.uid)
      );
      
      const employeeSnapshot = await getDocs(employeeQuery);
      console.log('employeeSnapshot.empty:', employeeSnapshot.empty);
      
      if (!employeeSnapshot.empty) {
        const employeeData = employeeSnapshot.docs[0].data();
        console.log('取得したemployeeData:', employeeData);
        console.log('userType:', employeeData.userType);
        console.log('companyId:', employeeData.companyId);
        console.log('email:', employeeData.email);
        
        // Firebase Auth のメールとFirestore の employee メールが一致することを確認
        if (employeeData.email !== user.email) {
          console.warn('メールアドレスが一致しません:', {
            authEmail: user.email,
            employeeEmail: employeeData.email
          });
        }
        
        setUserDetails(employeeData);
        console.log('userDetailsを設定しました (employees版):', employeeData);
        return employeeData;
      } else {
        console.warn('従業員データが見つかりません。認証を拒否します (uid:', user.uid, ')');
        console.warn('Firebase Authアカウントは存在しますが、対応するFirestore従業員データがありません');
        
        // ユーザーをログアウトさせて適切なログイン画面にリダイレクト
        await signOut(auth);
        setUserDetails(null);
        setCurrentUser(null);
        
        return null;
      }
    } catch (error) {
      console.error("=== fetchUserDetails エラー (employees版) ===");
      console.error("エラーオブジェクト:", error);
      console.error("エラーコード:", error.code);
      console.error("エラーメッセージ:", error.message);
      
      // 権限エラーまたは認証エラーの場合はログアウト
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'permission-denied' ||
          error.message?.includes('Missing or insufficient permissions')) {
        console.warn('認証エラーまたは権限エラー - ユーザーをログアウト');
        try {
          await signOut(auth);
          setCurrentUser(null);
        } catch (signOutError) {
          console.error('ログアウトエラー:', signOutError);
        }
      }
      
      setUserDetails(null);
      return null;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 AuthContext: 認証状態変更検出');
      console.log('   - user:', user ? `${user.email} (${user.uid})` : 'null');
      
      setCurrentUser(user);
      
      if (user) {
        try {
          console.log('📋 AuthContext: ユーザー詳細取得開始');
          
          // モバイルデバイスの場合は遅延を追加
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) {
            console.log('📱 モバイルデバイス検出 - 認証トークン同期のため待機');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          const details = await fetchUserDetails(user);
          console.log('✅ AuthContext: ユーザー詳細取得完了:', details);
        } catch (error) {
          console.error('❌ AuthContext: ユーザー詳細取得失敗:', error);
          
          // 権限エラーの場合はリトライ
          if (error.message && error.message.includes('Missing or insufficient permissions')) {
            console.log('🔄 権限エラー検出 - 3秒後にリトライ');
            setTimeout(async () => {
              try {
                const details = await fetchUserDetails(user);
                console.log('✅ リトライ成功:', details);
              } catch (retryError) {
                console.error('❌ リトライも失敗:', retryError);
                setUserDetails(null);
              }
            }, 3000);
          } else {
            setUserDetails(null);
          }
        }
      } else {
        console.log('🚪 AuthContext: ログアウト状態 - userDetailsをクリア');
        setUserDetails(null);
        
        // ログアウト時にホームページにリダイレクト（携帯対応）
        if (window.location.pathname !== '/' && 
            window.location.pathname !== '/admin/login' && 
            window.location.pathname !== '/employee/login') {
          console.log('🏠 ログアウト検出 - ホームページにリダイレクト');
          window.location.replace('/');
        }
      }
      
      setLoading(false);
      console.log('🏁 AuthContext: loading完了');
    });

    return unsubscribe;
  }, []);

  // register関数を追加（signupのエイリアス）
  function register(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  const value = {
    currentUser,
    userDetails,
    signup,
    register,
    login,
    logout,
    resetPassword,
    fetchUserDetails
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}