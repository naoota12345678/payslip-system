// 貼り付けられたデータの解析

const rawData = `KY01	KY02	KY03	KY04	KY11_0	KY11_1	KY11_2	KY11_3	KY11_4	KY11_5	KY11_6	KY11_7	KY11_8	KY11_9	KY11_10	KY11_11	KY11_12	KY11_13	KY11_14	KY11_15	KY11_16	KY11_17	KY12_0	KY12_1	KY12_2	KY12_3	KY12_4	KY12_5	KY12_6	KY12_7	KY12_8	KY12_9	KY12_10	KY12_11	KY12_12	KY12_13	KY12_14	KY12_15	KY12_16	KY12_17	KY12_18	KY12_19	KY12_20	KY12_21	KY12_22	KY12_23	KY21_0	KY21_1	KY21_2	KY21_3	KY21_4	KY21_5	KY21_6	KY21_7	KY21_8	KY21_9	KY21_10	KY21_11	KY21_12	KY21_13	KY21_14	KY21_15	KY21_16	KY21_17	KY21_18	KY21_19	KY21_20	KY21_21	KY21_22	KY21_23	KY21_24	KY21_25	KY21_26	KY21_27	KY22_0	KY22_1	KY22_2	KY22_3	KY22_4	KY22_5	KY22_6	KY22_7	KY22_8	KY22_9	KY22_10	KY22_11	KY22_12	KY22_13	KY22_14	KY22_15	KY22_16	KY22_17	KY22_18	KY22_19	KY22_20	KY22_21	KY22_22	KY22_23	KY22_24	KY22_25	KY22_26	KY22_27	KY22_29	KY22_30	KY22_28	KY23_0	KY23_1	KY23_2	KY23_3	KY23_4	KY23_5	KY23_6	KY23_7	KY23_8	KY31_0	KY31_3	KY31_1	KY31_2	KY32	KY33	KY35	KY36	KY37	KY38	KY40	KY41	KY42	KY43	KY44	KY45	KY46	KY47	KY48		KY34	KY49
識別コード※	部門コード	従業員コード※	従業員氏名	出勤日数	欠勤日数	普通残業時間	深夜残業時間	休日出勤時間	休日深夜時間	遅刻時間	月労働時間数	残業60時間超過	出向	遅刻回数	早退回数	有給取得日数	有給残日数	早退時間				普通残業単価	深夜残業単価	休日出勤単価	休日深夜単価	遅刻早退単価	欠勤単価		単価	通勤手当日額	通勤手当月額	固定残業時間	出向通勤手当日額													基本給	管理職手当	固定残業手当	残業手当		特別手当	扶養手当												前月調整	固定残業超過	深夜手当	休日手当		勤怠控除	通勤手当(非)	通勤手当(課)	実総支給額	総支給額	健康保険	厚生年金保険	厚生年金基金	雇用保険	社会保険合計	課税対象額	所得税	住民税	賄い			その他控除	前月調整															総控除額	(内)基本保険	(内)特定保険	(内)介護保険	定額減税	年末調整	前回端額	今回端額	振込口座１	振込口座２	振込口座３	現金支給額	差引支給額	有休付与日数	有休失効日数	当月消化日数	当月有休残	扶養親族数	支払基礎日数	支払日	課税支給計	非税支給計	社保対象計	社保控除401k	健康保険_標準額	厚生年金_標準額	健康保険_料率now	介護保険_料率now	厚生年金_料率now	厚年基金_料率now	通勤手当の月按分額	残業対象金額	全員用コメント	個人用コメント	上書フラグ`;

function analyzeData() {
  console.log('=== データ解析開始 ===');
  
  // 行に分割
  const lines = rawData.trim().split('\n');
  console.log('行数:', lines.length);
  
  // 各行をタブで分割
  const firstRow = lines[0].split('\t');
  const secondRow = lines[1].split('\t');
  
  console.log('\n1行目（項目コード）の項目数:', firstRow.length);
  console.log('2行目（日本語項目名）の項目数:', secondRow.length);
  
  // KY22_6とKY22_7の位置を確認
  const ky22_6_index = firstRow.indexOf('KY22_6');
  const ky22_7_index = firstRow.indexOf('KY22_7');
  
  console.log('\n=== 重要項目の位置確認 ===');
  console.log(`KY22_6の位置: ${ky22_6_index} (${ky22_6_index >= 0 ? firstRow[ky22_6_index] : '見つからず'})`);
  console.log(`KY22_7の位置: ${ky22_7_index} (${ky22_7_index >= 0 ? firstRow[ky22_7_index] : '見つからず'})`);
  
  if (ky22_6_index >= 0 && ky22_6_index < secondRow.length) {
    console.log(`KY22_6に対応する日本語項目名: "${secondRow[ky22_6_index]}"`);
  }
  if (ky22_7_index >= 0 && ky22_7_index < secondRow.length) {
    console.log(`KY22_7に対応する日本語項目名: "${secondRow[ky22_7_index]}"`);
  }
  
  // KY21_5とKY21_6の位置も確認（現在のマッピング）
  const ky21_5_index = firstRow.indexOf('KY21_5');
  const ky21_6_index = firstRow.indexOf('KY21_6');
  
  console.log('\n=== 現在のマッピング項目の位置確認 ===');
  console.log(`KY21_5の位置: ${ky21_5_index} (${ky21_5_index >= 0 ? firstRow[ky21_5_index] : '見つからず'})`);
  console.log(`KY21_6の位置: ${ky21_6_index} (${ky21_6_index >= 0 ? firstRow[ky21_6_index] : '見つからず'})`);
  
  if (ky21_5_index >= 0 && ky21_5_index < secondRow.length) {
    console.log(`KY21_5に対応する日本語項目名: "${secondRow[ky21_5_index]}"`);
  }
  if (ky21_6_index >= 0 && ky21_6_index < secondRow.length) {
    console.log(`KY21_6に対応する日本語項目名: "${secondRow[ky21_6_index]}"`);
  }
  
  // 所得税と住民税の位置を確認
  const shotokuzei_index = secondRow.indexOf('所得税');
  const juminzei_index = secondRow.indexOf('住民税');
  
  console.log('\n=== 日本語項目名から逆引き ===');
  console.log(`"所得税"の位置: ${shotokuzei_index}`);
  if (shotokuzei_index >= 0 && shotokuzei_index < firstRow.length) {
    console.log(`"所得税"に対応する項目コード: "${firstRow[shotokuzei_index]}"`);
  }
  
  console.log(`"住民税"の位置: ${juminzei_index}`);
  if (juminzei_index >= 0 && juminzei_index < firstRow.length) {
    console.log(`"住民税"に対応する項目コード: "${firstRow[juminzei_index]}"`);
  }
  
  // KY22系の項目をすべて表示
  console.log('\n=== KY22系項目の一覧 ===');
  firstRow.forEach((item, index) => {
    if (item.startsWith('KY22_')) {
      const japaneseItem = secondRow[index] || '';
      console.log(`${item} (位置${index}) → "${japaneseItem}"`);
    }
  });
  
  console.log('\n=== データ解析終了 ===');
}

analyzeData(); 