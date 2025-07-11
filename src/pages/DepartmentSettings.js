// src/pages/DepartmentSettings.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function DepartmentSettings() {
  const navigate = useNavigate();
  const { userDetails } = useAuth();
  
  // 部門リスト
  const [departments, setDepartments] = useState([]);
  
  // 編集中の部門
  const [editingDept, setEditingDept] = useState(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptDescription, setDeptDescription] = useState('');
  
  // UI状態
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 部門データの取得
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!userDetails?.companyId) {
        setError('会社情報が取得できませんでした');
        setLoading(false);
        return;
      }
      
      try {
        const deptsQuery = query(
          collection(db, 'departments'),
          where('companyId', '==', userDetails.companyId)
        );
        
        const snapshot = await getDocs(deptsQuery);
        
        const deptsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // 部門コード順にソート
        deptsList.sort((a, b) => {
          if (a.code && b.code) {
            return a.code.localeCompare(b.code);
          }
          return 0;
        });
        
        setDepartments(deptsList);
        setLoading(false);
      } catch (err) {
        console.error('部門データ取得エラー:', err);
        setError('部門データの取得中にエラーが発生しました');
        setLoading(false);
      }
    };
    
    fetchDepartments();
  }, [userDetails]);
  
  // 編集モードの開始
  const startEdit = (dept) => {
    setEditingDept(dept);
    setDeptName(dept.name || '');
    setDeptCode(dept.code || '');
    setDeptDescription(dept.description || '');
  };
  
  // 編集モードのキャンセル
  const cancelEdit = () => {
    setEditingDept(null);
    setDeptName('');
    setDeptCode('');
    setDeptDescription('');
  };
  
  // 新規部門の追加
  const handleAddDepartment = async () => {
    if (!deptName || !deptCode) {
      setError('部門名と部門コードは必須項目です');
      return;
    }
    
    if (!userDetails?.companyId) {
      setError('会社情報が取得できませんでした');
      return;
    }
    
    try {
      setError('');
      setSuccess('');
      
      // 部門コードの重複チェック
      const duplicateCheck = departments.find(dept => 
        dept.code === deptCode && (!editingDept || dept.id !== editingDept.id)
      );
      
      if (duplicateCheck) {
        setError(`部門コード「${deptCode}」は既に使用されています`);
        return;
      }
      
      if (editingDept) {
        // 既存部門の更新
        await updateDoc(doc(db, 'departments', editingDept.id), {
          name: deptName,
          code: deptCode,
          description: deptDescription,
          updatedAt: new Date()
        });
        
        // 部門リストを更新
        setDepartments(prev => prev.map(dept => 
          dept.id === editingDept.id 
            ? { 
                ...dept, 
                name: deptName, 
                code: deptCode, 
                description: deptDescription,
                updatedAt: new Date()
              } 
            : dept
        ));
        
        setSuccess('部門情報を更新しました');
      } else {
        // 新規部門の作成
        const newDeptRef = doc(collection(db, 'departments'));
        
        const newDept = {
          name: deptName,
          code: deptCode,
          description: deptDescription,
          companyId: userDetails.companyId,
          createdAt: new Date()
        };
        
        await setDoc(newDeptRef, newDept);
        
        // 部門リストに追加
        setDepartments(prev => [
          ...prev, 
          { 
            id: newDeptRef.id, 
            ...newDept
          }
        ]);
        
        setSuccess('新しい部門を追加しました');
      }
      
      // フォームをリセット
      cancelEdit();
      
      // 少し待ってから成功メッセージをクリア
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('部門保存エラー:', err);
      setError('部門の保存中にエラーが発生しました: ' + (err.message || 'エラーが発生しました'));
    }
  };
  
  // 部門の削除
  const handleDeleteDepartment = async (deptId) => {
    // 削除の確認
    if (!window.confirm('この部門を削除してもよろしいですか？関連する従業員データに影響する可能性があります。')) {
      return;
    }
    
    try {
      setError('');
      setSuccess('');
      
      // Firestoreから部門を削除
      await deleteDoc(doc(db, 'departments', deptId));
      
      // 部門リストを更新
      setDepartments(prev => prev.filter(dept => dept.id !== deptId));
      
      setSuccess('部門を削除しました');
      
      // 少し待ってから成功メッセージをクリア
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('部門削除エラー:', err);
      setError('部門の削除中にエラーが発生しました: ' + (err.message || 'エラーが発生しました'));
    }
  };
  
  // 日付フォーマット関数
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('ja-JP');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">データを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">部門設定</h1>
        <button
          onClick={() => navigate('/settings')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          システム設定に戻る
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          {success}
        </div>
      )}
      
      {/* 部門追加/編集フォーム */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingDept ? '部門の編集' : '新しい部門を追加'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="deptName" className="block text-sm font-medium text-gray-700 mb-1">
                部門名 *
              </label>
              <input
                type="text"
                id="deptName"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
                required
              />
            </div>
            
            <div>
              <label htmlFor="deptCode" className="block text-sm font-medium text-gray-700 mb-1">
                部門コード *
              </label>
              <input
                type="text"
                id="deptCode"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
                required
              />
            </div>
            
            <div>
              <label htmlFor="deptDescription" className="block text-sm font-medium text-gray-700 mb-1">
                説明
              </label>
              <input
                type="text"
                id="deptDescription"
                value={deptDescription}
                onChange={(e) => setDeptDescription(e.target.value)}
                className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            {editingDept && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                キャンセル
              </button>
            )}
            <button
              type="button"
              onClick={handleAddDepartment}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {editingDept ? '更新' : '追加'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 部門一覧 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">部門一覧</h2>
          
          {departments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      部門コード
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      部門名
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      説明
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      作成日
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {departments.map(dept => (
                    <tr key={dept.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{dept.code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{dept.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">{dept.description || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatDate(dept.createdAt?.toDate?.())}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => startEdit(dept)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDeleteDepartment(dept.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              部門が登録されていません。新しい部門を追加してください。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default DepartmentSettings;