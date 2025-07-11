// src/pages/InitialSetup.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

function InitialSetup() {
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    // 既にセットアップ済みかチェック
    const checkSetup = async () => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          navigate('/');
        }
      }
    };
    checkSetup();
  }, [currentUser, navigate]);

  const handleSetup = async (e) => {
    e.preventDefault();
    
    if (!companyName.trim()) {
      setError('会社名を入力してください');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // ユーザー情報を作成
      await setDoc(doc(db, 'users', currentUser.uid), {
        email: currentUser.email,
        userType: 'company',
        companyId: currentUser.uid,
        companyName: companyName,
        displayName: companyName,
        createdAt: new Date(),
        isActive: true
      });

      // 会社情報を作成
      await setDoc(doc(db, 'companies', currentUser.uid), {
        name: companyName,
        ownerId: currentUser.uid,
        createdAt: new Date(),
        isActive: true
      });

      navigate('/');
    } catch (err) {
      console.error('初期設定エラー:', err);
      setError('初期設定に失敗しました。もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            初期設定
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            会社情報を入力してください
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSetup}>
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
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {loading ? '設定中...' : '設定を完了'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InitialSetup;
