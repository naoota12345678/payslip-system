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
  
  // マッピング設定の管理
  const {
    mappingConfig,
    setMappingConfig,
    loading,
    saving,
    setSaving,  // 追加
    error,
    setError,
    success,
    setSuccess,
    saveMappingConfig,
    importFromJson,
    debugData,
    resetMappingConfig,
    resetCategoryMapping
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
        
        // ⚠️ 自動モード設定を無効化：保存されたデータがあっても自動でモードはONしない
        // setRowMappingMode(true);
      }
      
      // 解析済みヘッダーの復元 - 明示的に保存されたもののみ復元
      let headersToRestore = [];
      
      // ⚠️ 自動復元を完全停止：ユーザーが手動でのみヘッダーを設定
      // 常に空の状態でスタートし、必要な時のみ手動で行マッピングを実行
      console.log('⚠️ ヘッダーの自動復元を停止 - 常に空の状態でスタート');
      
      // if (mappingConfig.parsedHeaders && mappingConfig.parsedHeaders.length > 0) {
      //   console.log('✅ 明示的に保存されたparsedHeadersを復元:', mappingConfig.parsedHeaders);
      //   headersToRestore = mappingConfig.parsedHeaders;
      //   
      //   // ヘッダーを設定
      //   console.log('parsedHeadersを設定:', headersToRestore);
      //   setParsedHeaders(headersToRestore);
      // } else {
      //   console.log('⚠️ 明示的に保存されたヘッダーが見つかりません - 自動復元はスキップ');
      // }
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
    setMappingConfig(prev => {
      const updated = { ...prev };
      if (!updated.mainFields) {
        updated.mainFields = {};
      }
      
      const index = parseInt(columnIndex);
      if (index >= 0 && parsedHeaders[index]) {
        // 選択されたindexに対応する実際のヘッダー名（日本語）を取得
        const selectedHeaderName = parsedHeaders[index];
        
        // そのヘッダー名に対応する記号（itemName）を検索
        const allItems = [
          ...(prev.incomeItems || []),
          ...(prev.deductionItems || []),
          ...(prev.attendanceItems || []),
          ...(prev.itemCodeItems || []),
          ...(prev.kyItems || [])
        ];
        
        const matchedItem = allItems.find(item => item.headerName === selectedHeaderName);
        const itemCode = matchedItem?.itemName || selectedHeaderName;
        
        console.log(`🔧 基本項目マッピング更新: ${field}`, {
          selectedIndex: index,
          selectedHeaderName: selectedHeaderName,
          matchedItem: matchedItem,
          itemCode: itemCode
        });
        
        updated.mainFields[field] = {
          columnIndex: index,
          headerName: itemCode,  // 記号を保存
          itemName: selectedHeaderName  // 日本語も保存
        };
      } else {
        updated.mainFields[field] = {
          columnIndex: -1,
          headerName: ''
        };
      }
      
      return updated;
    });
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

  // 設定を保存するハンドラ
  const handleSave = async () => {
    try {
      console.log('=== 保存処理開始 ===');
      console.log('保存対象の設定:', mappingConfig);
      
      // 空の項目名をチェック
      const emptyItemNames = [];
      const checkCategory = (categoryName, items) => {
        items?.forEach((item, index) => {
          if (!item.itemName || item.itemName.trim() === '') {
            emptyItemNames.push(`${categoryName}[${index}]: ${item.headerName}`);
          }
        });
      };
      
      checkCategory('支給項目', mappingConfig.incomeItems);
      checkCategory('控除項目', mappingConfig.deductionItems);
      checkCategory('勤怠項目', mappingConfig.attendanceItems);
      checkCategory('項目コード', mappingConfig.itemCodeItems);
      
      // 警告表示
      if (emptyItemNames.length > 0) {
        const confirmMessage = `以下の項目で表示名が設定されていません：\n${emptyItemNames.join('\n')}\n\nこのまま保存しますか？（「項目名を一括修復」ボタンで自動設定することもできます）`;
        if (!window.confirm(confirmMessage)) {
          return;
        }
      }
      
             const configToSave = {
         ...mappingConfig,
         headerInput,
         kyItemInput,
         rowBasedInput
         // ⚠️ parsedHeadersの保存を停止（ヘッダー固定化を防ぐ）
         // parsedHeaders // 解析済みヘッダーも保存
       };
       console.log('保存する設定:', configToSave);
       const success = await saveMappingConfig(configToSave, validateMappingConfig);
       if (success) {
         console.log('=== 保存成功 ===');
         setSuccess('設定を正常に保存しました。ページを再読み込みしても設定が保持されます。');
       }
    } catch (error) {
      console.error('=== 保存エラー ===', error);
      setError('保存中にエラーが発生しました: ' + error.message);
    }
  };
  
  // JSONからインポートするハンドラ
  const handleJsonImport = useCallback(() => {
    const success = importFromJson(jsonInput);
    if (success) {
      setShowJsonImport(false);
    }
  }, [jsonInput, importFromJson]);

  // リセット機能のハンドラ
  const handleResetMapping = useCallback(async () => {
    if (window.confirm('マッピング設定をリセットしますか？（ヘッダー情報は保持されます）')) {
      await resetMappingConfig('mapping');
    }
  }, [resetMappingConfig]);

  const handleResetAll = useCallback(async () => {
    if (window.confirm('全ての設定をリセットしますか？（保存されたデータも削除されます）')) {
      await resetMappingConfig('all');
    }
  }, [resetMappingConfig]);

  const handleDeleteFromFirestore = useCallback(async () => {
    if (window.confirm('⚠️ 警告: Firestoreからマッピング設定を完全に削除しますか？\n\nこの操作は取り消せません。')) {
      await resetMappingConfig('firestore');
    }
  }, [resetMappingConfig]);
  
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
  
  // 古いヘッダーデータを削除するハンドラ
  const handleCleanupOldHeaders = useCallback(async () => {
    if (!userDetails?.companyId) return;
    
    try {
      setSaving(true);
      
      // csvSettingsから古いparsedHeadersを削除
      await setDoc(doc(db, 'csvSettings', userDetails.companyId), {
        parsedHeaders: null,
        updatedAt: new Date()
      }, { merge: true });
      
      // 現在のparsedHeadersもクリア
      setParsedHeaders([]);
      
      setSuccess('古いヘッダーデータを削除しました。これで固定化問題が解決されます。');
    } catch (error) {
      setError('古いヘッダーデータの削除に失敗しました: ' + error.message);
    } finally {
      setSaving(false);
    }
  }, [userDetails, setParsedHeaders, setSuccess, setError, setSaving]);

  // 完全リセット機能を追加
  const handleCompleteReset = useCallback(async () => {
    if (!userDetails?.companyId) return;
    
    if (!window.confirm('⚠️ 警告：すべてのマッピングデータを削除して初期状態に戻します。この操作は取り消せません。続行しますか？')) {
      return;
    }
    
    try {
      setSaving(true);
      
      // csvMappingsを完全削除
      await setDoc(doc(db, 'csvMappings', userDetails.companyId), {
        attendanceItems: [],
        deductionItems: [],
        incomeItems: [],
        itemCodeItems: [],
        kyItems: [],
        summaryItems: [],
        mainFields: {},
        parsedHeaders: [],
        headerInput: '',
        rowBasedInput: '',
        kyItemInput: '',
        simpleMapping: {},
        version: 'simple_v1',
        updatedAt: new Date(),
        updatedBy: userDetails.email || ''
      });
      
      // csvSettingsも完全削除
      await setDoc(doc(db, 'csvSettings', userDetails.companyId), {
        employeeIdColumn: '',
        departmentCodeColumn: '',
        headerInput: '',
        rowBasedInput: '',
        itemCodeItems: [],
        kyItems: [],
        updatedAt: new Date()
      });
      
      // 現在の状態もリセット
      setParsedHeaders([]);
      setHeaderInput('');
      setKyItemInput('');
      setRowBasedInput('');
      
      // マッピング設定もリセット
      setMappingConfig({
        mainFields: {},
        incomeItems: [],
        deductionItems: [],
        attendanceItems: [],
        itemCodeItems: [],
        kyItems: [],
        summaryItems: []
      });
      
      setSuccess('✅ すべてのデータをクリーンアップしました。新しい行マッピングを実行してください。');
    } catch (error) {
      setError('リセットに失敗しました: ' + error.message);
    } finally {
      setSaving(false);
    }
  }, [userDetails, setParsedHeaders, setHeaderInput, setKyItemInput, setRowBasedInput, setMappingConfig, setSuccess, setError, setSaving]);

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

  // シンプル：2行入力を直接Firebase保存
  const handleDirectSave = useCallback(async () => {
    if (!rowBasedInput.trim()) {
      setError('2行の入力が必要です');
      return;
    }
    
    if (!userDetails?.companyId) {
      setError('会社情報が取得できませんでした');
      return;
    }
    
    try {
      setSaving(true);
      
      // 入力を行に分割
      const lines = rowBasedInput.split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length < 2) {
        setError('2行の入力が必要です（1行目：項目名、2行目：項目コード）');
        return;
      }
      
      console.log('🎯 シンプル直接保存開始');
      console.log('入力行:', lines);
      
      // シンプルなFirebaseデータを作成
      const firebaseData = createDirectFirebaseData(lines[0], lines[1]);
      
      // 直接Firebaseに保存
      await setDoc(doc(db, 'csvMappings', userDetails.companyId), firebaseData);
      
      console.log('✅ Firebase保存完了');
      setSuccess(`✅ シンプル保存完了！\n項目数: ${firebaseData.itemCodeItems.length}\n控除: ${firebaseData.deductionItems.length}\n支給: ${firebaseData.incomeItems.length}\n勤怠: ${firebaseData.attendanceItems.length}`);
      
      // 画面の状態も更新
      setMappingConfig(firebaseData);
      
    } catch (error) {
      console.error('❌ 保存エラー:', error);
      setError(`保存に失敗しました: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }, [rowBasedInput, userDetails, setSaving, setError, setSuccess, setMappingConfig]);

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
              onClick={handleDirectSave}
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
