// src/pages/CsvUpload/index.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';

// カスタムフック
import useFileUpload from './hooks/useFileUpload';
import useEmployeeSettings from './hooks/useEmployeeSettings';
import useDebugTools from './hooks/useDebugTools';

// コンポーネント
import DebugTools from './components/DebugTools';
import EmployeeSettings from './components/EmployeeSettings';
import FileUploadPanel from './components/FileUploadPanel';
import ProgressIndicator from './components/ProgressIndicator';
import SuccessPanel from './components/SuccessPanel';
import MappingDisplay from './components/MappingDisplay';

// ユーティリティ
import { fetchCompanyMappings } from './utils/fetchMappings';

function CsvUpload() {
  const { currentUser, userDetails } = useAuth();
  const [payrollItems, setPayrollItems] = useState([]);
  const [mappingWarning, setMappingWarning] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [showSystemDebug, setShowSystemDebug] = useState(false);

  // カスタムフックを使用
  const {
    file,
    fileName,
    csvHeaders,
    paymentDate,
    sendEmailDate,
    isLoading,
    error,
    success,
    uploadProgress,
    uploadId,
    handleFileChange,
    handleUpload: uploadFile,
    setPaymentDate,
    setSendEmailDate,
    sendEmailNotification,
    setError
  } = useFileUpload(userDetails, currentUser);

  const {
    updateEmployeeInfo,
    setUpdateEmployeeInfo,
    employeeIdColumn,
    departmentCodeColumn,
    registerNewEmployees,
    setRegisterNewEmployees,
    isLoading: employeeSettingsLoading,
    debugState: employeeDebugState
  } = useEmployeeSettings(userDetails);

  const {
    debugMode,
    setDebugMode,
    savedSettings,
    viewDebugLogs,
    testSimpleFunction,
    testSimpleCSVProcessing,
    testCSVProcessing,
    saveCurrentSettings,
    loadSavedSettingsList,
    deleteSavedSetting
  } = useDebugTools();

  // 従業員設定の初期化（最初のレンダリング時のみ）
  useEffect(() => {
    const initializeEmployeeSettings = async () => {
      if (!userDetails?.companyId || employeeSettingsLoading) return;
      
      // csvSettingsコレクションに初期設定を保存（存在しない場合のみ）
      try {
        await setDoc(doc(db, "csvSettings", userDetails.companyId), {
          updateEmployeeInfo: true,
          registerNewEmployees: registerNewEmployees,
          updatedAt: new Date()
        }, { merge: true });
        
        if (debugMode) {
          console.log('[Debug] 従業員設定の初期化完了');
        }
      } catch (err) {
        console.error("従業員設定の初期化エラー:", err);
      }
    };
    
    initializeEmployeeSettings();
  }, [userDetails, employeeSettingsLoading, registerNewEmployees, debugMode]);

  // マッピング情報を取得する関数
  const fetchMappingSettings = useCallback(async () => {
    if (!userDetails?.companyId) return;
    
    setSettingsLoading(true);
    try {
      // 給与項目とCSVマッピングを取得
      // 1. 給与項目を取得
      const itemsQuery = query(
        collection(db, "payrollItems"),
        where("companyId", "==", userDetails.companyId)
      );
      const itemsSnapshot = await getDocs(itemsQuery);
      const items = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 2. マッピング情報をロード
      const mappingResult = await fetchCompanyMappings(db, userDetails.companyId, items, debugMode);
      
      if (mappingResult.error) {
        console.error("マッピング取得エラー:", mappingResult.error);
      }
      
      setPayrollItems(mappingResult.items);
      setMappingWarning(!mappingResult.hasMappings);
      
    } catch (err) {
      console.error("設定の取得エラー:", err);
      setError("設定の取得中にエラーが発生しました。");
    } finally {
      setSettingsLoading(false);
    }
  }, [userDetails, debugMode, setError]);

  // 会社のCSVマッピング設定と給与項目を取得
  useEffect(() => {
    fetchMappingSettings();
  }, [fetchMappingSettings]);

  // ファイル選択時の処理をラップ
  const handleFileSelectWrapper = (e) => {
    handleFileChange(e, debugMode);
  };

  // テスト用CSVファイル生成とハンドラー接続
  const handleTestCSV = () => {
    const testFile = testCSVProcessing();
    if (testFile) {
      // ファイル選択イベントをシミュレート
      const event = {
        target: {
          files: [testFile]
        }
      };
      handleFileChange(event, debugMode);
      setPaymentDate(new Date().toISOString().split('T')[0]); // 今日の日付をセット
    }
  };

  // 保存済み設定の適用
  const applySavedSetting = (setting) => {
    try {
      if (debugMode) {
        console.log('[Debug] 設定を適用します:', setting);
      }
      
      // 従業員情報設定を適用
      setUpdateEmployeeInfo(setting.updateEmployeeInfo !== undefined ? setting.updateEmployeeInfo : true);
      if (typeof setting.registerNewEmployees !== 'undefined') {
        setRegisterNewEmployees(setting.registerNewEmployees);
      }
      
      // 給与項目のマッピング情報を適用
      if (setting.payrollMappings && setting.payrollMappings.length > 0) {
        const updatedItems = [...payrollItems];
        
        setting.payrollMappings.forEach(mapping => {
          const itemIndex = updatedItems.findIndex(item => item.id === mapping.id);
          if (itemIndex !== -1) {
            updatedItems[itemIndex] = {
              ...updatedItems[itemIndex],
              csvColumn: mapping.csvColumn
            };
          }
        });
        
        setPayrollItems(updatedItems);
      }
      
      alert(`設定 "${setting.name}" を適用しました`);
    } catch (err) {
      console.error('[エラー] 設定適用エラー:', err);
      alert('設定の適用に失敗しました: ' + err.message);
    }
  };

  // アップロード処理をラップ
  const handleUpload = () => {
    uploadFile({
      payrollItems,
      employeeIdColumn, 
      departmentCodeColumn,
      updateEmployeeInfo,
      registerNewEmployees,
      debugMode
    });
  };

  // メール通知をラップ
  const handleEmailNotification = (uploadId, isTest) => {
    sendEmailNotification(uploadId, isTest, debugMode);
  };

  // 簡易CSV処理テストをラップ
  const handleSimpleCSVTest = () => {
    if (userDetails?.companyId) {
      testSimpleCSVProcessing(userDetails.companyId);
    } else {
      alert('会社IDが見つかりません');
    }
  };

  // 設定の再読み込み
  const refreshSettings = () => {
    fetchMappingSettings();
  };

  // 給与項目のカテゴリ変更
  const handleCategoryChange = async (itemId, newCategory) => {
    try {
      if (!itemId || !newCategory) {
        setError('項目IDまたは新しいカテゴリが指定されていません');
        return;
      }

      // 確認ダイアログを表示
      const item = payrollItems.find(item => item.id === itemId);
      if (!item) {
        setError('指定された項目が見つかりません');
        return;
      }

      const categoryNames = {
        'income': '支給項目',
        'deduction': '控除項目',
        'attendance': '勤怠項目'
      };

      const currentCategoryName = categoryNames[item.type] || item.type;
      const newCategoryName = categoryNames[newCategory] || newCategory;

      if (!window.confirm(`「${item.name}」を${currentCategoryName}から${newCategoryName}に移動しますか？`)) {
        return;
      }

      // Firestoreの給与項目を更新
      const itemRef = doc(db, "payrollItems", itemId);
      await updateDoc(itemRef, {
        type: newCategory,
        updatedAt: new Date()
      });

      // ローカルステートを更新
      const updatedItems = payrollItems.map(item => 
        item.id === itemId 
          ? { ...item, type: newCategory }
          : item
      );
      setPayrollItems(updatedItems);

      setSuccess(`「${item.name}」を${newCategoryName}に移動しました`);
      setError('');

      if (debugMode) {
        console.log(`[Debug] 項目カテゴリ変更: ${item.name} (${item.id}) を ${item.type} から ${newCategory} に変更`);
      }
    } catch (err) {
      console.error('カテゴリ変更エラー:', err);
      setError('カテゴリの変更中にエラーが発生しました: ' + err.message);
    }
  };

  // システムデバッグの切り替え（5回クリックで有効化）
  const [clickCount, setClickCount] = useState(0);
  const handleSystemDebugClick = () => {
    setClickCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 5) {
        setShowSystemDebug(true);
        return 0;
      }
      return newCount;
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6" onClick={handleSystemDebugClick}>給与データアップロード</h1>
      
      {/* システムデバッグ情報 */}
      {showSystemDebug && (
        <div className="bg-black text-green-400 p-4 mb-6 rounded-md text-xs font-mono overflow-x-auto">
          <p className="mb-1">==== システムデバッグ情報 ====</p>
          <p className="mb-1">registerNewEmployees: {registerNewEmployees ? 'true' : 'false'}</p>
          <p className="mb-1">updateEmployeeInfo: {updateEmployeeInfo ? 'true' : 'false'}</p>
          <p className="mb-1">employeeIdColumn: {employeeIdColumn || 'なし'}</p>
          <p className="mb-1">departmentCodeColumn: {departmentCodeColumn || 'なし'}</p>
          <p className="mb-1">isLoading: {isLoading ? 'true' : 'false'}</p>
          <p className="mb-1">settingsLoading: {settingsLoading ? 'true' : 'false'}</p>
          <p className="mb-1">employeeSettingsLoading: {employeeSettingsLoading ? 'true' : 'false'}</p>
          
          {employeeDebugState && (
            <div className="mt-2 border-t border-green-700 pt-2">
              <p className="font-bold">従業員設定デバッグ:</p>
              <pre>{JSON.stringify(employeeDebugState, null, 2)}</pre>
            </div>
          )}
          
          <button 
            onClick={() => setShowSystemDebug(false)}
            className="mt-2 px-2 py-1 bg-green-700 text-white rounded text-xs"
          >
            デバッグ情報を閉じる
          </button>
        </div>
      )}
      
      {/* 開発者用デバッグツール */}
      <DebugTools
        debugMode={debugMode}
        setDebugMode={setDebugMode}
        viewDebugLogs={viewDebugLogs}
        testCSVProcessing={handleTestCSV}
        testSimpleFunction={testSimpleFunction}
        testSimpleCSVProcessing={handleSimpleCSVTest}
        savedSettings={savedSettings}
        saveCurrentSettings={() => saveCurrentSettings({
          employeeIdColumn,
          departmentCodeColumn,
          updateEmployeeInfo,
          registerNewEmployees
        }, payrollItems)}
        loadSavedSettingsList={loadSavedSettingsList}
        applySavedSetting={applySavedSetting}
        deleteSavedSetting={deleteSavedSetting}
        employeeSettings={{
          employeeIdColumn,
          departmentCodeColumn,
          updateEmployeeInfo,
          registerNewEmployees
        }}
        payrollItems={payrollItems}
        refreshSettings={refreshSettings}
      />
      
      {/* 設定チェック - マッピング状態に基づいて警告表示 */}
      {mappingWarning && !settingsLoading && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6">
          <p className="font-bold">設定が必要です</p>
          <p>給与項目とCSVカラムのマッピングが設定されていません。先に給与項目設定画面でマッピングを行ってください。</p>
          <div className="mt-3">
            <a href="/settings/csv-mapping" className="text-blue-600 hover:underline mr-4">
              CSVマッピング設定へ
            </a>
            <a href="/settings/payroll-items" className="text-blue-600 hover:underline">
              給与項目設定へ
            </a>
          </div>
        </div>
      )}
      
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
      
      {/* 従業員情報更新設定 */}
      <EmployeeSettings
        updateEmployeeInfo={updateEmployeeInfo}
        setUpdateEmployeeInfo={setUpdateEmployeeInfo}
        employeeIdColumn={employeeIdColumn}
        departmentCodeColumn={departmentCodeColumn}
        registerNewEmployees={registerNewEmployees}
        setRegisterNewEmployees={setRegisterNewEmployees}
        isLoading={employeeSettingsLoading}
        csvHeaders={csvHeaders}
      />
      
      {/* CSVファイルアップロード */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <FileUploadPanel
          handleFileChange={handleFileSelectWrapper}
          fileName={fileName}
          paymentDate={paymentDate}
          setPaymentDate={setPaymentDate}
          sendEmailDate={sendEmailDate}
          setSendEmailDate={setSendEmailDate}
          handleUpload={handleUpload}
          isLoading={isLoading || settingsLoading || employeeSettingsLoading}
          file={file}
        />
        
        {/* 進捗表示 */}
        <ProgressIndicator 
          isLoading={isLoading} 
          uploadProgress={uploadProgress} 
        />
        
        {/* 成功メッセージ */}
        <SuccessPanel 
          success={success} 
          uploadId={uploadId} 
          isLoading={isLoading} 
          testEmailNotification={handleEmailNotification} 
        />
      </div>
      
      {/* マッピング情報表示 */}
      {!settingsLoading && (
        <MappingDisplay 
          payrollItems={payrollItems}
          refreshSettings={refreshSettings}
          onCategoryChange={handleCategoryChange}
        />
      )}
    </div>
  );
}

export default CsvUpload;
