// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  async function signup(email, password, userType, companyId = null) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // ユーザー情報をFirestoreに保存
      await setDoc(doc(db, 'users', user.uid), {
        email,
        userType, // 'company_admin' または 'employee'
        companyId,
        createdAt: new Date()
      });
      
      return user;
    } catch (error) {
      console.error("Error signing up:", error);
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
      console.log('=== fetchUserDetails 開始 ===');
      console.log('user:', user);
      console.log('user.uid:', user.uid);
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      console.log('userDoc.exists():', userDoc.exists());
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('取得したuserData:', userData);
        console.log('userType:', userData.userType);
        console.log('companyId:', userData.companyId);
        console.log('email:', userData.email);
        
        setUserDetails(userData);
        console.log('userDetailsを設定しました:', userData);
        return userData;
      } else {
        console.error('ユーザー詳細が見つかりません');
        setUserDetails(null);
        return null;
      }
    } catch (error) {
      console.error("=== fetchUserDetails エラー ===");
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