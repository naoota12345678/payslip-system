// src/pages/EmployeeManagement.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDocs, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

function EmployeeManagement() {
  const { currentUser, userDetails } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 従業員と部門データを読み込む
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
        
        // 従業員データを取得
        const employeesQuery = query(
          collection(db, "employees"),
          where("companyId", "==", companyId)
        );
        
        const employeesSnapshot = await getDocs(employeesQuery);
        const employeesData = employeesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log("Loaded employees:", employeesData.length);
        setEmployees(employeesData);
        
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

  // 従業員を削除
  const deleteEmployee = async (employeeId) => {
    if (!window.confirm("本当に削除しますか？")) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, "employees", employeeId));
      setEmployees(employees.filter(emp => emp.id !== employeeId));
      setSuccess("従業員を削除しました");
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error("従業員削除エラー:", error);
      setError("従業員の削除中にエラーが発生しました");
    }
  };

  // 部門名を取得
  const getDepartmentName = (departmentId) => {
    const department = departments.find(dept => dept.id === departmentId);
    return department ? department.name : '-';
  };

  if (loading) {
    return <div className="text-center p-8">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">従業員管理</h1>
      
      <div className="flex justify-end mb-6">
        <Link 
          to="/admin/employees/new" 
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
        >
          新規従業員登録
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
      
      {/* CSVアップロード */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-bold mb-4">従業員データCSVアップロード</h2>
        <p className="text-gray-600 mb-4">
          従業員データをCSVファイルで一括登録・更新します。
          従業員番号が一致するデータは更新され、新しい従業員番号は新規登録されます。
        </p>
        
        <CSVUploadForm companyId={userDetails?.companyId} setError={setError} setSuccess={setSuccess} />
      </div>
      
      {/* 従業員リスト */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                社員番号
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                氏名
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                メールアドレス
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                部門
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                役職
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                  登録されている従業員はいません
                </td>
              </tr>
            ) : (
              employees.map(employee => (
                <tr 
                  key={employee.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => window.location.href = `/admin/employees/${employee.id}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.employeeId || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    {employee.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.email || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.departmentId ? getDepartmentName(employee.departmentId) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.position || '-'}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link
                      to={`/admin/employees/${employee.id}`}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      詳細
                    </Link>
                    <Link
                      to={`/admin/employees/${employee.id}/edit`}
                      className="text-green-600 hover:text-green-800 mr-3"
                    >
                      編集
                    </Link>
                    <button
                      onClick={() => deleteEmployee(employee.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// CSVアップロードフォームコンポーネント - 改善版
function CSVUploadForm({ companyId, setError, setSuccess }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [previewData, setPreviewData] = useState(null);
    const [importResult, setImportResult] = useState(null);
    
    // 部門データを読み込む
    useEffect(() => {
      const fetchDepartments = async () => {
        try {
          if (!companyId) return;
          
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
          
          setDepartments(departmentsData);
        } catch (error) {
          console.error("部門データ取得エラー:", error);
          setError("部門データの取得中にエラーが発生しました");
        }
      };
      
      fetchDepartments();
    }, [companyId, setError]);
    
    const handleFileChange = (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile) {
        setFile(selectedFile);
        // ファイルが選択されたらプレビュー表示
        previewCSV(selectedFile);
      }
    };
    
    // CSVファイルのプレビュー表示
    const previewCSV = (file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const csvData = event.target.result;
          const lines = csvData.split('\n');
          
          if (lines.length < 2) {
            setError("CSVファイルに十分なデータがありません");
            setPreviewData(null);
            return;
          }
          
          // ヘッダー行を取得（カンマまたはタブ区切り）
          const headers = lines[0].split(/[,\t]/).map(h => h.trim());
          
          // データ行を解析（最大3行表示）
          const rows = [];
          for (let i = 1; i < Math.min(lines.length, 4); i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(/[,\t]/).map(v => v.trim());
            if (values.length >= headers.length) {
              const row = {};
              headers.forEach((header, index) => {
                row[header] = values[index];
              });
              rows.push(row);
            }
          }
          
          setPreviewData({ headers, rows });
          setError('');
        } catch (error) {
          console.error("CSVプレビューエラー:", error);
          setError("CSVファイルの解析中にエラーが発生しました");
          setPreviewData(null);
        }
      };
      
      reader.onerror = () => {
        setError("ファイルの読み込みに失敗しました");
        setPreviewData(null);
      };
      
      reader.readAsText(file);
    };
    
    const handleUpload = async (e) => {
      e.preventDefault();
      
      if (!file) {
        setError("アップロードするCSVファイルを選択してください");
        return;
      }
      
      if (!companyId) {
        setError("会社情報が取得できません");
        return;
      }
      
      // CSVファイルのMIMEタイプチェック
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setError("CSVファイル形式のみアップロード可能です");
        return;
      }
      
      try {
        setUploading(true);
        setImportResult(null);
        
        // ファイルを読み込む
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const csvData = event.target.result;
            
            // CSVデータを処理
            const result = await processCSV(csvData, companyId, departments);
            
            setFile(null);
            setPreviewData(null);
            setImportResult(result);
            setSuccess(`従業員データを更新しました（新規: ${result.created}件、更新: ${result.updated}件）`);
            
            // 画面をリロードして最新データを表示（少し遅延させる）
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } catch (error) {
            console.error("データ処理エラー:", error);
            setError(`CSVデータの処理中にエラーが発生しました: ${error.message}`);
          } finally {
            setUploading(false);
          }
        };
        
        reader.onerror = () => {
          setError("ファイルの読み込みに失敗しました");
          setUploading(false);
        };
        
        reader.readAsText(file);
      } catch (error) {
        console.error("CSVアップロードエラー:", error);
        setError(`CSVアップロード中にエラーが発生しました: ${error.message}`);
        setUploading(false);
      }
    };
    
    // CSVデータを処理する関数
    const processCSV = async (csvData, companyId, departments) => {
      // CSVのヘッダー行とデータ行を分割
      const lines = csvData.split('\n');
      if (lines.length < 2) {
        throw new Error("CSVデータが不正です");
      }
      
      // ヘッダー行を取得（カンマまたはタブ区切り）
      const headers = lines[0].split(/[,\t]/).map(h => h.trim());
      
      // 必要なカラムのインデックスを取得
      const employeeIdIndex = headers.indexOf('社員番号');
      const nameIndex = headers.indexOf('氏名');
      const emailIndex = headers.indexOf('メールアドレス');
      const departmentCodeIndex = headers.indexOf('部署コード');
      
      // オプションカラムのインデックスを取得
      const positionIndex = headers.indexOf('役職');
      const jobTypeIndex = headers.indexOf('職種');
      const contractTypeIndex = headers.indexOf('契約形態');
      const genderIndex = headers.indexOf('性別');
      const birthDateIndex = headers.indexOf('生年月日');
      const hireDateIndex = headers.indexOf('入社日');
      
      // 社員番号カラムは必須
      if (employeeIdIndex === -1) {
        throw new Error("「社員番号」カラムが見つかりません");
      }
      
      // 部門コードから部門IDへのマッピングを作成
      const departmentMap = {};
      departments.forEach(dept => {
        departmentMap[dept.code] = dept.id;
      });
      
      // 既存の従業員データを取得
      const existingEmployeesQuery = query(
        collection(db, "employees"),
        where("companyId", "==", companyId)
      );
      const existingEmployeesSnapshot = await getDocs(existingEmployeesQuery);
      const existingEmployees = {};
      existingEmployeesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        existingEmployees[data.employeeId] = {
          id: doc.id,
          ...data
        };
      });
      
      // インポート結果カウント
      const result = {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: []
      };
      
      // バッチ処理用
      const batch = writeBatch(db);
      
      // データ行を処理
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // 空行をスキップ
        
        try {
          const values = line.split(/[,\t]/).map(v => v.trim());
          
          // 従業員IDが空の場合はスキップ
          const employeeId = values[employeeIdIndex];
          if (!employeeId) {
            result.skipped++;
            continue;
          }
          
          // 従業員データを作成
          const employee = {
            employeeId,
            companyId,
            updatedAt: new Date()
          };
          
          // 氏名が設定されていれば追加
          if (nameIndex !== -1 && values[nameIndex]) {
            employee.name = values[nameIndex];
          }
          
          // メールアドレスが設定されていれば追加
          if (emailIndex !== -1 && values[emailIndex]) {
            employee.email = values[emailIndex];
          }
          
          // 部門コードが設定されていれば部門IDに変換
          if (departmentCodeIndex !== -1 && values[departmentCodeIndex]) {
            const deptCode = values[departmentCodeIndex];
            if (departmentMap[deptCode]) {
              employee.departmentId = departmentMap[deptCode];
            }
          }
          
          // オプションフィールドを追加
          if (positionIndex !== -1 && values[positionIndex]) {
            employee.position = values[positionIndex];
          }
          
          if (jobTypeIndex !== -1 && values[jobTypeIndex]) {
            employee.jobType = values[jobTypeIndex];
          }
          
          if (contractTypeIndex !== -1 && values[contractTypeIndex]) {
            employee.contractType = values[contractTypeIndex];
          }
          
          if (genderIndex !== -1 && values[genderIndex]) {
            employee.gender = parseInt(values[genderIndex]);
          }
          
          if (birthDateIndex !== -1 && values[birthDateIndex]) {
            employee.birthDate = values[birthDateIndex];
          }
          
          if (hireDateIndex !== -1 && values[hireDateIndex]) {
            employee.hireDate = values[hireDateIndex];
          }
          
          // 既存従業員の更新または新規従業員の追加
          if (existingEmployees[employeeId]) {
            // 既存従業員を更新
            const docRef = doc(db, "employees", existingEmployees[employeeId].id);
            batch.update(docRef, employee);
            result.updated++;
          } else {
            // 新規従業員を追加
            const docRef = doc(collection(db, "employees"));
            employee.createdAt = new Date();
            batch.set(docRef, employee);
            result.created++;
          }
        } catch (error) {
          console.error(`行 ${i+1} の処理エラー:`, error);
          result.errors.push(`行 ${i+1}: ${error.message}`);
          result.skipped++;
        }
      }
      
      // バッチ処理を実行
      await batch.commit();
      
      return result;
    };
    
    return (
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CSVファイル
          </label>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
                     file:mr-4 file:py-2 file:px-4
                     file:rounded-md file:border-0
                     file:text-sm file:font-semibold
                     file:bg-blue-50 file:text-blue-700
                     hover:file:bg-blue-100"
          />
          <p className="mt-1 text-xs text-gray-500">CSVファイル（UTF-8）を選択してください</p>
        </div>
        
        {previewData && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">CSVプレビュー</h3>
            <div className="overflow-x-auto border rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {previewData.headers.map((header, index) => (
                      <th key={index} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {previewData.headers.map((header, colIndex) => (
                        <td key={colIndex} className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {row[header] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {previewData.rows.length}行表示 (最大3行)
            </p>
          </div>
        )}
        
        <div className="pt-2">
          <button
            type="submit"
            disabled={!file || uploading}
            className={`px-4 py-2 rounded-md text-white ${
              !file || uploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {uploading ? 'アップロード中...' : 'アップロード'}
          </button>
        </div>
        
        {importResult && (
          <div className="mt-4 p-3 bg-green-50 rounded-md">
            <h3 className="text-sm font-medium text-green-800 mb-2">インポート結果</h3>
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="bg-white p-2 rounded text-center">
                <p className="text-xs text-gray-500">新規登録</p>
                <p className="text-lg font-bold text-green-600">{importResult.created}</p>
              </div>
              <div className="bg-white p-2 rounded text-center">
                <p className="text-xs text-gray-500">更新</p>
                <p className="text-lg font-bold text-blue-600">{importResult.updated}</p>
              </div>
              <div className="bg-white p-2 rounded text-center">
                <p className="text-xs text-gray-500">スキップ</p>
                <p className="text-lg font-bold text-yellow-600">{importResult.skipped}</p>
              </div>
            </div>
            {importResult.errors.length > 0 && (
              <div className="mt-2">
                <h4 className="text-xs font-medium text-red-700 mb-1">エラー ({importResult.errors.length}件)</h4>
                <div className="max-h-32 overflow-y-auto bg-white p-2 rounded text-xs text-red-600">
                  <ul className="list-disc list-inside">
                    {importResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="bg-blue-50 p-4 rounded-md mt-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">CSVファイル形式</h3>
          <p className="text-xs text-blue-700 mb-2">
            CSVファイルの1行目には以下のようなヘッダーを含めてください：
          </p>
          <div className="bg-white p-2 rounded text-xs font-mono text-gray-600 mb-2 overflow-x-auto">
            社員番号,氏名,メールアドレス,部署コード,役職,職種,契約形態,性別,生年月日,入社日
          </div>
          <ul className="text-xs text-blue-700 space-y-1 list-disc pl-5">
            <li><strong>必須項目</strong>: 社員番号（既存の社員番号と一致する場合は更新、新規の場合は登録）</li>
            <li>氏名、メールアドレスは設定することをお勧めします</li>
            <li>部署コードは会社設定の部門管理で登録した部門コードと一致する必要があります</li>
            <li>カンマ区切りまたはタブ区切りのCSVファイルに対応しています</li>
            <li>UTF-8エンコードのCSVファイルを使用してください</li>
          </ul>
        </div>
      </form>
    );
  }

export default EmployeeManagement;