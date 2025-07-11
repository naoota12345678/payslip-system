// src/pages/CsvUpload/utils/fileHelpers.js

import Papa from 'papaparse';

/**
 * CSVファイルのプレビュー情報を取得する
 * @param {File} file CSVファイル
 * @param {boolean} debugMode デバッグモードの有無
 * @returns {Promise<Object>} プレビュー情報（ヘッダー、サンプルデータなど）
 */
export const previewCSVFile = (file, debugMode = false) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('ファイルが選択されていません'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      if (debugMode) {
        console.log('[Debug] CSVプレビュー（先頭200文字）:', content.substring(0, 200));
      }
      
      // 行と列の数を確認
      const lines = content.split('\n');
      const headers = lines[0].split(',');
      
      if (debugMode) {
        console.log('[Debug] CSVヘッダー:', headers);
        console.log('[Debug] CSVの行数:', lines.length);
      }
      
      // 2行目のデータサンプルを表示（存在する場合）
      let sampleData = null;
      if (lines.length > 1) {
        const sampleRow = lines[1].split(',');
        sampleData = {};
        headers.forEach((header, index) => {
          if (index < sampleRow.length) {
            sampleData[header] = sampleRow[index];
          }
        });
        
        if (debugMode) {
          console.log('[Debug] データサンプル（2行目）:', sampleData);
        }
      }
      
      resolve({
        headers,
        lineCount: lines.length,
        sampleData
      });
    };
    
    reader.onerror = (e) => {
      if (debugMode) {
        console.error('[Debug] ファイル読み込みエラー:', e);
      }
      reject(e);
    };
    
    reader.readAsText(file);
  });
};

/**
 * CSVファイルのヘッダー情報を解析する
 * @param {File} file CSVファイル
 * @param {boolean} debugMode デバッグモードの有無
 * @returns {Promise<string[]>} ヘッダー情報の配列
 */
export const parseCSVHeaders = (file, debugMode = false) => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('ファイルが選択されていません'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvText = event.target.result;
      
      if (debugMode) {
        console.log('[Debug] CSVファイル内容（先頭500文字）:', csvText.substring(0, 500));
      }
      
      Papa.parse(csvText, {
        header: true,
        preview: 1, // ヘッダー行のみ
        skipEmptyLines: true,
        complete: (results) => {
          if (results.meta && results.meta.fields) {
            const headers = results.meta.fields;
            
            if (debugMode) {
              console.log('[Debug] 検出されたCSVヘッダー:', headers);
            }
            
            resolve(headers);
          } else {
            reject(new Error('CSVヘッダーの解析に失敗しました'));
          }
        },
        error: (error) => {
          if (debugMode) {
            console.error('[Debug] CSVパースエラー:', error);
          }
          reject(error);
        }
      });
    };
    
    reader.onerror = (e) => {
      if (debugMode) {
        console.error('[Debug] ファイル読み込みエラー:', e);
      }
      reject(e);
    };
    
    reader.readAsText(file);
  });
};

/**
 * テスト用のサンプルCSVを生成する
 * @param {boolean} debugMode デバッグモードの有無
 * @returns {File} 生成されたCSVファイル
 */
export const generateSampleCSV = (debugMode = false) => {
  // 最小限のCSVファイルを生成
  const csvContent = 
    "社員番号,氏名,基本給,残業時間\n" +
    "001,山田太郎,300000,10\n" +
    "002,佐藤花子,280000,5";
  
  // Blobとしてファイルを作成
  const csvBlob = new Blob([csvContent], { type: 'text/csv' });
  const testFile = new File([csvBlob], "test_sample.csv", { type: 'text/csv' });
  
  if (debugMode) {
    console.log('[Debug] テスト用CSVファイル作成:', {
      name: testFile.name,
      size: testFile.size,
      type: testFile.type
    });
  }
  
  return testFile;
};
