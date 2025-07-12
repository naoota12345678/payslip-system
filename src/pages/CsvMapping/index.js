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
  moveItemBetweenCategories,
  validateMappingConfig,
  generateDeterministicId
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
        console.log('headerInputを復元:', mappingConfig.headerInput);
        setHeaderInput(mappingConfig.headerInput);
      }
      if (mappingConfig.kyItemInput) {
        console.log('kyItemInputを復元:', mappingConfig.kyItemInput);
        setKyItemInput(mappingConfig.kyItemInput);
      }
      if (mappingConfig.rowBasedInput) {
        console.log('rowBasedInputを復元:', mappingConfig.rowBasedInput);
        setRowBasedInput(mappingConfig.rowBasedInput);
        
        // 行ベースモードが使用されていた場合はそのモードを表示
        setRowMappingMode(true);
      }
      
      // 解析済みヘッダーの復元 - 複数のソースから復元を試みる
      let headersToRestore = [];
      
      // 1. 保存されたparsedHeadersから復元
      if (mappingConfig.parsedHeaders && mappingConfig.parsedHeaders.length > 0) {
        console.log('保存されたparsedHeadersを復元:', mappingConfig.parsedHeaders);
        headersToRestore = mappingConfig.parsedHeaders;
      }
      // 2. itemCodeItemsから復元
      else if (mappingConfig.itemCodeItems && mappingConfig.itemCodeItems.length > 0) {
        console.log('itemCodeItemsからヘッダーを復元:', mappingConfig.itemCodeItems.length, '個');
        headersToRestore = mappingConfig.itemCodeItems
          .map(item => item.headerName)
          .filter(Boolean);
        console.log('復元されたヘッダー:', headersToRestore);
      }
      // 3. kyItemsから復元
      else if (mappingConfig.kyItems && mappingConfig.kyItems.length > 0) {
        console.log('kyItemsからヘッダーを復元:', mappingConfig.kyItems.length, '個');
        headersToRestore = mappingConfig.kyItems
          .map(item => item.headerName)
          .filter(Boolean);
        console.log('復元されたヘッダー:', headersToRestore);
      }
      // 4. 他のカテゴリから復元
      else {
        const allItems = [
          ...(mappingConfig.incomeItems || []),
          ...(mappingConfig.deductionItems || []),
          ...(mappingConfig.attendanceItems || [])
        ];
        if (allItems.length > 0) {
          console.log('その他の項目からヘッダーを復元:', allItems.length, '個');
          headersToRestore = allItems
            .map(item => item.headerName)
            .filter(Boolean);
          console.log('復元されたヘッダー:', headersToRestore);
        }
      }
      
      // ヘッダーを設定
      if (headersToRestore.length > 0) {
        console.log('parsedHeadersを設定:', headersToRestore);
        setParsedHeaders(headersToRestore);
      } else {
        console.log('復元可能なヘッダーが見つかりませんでした');
      }
    }
  }, [mappingConfig, loading, setHeaderInput, setKyItemInput, setRowBasedInput, setParsedHeaders, setRowMappingMode]);

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
  
  // 項目の移動ハンドラ
  const handleMoveItem = useCallback((fromCategory, itemIndex, toCategory) => {
    setMappingConfig(prev => 
      moveItemBetweenCategories(fromCategory, itemIndex, toCategory, prev)
    );
    setSuccess(`項目を${fromCategory}から${toCategory}に移動しました。`);
  }, [setSuccess]);
  
  // KY項目のヘッダー名と表示名を修正するハンドラ
  const handleFixKyItemsMapping = useCallback(() => {
    setMappingConfig(prev => {
      const fixed = { ...prev };
      
      // KY項目の headerName と itemName を修正
      if (fixed.kyItems && fixed.kyItems.length > 0) {
        fixed.kyItems = fixed.kyItems.map(item => {
          // KY項目コードが itemName に入っている場合は修正
          if (item.itemName && item.itemName.startsWith('KY') && 
              item.headerName && !item.headerName.startsWith('KY')) {
            console.log('KY項目を修正:', item.headerName, '<->', item.itemName);
            return {
              ...item,
              headerName: item.itemName,  // KY項目コードを headerName に
              itemName: item.headerName   // 日本語項目名を itemName に
            };
          }
          return item;
        });
      }
      
      // 他のカテゴリも同様に修正
      ['incomeItems', 'deductionItems', 'attendanceItems'].forEach(category => {
        if (fixed[category] && fixed[category].length > 0) {
          fixed[category] = fixed[category].map(item => {
            if (item.itemName && item.itemName.startsWith('KY') && 
                item.headerName && !item.headerName.startsWith('KY')) {
              console.log(`${category}項目を修正:`, item.headerName, '<->', item.itemName);
              return {
                ...item,
                headerName: item.itemName,  // KY項目コードを headerName に
                itemName: item.headerName   // 日本語項目名を itemName に
              };
            }
            return item;
          });
        }
      });
      
      return fixed;
    });
    
    setSuccess('KY項目のマッピングを修正しました。保存してください。');
  }, [setSuccess]);

  // 項目コードのヘッダー名と表示名を修正するハンドラ
  const handleFixItemCodeMapping = useCallback(() => {
    setMappingConfig(prev => {
      const fixed = { ...prev };
      
      // 項目コードの headerName と itemName を修正
      if (fixed.itemCodeItems && fixed.itemCodeItems.length > 0) {
        fixed.itemCodeItems = fixed.itemCodeItems.map(item => {
          // 項目コードが itemName に入っている場合は修正
          if (item.itemName && /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.itemName) && 
              item.headerName && !/^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.headerName)) {
            console.log('項目コードを修正:', item.headerName, '<->', item.itemName);
            return {
              ...item,
              headerName: item.itemName,  // 項目コードを headerName に
              itemName: item.headerName   // 日本語項目名を itemName に
            };
          }
          return item;
        });
      }
      
      // 旧KY項目データがある場合は項目コードに移行
      if (fixed.kyItems && fixed.kyItems.length > 0) {
        console.log('旧KY項目データを項目コードデータに移行します');
        fixed.itemCodeItems = fixed.itemCodeItems || [];
        fixed.kyItems.forEach(item => {
          const existingItem = fixed.itemCodeItems.find(codeItem => 
            codeItem.columnIndex === item.columnIndex
          );
          if (!existingItem) {
            // 項目コードが itemName に入っている場合は修正
            if (item.itemName && /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.itemName) && 
                item.headerName && !/^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.headerName)) {
              fixed.itemCodeItems.push({
                ...item,
                headerName: item.itemName,  // 項目コードを headerName に
                itemName: item.headerName,  // 日本語項目名を itemName に
                itemCode: item.itemName,    // 項目コードを保存
                id: item.id || generateDeterministicId('itemCode', item.itemName, item.columnIndex)
              });
            } else {
              fixed.itemCodeItems.push({
                ...item,
                itemCode: item.kyItem || item.headerName,
                id: item.id || generateDeterministicId('itemCode', item.headerName, item.columnIndex)
              });
            }
          }
        });
        // 旧KY項目データを削除
        delete fixed.kyItems;
      }
      
      // 他のカテゴリも同様に修正
      ['incomeItems', 'deductionItems', 'attendanceItems'].forEach(category => {
        if (fixed[category] && fixed[category].length > 0) {
          fixed[category] = fixed[category].map(item => {
            if (item.itemName && /^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.itemName) && 
                item.headerName && !/^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item.headerName)) {
              console.log(`${category}項目を修正:`, item.headerName, '<->', item.itemName);
              return {
                ...item,
                headerName: item.itemName,  // 項目コードを headerName に
                itemName: item.headerName,  // 日本語項目名を itemName に
                itemCode: item.itemName     // 項目コードを保存
              };
            }
            return item;
          });
        }
      });
      
      return fixed;
    });
    
    setSuccess('項目コードのマッピングを修正しました。保存してください。');
  }, [setSuccess]);

  // 設定を保存するハンドラ
  const handleSave = useCallback(async () => {
    const configToSave = {
      ...mappingConfig,
      headerInput,
      kyItemInput,
      rowBasedInput,
      parsedHeaders // 解析済みヘッダーも保存
    };
    console.log('保存する設定:', configToSave);
    const success = await saveMappingConfig(configToSave, validateMappingConfig);
    if (success) {
      setSuccess('設定を正常に保存しました。ページを再読み込みしても設定が保持されます。');
    }
  }, [mappingConfig, headerInput, kyItemInput, rowBasedInput, parsedHeaders, saveMappingConfig, setSuccess]);
  
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

  // デバッグ: 現在のマッピング設定を表示
  console.log('=== 現在のマッピング設定 ===');
  console.log('項目コード:', mappingConfig.itemCodeItems);
  console.log('旧KY項目:', mappingConfig.kyItems);
  console.log('支給項目:', mappingConfig.incomeItems);
  console.log('控除項目:', mappingConfig.deductionItems);
  console.log('勤怠項目:', mappingConfig.attendanceItems);
  console.log('=== デバッグ終了 ===');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">CSVマッピング設定</h1>
        <div className="flex space-x-2">
          <button
            onClick={handleFixItemCodeMapping}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            項目コードを修正
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            {saving ? '保存中...' : '設定を保存'}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            システム設定に戻る
          </button>
        </div>
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
              onMoveItem={handleMoveItem}
              onAddItem={handleAddItem}
            />
            

          </div>
        </div>
      )}
    </div>
  );
}

export default CsvMapping;
