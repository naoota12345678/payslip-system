// 空欄処理のテストコード
function testEmptyCells() {
  console.log('=== 空欄処理テスト開始 ===');
  
  // テストケース1: タブ区切りで空欄
  const line1_tab = 'A\t\tC\tD';  // AとCの間に空欄
  const line2_tab = 'KY01\t\tKY03\tKY04';
  
  console.log('📋 テストケース1: タブ区切り');
  console.log('line1:', JSON.stringify(line1_tab));
  console.log('line2:', JSON.stringify(line2_tab));
  
  const headerNames_tab = line1_tab.split('\t').map(item => item ? item.trim() : '');
  const itemNames_tab = line2_tab.split('\t').map(item => item ? item.trim() : '');
  
  console.log('split結果:');
  console.log('headerNames:', headerNames_tab);
  console.log('itemNames:', itemNames_tab);
  
  // テストケース2: カンマ区切りで空欄
  const line1_comma = 'A,,C,D';  // AとCの間に空欄
  const line2_comma = 'KY01,,KY03,KY04';
  
  console.log('\n📋 テストケース2: カンマ区切り');
  console.log('line1:', JSON.stringify(line1_comma));
  console.log('line2:', JSON.stringify(line2_comma));
  
  const headerNames_comma = line1_comma.split(',').map(item => item ? item.trim() : '');
  const itemNames_comma = line2_comma.split(',').map(item => item ? item.trim() : '');
  
  console.log('split結果:');
  console.log('headerNames:', headerNames_comma);
  console.log('itemNames:', itemNames_comma);
  
  // テストケース3: スペース区切り（空欄は保持できない）
  const line1_space = 'A C D';
  const line2_space = 'KY01 KY03 KY04';
  
  console.log('\n📋 テストケース3: スペース区切り');
  console.log('line1:', JSON.stringify(line1_space));
  console.log('line2:', JSON.stringify(line2_space));
  
  const headerNames_space = line1_space.split(/\s+/).map(item => item ? item.trim() : '');
  const itemNames_space = line2_space.split(/\s+/).map(item => item ? item.trim() : '');
  
  console.log('split結果:');
  console.log('headerNames:', headerNames_space);
  console.log('itemNames:', itemNames_space);
  
  console.log('=== テスト終了 ===');
}

// テスト実行
testEmptyCells(); 