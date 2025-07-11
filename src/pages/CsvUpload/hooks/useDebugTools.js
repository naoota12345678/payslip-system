// src/pages/CsvUpload/hooks/useDebugTools.js

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import { generateSampleCSV } from '../utils/fileHelpers';
import { DEBUG_STORAGE_KEY } from '../constants';

/**
 * デバッグ機能に関するカスタムフック
 */
const useDebugTools = () => {
  const [debugMode, setDebugMode] = useState(false);
  const [savedSettings, setSavedSettings] = useState([]);

  // 保存済み設定の読み込み
  useEffect(() => {
    if (debugMode) {
      loadSavedSettingsList();
    }
  }, [debugMode]);

  /**
   * デバッグログの表示
   */
  const viewDebugLogs = async () => {
    try {
      // 最新のアップロードのデバッグログを取得
      alert('この機能は開発中です。現在はコンソールログを確認してください。');
    } catch (err) {
      console.error('[エラー] デバッグログ取得エラー:', err);
    }
  };

  /**
   * シンプルなテスト関数
   */
  const testSimpleFunction = async () => {
    try {
      if (debugMode) {
        console.log('[Debug] シンプルテスト開始');
      }
      
      // シンプルなテスト関数を呼び出し
      const testSimple = httpsCallable(functions, 'testSimpleCSV');
      const testData = {
        testParam: 'テストデータ',
        timestamp: new Date().toISOString()
      };
      
      if (debugMode) {
        console.log('[Debug] テスト関数に送信するデータ:', testData);
      }
      
      const result = await testSimple(testData);
      
      if (debugMode) {
        console.log('[Debug] テスト関数の実行結果:', result.data);
      }
      
      alert('テスト成功: ' + JSON.stringify(result.data));
    } catch (err) {
      console.error('[エラー] テスト実行エラー:', err);
      alert('テスト実行中にエラーが発生しました: ' + err.message);
    }
  };

  /**
   * 簡易版CSV処理テスト
   */
  const testSimpleCSVProcessing = async (companyId) => {
    try {
      if (debugMode) {
        console.log('[Debug] シンプルCSV処理テスト開始');
      }
      
      // シンプルな処理関数を呼び出し
      const processCSVSimple = httpsCallable(functions, 'processCSVSimple');
      const processData = {
        uploadId: 'test-' + Date.now(),
        fileUrl: 'http://example.com/test.csv',
        companyId: companyId,
        updateEmployeeInfo: true,
        columnMappings: { 'test': 'test' }
      };
      
      if (debugMode) {
        console.log('[Debug] 簡易処理関数に送信するデータ:', processData);
      }
      
      const result = await processCSVSimple(processData);
      
      if (debugMode) {
        console.log('[Debug] 簡易処理関数の実行結果:', result.data);
      }
      
      alert('テスト処理成功: ' + JSON.stringify(result.data));
    } catch (err) {
      console.error('[エラー] テスト処理エラー:', err);
      alert('テスト処理中にエラーが発生しました: ' + err.message);
    }
  };

  /**
   * テスト用の簡易CSV生成
   */
  const testCSVProcessing = () => {
    try {
      if (debugMode) {
        console.log('[Debug] テスト処理開始');
      }
      
      // テスト用のCSVファイルを生成
      const testFile = generateSampleCSV(debugMode);
      
      alert('テスト用CSVファイルを生成しました。「アップロードして処理」ボタンをクリックしてテストを続行してください。');
      
      return testFile;
    } catch (err) {
      console.error('[エラー] テスト実行エラー:', err);
      alert('テスト実行中にエラーが発生しました: ' + err.message);
      return null;
    }
  };

  /**
   * 現在の設定を保存
   */
  const saveCurrentSettings = (employeeSettings, payrollItems) => {
    try {
      const settingName = prompt("設定の名前を入力してください", "テスト設定 " + new Date().toLocaleDateString());
      
      if (!settingName) return;
      
      // 現在の設定情報を取得
      const currentSettings = {
        name: settingName,
        timestamp: Date.now(),
        employeeIdColumn: employeeSettings.employeeIdColumn,
        departmentCodeColumn: employeeSettings.departmentCodeColumn,
        updateEmployeeInfo: employeeSettings.updateEmployeeInfo,
        payrollMappings: payrollItems.map(item => ({
          id: item.id,
          name: item.name,
          csvColumn: item.csvColumn || null
        }))
      };
      
      // ローカルストレージに保存
      let savedSettings = JSON.parse(localStorage.getItem(DEBUG_STORAGE_KEY) || '[]');
      savedSettings.push(currentSettings);
      localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(savedSettings));
      
      if (debugMode) {
        console.log('[Debug] 設定を保存しました:', currentSettings);
      }
      
      setSavedSettings(savedSettings);
      alert(`設定 "${settingName}" を保存しました`);
    } catch (err) {
      console.error('[エラー] 設定保存エラー:', err);
      alert('設定の保存に失敗しました: ' + err.message);
    }
  };

  /**
   * 保存済み設定一覧の読み込み
   */
  const loadSavedSettingsList = () => {
    try {
      const settings = JSON.parse(localStorage.getItem(DEBUG_STORAGE_KEY) || '[]');
      setSavedSettings(settings);
      
      if (debugMode) {
        console.log('[Debug] 保存済み設定一覧を読み込みました:', settings.length, '件');
      }
    } catch (err) {
      console.error('[エラー] 設定一覧読み込みエラー:', err);
    }
  };

  /**
   * 保存済み設定の削除
   */
  const deleteSavedSetting = (index) => {
    try {
      if (!window.confirm('この設定を削除してもよろしいですか？')) {
        return;
      }
      
      const settings = [...savedSettings];
      const deletedSetting = settings[index];
      settings.splice(index, 1);
      
      localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(settings));
      setSavedSettings(settings);
      
      if (debugMode) {
        console.log('[Debug] 設定を削除しました:', deletedSetting);
      }
      
      alert(`設定 "${deletedSetting.name}" を削除しました`);
    } catch (err) {
      console.error('[エラー] 設定削除エラー:', err);
      alert('設定の削除に失敗しました: ' + err.message);
    }
  };

  return {
    debugMode,
    setDebugMode,
    savedSettings,
    setSavedSettings,
    viewDebugLogs,
    testSimpleFunction,
    testSimpleCSVProcessing,
    testCSVProcessing,
    saveCurrentSettings,
    loadSavedSettingsList,
    deleteSavedSetting
  };
};

export default useDebugTools;
