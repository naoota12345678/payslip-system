// src/pages/CsvMapping/hooks/useHeaderParser.js
// CSVヘッダーの解析を管理するカスタムフック

import { useState, useEffect } from 'react';
import { parseHeaders, parseKyItems, parseRowBasedMapping } from '../utils/csvParser';
// import { generateKyMapping, generateRowBasedMapping, createSimpleDirectMapping } from '../utils/mappingHelpers';
// import { autoMapRequiredFields, generateKyMapping, generateRowBasedMapping, createSimpleDirectMapping } from '../utils/mappingHelpers';
import { processSimpleTextInput } from '../utils/simpleMapping';
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
      console.log('=== useHeaderParser初期化処理 ===');
      console.log('初期マッピング設定から情報を復元します:', initialMapping);
      
      // ⚠️ ヘッダーの自動復元を完全停止
      // ユーザーが行マッピングを実行した時のみヘッダーが設定される
      console.log('⚠️ ヘッダーの自動復元を停止 - 手動実行時のみ設定');
      
      // let headersToRestore = [];
      // if (initialMapping.parsedHeaders && initialMapping.parsedHeaders.length > 0) {
      //   console.log('✅ 明示的に保存されたヘッダー情報を復元:', initialMapping.parsedHeaders);
      //   headersToRestore = initialMapping.parsedHeaders;
      // } else {
      //   console.log('⚠️ 明示的に保存されたヘッダーが見つかりません - 自動復元はスキップ');
      // }
      
      // // ヘッダーを設定
      // if (headersToRestore.length > 0) {
      //   console.log('useHeaderParser: parsedHeadersを設定:', headersToRestore);
      //   setParsedHeaders(headersToRestore);
      // }
      
      // 行ベースマッピングの入力データがある場合は復元
      if (initialMapping.rowBasedInput) {
        console.log('行ベースマッピングの入力を復元:', initialMapping.rowBasedInput);
        setRowBasedInput(initialMapping.rowBasedInput);
      }
      
      // 入力フィールドの復元
      if (initialMapping.headerInput) {
        console.log('headerInputを復元:', initialMapping.headerInput);
        setHeaderInput(initialMapping.headerInput);
      }
      
      if (initialMapping.kyItemInput) {
        console.log('kyItemInputを復元:', initialMapping.kyItemInput);
        setKyItemInput(initialMapping.kyItemInput);
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
        // TODO: autoMapRequiredFields関数を実装する必要があります
        // const updated = autoMapRequiredFields(headers, prev);
        const updated = prev; // 一時的に変更なしで対応
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
      
      // KY項目とマッピング設定を更新
      // const newMappingConfig = generateKyMapping(kyItems);
      // TODO: generateKyMapping関数を実装する必要があります
      console.log('KY項目が解析されました:', kyItems);
      setError('');
      setSuccess(`✅ KY項目の解析完了！\n項目数: ${kyItems.length}`);

      // マッピング設定を更新
      setMappingConfig(prev => ({
        ...prev,
        // KY項目を一時的に保存
        kyItems: kyItems,
        parsedHeaders: parsedHeaders,
        headerInput: headerInput
      }));
      
    } catch (err) {
      console.error('KY項目マッピングエラー:', err);
      setError('KY項目のマッピングに失敗しました。入力内容を確認してください。');
    }
  };

  // 行ベースのマッピング（項目名行と項目コード行）- シンプル版
  const handleRowBasedMapping = (inputRows) => {
    console.log('🎯 新しいシンプル行マッピング開始');
    console.log('入力データ:', inputRows);
    
    try {
      // 文字列として結合
      const textInput = Array.isArray(inputRows) ? inputRows.join('\n') : inputRows;
      console.log('結合されたテキスト:', textInput);
      
      // シンプルマッピングで処理
      const newMappingConfig = processSimpleTextInput(textInput);
      
      // 項目コードをヘッダーとして設定
      const allItemCodes = newMappingConfig.itemCodeItems.map(item => item.headerName);
      console.log('設定する項目コード:', allItemCodes);
      
      // 成功メッセージ
      const stats = {
        total: newMappingConfig.itemCodeItems.length,
        income: newMappingConfig.incomeItems.length,
        deduction: newMappingConfig.deductionItems.length,
        attendance: newMappingConfig.attendanceItems.length,
        summary: newMappingConfig.summaryItems.length
      };
      
      // 設定を適用
      setMappingConfig(newMappingConfig);
      setParsedHeaders(allItemCodes);
      setRowMappingMode(false);
      
      const successMessage = `✅ シンプルマッピング完了！\n合計: ${stats.total}項目\n支給: ${stats.income}、控除: ${stats.deduction}、勤怠: ${stats.attendance}、合計: ${stats.summary}`;
      setSuccess(successMessage);
      setActiveTab(TABS.KY);
      
      console.log('🎉 シンプルマッピング成功');
      
    } catch (err) {
      console.error('❌ シンプルマッピングエラー:', err);
      setError(`マッピングに失敗しました: ${err.message}`);
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
