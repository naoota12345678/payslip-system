// src/pages/DepartmentManagement.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function DepartmentManagement() {
  const { userDetails } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [newDepartment, setNewDepartment] = useState({ 
    code: '', 
    name: '',
    isActive: true
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 部門データを読み込む
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const companyId = userDetails?.companyId;
        if (!companyId) {
          setError("会社情報が取得できません。設定を確認してください。");
          setLoading(false);
          return;
        }
        
        const q = query(
          collection(db, "departments"),
          where("companyId", "==", companyId)
        );
        const snapshot = await getDocs(q);
        const deptData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setDepartments(deptData);
      } catch (error) {
        console.error("部門データの読み込みエラー:", error);
        setError("部門データの読み込み中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    if (userDetails) {
      fetchDepartments();
    }
  }, [userDetails]);

  // 新しい部門を追加
  const addDepartment = async () => {
    try {
      const companyId = userDetails?.companyId;
      if (!companyId) {
        setError("会社情報が取得できないため、部門を追加できません。");
        return;
      }

      // 既存の部門コードとの重複チェック
      const duplicate = departments.find(dept => dept.code === newDepartment.code);
      if (duplicate) {
        setError("この部門コードは既に使用されています。");
        return;
      }

      const newDeptRef = doc(collection(db, "departments"));
      const departmentData = {
        ...newDepartment,
        companyId: companyId,
        createdAt: new Date()
      };
      
      await setDoc(newDeptRef, departmentData);
      
      setDepartments([...departments, { id: newDeptRef.id, ...departmentData }]);
      setNewDepartment({ code: '', name: '', isActive: true });
      setSuccess("部門を追加しました");
    } catch (error) {
      console.error("部門の追加エラー:", error);
      setError("部門の追加中にエラーが発生しました。");
    }
  };

  // 部門を削除
  const deleteDepartment = async (id) => {
    if (!window.confirm('この部門を削除してもよろしいですか？')) return;
    
    try {
      await deleteDoc(doc(db, "departments", id));
      setDepartments(departments.filter(dept => dept.id !== id));
      setSuccess("部門を削除しました");
    } catch (error) {
      console.error("部門の削除エラー:", error);
      setError("部門の削除中にエラーが発生しました。");
    }
  };

  // 部門の有効/無効を切り替え
  const toggleStatus = async (id, currentStatus) => {
    try {
      await setDoc(doc(db, "departments", id), 
        { isActive: !currentStatus }, 
        { merge: true }
      );
      
      setDepartments(departments.map(dept => 
        dept.id === id ? { ...dept, isActive: !currentStatus } : dept
      ));
      
      setSuccess(`部門を${!currentStatus ? '有効' : '無効'}にしました`);
    } catch (error) {
      console.error("部門ステータス更新エラー:", error);
      setError("部門の更新中にエラーが発生しました。");
    }
  };

  if (loading) {
    return <div className="text-center p-8">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">部門管理</h1>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6">
          <p>{success}</p>
        </div>
      )}
      
      {/* 新規部門追加フォーム */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">新規部門追加</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">部門コード</label>
            <input
              type="text"
              value={newDepartment.code}
              onChange={(e) => setNewDepartment({...newDepartment, code: e.target.value})}
              className="w-full border rounded-md px-3 py-2"
              placeholder="例: D001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">部門名</label>
            <input
              type="text"
              value={newDepartment.name}
              onChange={(e) => setNewDepartment({...newDepartment, name: e.target.value})}
              className="w-full border rounded-md px-3 py-2"
              placeholder="例: 営業部"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={addDepartment}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              disabled={!newDepartment.code || !newDepartment.name}
            >
              追加
            </button>
          </div>
        </div>
      </div>
      
      {/* 部門リスト */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">登録済み部門</h2>
        
        {departments.length === 0 ? (
          <p className="text-gray-500 italic">部門が登録されていません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-2 px-4 border text-left">部門コード</th>
                  <th className="py-2 px-4 border text-left">部門名</th>
                  <th className="py-2 px-4 border text-center">ステータス</th>
                  <th className="py-2 px-4 border text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td className="py-2 px-4 border">{dept.code}</td>
                    <td className="py-2 px-4 border">{dept.name}</td>
                    <td className="py-2 px-4 border text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        dept.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {dept.isActive ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="py-2 px-4 border text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button 
                          onClick={() => toggleStatus(dept.id, dept.isActive)}
                          className={`text-sm px-2 py-1 rounded ${
                            dept.isActive 
                              ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' 
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {dept.isActive ? '無効にする' : '有効にする'}
                        </button>
                        <button 
                          onClick={() => deleteDepartment(dept.id)}
                          className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DepartmentManagement;