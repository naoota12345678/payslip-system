import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';

const BonusCSVUpload = () => {
  const { userDetails } = useAuth();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]); // 今日の日付をデフォルト
  const [employeeIdColumn, setEmployeeIdColumn] = useState('');
  const [departmentCodeColumn, setDepartmentCodeColumn] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);

  // 賞与マッピング設定を取得する関数
  const fetchBonusMappingSettings = async () => {
    if (!userDetails?.companyId) {
      return { 
        employeeIdColumn: '', 
        departmentCodeColumn: '',
        simpleMapping: {},
        itemCategories: {},
        visibilitySettings: {}
      };
    }

    try {
      // 賞与専用マッピング設定を取得
      const mappingRef = doc(db, 'csvMappingsBonus', userDetails.companyId);
      const mappingDoc = await getDoc(mappingRef);
      
      if (!mappingDoc.exists()) {
        return {
          employeeIdColumn: '',
          departmentCodeColumn: '',
          simpleMapping: {},
          itemCategories: {},
          visibilitySettings: {}
        };
      }

      const data = mappingDoc.data();

      let employeeIdColumn = '';
      let departmentCodeColumn = '';
      let simpleMapping = {};
      let itemCategories = {};
      let visibilitySettings = {};

      // 従業員設定を取得
      if (data.mainFields) {
        if (data.mainFields.employeeCode && data.mainFields.employeeCode.headerName) {
          employeeIdColumn = data.mainFields.employeeCode.headerName;
        }
        
        if (data.mainFields.departmentCode && data.mainFields.departmentCode.headerName) {
          departmentCodeColumn = data.mainFields.departmentCode.headerName;
        }
      }

      // 項目マッピング設定を取得
      if (data.items && Array.isArray(data.items)) {
        data.items.forEach(item => {
          if (item.csvColumn && item.name) {
            simpleMapping[item.csvColumn] = item.name;
            itemCategories[item.csvColumn] = item.type || 'other';
            visibilitySettings[item.csvColumn] = item.isVisible !== false;
          }
        });
      }

      return {
        employeeIdColumn,
        departmentCodeColumn,
        simpleMapping,
        itemCategories,
        visibilitySettings
      };

    } catch (error) {
      return {
        employeeIdColumn: '',
        departmentCodeColumn: '',
        simpleMapping: {},
        itemCategories: {},
        visibilitySettings: {}
      };
    }
  };

  // CSVファイルを読み込む関数
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return { headers: [], data: [] };

    const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, ''));
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(value => value.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    return { headers, data };
  };

  // ファイル選択時の処理
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setMessage('CSVファイルを選択してください');
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const text = event.target.result;
      const { headers, data } = parseCSV(text);
      
      setHeaders(headers);
      setCsvData(data);
      setShowPreview(true);
      
      // マッピング設定を取得して自動設定
      const mappingSettings = await fetchBonusMappingSettings();
      setEmployeeIdColumn(mappingSettings.employeeIdColumn);
      setDepartmentCodeColumn(mappingSettings.departmentCodeColumn);
    };
    
    reader.readAsText(selectedFile, 'UTF-8');
  };

  // 賞与明細データを保存する関数
  const saveBonusPayslipData = async () => {
    if (!file || !userDetails?.companyId) {
      setMessage('ファイルまたはユーザー情報が不足しています');
      return;
    }

    if (!employeeIdColumn) {
      setMessage('従業員番号列を選択してください');
      return;
    }

    try {
      setUploading(true);
      setMessage('賞与明細データを保存中...');
      
      // マッピング設定を取得
      const mappingSettings = await fetchBonusMappingSettings();
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const [index, row] of csvData.entries()) {
        try {
          // 従業員番号を取得
          const employeeId = row[employeeIdColumn];
          
          if (!employeeId) {
            errorCount++;
            continue;
          }
          
          // 従業員検索用の変数を定義
          let employeeDoc = null;
          let userId = null;
          let employeeData = null;
          
          try {
            // 従業員情報を検索してuserIdを取得
            
            // 🔧 従業員番号の正規化（複数パターンで検索）
            const searchPatterns = [
              employeeId, // 元の値
              String(employeeId), // 文字列化
              employeeId.toString().padStart(3, '0'), // 3桁ゼロパディング（例: "001"）
              employeeId.toString().replace(/^0+/, ''), // 先頭ゼロ除去（例: "1"）
              employeeId.toString().slice(-3), // 末尾3桁（例: "001"）
              parseInt(employeeId, 10), // 数値化
            ].filter((pattern, index, arr) => arr.indexOf(pattern) === index); // 重複除去
            
            // 各パターンで検索を実行
            for (const pattern of searchPatterns) {
              try {
                
                const employeesQuery = query(
                  collection(db, 'employees'),
                  where('companyId', '==', userDetails.companyId),
                  where('employeeId', '==', pattern)
                );
                
                const employeesSnapshot = await getDocs(employeesQuery);
                
                if (!employeesSnapshot.empty) {
                  employeeDoc = employeesSnapshot.docs[0];
                  userId = employeeDoc.id;
                  employeeData = employeeDoc.data();
                  break;
                }
              } catch (searchError) {
                // 次のパターンを試行
              }
            }
          } catch (employeeSearchError) {
            errorCount++;
            continue;
          }
          
          // 🔧 検索結果の確認
          if (!employeeDoc) {
            // 🚨 緊急デバッグ：全従業員をチェック
            const allEmployeesQuery = query(collection(db, 'employees'), where('companyId', '==', userDetails.companyId));
            const allSnapshot = await getDocs(allEmployeesQuery);
            
            if (allSnapshot.size > 0) {
              allSnapshot.forEach((doc, idx) => {
                const empData = doc.data();
              });
              
              // 部分一致検索も試行
              const matchingEmployee = allSnapshot.docs.find(doc => {
                const empData = doc.data();
                return String(empData.employeeId) === String(employeeId) ||
                       empData.employeeId === employeeId;
              });
              
              if (matchingEmployee) {
                // 部分一致で見つかった
              } else {
                // 部分一致でも見つからなかった
              }
            }
            
            errorCount++;
            continue;
          }
          
          try {
            // 部門コードを取得
            const departmentCode = departmentCodeColumn ? row[departmentCodeColumn] : employeeData.departmentCode;
            
            // 項目データを構築
            const items = {};
            Object.keys(row).forEach(key => {
              // 従業員番号・部門コード以外で、ヘッダーが存在する項目を処理
              if (key !== employeeIdColumn && key !== departmentCodeColumn && key && key.trim() !== '') {
                // 賞与マッピング設定に基づいて項目を構築
                const itemName = mappingSettings.simpleMapping[key] || key;
                const itemType = mappingSettings.itemCategories[key] || 'other';
                const isVisible = mappingSettings.visibilitySettings[key] !== false;
                
                // 値を取得（空白も含む）
                let value = row[key] || ''; // undefined/nullは空文字列に変換
                value = String(value).trim(); // 前後の空白を除去
                
                // 部門コード、従業員コード、従業員氏名などの文字列項目は文字列として保持
                const isStringField = ['部門コード', '部署コード', '従業員コード', '従業員氏名', '氏名', '社員番号', '社員ID', '識別コード'].some(field => 
                  key.includes(field) || itemName.includes(field)
                );
                
                // 数値に変換を試行（文字列フィールド以外で空白でない場合のみ）
                if (value !== '' && !isStringField && !isNaN(value)) {
                  value = Number(value);
                }
                
                items[key] = {
                  value: value, // 空白も保存される、文字列フィールドは文字列として保存
                  name: itemName,
                  type: itemType,
                  isVisible: isVisible
                };
              }
            });
            
            // 賞与明細データを作成
            const bonusPayslipData = {
              userId: userId,
              employeeId: employeeId,
              companyId: userDetails.companyId,
              departmentCode: departmentCode,
              paymentDate: new Date(paymentDate),
              items: items,
              payslipType: 'bonus', // 賞与固定
              createdAt: serverTimestamp(),
              createdBy: userDetails.uid || 'system'
            };
            
            // bonusPayslipsコレクションに保存
            const docRef = await addDoc(collection(db, 'bonusPayslips'), bonusPayslipData);
            
            successCount++;
            
          } catch (saveError) {
            errorCount++;
          }
          
        } catch (rowError) {
          errorCount++;
        }
      }
      
      setMessage(`賞与明細の保存が完了しました。成功: ${successCount}件, エラー: ${errorCount}件`);
      
      // 成功時は画面をリセット
      if (successCount > 0) {
        setFile(null);
        setCsvData([]);
        setHeaders([]);
        setShowPreview(false);
        document.querySelector('input[type="file"]').value = '';
      }
      
    } catch (error) {
      setMessage(`エラーが発生しました: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // 賞与マッピング設定を保存
  const handleSaveBonusMapping = async () => {
    if (!userDetails?.companyId) {
      setMessage('エラー: 会社情報が取得できません');
      return;
    }

    try {
      setSavingMapping(true);
      setMessage('');

      // 現在のヘッダー情報から基本的なマッピング設定を作成
      const mappingData = {
        employeeIdColumn,
        departmentCodeColumn,
        simpleMapping: {},
        itemCategories: {},
        visibilitySettings: {},
        headers: headers || [],
        updatedAt: new Date()
      };

      // 各ヘッダーに対してデフォルト設定を作成
      if (headers && headers.length > 0) {
        headers.forEach(header => {
          if (header !== employeeIdColumn && header !== departmentCodeColumn) {
            // デフォルトの項目名は元のヘッダー名
            mappingData.simpleMapping[header] = header;
            
            // カテゴリを推定（簡単な分類）
            const lowerHeader = header.toLowerCase();
            if (lowerHeader.includes('基本') || lowerHeader.includes('手当') || lowerHeader.includes('支給')) {
              mappingData.itemCategories[header] = 'income';
            } else if (lowerHeader.includes('控除') || lowerHeader.includes('税') || lowerHeader.includes('保険')) {
              mappingData.itemCategories[header] = 'deduction';
            } else if (lowerHeader.includes('時間') || lowerHeader.includes('日数') || lowerHeader.includes('出勤')) {
              mappingData.itemCategories[header] = 'attendance';
            } else {
              mappingData.itemCategories[header] = 'other';
            }
            
            // デフォルトは表示
            mappingData.visibilitySettings[header] = true;
          }
        });
      }

      // Firestoreに保存
      await setDoc(doc(db, 'csvMappingsBonus', userDetails.companyId), mappingData);

      setMessage('賞与マッピング設定を保存しました');

    } catch (err) {
      console.error('賞与マッピング設定保存エラー:', err);
      setMessage('エラー: マッピング設定の保存中にエラーが発生しました: ' + err.message);
    } finally {
      setSavingMapping(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">賞与CSVアップロード</h1>
        
        {/* ファイル選択 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">CSVファイル選択</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                賞与CSVファイル
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                支払日
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>
        </div>
        
        {/* CSVプレビューと設定 */}
        {showPreview && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">CSV設定とプレビュー</h2>
            
            {/* 列設定 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  従業員番号列 <span className="text-red-500">*</span>
                </label>
                <select
                  value={employeeIdColumn}
                  onChange={(e) => setEmployeeIdColumn(e.target.value)}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">選択してください</option>
                  {headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  部門コード列
                </label>
                <select
                  value={departmentCodeColumn}
                  onChange={(e) => setDepartmentCodeColumn(e.target.value)}
                  className="block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">選択してください</option>
                  {headers.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* CSVデータプレビュー */}
            <div className="mb-6">
              <h3 className="text-md font-medium mb-2">データプレビュー（最初の5行）</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      {headers.map((header, index) => (
                        <th key={index} className="border border-gray-300 px-2 py-1 text-xs text-left">
                          {header}
                          {header === employeeIdColumn && <span className="text-red-500 ml-1">👤</span>}
                          {header === departmentCodeColumn && <span className="text-blue-500 ml-1">🏢</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 5).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {headers.map((header, colIndex) => (
                          <td key={colIndex} className="border border-gray-300 px-2 py-1 text-xs">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.length > 5 && (
                <p className="text-sm text-gray-500 mt-2">
                  ...他 {csvData.length - 5} 行
                </p>
              )}
            </div>
            
            {/* アップロードボタン */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={saveBonusPayslipData}
                disabled={uploading || !employeeIdColumn}
                className={`px-6 py-2 rounded-md font-medium ${
                  uploading || !employeeIdColumn
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {uploading ? '保存中...' : '賞与明細を保存'}
              </button>
              
              <button
                onClick={handleSaveBonusMapping}
                disabled={savingMapping || !headers.length}
                className={`px-6 py-2 rounded-md font-medium ${
                  savingMapping || !headers.length
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {savingMapping ? 'マッピング保存中...' : 'マッピング設定を保存'}
              </button>
              
              <button
                onClick={() => {
                  setShowPreview(false);
                  setFile(null);
                  setCsvData([]);
                  setHeaders([]);
                  document.querySelector('input[type="file"]').value = '';
                }}
                disabled={uploading || savingMapping}
                className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-400"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
        
        {/* メッセージ表示 */}
        {message && (
          <div className={`rounded-lg p-4 mb-6 ${
            message.includes('エラー') || message.includes('失敗') 
              ? 'bg-red-100 text-red-700' 
              : message.includes('完了')
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {message}
          </div>
        )}
        
        {/* 使用方法の説明 */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">使用方法</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>賞与データが含まれるCSVファイルを選択してください</li>
            <li>支払日を設定してください</li>
            <li>従業員番号列を正しく選択してください（必須）</li>
            <li>部門コード列を選択してください（任意）</li>
            <li>データプレビューを確認してから「賞与明細を保存」をクリックしてください</li>
          </ol>
          
          <div className="mt-4 p-3 bg-yellow-100 rounded-md">
            <p className="text-sm text-yellow-800">
              <strong>注意:</strong> 
              従業員番号は従業員マスタに登録されている番号と一致する必要があります。
              賞与マッピング設定により、項目名と分類が自動的に適用されます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BonusCSVUpload; 