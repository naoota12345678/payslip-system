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
 * 混在した1行データを項目名と項目コードに分離
 * @param {string} mixedData - 混在したデータ
 * @returns {Object} 分離された項目名と項目コード
 */
export const separateMixedData = (mixedData) => {
  if (!mixedData || !mixedData.trim()) {
    return { itemNames: [], itemCodes: [] };
  }
  
  console.log('=== separateMixedData 開始 ===');
  console.log('混在データ:', mixedData);
  
  // スペースで分割
  const items = mixedData.split(/\s+/).filter(item => item.trim().length > 0);
  console.log('分割された項目:', items);
  
  const itemCodes = [];
  const itemNames = [];
  
  items.forEach(item => {
    // 項目コードの判定：KYで始まる、または数字のみ、または英数字のパターン
    if (/^[A-Z]{1,5}[0-9]{1,3}(_[0-9]+)?$/.test(item) || /^[A-Z]+[0-9]+$/.test(item)) {
      itemCodes.push(item);
      console.log(`🔢 項目コード: ${item}`);
    } else {
      itemNames.push(item);
      console.log(`📝 項目名: ${item}`);
    }
  });
  
  console.log('分離結果:');
  console.log('項目名:', itemNames);
  console.log('項目コード:', itemCodes);
  
  return { itemNames, itemCodes };
};

/**
 * 複数行の入力から行ベースのマッピングデータを解析
 * @param {Array} rows - 行の配列
 * @returns {Object} ヘッダー行とKY項目行の解析結果
 */
export const parseRowBasedMapping = (rows) => {
  if (!rows || rows.length === 0) {
    return { headers: [], kyItems: [] };
  }

  // 空白行を除去して有効な行のみを取得
  const validRows = rows.filter(row => row && row.trim().length > 0);
  
  console.log('=== parseRowBasedMapping デバッグ開始 ===');
  console.log('元の入力行数:', rows.length);
  console.log('有効な行数:', validRows.length);
  
  // 1行のみの場合は自動分離を試行
  if (validRows.length === 1) {
    console.log('⚠️ 1行データを検出、自動分離を実行');
    const { itemNames, itemCodes } = separateMixedData(validRows[0]);
    
    if (itemNames.length > 0 && itemCodes.length > 0) {
      console.log('✅ 自動分離成功');
      return { headers: itemNames, kyItems: itemCodes };
    } else {
      console.log('❌ 自動分離失敗、2行形式が必要');
      return { headers: [], kyItems: [] };
    }
  }
  
  // 2行以上の場合は通常処理
  if (validRows.length < 2) {
    console.log('有効な行が2行未満です:', validRows);
    return { headers: [], kyItems: [] };
  }

  console.log('行1 (項目名行):', validRows[0]);
  console.log('行2 (項目コード行):', validRows[1]);

  // 区切り文字を検出（最初の有効行から判断）
  let separator;
  if (validRows[0].includes('\t')) {
    separator = '\t';
    console.log('区切り文字: タブ');
  } else if (validRows[0].includes(',')) {
    separator = ',';
    console.log('区切り文字: カンマ');
  } else {
    // タブやカンマがなければスペースで分割
    separator = /\s+/;
    console.log('区切り文字: スペース');
  }

  // 各行を解析
  const headers = validRows[0].split(separator).map(item => item.trim()).filter(Boolean);
  const kyItems = validRows[1].split(separator).map(item => item.trim()).filter(Boolean);

  console.log('解析結果:');
  console.log('項目名:', headers);
  console.log('項目コード:', kyItems);

  return {
    headers: headers,  // 1行目：項目名
    kyItems: kyItems   // 2行目：項目コード
  };
};
