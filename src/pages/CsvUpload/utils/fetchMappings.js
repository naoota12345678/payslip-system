// src/pages/CsvUpload/utils/fetchMappings.js

import { doc, getDoc } from 'firebase/firestore';

/**
 * 会社のマッピング情報を取得する
 * @param {Object} db Firestore DBインスタンス
 * @param {string} companyId 会社ID
 * @param {Array} items 給与項目リスト
 * @param {boolean} debugMode デバッグモードの有無
 * @returns {Object} 給与項目とマッピング状態
 */
export const fetchCompanyMappings = async (db, companyId, items, debugMode = false) => {
  let mappingsFound = false;
  const itemsCopy = JSON.parse(JSON.stringify(items)); // ディープコピーを作成

  try {
    // デバッグ：現在の給与項目リストを表示
    if (debugMode) {
      console.log('[Debug] 給与項目リスト:', itemsCopy.map(item => ({ id: item.id, name: item.name })));
    }

    // 新しい形式のマッピングを確認 (csvMappings)
    const mappingDoc = await getDoc(doc(db, "csvMappings", companyId));
    if (mappingDoc.exists() && mappingDoc.data().mappings) {
      // マッピング情報を給与項目に適用
      const mappings = mappingDoc.data().mappings;
      
      if (debugMode) {
        console.log('[Debug] Loaded existing mappings from csvMappings collection:', mappings);
      }
      
      // 各項目のIDに対応するマッピングを適用
      itemsCopy.forEach(item => {
        if (item.id && mappings[item.id]) {
          item.csvColumn = mappings[item.id];
          if (debugMode) {
            console.log(`[Debug] マッピング適用: 項目 ${item.name} (ID: ${item.id}) => ${mappings[item.id]}`);
          }
        }
      });
      
      mappingsFound = true;
    } else if (debugMode) {
      console.log('[Debug] No mappings found in csvMappings collection');
    }
    
    // 古い形式のマッピングも確認 (CsvMapping.jsで使用されるコレクション)
    if (!mappingsFound) {
      const oldMappingDoc = await getDoc(doc(db, "csvMapping", companyId));
      if (oldMappingDoc.exists() && oldMappingDoc.data().csvMapping) {
        if (debugMode) {
          console.log('[Debug] Found mapping in csvMapping collection');
        }
        
        // 古い形式のマッピングを適用
        const oldMappings = oldMappingDoc.data().csvMapping;
        
        // 各カテゴリからマッピング情報を探す
        const allItems = [
          ...(oldMappings.incomeItems || []),
          ...(oldMappings.deductionItems || []),
          ...(oldMappings.attendanceItems || []),
          ...(oldMappings.kyItems || [])
        ];
        
        if (debugMode) {
          console.log('[Debug] 古い形式のアイテム数:', allItems.length);
          console.log('[Debug] アイテムサンプル:', allItems.slice(0, 3));
        }
        
        // 項目名でマッチングを行う
        itemsCopy.forEach(item => {
          // 既にマッピングされている場合はスキップ
          if (item.csvColumn) return;
          
          // 同じ名前の項目を探す
          const matchingItem = allItems.find(oldItem => 
            oldItem.itemName === item.name || oldItem.name === item.name
          );
          
          if (matchingItem && matchingItem.headerName) {
            item.csvColumn = matchingItem.headerName;
            if (debugMode) {
              console.log(`[Debug] 古い形式からマッピング適用: 項目 ${item.name} => ${matchingItem.headerName}`);
            }
          }
        });
        
        mappingsFound = true;
      } else if (debugMode) {
        console.log('[Debug] No mappings found in csvMapping collection');
      }
    }
    
    // マッピングの有無を確認
    const hasMappings = itemsCopy.some(item => item.csvColumn);
    
    if (debugMode) {
      console.log('[Debug] Mappings loaded:', {
        itemsCount: itemsCopy.length,
        mappedItemsCount: itemsCopy.filter(item => item.csvColumn).length,
        hasMappings: hasMappings
      });
      
      // マッピングされた項目の一覧を表示
      console.log('[Debug] マッピングされた項目一覧:');
      itemsCopy.filter(item => item.csvColumn).forEach(item => {
        console.log(`- ${item.name} => ${item.csvColumn}`);
      });
    }
    
    return {
      items: itemsCopy,
      hasMappings
    };
  } catch (err) {
    console.error("マッピング情報取得エラー:", err);
    return {
      items: itemsCopy,
      hasMappings: false,
      error: err.message
    };
  }
};
