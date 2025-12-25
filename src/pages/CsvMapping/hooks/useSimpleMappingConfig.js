/**
 * シンプルなマッピング設定管理フック
 * 複雑な変換処理を排除し、直接的な読み込み・保存・UI状態保持機能を提供
 */

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { 
  createMappingFromInput, 
  loadMappingFromFirestore, 
  prepareMappingForSave, 
  restoreHeadersFromItems 
} from '../utils/simpleMappingManager';

export const useSimpleMappingConfig = (userDetails) => {
  const [mappingConfig, setMappingConfig] = useState({
    incomeItems: [],
    deductionItems: [],
    attendanceItems: [],
    totalItems: [],
    itemCodeItems: [],
    mainFields: {}
  });
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [headerInput, setHeaderInput] = useState('');
  const [rowBasedInput, setRowBasedInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Firestoreからデータを読み込み
  useEffect(() => {
    const loadData = async () => {
      if (!userDetails?.companyId) {
        setLoading(false);
        return;
      }

      try {
        console.log('=== シンプルマッピング読み込み開始 ===');
        const docRef = doc(db, 'csvMappings', userDetails.companyId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const firestoreData = docSnap.data();
          console.log('Firestoreからデータ取得:', firestoreData);

          // シンプルな読み込み処理
          const { mappingConfig: config, parsedHeaders: headers, headerInput: header, rowBasedInput: rowInput } = 
            loadMappingFromFirestore(firestoreData);

          setMappingConfig(config);
          setHeaderInput(header);
          setRowBasedInput(rowInput);
          
          // UI状態保持：parsedHeadersを復元
          if (headers && headers.length > 0) {
            console.log('parsedHeadersを復元:', headers);
            setParsedHeaders(headers);
          } else if (config.itemCodeItems && config.itemCodeItems.length > 0) {
            // parsedHeadersがない場合はitemCodeItemsから復元
            const restoredHeaders = restoreHeadersFromItems(config.itemCodeItems);
            console.log('itemCodeItemsからヘッダーを復元:', restoredHeaders);
            setParsedHeaders(restoredHeaders);
          }

          console.log('読み込み完了');
        } else {
          console.log('マッピングデータなし');
        }
      } catch (err) {
        console.error('読み込みエラー:', err);
        setError('マッピング設定の読み込みに失敗しました: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userDetails]);

  // 2行入力からマッピングを作成
  const createFromInput = (line1, line2) => {
    try {
      console.log('=== 2行入力処理開始 ===');
      const mappingData = createMappingFromInput(line1, line2);
      
      // UI状態を更新
      setMappingConfig({
        incomeItems: mappingData.incomeItems,
        deductionItems: mappingData.deductionItems,
        attendanceItems: mappingData.attendanceItems,
        totalItems: mappingData.totalItems || [],
        itemCodeItems: mappingData.itemCodeItems,
        mainFields: mappingData.mainFields
      });
      setParsedHeaders(mappingData.parsedHeaders);
      setHeaderInput(mappingData.headerInput);
      setRowBasedInput(mappingData.rowBasedInput);
      
      setSuccess('マッピングを作成しました');
      setError('');
      
      console.log('2行入力処理完了');
      return mappingData;
    } catch (err) {
      console.error('2行入力処理エラー:', err);
      setError('マッピングの作成に失敗しました: ' + err.message);
      return null;
    }
  };

  // Firestoreに保存
  const saveMapping = async () => {
    if (!userDetails?.companyId) {
      setError('会社情報が取得できませんでした');
      return false;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      console.log('=== 保存処理開始 ===');
      
      // 保存用データ準備
      const saveData = prepareMappingForSave({
        mappingConfig,
        parsedHeaders,
        headerInput,
        rowBasedInput
      });

      // Firestoreに保存
      const docRef = doc(db, 'csvMappings', userDetails.companyId);
      await setDoc(docRef, saveData);

      setSuccess('マッピング設定を保存しました');
      console.log('保存完了');
      return true;

    } catch (err) {
      console.error('保存エラー:', err);
      setError('保存に失敗しました: ' + err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // 設定をリセット
  const resetMapping = () => {
    setMappingConfig({
      incomeItems: [],
      deductionItems: [],
      attendanceItems: [],
      totalItems: [],
      itemCodeItems: [],
      mainFields: {}
    });
    setParsedHeaders([]);
    setHeaderInput('');
    setRowBasedInput('');
    setError('');
    setSuccess('設定をリセットしました');
  };

  return {
    // 状態
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
    
    // 関数
    createFromInput,
    saveMapping,
    resetMapping
  };
}; 