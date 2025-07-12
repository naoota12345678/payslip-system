// src/pages/CsvMapping/hooks/useMappingConfig.js
// マッピング設定を管理するカスタムフック

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import { initialMappingConfig } from '../constants';
import { convertToNewFormat, convertFromNewFormat, debugMappingFormats, generateDeterministicId } from '../utils/mappingHelpers';

/**
 * マッピング設定を管理するカスタムフック
 * @param {Object} userDetails - ユーザー情報
 * @returns {Object} マッピング設定と関連する状態・関数
 */
export const useMappingConfig = (userDetails) => {
  const [mappingConfig, setMappingConfig] = useState(initialMappingConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // デバッグ表示のためのデータを保持
  const [debugData, setDebugData] = useState(null);

  // 既存の設定を読み込む
  useEffect(() => {
    const fetchMappingConfig = async () => {
      if (!userDetails?.companyId) {
        setError('会社情報が取得できませんでした');
        setLoading(false);
        return;
      }
      
      try {
        console.log('設定を読み込み中...', 'companyId:', userDetails.companyId);
        let configLoaded = false;
        
        // 1. 新しい形式 (csvMappings) でのデータ取得を試みる
        const newMappingDoc = await getDoc(doc(db, 'csvMappings', userDetails.companyId));
        if (newMappingDoc.exists()) {
          console.log('新しい形式での設定が見つかりました:', newMappingDoc.data());
          
          // 新しい形式のデータを古い形式に変換
          const convertedData = convertFromNewFormat(newMappingDoc.data(), initialMappingConfig);
          
          // 追加：保存されたヘッダー情報も復元
          const csvSettings = await getDoc(doc(db, 'csvSettings', userDetails.companyId));
          if (csvSettings.exists() && csvSettings.data().parsedHeaders) {
            convertedData.parsedHeaders = csvSettings.data().parsedHeaders;
            convertedData.headerInput = csvSettings.data().headerInput;
            convertedData.rowBasedInput = csvSettings.data().rowBasedInput;
          }
          
          // データを表示用に保存
          setDebugData({
            newFormat: newMappingDoc.data(),
            convertedData: convertedData
          });
          
          // 変換されたデータを設定
          setMappingConfig(convertedData);
          configLoaded = true;
          
          console.log('新しい形式のデータを古い形式に変換して読み込みました');
        }
        
        // 2. 新しい形式のデータがない場合、古い形式 (csvMapping) のデータを確認
        if (!configLoaded) {
          const oldMappingDoc = await getDoc(doc(db, 'csvMapping', userDetails.companyId));
          if (oldMappingDoc.exists() && oldMappingDoc.data().csvMapping) {
            console.log('既存のCSVマッピング設定を読み込みました（古い形式）');
            const oldFormatData = oldMappingDoc.data().csvMapping;
          
            // データ構造を安全に確保
            const safeData = {
              ...initialMappingConfig,
              ...oldFormatData
            };
            
            // mainFieldsを安全に初期化
            if (!safeData.mainFields || typeof safeData.mainFields !== 'object') {
              safeData.mainFields = initialMappingConfig.mainFields;
            } else {
              // 各mainFieldsプロパティを安全に確保
              for (const [key, defaultValue] of Object.entries(initialMappingConfig.mainFields)) {
                if (!safeData.mainFields[key] || typeof safeData.mainFields[key] !== 'object') {
                  safeData.mainFields[key] = defaultValue;
                } else {
                  // columnIndexとheaderNameを安全に確保
                  if (typeof safeData.mainFields[key].columnIndex !== 'number') {
                    safeData.mainFields[key].columnIndex = -1;
                  }
                  if (typeof safeData.mainFields[key].headerName !== 'string') {
                    safeData.mainFields[key].headerName = '';
                  }
                }
              }
            }
            
            // 配列項目を安全に初期化
            const arrayCategories = ['incomeItems', 'deductionItems', 'attendanceItems', 'kyItems', 'itemCodeItems'];
            for (const category of arrayCategories) {
              if (!Array.isArray(safeData[category])) {
                safeData[category] = [];
              } else {
                // 各項目にID属性を確保
                safeData[category].forEach((item, index) => {
                  if (!item || typeof item !== 'object') {
                    safeData[category][index] = {
                      columnIndex: -1,
                      headerName: '',
                      itemName: '',
                      isVisible: true,
                      id: `${category}_${index}_${Math.random().toString(36).substring(2, 7)}`
                    };
                  } else {
                    // 必要なプロパティを安全に確保
                    if (typeof item.columnIndex !== 'number') {
                      item.columnIndex = -1;
                    }
                    if (typeof item.headerName !== 'string') {
                      item.headerName = '';
                    }
                    if (typeof item.itemName !== 'string') {
                      item.itemName = '';
                    }
                    if (typeof item.isVisible !== 'boolean') {
                      item.isVisible = true;
                    }
                    if (!item.id) {
                      const columnIndex = item.columnIndex || index;
                      item.id = `${category}_${columnIndex}_${Math.random().toString(36).substring(2, 7)}`;
                    }
                  }
                });
              }
            }
            
            setMappingConfig(safeData);
            configLoaded = true;
            
            // データを表示用に保存
            setDebugData(prevData => ({
              ...prevData,
              oldFormat: safeData
            }));
          }
        }
        
        if (!configLoaded) {
          console.log('既存のマッピング設定がありません。初期値を使用します。');
          // 初期値を適用
          setMappingConfig(initialMappingConfig);
        }
        
        // デバッグ: データ構造を確認
        if (configLoaded) {
          console.log('=== デバッグ：読み込まれたマッピング設定 ===');
          console.log(JSON.stringify(mappingConfig, null, 2));
        }
        
        setLoading(false);
      } catch (err) {
        console.error('マッピング設定取得エラー:', err);
        setError('設定の取得中にエラーが発生しました');
        setLoading(false);
      }
    };
    
    if (userDetails?.companyId) {
      fetchMappingConfig();
    }
  }, [userDetails]);

  // 設定を保存
  const saveMappingConfig = async (config, validationFn) => {
    if (!userDetails?.companyId) {
      setError('会社情報が取得できませんでした');
      return false;
    }
    
    // バリデーション関数が指定されている場合は実行
    if (validationFn) {
      const validationError = validationFn(config);
      if (validationError) {
        setError(validationError);
        return false;
      }
    }
    
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      // 保存用の設定オブジェクトを作成（ディープコピーを作成）
      const configToSave = JSON.parse(JSON.stringify(config));
      
      // 各項目にIDが設定されているか確認（未設定の場合は決定論的なIDを追加）
      const ensureItemsHaveIds = (items, categoryPrefix) => {
        return items.map((item, index) => {
          if (!item.id) {
            return {
              ...item,
              id: generateDeterministicId(categoryPrefix, item.headerName, item.columnIndex || index)
            };
          }
          return item;
        });
      };
      
      // 各カテゴリの項目にIDを確保
      if (Array.isArray(configToSave.incomeItems)) {
        configToSave.incomeItems = ensureItemsHaveIds(configToSave.incomeItems, 'income');
      }
      if (Array.isArray(configToSave.deductionItems)) {
        configToSave.deductionItems = ensureItemsHaveIds(configToSave.deductionItems, 'deduction');
      }
      if (Array.isArray(configToSave.attendanceItems)) {
        configToSave.attendanceItems = ensureItemsHaveIds(configToSave.attendanceItems, 'attendance');
      }
      if (Array.isArray(configToSave.kyItems)) {
        configToSave.kyItems = ensureItemsHaveIds(configToSave.kyItems, 'ky');
      }
      if (Array.isArray(configToSave.itemCodeItems)) {
        configToSave.itemCodeItems = ensureItemsHaveIds(configToSave.itemCodeItems, 'itemCode');
      }
      
      // CsvMapping形式からCsvUpload形式への変換を実行
      const newFormatData = convertToNewFormat(configToSave);
      
      // デバッグ情報を表示
      const debugInfo = debugMappingFormats(configToSave);
      setDebugData({
        oldFormat: configToSave,
        newFormat: newFormatData
      });
      
      // バッチ処理を使用して複数のドキュメントを原子的に更新
      const batch = writeBatch(db);
      
      // 1. 従来形式でFirestoreに設定を保存 (下位互換性のため)
      batch.set(doc(db, 'csvMapping', userDetails.companyId), {
        csvMapping: configToSave,
        updatedAt: new Date(),
        updatedBy: userDetails.email || ''
      });
      
      // 2. 新しい形式でもFirestoreに設定を保存
      batch.set(doc(db, 'csvMappings', userDetails.companyId), {
        mappings: newFormatData.mappings,
        employeeMapping: newFormatData.employeeMapping,
        updatedAt: new Date(),
        updatedBy: userDetails.email || ''
      });
      
      // 3. CSV設定にも従業員IDと部門コードカラムを保存
      batch.set(doc(db, 'csvSettings', userDetails.companyId), {
        employeeIdColumn: newFormatData.employeeMapping.employeeIdColumn,
        departmentCodeColumn: newFormatData.employeeMapping.departmentCodeColumn,
        parsedHeaders: configToSave.parsedHeaders || [],
        headerInput: configToSave.headerInput || '',
        rowBasedInput: configToSave.rowBasedInput || '',
        updatedAt: new Date()
      }, { merge: true });
      
      // バッチ処理を実行
      await batch.commit();
      
      console.log('全ての形式で設定を保存しました:', {
        oldFormat: configToSave,
        newFormat: newFormatData
      });
      
      setSuccess('マッピング設定を保存しました');
      
      // 少し待ってから成功メッセージをクリア
      setTimeout(() => setSuccess(''), 3000);
      return true;
    } catch (err) {
      console.error('設定保存エラー:', err);
      
      // ユーザーフレンドリーなエラーメッセージ
      let errorMessage = '設定の保存中にエラーが発生しました。';
      if (err.code === 'permission-denied') {
        errorMessage = 'アクセス権限がありません。管理者にお問い合わせください。';
      } else if (err.code === 'unavailable') {
        errorMessage = 'ネットワーク接続を確認してください。';
      } else if (err.code === 'invalid-argument') {
        errorMessage = '設定データに問題があります。入力内容を確認してください。';
      }
      
      setError(errorMessage);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // JSONからのインポート
  const importFromJson = (jsonString) => {
    try {
      const importedData = JSON.parse(jsonString);
      
      if (importedData.csvMapping) {
        // 各項目にIDが付与されているか確認
        const config = importedData.csvMapping;
        
        // 各カテゴリの項目にIDを確保（決定論的なID生成）
        const ensureItemsHaveIds = (items, categoryPrefix) => {
          if (!Array.isArray(items)) return [];
          return items.map((item, index) => {
            if (!item.id) {
              return {
                ...item,
                id: generateDeterministicId(categoryPrefix, item.headerName, item.columnIndex || index)
              };
            }
            return item;
          });
        };
        
        if (config.incomeItems) {
          config.incomeItems = ensureItemsHaveIds(config.incomeItems, 'income');
        }
        if (config.deductionItems) {
          config.deductionItems = ensureItemsHaveIds(config.deductionItems, 'deduction');
        }
        if (config.attendanceItems) {
          config.attendanceItems = ensureItemsHaveIds(config.attendanceItems, 'attendance');
        }
        if (config.kyItems) {
          config.kyItems = ensureItemsHaveIds(config.kyItems, 'ky');
        }
        if (config.itemCodeItems) {
          config.itemCodeItems = ensureItemsHaveIds(config.itemCodeItems, 'itemCode');
        }
        
        setMappingConfig(config);
        
        // デバッグ情報を表示
        debugMappingFormats(config);
        
        setSuccess('設定を正常にインポートしました');
        return true;
      } else if (importedData.mappings) {
        // 新しい形式のインポートにも対応
        // 実装は省略...
        setError('新形式のJSONインポートはまだサポートされていません');
        return false;
      } else {
        setError('有効なマッピング設定がJSONに含まれていません');
        return false;
      }
    } catch (err) {
      console.error('JSON解析エラー:', err);
      
      // ユーザーフレンドリーなエラーメッセージ
      let errorMessage = 'JSONデータの読み込みに失敗しました。';
      if (err.name === 'SyntaxError') {
        errorMessage = 'JSONの形式が正しくありません。ファイルを確認してください。';
      }
      
      setError(errorMessage);
      return false;
    }
  };

  return {
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
  };
};

export default useMappingConfig;
