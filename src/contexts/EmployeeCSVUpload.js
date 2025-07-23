// src/components/EmployeeCSVUpload.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, query, where, getDocs } from 'firebase/firestore';

function EmployeeCSVUpload({ companyId, onSuccess, onError }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [employeeMapping, setEmployeeMapping] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        if (!companyId) {
          onError("会社情報が取得できません");
          setLoading(false);
          return;
        }

        // CSVマッピング設定を取得
        const mappingDoc = await getDoc(doc(db, "csvMappings", companyId));
        if (mappingDoc.exists()) {
          const mappingData = mappingDoc.data();
          if (mappingData.employeeMapping) {
            setEmployeeMapping(mappingData.employeeMapping);
          } else {
            onError("従業員情報マッピングが設定されていません。先にCSVマッピング設定を行ってください。");
          }
        } else {
          onError("CSVマッピング設定が見つかりません。先にCSVマッピング設定を行ってください。");
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
        console.error("マッピング設定取得エラー:", error);
        onError("マッピング設定の読み込み中にエラーが発生しました");
        setLoading(false);
      }
    };

    fetchMappings();
  }, [companyId, onError]);

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!file) {
      onError("アップロードするCSVファイルを選択してください");
      return;
    }

    if (!employeeMapping?.employeeIdColumn) {
      onError("従業員番号カラムのマッピングが設定されていません");
      return;
    }
    
    try {
      setUploading(true);
      
      // ファイルを読み込む
      const reader = new FileReader();
      reader.onload = async (event) => {
        const csvData = event.target.result;
        
        try {
          // CSVデータを処理して従業員データを登録
          await processEmployeeCSV(csvData, employeeMapping, companyId, departments);
          onSuccess("従業員データをインポートしました");
        } catch (error) {
          console.error("データ処理エラー:", error);
          onError(`データ処理中にエラーが発生しました: ${error.message}`);
        } finally {
          setUploading(false);
          setFile(null);
        }
      };
      
      reader.onerror = () => {
        onError("ファイルの読み込みに失敗しました");
        setUploading(false);
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error("CSVアップロードエラー:", error);
      onError(`CSVアップロード中にエラーが発生しました: ${error.message}`);
      setUploading(false);
    }
  };

  // CSVデータを処理して従業員データを登録する関数
  const processEmployeeCSV = async (csvText, mapping, companyId, departments) => {
    // CSVデータをパースする
    const lines = csvText.split('\n');
    if (lines.length < 2) {
      throw new Error("CSVデータが不正です");
    }

    // ヘッダー行を取得
    const headers = lines[0].split(/[,\t]/).map(h => h.trim());
    
    // 各カラムのインデックスを取得
    const employeeIdIndex = headers.indexOf(mapping.employeeIdColumn);
    const departmentCodeIndex = mapping.departmentCodeColumn ? headers.indexOf(mapping.departmentCodeColumn) : -1;
    const nameIndex = mapping.nameColumn ? headers.indexOf(mapping.nameColumn) : -1;
    const positionIndex = mapping.positionColumn ? headers.indexOf(mapping.positionColumn) : -1;
    const emailIndex = mapping.emailColumn ? headers.indexOf(mapping.emailColumn) : -1;
    
    if (employeeIdIndex === -1) {
      throw new Error(`従業員番号カラム(${mapping.employeeIdColumn})が見つかりません`);
    }
    
    // 部門コードからIDへのマッピングを作成
    const departmentMap = {};
    departments.forEach(dept => {
      departmentMap[dept.code] = dept.id;
    });
    
    // データ行を処理
    const employees = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // 空行をスキップ
      
      const values = line.split(/[,\t]/).map(v => v.trim());
      
      // 従業員IDが空の場合はスキップ
      const employeeId = values[employeeIdIndex];
      if (!employeeId) continue;
      
      // 従業員データを作成
      const employee = {
        employeeId,
        companyId,
        updatedAt: new Date()
      };
      
      // 部門コードが設定されていれば保存
      if (departmentCodeIndex !== -1 && values[departmentCodeIndex]) {
        const deptCode = values[departmentCodeIndex];
        if (departmentMap[deptCode]) {
          employee.departmentCode = deptCode;
        }
      }
      
      // 氏名が設定されていれば追加
      if (nameIndex !== -1 && values[nameIndex]) {
        employee.name = values[nameIndex];
      }
      
      // 役職が設定されていれば追加
      if (positionIndex !== -1 && values[positionIndex]) {
        employee.position = values[positionIndex];
      }
      
      // メールアドレスが設定されていれば追加
      if (emailIndex !== -1 && values[emailIndex]) {
        employee.email = values[emailIndex];
      }
      
      employees.push(employee);
    }
    
    // Firestoreに従業員データを保存
    const batch = db.batch();
    for (const employee of employees) {
      // 従業員IDで検索して存在すれば更新、なければ新規作成
      const employeeQuery = query(
        collection(db, "employees"),
        where("companyId", "==", companyId),
        where("employeeId", "==", employee.employeeId)
      );
      
      const snapshot = await getDocs(employeeQuery);
      
      if (!snapshot.empty) {
        // 既存の従業員データを更新
        const docId = snapshot.docs[0].id;
        const docRef = doc(db, "employees", docId);
        batch.update(docRef, employee);
      } else {
        // 新規従業員を追加
        const docRef = doc(collection(db, "employees"));
        employee.createdAt = new Date();
        batch.set(docRef, employee);
      }
    }
    
    // バッチ処理を実行
    await batch.commit();
    
    return employees.length;
  };

  if (loading) {
    return <div className="text-center p-4">設定読み込み中...</div>;
  }

  if (!employeeMapping?.employeeIdColumn) {
    return (
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
        <p>
          従業員情報マッピングが設定されていません。
          先に<a href="/settings/csv-mapping" className="text-blue-600 underline">CSVマッピング設定</a>を行ってください。
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">従業員データCSVインポート</h2>
      <p className="text-sm text-gray-600 mb-4">
        CSVファイルから従業員データを一括登録・更新します。
      </p>
      
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CSVファイル
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="mt-1 text-xs text-gray-500">CSV形式のファイルを選択してください（UTF-8推奨）</p>
        </div>
        
        <div className="pt-2">
          <button
            type="submit"
            disabled={uploading || !file}
            className={`px-4 py-2 rounded-md text-white ${
              uploading || !file ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {uploading ? 'インポート中...' : 'インポート実行'}
          </button>
        </div>
      </form>
      
      <div className="bg-blue-50 p-4 rounded-md mt-6 border border-blue-200">
        <h3 className="text-sm font-medium text-blue-800 mb-2">現在のマッピング設定</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>従業員番号: <span className="font-mono">{employeeMapping.employeeIdColumn}</span></li>
          {employeeMapping.departmentCodeColumn && (
            <li>部門コード: <span className="font-mono">{employeeMapping.departmentCodeColumn}</span></li>
          )}
          {employeeMapping.nameColumn && (
            <li>氏名: <span className="font-mono">{employeeMapping.nameColumn}</span></li>
          )}
          {employeeMapping.positionColumn && (
            <li>役職: <span className="font-mono">{employeeMapping.positionColumn}</span></li>
          )}
          {employeeMapping.emailColumn && (
            <li>メールアドレス: <span className="font-mono">{employeeMapping.emailColumn}</span></li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default EmployeeCSVUpload;