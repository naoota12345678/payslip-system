// src/pages/CompanySettings.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, getDocs, deleteDoc, query, where, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function CompanySettings() {
  const { currentUser, userDetails } = useAuth();
  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    address: '',
    phone: '',
    taxId: ''
  });
  const [departments, setDepartments] = useState([]);
  const [newDepartment, setNewDepartment] = useState({ 
    code: '', 
    name: '' 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('company'); // 'company' or 'departments'

  // 会社情報と部門データを読み込む
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        
        const companyId = userDetails?.companyId;
        if (!companyId) {
          console.error("Company ID not available", userDetails);
          setError("会社情報が取得できません。設定を確認してください。");
          setLoading(false);
          return;
        }

        console.log("Loading data for company:", companyId);
        
        // 会社情報を取得
        const companyDocRef = doc(db, "companies", companyId);
        const companyDocSnap = await getDoc(companyDocRef);
        
        if (companyDocSnap.exists()) {
          setCompanyInfo(companyDocSnap.data());
        } else {
          console.log("No company document found");
        }
        
        // 部門データを取得
        const departmentsQuery = query(
          collection(db, "departments"),
          where("companyId", "==", companyId)
        );
        
        const departmentsSnapshot = await getDocs(departmentsQuery);
        const departmentsData = departmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log("Loaded departments:", departmentsData.length);
        setDepartments(departmentsData);
        
        setLoading(false);
      } catch (error) {
        console.error("データ読み込みエラー:", error);
        setError("データの取得中にエラーが発生しました");
        setLoading(false);
      }
    };
    
    if (userDetails) {
      fetchData();
    }
  }, [userDetails]);

  // 会社情報を保存
  const saveCompanyInfo = async () => {
    try {
      const companyId = userDetails?.companyId;
      if (!companyId) {
        setError("会社情報が取得できません");
        return;
      }
      
      // 必須項目のチェック
      if (!companyInfo.name) {
        setError("会社名を入力してください");
        return;
      }
      
      const companyDocRef = doc(db, "companies", companyId);
      
      await updateDoc(companyDocRef, {
        ...companyInfo,
        updatedAt: new Date()
      });
      
      setSuccess("会社情報を保存しました");
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error("会社情報保存エラー:", error);
      setError("会社情報の保存中にエラーが発生しました");
    }
  };

  // 新しい部門を追加
  const addDepartment = async () => {
    try {
      const companyId = userDetails?.companyId;
      if (!companyId) {
        setError("会社情報が取得できないため、部門を追加できません。");
        return;
      }

      if (!newDepartment.code.trim() || !newDepartment.name.trim()) {
        setError("部門コードと部門名を入力してください。");
        return;
      }
      
      // 部門コードの重複チェック
      const existingDept = departments.find(dept => dept.code === newDepartment.code);
      if (existingDept) {
        setError("この部門コードは既に使用されています。");
        return;
      }

      const newDepartmentRef = doc(collection(db, "departments"));
      
      const departmentData = {
        ...newDepartment,
        companyId: companyId,
        createdAt: new Date()
      };
      
      await setDoc(newDepartmentRef, departmentData);
      
      setDepartments([...departments, { id: newDepartmentRef.id, ...departmentData }]);
      // 入力フォームをリセット
      setNewDepartment({ code: '', name: '' });
      setSuccess("部門を追加しました");
      setError('');
    } catch (error) {
      console.error("部門追加エラー:", error);
      setError("部門の追加中にエラーが発生しました。");
    }
  };

  // 部門を削除
  const deleteDepartment = async (id) => {
    if (!window.confirm("この部門を削除しますか？\n※この部門に所属する従業員がいる場合、部門情報が正しく表示されなくなります。")) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, "departments", id));
      setDepartments(departments.filter(dept => dept.id !== id));
      setSuccess("部門を削除しました");
    } catch (error) {
      console.error("部門削除エラー:", error);
      setError("部門の削除中にエラーが発生しました。");
    }
  };

  if (loading) {
    return <div className="text-center p-8">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">会社設定</h1>
      
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
      
      {/* タブ切り替え */}
      <div className="flex border-b mb-6">
        <button
          className={`px-4 py-2 font-medium text-sm mr-2 ${
            activeTab === 'company'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('company')}
        >
          会社情報
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm mr-2 ${
            activeTab === 'departments'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('departments')}
        >
          部門管理
        </button>
      </div>
      
      {/* 会社情報タブ */}
      {activeTab === 'company' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">会社情報設定</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                会社名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyInfo.name || ''}
                onChange={(e) => setCompanyInfo({...companyInfo, name: e.target.value})}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                住所
              </label>
              <input
                type="text"
                value={companyInfo.address || ''}
                onChange={(e) => setCompanyInfo({...companyInfo, address: e.target.value})}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                電話番号
              </label>
              <input
                type="text"
                value={companyInfo.phone || ''}
                onChange={(e) => setCompanyInfo({...companyInfo, phone: e.target.value})}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                法人番号
              </label>
              <input
                type="text"
                value={companyInfo.taxId || ''}
                onChange={(e) => setCompanyInfo({...companyInfo, taxId: e.target.value})}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
          </div>
          
          <button
            onClick={saveCompanyInfo}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      )}
      
      {/* 部門管理タブ */}
      {activeTab === 'departments' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">部門管理</h2>
          
          {/* 新規部門追加フォーム */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                部門コード <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newDepartment.code}
                onChange={(e) => setNewDepartment({...newDepartment, code: e.target.value})}
                placeholder="例: DEPT001"
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                部門名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newDepartment.name}
                onChange={(e) => setNewDepartment({...newDepartment, name: e.target.value})}
                placeholder="例: 営業部"
                className="w-full border rounded-md px-3 py-2"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={addDepartment}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                部門を追加
              </button>
            </div>
          </div>
          
          {/* 部門リスト */}
          {departments.length === 0 ? (
            <p className="text-gray-500 italic">登録されている部門はありません</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    部門コード
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    部門名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {departments.map((dept) => (
                  <tr key={dept.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {dept.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {dept.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => deleteDepartment(dept.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {/* 注意事項 */}
          <div className="bg-yellow-50 p-4 rounded-md mt-6 border border-yellow-200">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">部門管理に関する注意事項</h3>
            <ul className="text-xs text-yellow-700 space-y-1 list-disc pl-5">
              <li>部門コードは社内で一意の値を設定してください</li>
              <li>CSVからのインポート時に部門コードで紐付けが行われます</li>
              <li>部門を削除すると、所属していた従業員の部門情報が正しく表示されなくなります</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompanySettings;