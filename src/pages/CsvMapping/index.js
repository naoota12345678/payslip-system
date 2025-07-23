// src/pages/CsvMapping/index.js
// CSVマッピング設定ページのメインコンポーネント

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// カスタムフック
import { useSimpleMappingConfig } from './hooks/useSimpleMappingConfig';
import useHeaderParser from './hooks/useHeaderParser';
import useDebounce from './hooks/useDebounce';

// コンポーネント
import HeaderInputPanel from './components/HeaderInputPanel';
import MainFieldsSection from './components/MainFieldsSection';
import ItemTabs from './components/ItemTabs';
import JsonImportPanel from './components/JsonImportPanel';

// ユーティリティと定数
import { TABS } from './constants';
import { 
  // updateMainFieldMapping, 
  updateItemName, 
  updateItemVisibility, 
  addItemToCategory, 
  removeItemFromCategory,
  moveItemBetweenCategories,
  validateMappingConfig,
  convertToNewFormat,
  debugMappingFormats,
  generateDeterministicId
} from './utils/mappingHelpers';
import { createDirectFirebaseData } from './utils/directSave';

function CsvMapping() {
  const navigate = useNavigate();
  const { userDetails } = useAuth();
  
  // シンプルなマッピング設定の管理
  const {
    mappingConfig,
    setMappingConfig,
    parsedHeaders,
    setParsedHeaders,
    headerInput,
    setHeaderInput,
    rowBasedInput,
    setRowBasedInput,
    loading,
    saving,
    error,
    setError,
    success,
    setSuccess,
    createFromInput,
    saveMapping,
    resetMapping
  } = useSimpleMappingConfig(userDetails);
  
  // アクティブなタブを管理
  const [activeTab, setActiveTab] = useState(TABS.INCOME);
  
  // JSONインポート
  const [jsonInput, setJsonInput] = useState('');
  const [showJsonImport, setShowJsonImport] = useState(false);
  
  // ヘッダー解析の管理（シンプル版では使用しない） 
  const {
    kyItemInput,
    setKyItemInput,
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
  
  // シンプル版では自動復元処理は不要（useSimpleMappingConfigで処理済み）

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
  
  // 基本項目マッピング更新ハンドラー
  const handleUpdateMainFieldMapping = useCallback((field, selectedHeaderName) => {
    setMappingConfig(prev => {
      const updated = { ...prev };
      if (!updated.mainFields) {
        updated.mainFields = {};
      }
      
      if (selectedHeaderName && selectedHeaderName.trim()) {
        const allItems = [
          ...(updated.incomeItems || []),
          ...(updated.deductionItems || []),
          ...(updated.attendanceItems || []),
          ...(updated.itemCodeItems || []),
          ...(updated.kyItems || [])
        ];
        
        // 🔧 データ構造の修正：headerNameが日本語の場合は記号と交換
        const fixedItems = allItems.map(item => {
          if (item.headerName && item.itemName && 
              !item.headerName.startsWith('KY') && item.itemName.startsWith('KY')) {
            return {
              ...item,
              headerName: item.itemName,  // 記号をheaderNameに
              itemName: item.headerName   // 日本語をitemNameに
            };
          }
          return item;
        });
        
        // headerName（記号）で検索して、対応するアイテムを見つける
        const matchedItem = fixedItems.find(item => item.headerName === selectedHeaderName);
        
        if (matchedItem) {
          updated.mainFields[field] = {
            columnIndex: matchedItem.columnIndex,
            headerName: selectedHeaderName, // 記号を保存
            itemName: matchedItem.itemName  // 日本語名を保存
          };
          
          console.log(`✅ 基本項目マッピング更新: ${field}`, {
            headerName: selectedHeaderName,
            itemName: matchedItem.itemName,
            columnIndex: matchedItem.columnIndex
          });
        } else {
          console.warn(`⚠️ 記号が見つからない: ${selectedHeaderName}`);
        }
      } else {
        updated.mainFields[field] = {
          columnIndex: -1,
          headerName: '',
          itemName: ''
        };
        console.log(`❌ 基本項目マッピング解除: ${field}`);
      }
      
      return updated;
    });
  }, []);
  
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
                id: generateDeterministicId('itemCode', item.itemName, item.columnIndex)
              });
            } else {
              fixed.itemCodeItems.push({
                ...item,
                itemCode: item.kyItem || item.headerName,
                id: generateDeterministicId('itemCode', item.headerName, item.columnIndex)
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

  // 項目名の一括設定ハンドラ（空の項目名を修復）
  const handleFixEmptyItemNames = useCallback(() => {
    setMappingConfig(prev => {
      const fixed = { ...prev };
      
      // 各カテゴリの空のitemNameを修復
      const fixCategory = (categoryName, items) => {
        return items.map(item => {
          if (!item.itemName || item.itemName.trim() === '') {
            // デフォルトの表示名を提案
            let suggestedName = item.headerName;
            
            // 一般的な項目名のマッピング
            const commonMappings = {
              'KY11_0': '出勤日数',
              'KY11_1': '欠勤日数', 
              'KY11_2': '有給日数',
              'KY21_0': '基本給',
              'KY21_1': '残業手当',
              'KY22_0': '健康保険',
              'KY22_1': '厚生年金',
              'KY22_2': '雇用保険',
              'KY03': '従業員コード',
              'KY02': '部門コード',
              'KY01': '識別コード'
            };
            
            if (commonMappings[item.headerName]) {
              suggestedName = commonMappings[item.headerName];
            } else if (item.headerName?.includes('KY11')) {
              suggestedName = '勤怠項目';
            } else if (item.headerName?.includes('KY21')) {
              suggestedName = '支給項目';
            } else if (item.headerName?.includes('KY22')) {
              suggestedName = '控除項目';
            }
            
            console.log(`[修復] ${item.headerName} → ${suggestedName}`);
            
            return {
              ...item,
              itemName: suggestedName
            };
          }
          return item;
        });
      };
      
      // 各カテゴリを修復
      if (fixed.incomeItems) {
        fixed.incomeItems = fixCategory('incomeItems', fixed.incomeItems);
      }
      if (fixed.deductionItems) {
        fixed.deductionItems = fixCategory('deductionItems', fixed.deductionItems);
      }
      if (fixed.attendanceItems) {
        fixed.attendanceItems = fixCategory('attendanceItems', fixed.attendanceItems);
      }
      if (fixed.itemCodeItems) {
        fixed.itemCodeItems = fixCategory('itemCodeItems', fixed.itemCodeItems);
      }
      if (fixed.kyItems) {
        fixed.kyItems = fixCategory('kyItems', fixed.kyItems);
      }
      
      return fixed;
    });
    
    setSuccess('空の項目名を一括修復しました。必要に応じて調整してください。');
  }, [setSuccess, setMappingConfig]);

  // ヘッダーをクリアするハンドラ
  const handleClearHeaders = useCallback(() => {
    setParsedHeaders([]);
    setSuccess('ヘッダーをクリアしました。新しい行マッピングを実行してください。');
  }, [setParsedHeaders, setSuccess]);

  // シンプルな保存ハンドラー
  const handleSave = async () => {
    const success = await saveMapping();
    if (success) {
      setSuccess('設定を保存しました。他のページに移動しても設定が保持されます。');
    }
  };
  
  // JSONからインポートするハンドラ（シンプル版では無効化）
  const handleJsonImport = useCallback(() => {
    setError('シンプル版ではJSONインポートは利用できません');
  }, [setError]);

  // リセット機能のハンドラ
  const handleResetMapping = useCallback(async () => {
    if (window.confirm('マッピング設定をリセットしますか？')) {
      resetMapping();
    }
  }, [resetMapping]);

  const handleResetAll = useCallback(async () => {
    if (window.confirm('全ての設定をリセットしますか？')) {
      resetMapping();
    }
  }, [resetMapping]);

  const handleDeleteFromFirestore = useCallback(async () => {
    if (window.confirm('⚠️ 警告: マッピング設定を削除しますか？')) {
      resetMapping();
    }
  }, [resetMapping]);
  
  // シンプル保存（マッピング作成＋保存）
  const processRowBasedMapping = useCallback(async () => {
    if (!rowBasedInput.trim()) {
      setError('2行のデータを入力してください');
      return;
    }
    
    const rows = rowBasedInput.split('\n').filter(row => row.trim().length > 0);
    
    if (rows.length < 2) {
      setError('少なくとも2行（項目名行とコード行）が必要です');
      return;
    }
    
    // マッピング作成
    const result = createFromInput(rows[0], rows[1]);
    
    if (result) {
      // 作成成功したら自動保存
      const success = await saveMapping();
      if (success) {
        setSuccess('マッピングを作成して保存しました。他のページに移動しても設定が保持されます。');
      }
    }
  }, [rowBasedInput, createFromInput, saveMapping, setError, setSuccess]);
  
  // 古いヘッダーデータを削除するハンドラ（シンプル版）
  const handleCleanupOldHeaders = useCallback(async () => {
    if (!userDetails?.companyId) return;
    
    try {
      // 現在のparsedHeadersをクリア
      setParsedHeaders([]);
      setSuccess('ヘッダーデータをクリアしました');
    } catch (error) {
      setError('ヘッダーデータのクリアに失敗しました: ' + error.message);
    }
  }, [userDetails, setParsedHeaders, setSuccess, setError]);

  // 完全リセット機能（シンプル版）
  const handleCompleteReset = useCallback(async () => {
    if (!userDetails?.companyId) return;
    
    if (!window.confirm('⚠️ 警告：すべてのマッピングデータをリセットします。続行しますか？')) {
      return;
    }
    
    try {
      // シンプル版では直接リセット関数を使用
      resetMapping();
      setSuccess('✅ すべてのデータをリセットしました');
    } catch (error) {
      setError('リセットに失敗しました: ' + error.message);
    }
  }, [userDetails, resetMapping, setSuccess, setError]);

  // 新しいシンプルシステム用のクリア機能
  const handleSwitchToSimpleSystem = useCallback(async () => {
    if (!window.confirm('🎯 新しいシンプルマッピングシステムに切り替えますか？\n\n複雑な処理を排除して、直接的なマッピングを行います。')) {
      return;
    }
    
    // 現在の状態をクリア
    setParsedHeaders([]);
    setHeaderInput('');
    setKyItemInput('');
    setRowBasedInput('');
    
    // シンプルなマッピング設定に初期化
    setMappingConfig({
      mainFields: {},
      incomeItems: [],
      deductionItems: [],
      attendanceItems: [],
      itemCodeItems: [],
      kyItems: [],
      summaryItems: []
    });
    
    setSuccess('✅ 新しいシンプルマッピングシステムに切り替えました！\n\n2行入力（項目名、項目コード）で直接マッピングを作成してください。');
  }, [setParsedHeaders, setHeaderInput, setKyItemInput, setRowBasedInput, setMappingConfig, setSuccess]);

  // ダイレクト保存（シンプル版では無効化）
  const handleDirectSave = useCallback(async () => {
    setError('この機能はシンプル版では利用できません。「🎯 シンプル保存」ボタンを使用してください。');
  }, [setError]);

  // MainFieldsSectionにpropsを渡す際の修正
  // 行ベースマッピングモード時は、KYシステム用のヘッダーを優先使用
  // 不要な関数を削除
  // getMainFieldsParsedHeaders関数は混乱の元なので削除
  // 基本情報マッピングには常にCSVの実際のヘッダー（KYコード）を表示すべき
  
  console.log('🔍 基本情報マッピング用ヘッダー確認:');
  console.log('- parsedHeaders（使用予定）:', parsedHeaders);
  console.log('- parsedHeaders長さ:', parsedHeaders?.length);
  console.log('- 先頭5個:', parsedHeaders?.slice(0, 5));

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
              <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">CSVマッピング設定</h2>
          <div className="flex space-x-2">
            <button
              onClick={processRowBasedMapping}
              disabled={saving || !rowBasedInput.trim()}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-400 text-sm"
            >
              {saving ? '保存中...' : '🎯 シンプル保存'}
            </button>
          </div>
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
      
      {/* デバッグ情報表示（シンプル版では無効化） */}
      
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
        handleDirectSave={handleDirectSave}
        saving={saving}
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
