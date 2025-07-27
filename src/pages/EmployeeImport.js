// src/pages/EmployeeImport.js
import React, { useState, useEffect } from 'react';
import { db, functions } from '../firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

function EmployeeImport() {
  const { currentUser, userDetails } = useAuth();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  
  // 部門データを読み込む
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setLoading(true);
        
        const companyId = userDetails?.companyId;
        if (!companyId) {
          setError("会社情報が取得できません。設定を確認してください。");
          setLoading(false);
          return;
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
        
        setDepartments(departmentsData);
        setLoading(false);
      } catch (error) {
        console.error("部門データ取得エラー:", error);
        setError("部門データの取得中にエラーが発生しました");
        setLoading(false);
      }
    };
    
    if (userDetails) {
      fetchDepartments();
    }
  }, [userDetails]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
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
        
        // ヘッダー行を取得
        const headers = lines[0].split(',').map(h => h.trim());
        
        // 必須フィールドの確認
        const requiredFields = ['社員番号', '氏名', 'メールアドレス', '部署コード'];
        const missingFields = requiredFields.filter(field => !headers.includes(field));
        
        if (missingFields.length > 0) {
          setError(`CSVファイルに必須フィールド（${missingFields.join(', ')}）が見つかりません`);
          setPreviewData(null);
          return;
        }
        
        // データ行を解析（最大5行表示）
        const rows = [];
        for (let i = 1; i < Math.min(lines.length, 6); i++) {
          if (!lines[i].trim()) continue;
          
          const values = lines[i].split(',').map(v => v.trim());
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

  const handleImport = async () => {
    if (!file) {
      setError("インポートするCSVファイルを選択してください");
      return;
    }
    
    try {
      setUploading(true);
      setError('');
      setSuccess('');
      setImportResult(null);
      
      const companyId = userDetails?.companyId;
      if (!companyId) {
        setError("会社情報が取得できません");
        setUploading(false);
        return;
      }
      
      // ファイルを読み込む
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const csvData = event.target.result;
          const result = await importEmployees(csvData, companyId);
          
          setImportResult(result);
          
          // 成功メッセージを作成
          let successMessage = `従業員データをインポートしました（新規: ${result.created}件、更新: ${result.updated}件`;
          if (result.authCreated !== undefined) {
            successMessage += `、Authアカウント作成: ${result.authCreated}件`;
          }
          successMessage += `）`;
          
          setSuccess(successMessage);
          setFile(null);
          setPreviewData(null);
          
          // 入力フィールドのリセット
          document.getElementById('file-upload').value = '';
        } catch (error) {
          console.error("インポートエラー:", error);
          setError(`従業員データのインポート中にエラーが発生しました: ${error.message}`);
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
      console.error("インポート処理エラー:", error);
      setError(`処理中にエラーが発生しました: ${error.message}`);
      setUploading(false);
    }
  };

  // 従業員データをインポートする処理
  const importEmployees = async (csvData, companyId) => {
    const lines = csvData.split('\n');
    if (lines.length < 2) {
      throw new Error("CSVデータが不正です");
    }
    
    // ヘッダー行を取得
    const headers = lines[0].split(',').map(h => h.trim());
    
    // 必須フィールドのインデックスを取得
    const employeeIdIndex = headers.indexOf('社員番号');
    const nameIndex = headers.indexOf('氏名');
    const emailIndex = headers.indexOf('メールアドレス');
    const departmentCodeIndex = headers.indexOf('部署コード');
    
    // オプションフィールドのインデックスを取得
    const positionIndex = headers.indexOf('役職');
    const jobTypeIndex = headers.indexOf('職種');
    const contractTypeIndex = headers.indexOf('契約形態');
    const genderIndex = headers.indexOf('性別');
    const birthDateIndex = headers.indexOf('生年月日');
    const hireDateIndex = headers.indexOf('入社日');
    
    // 必須フィールドの存在確認
    if (employeeIdIndex === -1 || nameIndex === -1 || emailIndex === -1 || departmentCodeIndex === -1) {
      throw new Error("CSVファイルに必須フィールド（社員番号、氏名、メールアドレス、部署コード）が見つかりません");
    }
    
    // 部門コードから部門IDへのマッピングを作成
    const departmentMap = {};
    departments.forEach(dept => {
      departmentMap[dept.code] = dept.id;
    });
    
    // Firestoreのバッチ処理用
    const batch = writeBatch(db);
    
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
    
    // データ行を処理
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // 空行をスキップ
      
      try {
        const values = line.split(',').map(v => v.trim());
        
        // 従業員IDが空の場合はスキップ
        const employeeId = values[employeeIdIndex];
        if (!employeeId) {
          result.skipped++;
          continue;
        }
        
        // 名前またはメールアドレスが空の場合はスキップ
        const name = values[nameIndex];
        const email = values[emailIndex];
        if (!name || !email) {
          result.errors.push(`行 ${i+1}: 氏名またはメールアドレスが空です（従業員番号: ${employeeId}）`);
          result.skipped++;
          continue;
        }
        
        // 部門コードの確認
        const departmentCode = values[departmentCodeIndex];
        if (departmentCode && !departmentMap[departmentCode]) {
          result.errors.push(`行 ${i+1}: 部署コード「${departmentCode}」が見つかりません（従業員番号: ${employeeId}）`);
        }
        
        // 従業員データを作成
        const employee = {
          employeeId,
          name,
          email,
          companyId,
          userType: 'employee', // 従業員として設定
          role: 'employee', // 従業員ロール
          status: 'active', // ステータス: アクティブ
          isActive: true, // アクティブフラグ
          updatedAt: new Date(),
          createdAt: new Date()
        };
        
        // 部門コードと部門IDを設定
        if (departmentCode && departmentMap[departmentCode]) {
          employee.departmentCode = departmentCode;
          employee.departmentId = departmentMap[departmentCode];
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
        result.errors.push(`行 ${i+1}: 処理エラー - ${error.message}`);
        result.skipped++;
      }
    }
    
    // バッチ処理を実行
    await batch.commit();
    
    // Firebase Authアカウントを作成（新規従業員のみ）
    if (result.created > 0) {
      console.log(`🔧 ${result.created}件の新規従業員にFirebase Authアカウントを作成中...`);
      
      const createEmployeeAccount = httpsCallable(functions, 'createEmployeeAccount');
      let authCreated = 0;
      let authErrors = [];
      
      // 新規作成された従業員のアカウントを作成
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
          const values = line.split(',').map(v => v.trim());
          const employeeId = values[employeeIdIndex];
          const name = values[nameIndex];
          const email = values[emailIndex];
          
          if (!employeeId || !name || !email) continue;
          
          // 新規作成された従業員かチェック
          if (!existingEmployees[employeeId]) {
            try {
              const authResult = await createEmployeeAccount({
                email: email,
                name: name,
                employeeData: {
                  employeeId,
                  name,
                  email,
                  companyId
                }
              });
              
              console.log(`✅ Firebase Authアカウント作成成功: ${email}`);
              authCreated++;
            } catch (authError) {
              console.error(`❌ Firebase Authアカウント作成失敗: ${email}`, authError);
              console.error('詳細エラー:', authError.code, authError.message, authError.details);
              
              // より詳細なエラーメッセージ
              let errorMessage = authError.message || 'Unknown error';
              if (authError.code) {
                errorMessage = `[${authError.code}] ${errorMessage}`;
              }
              if (authError.details) {
                errorMessage += ` (詳細: ${authError.details})`;
              }
              
              authErrors.push(`${name} (${email}): ${errorMessage}`);
            }
          }
        } catch (error) {
          console.error(`行 ${i+1} のAuth処理エラー:`, error);
        }
      }
      
      // Auth作成結果を結果に追加
      result.authCreated = authCreated;
      result.authErrors = authErrors;
      
      console.log(`🎉 Firebase Authアカウント作成完了: ${authCreated}件成功, ${authErrors.length}件失敗`);
      
      // エラーが発生した場合、詳細を確認しやすくするため
      if (authErrors.length > 0) {
        console.group('🔍 Firebase Auth作成エラー詳細:');
        authErrors.forEach((error, index) => {
          console.error(`${index + 1}. ${error}`);
        });
        console.groupEnd();
        
        // ユーザーにアラートで主要エラーを表示
        const errorSummary = authErrors.slice(0, 3).join('\n\n');
        alert(`Firebase Auth作成で${authErrors.length}件のエラーが発生しました。\n\n最初の${Math.min(3, authErrors.length)}件のエラー:\n${errorSummary}\n\nコンソールで詳細を確認してください。`);
        
        // LocalStorageにもエラーを保存（デバッグ用）
        localStorage.setItem('lastAuthErrors', JSON.stringify({
          timestamp: new Date().toISOString(),
          errors: authErrors,
          totalCount: authErrors.length
        }));
      }
    }
    
    return result;
  };

  if (loading) {
    return <div className="text-center p-8">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">従業員情報一括インポート</h1>
      
      <div className="mb-6">
        <Link to="/employees" className="text-blue-600 hover:text-blue-800">
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
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">CSVファイルのインポート</h2>
        <p className="text-gray-600 mb-4">
          従業員情報を一括登録・更新するには、以下の形式のCSVファイルをアップロードしてください。
        </p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CSVファイル
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="mt-1 text-xs text-gray-500">
            UTF-8エンコードのCSVファイルを選択してください。必須フィールド：社員番号、氏名、メールアドレス、部署コード
          </p>
        </div>
        
        {previewData && (
          <div className="mb-4">
            <h3 className="font-medium mb-2">ファイルプレビュー</h3>
            <div className="overflow-x-auto">
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
              {previewData.rows.length}行表示中 (最大5行)
            </p>
          </div>
        )}
        
        <button
          onClick={handleImport}
          disabled={!file || uploading}
          className={`px-4 py-2 rounded-md text-white ${
            !file || uploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {uploading ? 'インポート中...' : 'インポート実行'}
        </button>
      </div>
      
      {importResult && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">インポート結果</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-green-50 p-4 rounded-md">
              <p className="text-lg font-bold text-green-700">{importResult.created}</p>
              <p className="text-sm text-green-600">新規登録</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-md">
              <p className="text-lg font-bold text-blue-700">{importResult.updated}</p>
              <p className="text-sm text-blue-600">更新</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-md">
              <p className="text-lg font-bold text-yellow-700">{importResult.skipped}</p>
              <p className="text-sm text-yellow-600">スキップ</p>
            </div>
            {importResult.authCreated !== undefined && (
              <div className="bg-purple-50 p-4 rounded-md">
                <p className="text-lg font-bold text-purple-700">{importResult.authCreated}</p>
                <p className="text-sm text-purple-600">ログインアカウント作成</p>
              </div>
            )}
          </div>
          
          {importResult.errors.length > 0 && (
            <div className="mb-4">
              <h3 className="font-medium mb-2">エラー ({importResult.errors.length}件)</h3>
              <div className="bg-red-50 p-3 rounded-md max-h-40 overflow-y-auto">
                <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                  {importResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {importResult.authErrors && importResult.authErrors.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">ログインアカウント作成エラー ({importResult.authErrors.length}件)</h3>
              <div className="bg-orange-50 p-3 rounded-md max-h-40 overflow-y-auto">
                <ul className="list-disc pl-5 text-sm text-orange-700 space-y-1">
                  {importResult.authErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
              <p className="mt-2 text-xs text-orange-600">
                ※ ログインアカウント作成に失敗した従業員は、個別に従業員管理画面から再作成できます
              </p>
            </div>
          )}
        </div>
      )}
      
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-medium text-blue-800 mb-2">CSVファイル形式</h3>
        <p className="text-sm text-blue-700 mb-2">
          CSVファイルは以下のフォーマットに従ってください：
        </p>
        <div className="bg-white p-3 rounded-md overflow-x-auto mb-3">
          <pre className="text-xs text-gray-700">社員番号,氏名,メールアドレス,部署コード,役職,職種,契約形態,性別,生年月日,入社日</pre>
        </div>
        <ul className="list-disc pl-5 text-sm text-blue-700 space-y-1">
          <li>必須項目: 社員番号、氏名、メールアドレス、部署コード</li>
          <li>任意項目: 役職、職種、契約形態、性別、生年月日、入社日</li>
          <li>部署コードは、会社設定の部門管理で登録した部門コードと一致する必要があります</li>
          <li>社員番号が既に存在する場合は更新、存在しない場合は新規登録されます</li>
          <li>新規従業員には自動的にFirebase Authログインアカウントが作成されます（パスワード: 000000）</li>
          <li>性別は数値で指定: 1=男性、2=女性、その他の値=その他/未指定</li>
          <li>日付はYYYY/MM/DD形式で指定してください</li>
        </ul>
      </div>
    </div>
  );
}

export default EmployeeImport;