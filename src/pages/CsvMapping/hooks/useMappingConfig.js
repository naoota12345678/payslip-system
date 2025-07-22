// src/pages/CsvMapping/hooks/useMappingConfig.js
// マッピング設定を管理するカスタムフック

import { useState, useEffect } from 'react';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import { initialMappingConfig } from '../constants';
import { convertToNewFormat, convertFromNewFormat, debugMappingFormats, generateDeterministicId, validateMappingConfig } from '../utils/mappingHelpers';

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
      // 詳細なデバッグ情報を追加
      console.log('=== fetchMappingConfig デバッグ開始 ===');
      console.log('userDetails:', userDetails);
      console.log('userDetails?.companyId:', userDetails?.companyId);
      console.log('userDetails?.userType:', userDetails?.userType);
      console.log('userDetails?.email:', userDetails?.email);
      console.log('userDetails?.uid:', userDetails?.uid);
      
      if (!userDetails?.companyId) {
        console.error('companyIdが設定されていません');
        setError('会社情報が取得できませんでした');
        setLoading(false);
        return;
      }
      
      try {
        console.log('設定を読み込み中...', 'companyId:', userDetails.companyId);
        let configLoaded = false;
        
        // 1. 新しい形式 (csvMappings) でのデータ取得を試みる
        console.log('=== 新しい形式 (csvMappings) での読み込み開始 ===');
        const newMappingDoc = await getDoc(doc(db, 'csvMappings', userDetails.companyId));
        console.log('新しい形式の読み込み結果:', newMappingDoc.exists());
        
        if (newMappingDoc.exists()) {
          console.log('新しい形式での設定が見つかりました:', newMappingDoc.data());
          
          // 新しい形式のデータを古い形式に変換
          const convertedData = convertFromNewFormat(newMappingDoc.data(), initialMappingConfig);
          
          // 追加：保存されたヘッダー情報も復元
          console.log('=== CSV設定の読み込み開始 ===');
          const csvSettings = await getDoc(doc(db, 'csvSettings', userDetails.companyId));
          console.log('CSV設定の読み込み結果:', csvSettings.exists());
          
          if (csvSettings.exists()) {
            const csvData = csvSettings.data();
            console.log('保存されたCSV設定データ:', csvData);
            
            // ⚠️ parsedHeadersの自動復元を停止（ユーザーが手動設定のみ）
            // if (csvData.parsedHeaders) {
            //   console.log('保存されたヘッダー情報を復元:', csvData.parsedHeaders);
            //   convertedData.parsedHeaders = csvData.parsedHeaders;
            // }
            
            if (csvData.headerInput) {
              console.log('保存されたheaderInputを復元:', csvData.headerInput);
              convertedData.headerInput = csvData.headerInput;
            }
            if (csvData.rowBasedInput) {
              console.log('保存されたrowBasedInputを復元:', csvData.rowBasedInput);
              convertedData.rowBasedInput = csvData.rowBasedInput;
            }
          } else {
            console.log('CSV設定データが見つかりませんでした');
          }
          
          console.log('=== 最終的な変換済みデータ ===');
          console.log('convertedData:', convertedData);
          
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
        
        // csvMappingsのみを使用（統一済み）
        if (!configLoaded) {
          console.log('csvMappings にデータが見つかりませんでした。初期設定を使用します');
          setMappingConfig(initialMappingConfig);
        }
        
        // デバッグ: データ構造を確認
        if (configLoaded) {
          console.log('=== デバッグ：読み込まれたマッピング設定 ===');
          console.log(JSON.stringify(mappingConfig, null, 2));
        }
        
        setLoading(false);
      } catch (err) {
        console.error('=== マッピング設定取得エラー詳細 ===');
        console.error('エラーオブジェクト:', err);
        console.error('エラーコード:', err.code);
        console.error('エラーメッセージ:', err.message);
        console.error('スタックトレース:', err.stack);
        
        // 権限エラーの詳細分析
        if (err.code === 'permission-denied') {
          console.error('権限エラー詳細:');
          console.error('- ユーザーの認証状態:', !!userDetails);
          console.error('- ユーザータイプ:', userDetails?.userType);
          console.error('- 会社ID:', userDetails?.companyId);
          console.error('- メールアドレス:', userDetails?.email);
          console.error('- UID:', userDetails?.uid);
          
          setError(`権限エラー: ${err.message}。ユーザータイプ: ${userDetails?.userType}、会社ID: ${userDetails?.companyId}`);
        } else if (err.code === 'not-found') {
          console.error('データが見つかりません:', err.message);
          setError('設定データが見つかりません。新しい設定を作成してください。');
        } else {
          console.error('その他のエラー:', err.message);
          setError(`設定の取得中にエラーが発生しました: ${err.message}`);
        }
        
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
      
      // データ整合性チェック（itemName=headerNameの検出）
      const validationError = validateMappingConfig(configToSave);
      if (validationError) {
        console.error('❌ バリデーションエラー:', validationError);
        setError(validationError);
        return false;
      }
      
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
      
      console.log('🔍 保存前のマッピング設定詳細確認:');
      console.log('configToSave.deductionItems:', configToSave.deductionItems);
      console.log('configToSave.incomeItems:', configToSave.incomeItems);
      console.log('configToSave.attendanceItems:', configToSave.attendanceItems);
      console.log('configToSave.itemCodeItems:', configToSave.itemCodeItems);
      
      // 各カテゴリのitemNameを確認
      ['deductionItems', 'incomeItems', 'attendanceItems', 'itemCodeItems'].forEach(category => {
        const items = configToSave[category] || [];
        console.log(`📋 ${category} のitemName確認:`);
        items.forEach((item, index) => {
          console.log(`  [${index}] headerName="${item.headerName}", itemName="${item.itemName}"`);
        });
      });
      
      // CsvMapping形式からcsvMappings形式への変換を実行
      const newFormatData = convertToNewFormat(configToSave);
      
      console.log('🔄 変換後のデータ詳細確認:');
      console.log('newFormatData.deductionItems:', newFormatData.deductionItems);
      
      // 変換後のitemNameを確認
      ['deductionItems', 'incomeItems', 'attendanceItems', 'itemCodeItems'].forEach(category => {
        const items = newFormatData[category] || [];
        console.log(`📋 変換後 ${category} のitemName確認:`);
        items.forEach((item, index) => {
          console.log(`  [${index}] headerName="${item.headerName}", itemName="${item.itemName}"`);
        });
      });
      
      // デバッグ情報を表示
      debugMappingFormats(configToSave);
      setDebugData({
        oldFormat: configToSave,
        newFormat: newFormatData
      });
      
      // バッチ処理を使用して複数のドキュメントを原子的に更新
      const batch = writeBatch(db);
      
      // csvMappings（カテゴリ配列形式）に保存
      batch.set(doc(db, 'csvMappings', userDetails.companyId), {
        ...newFormatData,
        // mainFieldsを確実に保存
        mainFields: configToSave.mainFields || {},
        updatedAt: new Date(),
        updatedBy: userDetails.email || ''
      });
      
      // CSV設定にも従業員IDと部門コードカラムを保存
      const employeeIdColumn = configToSave.mainFields?.employeeCode?.headerName || '';
      const departmentCodeColumn = configToSave.mainFields?.departmentCode?.headerName || '';
      
      batch.set(doc(db, 'csvSettings', userDetails.companyId), {
        employeeIdColumn: employeeIdColumn,
        departmentCodeColumn: departmentCodeColumn,
        // ⚠️ parsedHeadersの保存を停止（ヘッダー固定化を防ぐ）
        // parsedHeaders: configToSave.parsedHeaders || [],
        headerInput: configToSave.headerInput || '',
        rowBasedInput: configToSave.rowBasedInput || '',
        // 項目情報も保存して復元時に使用
        itemCodeItems: configToSave.itemCodeItems || [],
        kyItems: configToSave.kyItems || [],
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

  /**
   * マッピング設定をリセットする
   * @param {string} type - リセットタイプ: 'all', 'mapping', 'firestore'
   */
  const resetMappingConfig = async (type = 'mapping') => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      if (type === 'mapping') {
        // マッピング設定のみをリセット（ヘッダー情報は保持）
        setMappingConfig(prev => ({
          ...initialMappingConfig,
          headerInput: prev.headerInput,
          rowBasedInput: prev.rowBasedInput,
          parsedHeaders: prev.parsedHeaders
        }));
        setSuccess('マッピング設定をリセットしました');
        
      } else if (type === 'all') {
        // 全ての設定をリセット
        setMappingConfig(initialMappingConfig);
        setSuccess('全ての設定をリセットしました');
        
      } else if (type === 'firestore') {
        // Firestoreからも削除
        if (!userDetails?.companyId) {
          setError('会社情報が取得できません');
          return false;
        }
        
        const batch = writeBatch(db);
        
        // 新しい形式の設定を削除
        const newMappingRef = doc(db, 'csvMappings', userDetails.companyId);
        batch.delete(newMappingRef);
        
        // CSV設定も削除
        const csvSettingsRef = doc(db, 'csvSettings', userDetails.companyId);
        batch.delete(csvSettingsRef);
        
        // csvMappings統一により、この処理は不要
        
        await batch.commit();
        
        // ローカル設定もリセット
        setMappingConfig(initialMappingConfig);
        setSuccess('Firestoreからマッピング設定を完全に削除しました');
      }
      
      return true;
      
    } catch (err) {
      console.error('マッピング設定のリセットエラー:', err);
      setError(`設定のリセット中にエラーが発生しました: ${err.message}`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * 特定カテゴリのマッピングをリセットする
   * @param {string} category - カテゴリ名: 'incomeItems', 'deductionItems', 'attendanceItems', 'itemCodeItems'
   */
  const resetCategoryMapping = (category) => {
    try {
      setMappingConfig(prev => ({
        ...prev,
        [category]: []
      }));
      
      const categoryNames = {
        incomeItems: '支給項目',
        deductionItems: '控除項目', 
        attendanceItems: '勤怠項目',
        totalItems: '合計項目',
        itemCodeItems: '項目コード'
      };
      
      setSuccess(`${categoryNames[category] || category}のマッピングをリセットしました`);
      return true;
      
    } catch (err) {
      console.error('カテゴリリセットエラー:', err);
      setError(`${category}のリセット中にエラーが発生しました`);
      return false;
    }
  };

  return {
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
  };
};

export default useMappingConfig;
