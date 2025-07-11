// src/pages/CsvMapping/hooks/useHeaderParser.js
// CSVヘッダーの解析を管理するカスタムフック

import { useState, useEffect } from 'react';
import { parseHeaders, parseKyItems, parseRowBasedMapping } from '../utils/csvParser';
import { autoMapRequiredFields, generateKyMapping, generateRowBasedMapping } from '../utils/mappingHelpers';
import { TABS } from '../constants';

/**
 * CSVヘッダーの解析とマッピングを管理するカスタムフック
 * @param {function} setMappingConfig - マッピング設定を更新する関数
 * @param {function} setError - エラー状態を更新する関数
 * @param {function} setSuccess - 成功状態を更新する関数
 * @param {function} setActiveTab - アクティブタブを更新する関数
 * @param {Object} initialMapping - 初期マッピング設定
 * @returns {Object} ヘッダー関連の状態と関数
 */
export const useHeaderParser = (
  setMappingConfig,
  setError,
  setSuccess,
  setActiveTab,
  initialMapping = null
) => {
  const [headerInput, setHeaderInput] = useState('');
  const [kyItemInput, setKyItemInput] = useState('');
  const [rowBasedInput, setRowBasedInput] = useState('');
  const [parsedHeaders, setParsedHeaders] = useState([]);
  const [kyMappingMode, setKyMappingMode] = useState(false);
  const [rowMappingMode, setRowMappingMode] = useState(false);

  // 初期マッピング設定がある場合はヘッダー情報を復元
  useEffect(() => {
    if (initialMapping) {
      console.log('初期マッピング設定から情報を復元します:', initialMapping);
      
      // ヘッダー情報が保存されている場合は復元
      if (initialMapping.parsedHeaders && initialMapping.parsedHeaders.length > 0) {
        console.log('保存されたヘッダー情報を復元:', initialMapping.parsedHeaders);
        setParsedHeaders(initialMapping.parsedHeaders);
      }
      // 項目情報からヘッダーを再構築
      else if (initialMapping.kyItems && initialMapping.kyItems.length > 0) {
        console.log('KY項目からヘッダー情報を再構築:', initialMapping.kyItems.length);
        const headers = initialMapping.kyItems.map(item => item.headerName).filter(Boolean);
        if (headers.length > 0) {
          console.log('再構築されたヘッダー:', headers);
          setParsedHeaders(headers);
        }
      }
      
      // 行ベースマッピングの入力データがある場合は復元
      if (initialMapping.rowBasedInput) {
        console.log('行ベースマッピングの入力を復元:', initialMapping.rowBasedInput);
        setRowBasedInput(initialMapping.rowBasedInput);
      }
    }
  }, [initialMapping]);

  // CSVヘッダーの一括入力を処理
  const handleHeadersParse = () => {
    if (!headerInput.trim()) {
      setError('ヘッダー行を入力してください');
      return;
    }
    
    try {
      const headers = parseHeaders(headerInput);
      
      if (headers.length === 0) {
        setError('有効なヘッダーが見つかりませんでした');
        return;
      }
      
      console.log('解析されたヘッダー:', headers);
      setParsedHeaders(headers);
      setError('');
      setSuccess(`${headers.length}個のヘッダーを正常に解析しました。必要な項目をマッピングしてください。`);
      
      // 必須項目の自動マッピングを試みる
      setMappingConfig(prev => {
        const updated = autoMapRequiredFields(headers, prev);
        // ヘッダー情報も保存
        return {
          ...updated,
          parsedHeaders: headers,
          headerInput: headerInput
        };
      });
      
    } catch (err) {
      console.error('ヘッダー解析エラー:', err);
      setError('ヘッダー行の解析に失敗しました。カンマまたはタブで区切られたデータを入力してください。');
    }
  };

  // KY項目と給与システム列の一括マッピング
  const handleKyMapping = () => {
    if (!kyItemInput.trim()) {
      setError('KY項目を入力してください');
      return;
    }
    
    try {
      // KY項目を解析
      const kyItems = parseKyItems(kyItemInput);
      
      if (kyItems.length === 0) {
        setError('有効なKY項目が見つかりませんでした');
        return;
      }
      
      console.log(`${kyItems.length}個のKY項目を検出しました:`, kyItems);
      
      // マッピング設定を生成
      const newMappingConfig = generateKyMapping(kyItems);
      // 入力情報も保存
      newMappingConfig.parsedHeaders = kyItems;
      newMappingConfig.kyItemInput = kyItemInput;
      
      // 生成した設定を適用
      setMappingConfig(newMappingConfig);
      setParsedHeaders(kyItems); // KY項目をヘッダーとして設定
      
      setSuccess(`${kyItems.length}個のKY項目をマッピングしました。必要に応じて調整してください。`);
      setKyMappingMode(false); // 入力パネルを閉じる
      setActiveTab(TABS.KY); // KY項目タブを開く
      
    } catch (err) {
      console.error('KY項目マッピングエラー:', err);
      setError('KY項目のマッピングに失敗しました。入力内容を確認してください。');
    }
  };

  // 行ベースのマッピング（ヘッダー行とKY項目行）
  const handleRowBasedMapping = (inputRows) => {
    if (!inputRows || inputRows.length < 2) {
      setError('少なくとも2行（ヘッダー行とデータ行）が必要です');
      return;
    }

    try {
      // データ形式のデバッグ
      console.log('行ベースマッピング入力:', inputRows);
      
      // 入力文字列をのまま保存（状態復元用）
      const originalInput = Array.isArray(inputRows) ? inputRows.join('\n') : inputRows;
      
      // 行を解析
      const { headers, kyItems } = parseRowBasedMapping(inputRows);

      if (headers.length === 0 || kyItems.length === 0) {
        setError('有効なヘッダーまたはKY項目が見つかりませんでした');
        return;
      }

      console.log('解析されたヘッダー:', headers);
      console.log('解析されたKY項目:', kyItems);
      
      // マッピング設定を生成
      const newMappingConfig = generateRowBasedMapping(headers, kyItems);
      // ヘッダー情報と元の入力も保存
      newMappingConfig.parsedHeaders = headers;
      newMappingConfig.rowBasedInput = originalInput;
      newMappingConfig.kyItems = newMappingConfig.kyItems.map((item, index) => ({
        ...item,
        // KY項目のマッピング情報を確実に保存
        matchedHeader: headers[index] || '',
        index
      }));
      
      // デバッグログ
      console.log('生成されたマッピング設定:', newMappingConfig);
      
      // 生成した設定を適用
      setMappingConfig(newMappingConfig);
      setParsedHeaders(headers); // ヘッダーを設定

      setSuccess(`${headers.length}個のヘッダーと${kyItems.length}個のKY項目を列単位でマッピングしました。必要に応じて調整してください。`);
      setRowBasedInput(originalInput); // 元の入力を保存（状態復元用）
      setRowMappingMode(false); // 入力パネルを閉じる
      setActiveTab(TABS.KY); // KY項目タブを開く

    } catch (err) {
      console.error('行ベースマッピングエラー:', err);
      setError('行ベースマッピングの処理に失敗しました。ヘッダー行とデータ行が正しく入力されているか確認してください。');
    }
  };

  // 入力モードのリセット
  const resetInputMode = () => {
    setKyMappingMode(false);
    setRowMappingMode(false);
    setHeaderInput('');
    setKyItemInput('');
    setRowBasedInput('');
  };

  return {
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
  };
};

export default useHeaderParser;
