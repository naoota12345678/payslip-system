// src/pages/CSVMappingSettings.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function CSVMappingSettings() {
  const { currentUser, userDetails } = useAuth();
  const [payrollItems, setPayrollItems] = useState([]);
  const [csvColumns, setCsvColumns] = useState([]);
  const [mappings, setMappings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sampleCsvInput, setSampleCsvInput] = useState('');
  const [parsedHeaders, setParsedHeaders] = useState(false);
  const [activeTab, setActiveTab] = useState('payroll'); // 'payroll' または 'employee'
  
  // 従業員データマッピング設定
  const [employeeMapping, setEmployeeMapping] = useState({
    employeeIdColumn: '',
    departmentCodeColumn: '',
    nameColumn: '',
    positionColumn: '',
    emailColumn: ''
  });

  // 給与項目とマッピング情報を読み込む
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

        console.log("Loading data for company:", companyId);
        
        // 給与項目を取得
        const itemsQuery = query(
          collection(db, "payrollItems"),
          where("companyId", "==", companyId)
        );
        const itemsSnapshot = await getDocs(itemsQuery);
        const items = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // 表示順でソート
        items.sort((a, b) => a.displayOrder - b.displayOrder);
        console.log("Loaded payroll items:", items.length);
        setPayrollItems(items);
        
        // マッピング設定を取得
        const mappingDoc = await getDoc(doc(db, "csvMappings", companyId));
        if (mappingDoc.exists()) {
          const mappingData = mappingDoc.data();
          setMappings(mappingData.mappings || {});
          if (mappingData.csvColumns?.length > 0) {
            setCsvColumns(mappingData.csvColumns);
            setParsedHeaders(true);
          }
          // 従業員マッピング設定があれば読み込む
          if (mappingData.employeeMapping) {
            setEmployeeMapping(mappingData.employeeMapping);
          }
          console.log("Loaded existing mappings");
        } else {
          console.log("No existing mappings found");
        }
      } catch (error) {
        console.error("データ読み込みエラー:", error);
        setError(`データの読み込み中にエラーが発生しました: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    if (userDetails) {
      fetchData();
    }
  }, [userDetails]);

  // マッピング情報を保存
  const saveMappings = async () => {
    try {
      const companyId = userDetails?.companyId;
      if (!companyId) {
        setError("会社情報が取得できないため、設定を保存できません。");
        return;
      }

      if (csvColumns.length === 0) {
        setError("CSVカラムが設定されていません。先にCSVヘッダーを解析してください。");
        return;
      }

      await setDoc(doc(db, "csvMappings", companyId), {
        mappings,
        employeeMapping,
        csvColumns,
        updatedAt: new Date()
      });
      setSuccess("マッピング設定を保存しました");
      setError('');
    } catch (error) {
      console.error("保存エラー:", error);
      setError(`保存中にエラーが発生しました: ${error.message}`);
    }
  };

  // サンプルCSVからヘッダー行を解析
  const parseSampleCsv = () => {
    if (!sampleCsvInput.trim()) {
      setError("CSVヘッダー行を入力してください");
      return;
    }
    
    // 最初の行を取得
    const lines = sampleCsvInput.split('\n');
    const firstLine = lines[0];
    if (!firstLine) {
      setError("有効なCSVヘッダー行が見つかりません");
      return;
    }
    
    // タブまたはカンマで分割してヘッダーを取得
    const headers = firstLine.split(/[,\t]/).map(header => header.trim()).filter(h => h);
    if (headers.length === 0) {
      setError("有効なCSVカラムが見つかりません");
      return;
    }
    
    console.log("Parsed CSV headers:", headers);
    setCsvColumns(headers);
    setParsedHeaders(true);
    setError('');
    setSuccess(`${headers.length}件のCSVカラムを解析しました`);
  };

  // マッピングの更新
  const updateMapping = (itemId, columnName) => {
    setMappings({
      ...mappings,
      [itemId]: columnName
    });
  };

  // 従業員マッピングの更新
  const updateEmployeeMapping = (field, columnName) => {
    setEmployeeMapping({
      ...employeeMapping,
      [field]: columnName
    });
  };

  // サンプル入力のリセット
  const resetHeaders = () => {
    if (window.confirm('CSVヘッダー設定をリセットしますか？既存のマッピングも削除されます。')) {
      setCsvColumns([]);
      setMappings({});
      setEmployeeMapping({
        employeeIdColumn: '',
        departmentCodeColumn: '',
        nameColumn: '',
        positionColumn: '',
        emailColumn: ''
      });
      setSampleCsvInput('');
      setParsedHeaders(false);
      setSuccess('');
      setError('');
    }
  };

  // タイプ名の表示用変換
  const getTypeDisplayName = (type) => {
    const typeMap = {
      'income': '支給項目',
      'deduction': '控除項目',
      'attendance': '勤怠項目'
    };
    return typeMap[type] || type;
  };

  if (loading) {
    return <div className="text-center p-8">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">CSVマッピング設定</h1>
      
      {/* エラーメッセージ */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {/* 成功メッセージ */}
      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6">
          <p>{success}</p>
        </div>
      )}
      
      {/* サンプルCSV入力 */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-lg font-semibold mb-3">CSVヘッダーの設定</h2>
        <p className="mb-3 text-sm text-gray-600">
          CSVファイルの最初の行（ヘッダー行）をペーストしてください。各カラムがカンマまたはタブで区切られていることを確認してください。
        </p>
        
        <div className="mb-4">
          <textarea
            value={sampleCsvInput}
            onChange={(e) => setSampleCsvInput(e.target.value)}
            placeholder="例: KY03,KY02,KY01,KY11_0,KY11_1,KY11_2..."
            className="w-full border rounded-md px-3 py-2 h-20 font-mono"
          />
          <div className="flex mt-2 space-x-2">
            <button
              onClick={parseSampleCsv}
              className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-sm"
            >
              ヘッダー行を解析
            </button>
            {parsedHeaders && (
              <button
                onClick={resetHeaders}
                className="bg-gray-600 text-white px-3 py-1 rounded-md hover:bg-gray-700 text-sm"
              >
                リセット
              </button>
            )}
          </div>
        </div>
        
        {parsedHeaders && csvColumns.length > 0 && (
          <div className="mb-3">
            <h3 className="font-medium mb-2">解析されたCSVカラム ({csvColumns.length}件)</h3>
            <div className="border rounded-md p-3 bg-gray-50 max-h-32 overflow-y-auto">
              <p className="text-sm font-mono break-all">
                {csvColumns.join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* マッピング設定 */}
      {parsedHeaders && csvColumns.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          {/* タブ切り替え */}
          <div className="flex border-b mb-6">
            <button
              className={`px-4 py-2 font-medium text-sm mr-2 ${
                activeTab === 'payroll'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('payroll')}
            >
              給与項目マッピング
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm mr-2 ${
                activeTab === 'employee'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('employee')}
            >
              従業員情報マッピング
            </button>
          </div>

          {/* 給与項目マッピングタブ */}
          {activeTab === 'payroll' && (
            <>
              <h2 className="text-lg font-semibold mb-4">給与項目とCSVカラムのマッピング</h2>
              
              <div className="mb-4">
                <h3 className="font-medium mb-2">{getTypeDisplayName('income')}</h3>
                <MappingTable
                  items={payrollItems.filter(item => item.type === 'income')}
                  csvColumns={csvColumns}
                  mappings={mappings}
                  onUpdateMapping={updateMapping}
                />
              </div>
              
              <div className="mb-4">
                <h3 className="font-medium mb-2">{getTypeDisplayName('deduction')}</h3>
                <MappingTable
                  items={payrollItems.filter(item => item.type === 'deduction')}
                  csvColumns={csvColumns}
                  mappings={mappings}
                  onUpdateMapping={updateMapping}
                />
              </div>
              
              <div className="mb-4">
                <h3 className="font-medium mb-2">{getTypeDisplayName('attendance')}</h3>
                <MappingTable
                  items={payrollItems.filter(item => item.type === 'attendance')}
                  csvColumns={csvColumns}
                  mappings={mappings}
                  onUpdateMapping={updateMapping}
                />
              </div>
            </>
          )}

          {/* 従業員情報マッピングタブ */}
          {activeTab === 'employee' && (
            <>
              <h2 className="text-lg font-semibold mb-4">従業員情報とCSVカラムのマッピング</h2>
              <p className="text-sm text-gray-600 mb-4">
                CSVから従業員情報を取り込む際に使用するカラムを設定します。
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    従業員番号カラム <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={employeeMapping.employeeIdColumn || ''}
                    onChange={(e) => updateEmployeeMapping('employeeIdColumn', e.target.value)}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="">--選択してください--</option>
                    {csvColumns.map((column, index) => (
                      <option key={index} value={column}>{column}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    従業員を識別するための番号が含まれるカラム（例: KY01）
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    部門コードカラム
                  </label>
                  <select
                    value={employeeMapping.departmentCodeColumn || ''}
                    onChange={(e) => updateEmployeeMapping('departmentCodeColumn', e.target.value)}
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
                    value={employeeMapping.nameColumn || ''}
                    onChange={(e) => updateEmployeeMapping('nameColumn', e.target.value)}
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
                    value={employeeMapping.positionColumn || ''}
                    onChange={(e) => updateEmployeeMapping('positionColumn', e.target.value)}
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
                    value={employeeMapping.emailColumn || ''}
                    onChange={(e) => updateEmployeeMapping('emailColumn', e.target.value)}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    <option value="">--選択してください--</option>
                    {csvColumns.map((column, index) => (
                      <option key={index} value={column}>{column}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}
          
          <div className="mt-6">
            <button
              onClick={saveMappings}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              マッピング設定を保存
            </button>
          </div>
        </div>
      )}

      {/* 注意事項 */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
        <h3 className="font-medium text-blue-800 mb-2">使い方</h3>
        <ol className="list-decimal pl-5 text-sm text-blue-700 space-y-1">
          <li>CSVファイルの1行目（ヘッダー行）を上のテキストエリアにコピー＆ペーストします</li>
          <li>「ヘッダー行を解析」ボタンをクリックしてカラム名を読み込みます</li>
          <li>「給与項目マッピング」タブで各給与項目に対応するCSVカラムを選択します</li>
          <li>「従業員情報マッピング」タブで従業員番号や部門コードに対応するカラムを設定します</li>
          <li>完了したら「マッピング設定を保存」ボタンをクリックします</li>
        </ol>
      </div>
    </div>
  );
}

// マッピングテーブルコンポーネント
function MappingTable({ items, csvColumns, mappings, onUpdateMapping }) {
  if (items.length === 0) {
    return <p className="text-gray-500 italic">項目が登録されていません</p>;
  }
  
  // 項目を表示順でソート
  const sortedItems = [...items].sort((a, b) => a.displayOrder - b.displayOrder);
  
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="border px-4 py-2 text-left">給与項目</th>
          <th className="border px-4 py-2 text-left">CSVカラム</th>
        </tr>
      </thead>
      <tbody>
        {sortedItems.map(item => (
          <tr key={item.id}>
            <td className="border px-4 py-2">{item.name}</td>
            <td className="border px-4 py-2">
              <select
                value={mappings[item.id] || ''}
                onChange={(e) => onUpdateMapping(item.id, e.target.value)}
                className="w-full border rounded-md px-2 py-1"
              >
                <option value="">--マッピングなし--</option>
                {csvColumns.map((column, index) => (
                  <option key={index} value={column}>{column}</option>
                ))}
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default CSVMappingSettings;