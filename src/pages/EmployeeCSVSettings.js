// src/pages/EmployeeCSVSettings.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

function EmployeeCSVSettings() {
  const { currentUser, userDetails } = useAuth();
  const [csvSettings, setCsvSettings] = useState({
    employeeIdColumn: '',
    departmentCodeColumn: '',
    nameColumn: '',
    emailColumn: '', 
    positionColumn: ''
  });
  const [csvColumns, setCsvColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // データを読み込む
  useEffect(() => {
    const fetchData = async () => {
      try {
        const companyId = userDetails?.companyId;
        if (!companyId) {
          console.error("Company ID not available", userDetails);
          setError("会社情報が取得できません。設定を確認してください。");
          setLoading(false);
          return;
        }

        console.log("Loading CSV settings for company:", companyId);
        
        // CSV設定を取得
        const settingsDoc = await getDoc(doc(db, "csvSettings", companyId));
        if (settingsDoc.exists()) {
          setCsvSettings(settingsDoc.data());
        }
        
        // CSVマッピングからカラム情報を取得
        const csvMappingDoc = await getDoc(doc(db, "csvMappings", companyId));
        if (csvMappingDoc.exists() && csvMappingDoc.data().csvColumns) {
          setCsvColumns(csvMappingDoc.data().csvColumns);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("データ読み込みエラー:", error);
        setError("設定の読み込み中にエラーが発生しました");
        setLoading(false);
      }
    };
    
    if (userDetails) {
      fetchData();
    }
  }, [userDetails]);

  // 設定を保存
  const saveSettings = async () => {
    try {
      const companyId = userDetails?.companyId;
      if (!companyId) {
        setError("会社情報が取得できません");
        return;
      }
      
      // 必須項目のチェック
      if (!csvSettings.employeeIdColumn) {
        setError("従業員番号カラムを選択してください");
        return;
      }
      
      await setDoc(doc(db, "csvSettings", companyId), {
        ...csvSettings,
        updatedAt: new Date()
      });
      
      setSuccess("設定を保存しました");
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error("設定保存エラー:", error);
      setError("設定の保存中にエラーが発生しました");
    }
  };

  if (loading) {
    return <div className="text-center p-8">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">従業員CSV連携設定</h1>
      
      <div className="mb-6">
        <Link 
          to="/employees" 
          className="text-blue-600 hover:text-blue-800"
        >
          ← 従業員管理に戻る
        </Link>
      </div>
      
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
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">CSV連携設定</h2>
        <p className="text-gray-600 mb-4">
          CSVからの従業員情報同期に使用するカラムを設定します。
        </p>
        
        {csvColumns.length === 0 ? (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
            <p>
              CSVカラムが設定されていません。先に
              <Link to="/csv-mapping" className="text-blue-600 underline">CSVマッピング設定</Link>
              で「ヘッダー行を解析」を行ってください。
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  従業員番号カラム <span className="text-red-500">*</span>
                </label>
                <select
                  value={csvSettings.employeeIdColumn || ''}
                  onChange={(e) => setCsvSettings({...csvSettings, employeeIdColumn: e.target.value})}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">--選択してください--</option>
                  {csvColumns.map((column, index) => (
                    <option key={index} value={column}>{column}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  従業員を識別するための番号が含まれるカラム
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  部門コードカラム
                </label>
                <select
                  value={csvSettings.departmentCodeColumn || ''}
                  onChange={(e) => setCsvSettings({...csvSettings, departmentCodeColumn: e.target.value})}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">--選択してください--</option>
                  {csvColumns.map((column, index) => (
                    <option key={index} value={column}>{column}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  部門コードが含まれるカラム
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  氏名カラム
                </label>
                <select
                  value={csvSettings.nameColumn || ''}
                  onChange={(e) => setCsvSettings({...csvSettings, nameColumn: e.target.value})}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">--選択してください--</option>
                  {csvColumns.map((column, index) => (
                    <option key={index} value={column}>{column}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレスカラム
                </label>
                <select
                  value={csvSettings.emailColumn || ''}
                  onChange={(e) => setCsvSettings({...csvSettings, emailColumn: e.target.value})}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">--選択してください--</option>
                  {csvColumns.map((column, index) => (
                    <option key={index} value={column}>{column}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  役職カラム
                </label>
                <select
                  value={csvSettings.positionColumn || ''}
                  onChange={(e) => setCsvSettings({...csvSettings, positionColumn: e.target.value})}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">--選択してください--</option>
                  {csvColumns.map((column, index) => (
                    <option key={index} value={column}>{column}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="pt-4">
              <button
                onClick={saveSettings}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                設定を保存
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-800 mb-2">CSV連携について</h3>
        <ul className="list-disc pl-5 text-sm text-blue-700 space-y-1">
          <li>従業員番号は必須です。CSVファイル内の一意の識別子として使用されます。</li>
          <li>部門コードを設定する場合は、<Link to="/departments" className="underline">部門管理</Link>で事前に部門を登録してください。</li>
          <li>既存の従業員データがある場合、CSVインポート時に同じ従業員番号のデータは上書きされます。</li>
          <li>CSVファイルのエンコーディングはUTF-8を推奨します。</li>
        </ul>
      </div>
    </div>
  );
}

export default EmployeeCSVSettings;