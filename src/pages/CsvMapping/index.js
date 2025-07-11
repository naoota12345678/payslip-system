// src/pages/CsvMapping/index.js
// CSVマッピング設定ページのメインコンポーネント

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// カスタムフック
import useMappingConfig from './hooks/useMappingConfig';
import useHeaderParser from './hooks/useHeaderParser';
import useDebounce from './hooks/useDebounce';

// コンポーネント
import HeaderInputPanel from './components/HeaderInputPanel';
import MainFieldsSection from './components/MainFieldsSection';
import ItemTabs from './components/ItemTabs';
import JsonImportPanel from './components/JsonImportPanel';

// ユーティリティと定数
import { systemColumns, TABS } from './constants';
import { 
  updateMainFieldMapping, 
  updateItemName, 
  updateItemVisibility, 
  addItemToCategory, 
  removeItemFromCategory,
  validateMappingConfig
} from './utils/mappingHelpers';

function CsvMapping() {
  const navigate = useNavigate();
  const { userDetails } = useAuth();
  
  // マッピング設定の管理
  const {
    mappingConfig,
    setMappingConfig,
    loading,
    saving,
    error,
    setError,
    success,
    setSuccess,
    saveMappingConfig,
    importFromJson,
    debugData
  } = useMappingConfig(userDetails);
  
  // アクティブなタブを管理
  const [activeTab, setActiveTab] = useState(TABS.INCOME);
  
  // JSONインポート
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  
  // ヘッダー解析の管理 - 初期マッピング設定を渡す
  const {
    headerInput,
    setHeaderInput,
    kyItemInput,
    setKyItemInput,
    rowBasedInput,
    setRowBasedInput,
    parsedHeaders,
    setParsedHeaders,
    kyMappingMode,
    setKyMappingMode,
    rowMappingMode,
    setRowMappingMode,
    handleHeadersParse,
    handleKyMapping,
    handleRowBasedMapping,
    resetInputMode
  } = useHeaderParser(
    setMappingConfig,
    setError,
    setSuccess,
    setActiveTab,
    mappingConfig  // 初期マッピング設定を渡す
  );
  
  // マッピング設定が読み込まれたら、必要な情報を復元
  useEffect(() => {
    if (mappingConfig && !loading) {
      console.log('マッピング設定が読み込まれました。保存された状態を復元します:', mappingConfig);
      
      // 入力フィールドの状態を復元
      if (mappingConfig.headerInput) {
        setHeaderInput(mappingConfig.headerInput);
      }
      if (mappingConfig.kyItemInput) {
        setKyItemInput(mappingConfig.kyItemInput);
      }
      if (mappingConfig.rowBasedInput) {
        setRowBasedInput(mappingConfig.rowBasedInput);
        
        // 行ベースモードが使用されていた場合はそのモードを表示
        setRowMappingMode(true);
      }
      
      // 解析済みヘッダーの復元
      if (mappingConfig.parsedHeaders && mappingConfig.parsedHeaders.length > 0) {
        setParsedHeaders(mappingConfig.parsedHeaders);
      }
    }
  }, [mappingConfig, loading, setHeaderInput, setKyItemInput, setRowBasedInput, setParsedHeaders]);

  // デバウンスされたマッピング設定
  const debouncedMappingConfig = useDebounce(mappingConfig, 1000);
  
  // 設定変更時に従業員ID/部門コード列を抽出し、CSVマッピング設定を更新する
  useEffect(() => {
    const updateEmployeeMapping = async () => {
      if (!userDetails?.companyId || !debouncedMappingConfig) return;

      try {
        // 現在のマッピングから従業員ID列と部門コード列を抽出
        const employeeIdColumn = Object.entries(debouncedMappingConfig.mainFields)
          .find(([key]) => key === 'employeeCode')?.[1]?.headerName || '';
        
        const departmentCodeColumn = Object.entries(debouncedMappingConfig.mainFields)
          .find(([key]) => key === 'departmentCode')?.[1]?.headerName || '';

        // 既に設定をロード中または保存中の場合はスキップ
        if (loading || saving) return;

        // 従業員情報のCSV連携設定を更新
        await setDoc(doc(db, "csvSettings", userDetails.companyId), {
          employeeIdColumn,
          departmentCodeColumn,
          updatedAt: new Date()
        }, { merge: true });

        console.log('従業員情報CSV連携設定を保存しました:', {
          employeeIdColumn,
          departmentCodeColumn
        });
      } catch (err) {
        console.error('従業員マッピング更新エラー:', err);
      }
    };

    // デバウンスされたマッピング設定が変更されたら更新
    if (debouncedMappingConfig && userDetails?.companyId && !loading) {
      updateEmployeeMapping();
    }
  }, [debouncedMappingConfig, userDetails, loading, saving]);
  
  // 主要フィールドのマッピングを更新するハンドラ
  const handleUpdateMainFieldMapping = useCallback((field, columnIndex) => {
    setMappingConfig(prev => 
      updateMainFieldMapping(field, columnIndex, parsedHeaders, prev)
    );
  }, [parsedHeaders]);
  
  // 項目の表示名を更新するハンドラ
  const handleUpdateItemName = useCallback((category, index, itemName) => {
    setMappingConfig(prev => {
      const newItems = [...prev[category]];
      newItems[index] = { ...newItems[index], itemName };
      return { ...prev, [category]: newItems };
    });
  }, []);
  
  // 項目の表示/非表示を更新するハンドラ
  const handleUpdateItemVisibility = useCallback((category, index, isVisible) => {
    setMappingConfig(prev => {
      const newItems = [...prev[category]];
      newItems[index] = { ...newItems[index], isVisible };
      return { ...prev, [category]: newItems };
    });
  }, []);
  
  // 項目の追加ハンドラ
  const handleAddItem = useCallback((category, headerName) => {
    setMappingConfig(prev => 
      addItemToCategory(category, headerName, parsedHeaders, prev)
    );
  }, [parsedHeaders]);
  
  // 項目の削除ハンドラ
  const handleRemoveItem = useCallback((category, index) => {
    setMappingConfig(prev => 
      removeItemFromCategory(category, index, prev)
    );
  }, []);
  
  // 設定を保存するハンドラ
  const handleSave = useCallback(async () => {
    const configToSave = {
      ...mappingConfig,
      headerInput,
      kyItemInput,
      rowBasedInput
    };
    await saveMappingConfig(configToSave, validateMappingConfig);
  }, [mappingConfig, headerInput, kyItemInput, rowBasedInput, saveMappingConfig]);
  
  // JSONからインポートするハンドラ
  const handleJsonImport = useCallback(() => {
    const success = importFromJson(jsonInput);
    if (success) {
      setShowJsonImport(false);
    }
  }, [jsonInput, importFromJson]);
  
  // 行ベースマッピングのハンドラ
  const processRowBasedMapping = useCallback(() => {
    if (!rowBasedInput.trim()) {
      setError('2行のデータを入力してください');
      return;
    }
    
    // 入力を行に分割
    const rows = rowBasedInput.split('\n').filter(row => row.trim().length > 0);
    
    // 少なくとも2行（ヘッダー行とデータ行）が必要
    if (rows.length < 2) {
      setError('少なくとも2行（ヘッダー行とデータ行）が必要です');
      return;
    }
    
    // 行ベースマッピングを実行
    handleRowBasedMapping(rows);
  }, [rowBasedInput, handleRowBasedMapping, setError]);
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">設定の読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">CSVマッピング設定</h1>
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
      
      {/* デバッグ情報表示（開発中のみ表示） */}
      {debugData && process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 p-4 mb-6 rounded text-xs">
          <p className="font-bold mb-1">デバッグ情報:</p>
          <p>保存形式: {debugData.newFormat ? 'あり' : 'なし'}</p>
          <p>旧形式: {debugData.oldFormat ? 'あり' : 'なし'}</p>
          <p>rowBasedInput: {rowBasedInput ? '設定あり' : 'なし'}</p>
          <p>parsedHeaders: {parsedHeaders.length}件</p>
        </div>
      )}
      
      {/* CSVヘッダー一括入力セクション */}
      <HeaderInputPanel
        kyMappingMode={kyMappingMode}
        setKyMappingMode={setKyMappingMode}
        headerInput={headerInput}
        setHeaderInput={setHeaderInput}
        kyItemInput={kyItemInput}
        setKyItemInput={setKyItemInput}
        rowMappingMode={rowMappingMode}
        setRowMappingMode={setRowMappingMode}
        rowBasedInput={rowBasedInput}
        setRowBasedInput={setRowBasedInput}
        handleHeadersParse={handleHeadersParse}
        handleKyMapping={handleKyMapping}
        handleRowBasedMapping={processRowBasedMapping}
        systemColumns={systemColumns}
      />
      
      {/* マッピング設定セクション */}
      {parsedHeaders.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="p-6">
            <JsonImportPanel 
              showJsonImport={showJsonImport}
              setShowJsonImport={setShowJsonImport}
              jsonInput={jsonInput}
              setJsonInput={setJsonInput}
              handleJsonImport={handleJsonImport}
            />
            
            <MainFieldsSection 
              mappingConfig={mappingConfig}
              updateMainFieldMapping={handleUpdateMainFieldMapping}
              parsedHeaders={parsedHeaders}
            />
            
            <ItemTabs 
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              mappingConfig={mappingConfig}
              parsedHeaders={parsedHeaders}
              onUpdateItemName={handleUpdateItemName}
              onUpdateItemVisibility={handleUpdateItemVisibility}
              onRemoveItem={handleRemoveItem}
              onAddItem={handleAddItem}
            />
            
            {/* 保存ボタン */}
            <div className="pt-5 border-t">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                >
                  {saving ? '保存中...' : '設定を保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CsvMapping;
