/**
 * シンプルマッピングの空欄処理テスト
 */

import { createMappingFromInput } from './src/pages/CsvMapping/utils/simpleMappingManager.js';

console.log('=== シンプルマッピング空欄テスト ===');

// テストケース1: タブ区切りで空欄あり
const line1_tab = '基本給\t\t諸手当\t支給合計';
const line2_tab = 'KY01\t\tKY03\tKY04';

console.log('\n📋 テストケース1: タブ区切り（空欄あり）');
console.log('line1:', JSON.stringify(line1_tab));
console.log('line2:', JSON.stringify(line2_tab));

const result1 = createMappingFromInput(line1_tab, line2_tab);
console.log('結果:', {
  parsedHeaders: result1.parsedHeaders,
  itemCount: result1.itemCodeItems.length,
  firstFewItems: result1.itemCodeItems.slice(0, 5).map(item => ({
    columnIndex: item.columnIndex,
    headerName: item.headerName,
    itemName: item.itemName
  }))
});

// テストケース2: カンマ区切りで空欄あり
const line1_comma = '基本給,,諸手当,支給合計';
const line2_comma = 'KY01,,KY03,KY04';

console.log('\n📋 テストケース2: カンマ区切り（空欄あり）');
console.log('line1:', JSON.stringify(line1_comma));
console.log('line2:', JSON.stringify(line2_comma));

const result2 = createMappingFromInput(line1_comma, line2_comma);
console.log('結果:', {
  parsedHeaders: result2.parsedHeaders,
  itemCount: result2.itemCodeItems.length,
  firstFewItems: result2.itemCodeItems.slice(0, 5).map(item => ({
    columnIndex: item.columnIndex,
    headerName: item.headerName,
    itemName: item.itemName
  }))
});

console.log('\n=== テスト完了 ==='); 