/**
 * 列ベースCSVの転置ユーティリティ
 * 列ベースCSV（1列=1従業員）を行ベース（1行=1従業員）に変換
 */

/**
 * CSV行列を転置する
 * @param {string[][]} matrix - 2次元配列（各行がCSVの1行）
 * @returns {string[][]} 転置された2次元配列
 */
export const transposeMatrix = (matrix) => {
  if (!matrix || matrix.length === 0) return [];

  const maxCols = Math.max(...matrix.map(row => row.length));
  const transposed = [];

  for (let col = 0; col < maxCols; col++) {
    const newRow = [];
    for (let row = 0; row < matrix.length; row++) {
      newRow.push(matrix[row][col] || '');
    }
    transposed.push(newRow);
  }

  return transposed;
};

/**
 * CSVテキストを列ベースから行ベースに転置する
 * @param {string} csvText - CSVテキスト（列ベース形式）
 * @returns {{ headers: string[], dataRows: Object[] }} 転置後のヘッダーとデータ行
 */
export const transposeColumnCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSVファイルにデータが不足しています。');
  }

  // CSVをパースして2次元配列に変換
  const matrix = lines.map(line =>
    line.split(',').map(cell => cell.trim().replace(/"/g, ''))
  );

  // 転置
  const transposed = transposeMatrix(matrix);

  if (transposed.length < 2) {
    throw new Error('転置後のデータが不足しています。');
  }

  // 転置後: 1行目 = ヘッダー（元の1列目の項目名）、2行目以降 = 従業員データ
  // 元の1行目（従業員名）は転置後の1列目になる
  const headers = transposed[0]; // [空, 項目名1, 項目名2, ...]

  // ヘッダーの最初のセルが空の場合、従業員名列として扱う
  const firstHeaderEmpty = !headers[0] || headers[0].trim() === '';

  const dataRows = transposed.slice(1).map(row => {
    const rowData = {};
    headers.forEach((header, index) => {
      if (header && header.trim() !== '') {
        rowData[header] = row[index] || '';
      }
    });
    // 従業員名を特別に保存（転置後の最初の列）
    if (firstHeaderEmpty) {
      rowData['__employeeName__'] = row[0] || '';
    }
    return rowData;
  });

  // 空のヘッダーを除外
  const cleanHeaders = headers.filter(h => h && h.trim() !== '');

  console.log('📐 列ベースCSV転置完了:', {
    '元の行数': lines.length,
    '元の列数': matrix[0]?.length || 0,
    '転置後ヘッダー数': cleanHeaders.length,
    '転置後データ行数': dataRows.length,
    'ヘッダー': cleanHeaders,
    '最初のデータ行': dataRows[0]
  });

  return { headers: cleanHeaders, dataRows };
};
