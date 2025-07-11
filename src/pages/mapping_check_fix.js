// CSVUpload.jsの一部修正（マッピング設定チェック部分のみ）

// マッピング情報を取得
const mappingDoc = await getDoc(doc(db, "csvMappings", userDetails.companyId));
if (mappingDoc.exists() && mappingDoc.data().mappings) {
  // マッピング情報を給与項目に適用
  const mappings = mappingDoc.data().mappings;
  items.forEach(item => {
    if (mappings[item.id]) {
      item.csvColumn = mappings[item.id];
    }
  });

  console.log('Loaded existing mappings');
}

// CsvMapping.jsファイルとは異なり、csvMapping ではなく csvMappings コレクションを使用している
// これは別の場所に設定情報を保存している可能性があるため、追加のチェックを行う
const oldMappingDoc = await getDoc(doc(db, "csvMapping", userDetails.companyId));
if (oldMappingDoc.exists() && oldMappingDoc.data().csvMapping) {
  console.log('Found old style mapping in csvMapping collection');
  // 古い形式のマッピングを適用
  const oldMappings = oldMappingDoc.data().csvMapping;
  
  // マッピング情報が異なるので、適切な形式に変換
  items.forEach(item => {
    // 古い形式のマッピングで項目に対応する設定があるか探す
    const oldItem = oldMappings.incomeItems.find(i => i.itemName === item.name) ||
                    oldMappings.deductionItems.find(i => i.itemName === item.name) ||
                    oldMappings.attendanceItems.find(i => i.itemName === item.name) ||
                    oldMappings.kyItems.find(i => i.itemName === item.name);
    
    if (oldItem && oldItem.headerName) {
      item.csvColumn = oldItem.headerName;
    }
  });
}

// マッピングの適用が完了した後でマッピングされている項目があるかチェック
const hasMappings = items.some(item => item.csvColumn);
if (!hasMappings) {
  console.log('No mappings found for any payroll items');
}
