// src/pages/CsvMapping/utils/csvParser.js
// CSVデータを解析するユーティリティ関数

/**
 * CSVヘッダー文字列を解析して配列に変換
 * @param {string} inputText - 解析する入力テキスト
 * @returns {Array} 解析されたヘッダー配列
 */
export const parseHeaders = (inputText) => {
  if (!inputText || !inputText.trim()) {
    return [];
  }
  
  let headers = [];
  
  // タブが含まれていればタブ区切り
  if (inputText.includes('\t')) {
    headers = inputText
      .split('\t')
      .map(header => header.trim())
      .filter(header => header.length > 0);
    console.log('タブ区切りで解析しました');
  }
  // カンマが含まれていればカンマ区切り
  else if (inputText.includes(',')) {
    headers = inputText
      .split(',')
      .map(header => header.trim())
      .filter(header => header.length > 0);
    console.log('カンマ区切りで解析しました');
  }
  // 改行が含まれていれば行区切り
  else if (inputText.includes('\n')) {
    headers = inputText
      .split('\n')
      .map(header => header.trim())
      .filter(header => header.length > 0);
    console.log('改行区切りで解析しました');
  }
  // それ以外はスペース区切りと仮定
  else {
    headers = inputText
      .split(/\s+/)
      .map(header => header.trim())
      .filter(header => header.length > 0);
    console.log('スペース区切りで解析しました');
  }
  
  return headers;
};

/**
 * KY項目リストを解析
 * @param {string} inputText - 解析する入力テキスト
 * @returns {Array} 解析されたKY項目配列
 */
export const parseKyItems = (inputText) => {
  if (!inputText || !inputText.trim()) {
    return [];
  }
  
  let kyItems = [];
  
  // タブが含まれていればタブ区切り
  if (inputText.includes('\t')) {
    kyItems = inputText
      .split('\t')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  // カンマが含まれていればカンマ区切り
  else if (inputText.includes(',')) {
    kyItems = inputText
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  // 改行が含まれていれば行区切り
  else if (inputText.includes('\n')) {
    kyItems = inputText
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  // それ以外はスペース区切りと仮定
  else {
    kyItems = inputText
      .split(/\s+/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
  
  return kyItems;
};

/**
 * 複数行の入力から行ベースのマッピングデータを解析
 * @param {Array} rows - 行の配列
 * @returns {Object} ヘッダー行とKY項目行の解析結果
 */
export const parseRowBasedMapping = (rows) => {
  if (!rows || rows.length < 2) {
    return { headers: [], kyItems: [] };
  }

  console.log('=== parseRowBasedMapping デバッグ開始 ===');
  console.log('入力行数:', rows.length);
  console.log('行1 (ヘッダー行):', rows[0]);
  console.log('行2 (KY項目行):', rows[1]);

  // 区切り文字を検出（最初の行から判断）
  let separator;
  if (rows[0].includes('\t')) {
    separator = '\t';
    console.log('区切り文字: タブ');
  } else if (rows[0].includes(',')) {
    separator = ',';
    console.log('区切り文字: カンマ');
  } else {
    // タブやカンマがなければスペースで分割
    separator = /\s+/;
    console.log('区切り文字: スペース');
  }

  // 各行を解析
  let headers = rows[0].split(separator instanceof RegExp ? separator : separator).map(item => item.trim());
  let kyItems = rows[1].split(separator instanceof RegExp ? separator : separator).map(item => item.trim());

  console.log('解析されたヘッダー:', headers);
  console.log('解析されたKY項目:', kyItems);

  // 長さを統一（短い方に合わせる）
  const minLength = Math.min(headers.length, kyItems.length);
  headers = headers.slice(0, minLength);
  kyItems = kyItems.slice(0, minLength);

  console.log('最終的なヘッダー:', headers);
  console.log('最終的なKY項目:', kyItems);
  console.log('=== parseRowBasedMapping デバッグ終了 ===');

  return {
    headers,
    kyItems
  };
};
