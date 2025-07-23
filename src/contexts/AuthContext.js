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
        console.warn('従業員データが見つかりません。管理者として自動作成します (uid:', user.uid, ')');
        
        // 管理者ユーザーとして自動作成
        const autoAdminData = {
          uid: user.uid,
          email: user.email,
          name: user.email.split('@')[0] || '管理者',
          employeeId: `ADMIN_${user.uid.substring(0, 8)}`,
          position: '管理者',
          userType: 'company_admin',
          role: 'admin',
          companyId: user.uid, // 自分のUIDを会社IDとして使用
          departmentCode: '',
          phone: '',
          isActive: true,
          createdAt: new Date()
        };
        
        try {
          const docRef = await addDoc(collection(db, 'employees'), autoAdminData);
          console.log('✅ 管理者ユーザーを自動作成しました:', docRef.id);
          
          setUserDetails(autoAdminData);
          return autoAdminData;
        } catch (createError) {
          console.error('❌ 管理者ユーザー自動作成エラー:', createError);
          setUserDetails(null);
          return null;
        }
      }
    } catch (error) {
      console.error("=== fetchUserDetails エラー (employees版) ===");
      console.error("エラーオブジェクト:", error);
      console.error("エラーコード:", error.code);
      console.error("エラーメッセージ:", error.message);
      setUserDetails(null);
      return null;
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('認証状態の変更を検出しました:', user ? `ユーザー: ${user.email}` : 'ログアウト状態');
      setCurrentUser(user);
      if (user) {
        try {
          const details = await fetchUserDetails(user);
          console.log('ユーザー詳細の取得完了:', details);
        } catch (error) {
          console.error('ユーザー詳細の取得に失敗:', error);
        }
      } else {
        setUserDetails(null);
      }
      setLoading(false);
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