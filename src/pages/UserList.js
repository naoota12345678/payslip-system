// src/pages/UserList.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function UserList() {
  const { userDetails } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'admin', 'employee'

  useEffect(() => {
    const fetchUsers = async () => {
      if (!userDetails?.companyId) {
        setError('会社情報が取得できませんでした');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // 会社に所属するユーザーを取得
        const usersQuery = query(
          collection(db, 'users'),
          where('companyId', '==', userDetails.companyId)
        );
        
        const snapshot = await getDocs(usersQuery);
        
        const usersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.()
        }));
        
        setUsers(usersList);
        setLoading(false);
      } catch (err) {
        console.error('ユーザー一覧取得エラー:', err);
        setError('ユーザー情報の取得中にエラーが発生しました');
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [userDetails]);
  
  // 検索とフィルタリング
  const filteredUsers = users.filter(user => {
    // 検索条件
    const searchMatch = searchTerm === '' || 
      (user.displayName && user.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.employeeId && user.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // ロールフィルター
    const roleMatch = filter === 'all' || 
      (filter === 'admin' && (user.userType === 'company_admin' || user.role === 'admin')) ||
      (filter === 'employee' && user.userType === 'employee');
    
    return searchMatch && roleMatch;
  });
  
  // ユーザー種別表示用
  const getUserTypeDisplay = (user) => {
    if (user.userType === 'company_admin' || user.role === 'admin') {
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
          管理者
        </span>
      );
    } else {
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
          従業員
        </span>
      );
    }
  };
  
  // 日付フォーマット関数
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('ja-JP');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ユーザー管理</h1>
        <Link
          to="/users/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          新規ユーザー作成
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}
      
      {/* 検索とフィルターセクション */}
      <div className="bg-white p-4 rounded-md shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              検索
            </label>
            <input
              type="text"
              id="search"
              placeholder="名前、メール、IDで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="filter" className="block text-sm font-medium text-gray-700 mb-1">
              ユーザータイプ
            </label>
            <select
              id="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="all">すべて</option>
              <option value="admin">管理者のみ</option>
              <option value="employee">従業員のみ</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* ユーザー一覧 */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <li key={user.id}>
                <Link to={`/users/${user.id}`} className="block hover:bg-gray-50">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-500 font-semibold">
                            {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">
                            {user.displayName || user.email}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {getUserTypeDisplay(user)}
                        <svg className="ml-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        {user.employeeId && (
                          <p className="flex items-center text-sm text-gray-500 mr-6">
                            <span>従業員ID: {user.employeeId}</span>
                          </p>
                        )}
                        {user.departmentName && (
                          <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <span>部門: {user.departmentName}</span>
                          </p>
                        )}
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        <span>登録日: {formatDate(user.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-md shadow text-center">
          <p className="text-gray-500">表示するユーザーがありません</p>
        </div>
      )}
    </div>
  );
}

export default UserList;