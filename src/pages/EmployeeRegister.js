// src/pages/EmployeeRegister.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

function EmployeeRegister() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const { userDetails } = useAuth();

  useEffect(() => {
    if (userDetails && userDetails.companyId) {
      setCompanyId(userDetails.companyId);
    }
  }, [userDetails]);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!companyId) {
      return setError('会社情報が取得できません');
    }
    
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      
      // メールアドレスが既に使用されているか確認
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return setError('このメールアドレスは既に使用されています');
      }
      
      // 従業員データを追加
      await addDoc(collection(db, `companies/${companyId}/employees`), {
        email,
        name,
        department,
        position,
        employeeId,
        createdAt: new Date()
      });
      
      // フォームをリセット
      setEmail('');
      setName('');
      setDepartment('');
      setPosition('');
      setEmployeeId('');
      setSuccess('従業員情報を登録しました');
    } catch (error) {
      setError('従業員登録に失敗しました: ' + error.message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">従業員登録</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
            氏名
          </label>
          <input
            id="name"
            type="text"
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="employee-id">
            社員番号
          </label>
          <input
            id="employee-id"
            type="text"
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="department">
            部署
          </label>
          <input
            id="department"
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="position">
            役職
          </label>
          <input
            id="position"
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {loading ? '登録中...' : '従業員を登録'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EmployeeRegister;