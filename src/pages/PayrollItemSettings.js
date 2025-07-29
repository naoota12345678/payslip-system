// src/pages/PayrollItemSettings.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

// 柔軟な解析ユーティリティ関数
const parseItems = (inputText) => {
  if (!inputText || !inputText.trim()) {
    return [];
  }
  
  // 入力テキストを行に分割し、空行を除外
  const lines = inputText.split('\n')
    .map(line => line.trim())
    .filter(line => line);
  
  if (lines.length === 0) {
    return [];
  }
  
  const result = [];
  
  for (const line of lines) {
    // 区切り文字を自動判別
    let items = [];
    
    // タブが含まれていればタブ区切り
    if (line.includes('\t')) {
      items = line
        .split('\t')
        .map(item => item.trim())
        .filter(item => item.length > 0);
      console.log('タブ区切りで解析しました');
    }
    // カンマが含まれていればカンマ区切り
    else if (line.includes(',')) {
      items = line
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
      console.log('カンマ区切りで解析しました');
    }
    // それ以外はスペース区切りと仮定
    else {
      // 単語として区切れる場合はスペース区切り、そうでなければ1つの項目として扱う
      const spaceSplit = line
        .split(/\s+/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
      
      items = spaceSplit.length > 1 ? spaceSplit : [line];
      
      if (spaceSplit.length > 1) {
        console.log('スペース区切りで解析しました');
      } else {
        console.log('単一項目として解析しました');
      }
    }
    
    result.push(...items);
  }
  
  return result;
};

function PayrollItemSettings() {
  const { currentUser, userDetails } = useAuth();
  const [payrollItems, setPayrollItems] = useState([]);
  const [newItem, setNewItem] = useState({ 
    name: '', 
    type: 'income',
    displayOrder: 0,
    isRequired: false
  });
  const [bulkItemsInput, setBulkItemsInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('income'); // 'income', 'deduction', 'attendance'

  // 給与項目を読み込む
  useEffect(() => {
    const fetchPayrollItems = async () => {
      try {
        const companyId = userDetails?.companyId;
        if (!companyId) {
          console.error("Company ID not available", userDetails);
          setError("会社情報が取得できません。設定を確認してください。");
          setLoading(false);
          return;
        }

        const q = query(
          collection(db, "payrollItems"),
          where("companyId", "==", companyId)
        );
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // 表示順でソート（安全な数値チェック付き）
        items.sort((a, b) => {
          const orderA = (typeof a.displayOrder === 'number' && !isNaN(a.displayOrder)) ? a.displayOrder : 999;
          const orderB = (typeof b.displayOrder === 'number' && !isNaN(b.displayOrder)) ? b.displayOrder : 999;
          return orderA - orderB;
        });
        setPayrollItems(items);
        console.log("Loaded payroll items:", items.length);
      } catch (error) {
        console.error("給与項目の読み込みエラー:", error);
        setError("給与項目の読み込み中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    if (userDetails) {
      fetchPayrollItems();
    }
  }, [userDetails]);

  // 新しい給与項目を追加
  const addPayrollItem = async () => {
    try {
      const companyId = userDetails?.companyId;
      if (!companyId) {
        setError("会社情報が取得できないため、項目を追加できません。");
        return;
      }

      if (!newItem.name.trim()) {
        setError("項目名を入力してください。");
        return;
      }

      const newItemRef = doc(collection(db, "payrollItems"));
      
      // 同じタイプの項目の最大表示順を取得（安全な数値チェック付き）
      const sameTypeItems = payrollItems.filter(item => item.type === newItem.type);
      const validDisplayOrders = sameTypeItems
        .map(item => item.displayOrder)
        .filter(order => typeof order === 'number' && !isNaN(order));
      const maxDisplayOrder = validDisplayOrders.length > 0 
        ? Math.max(...validDisplayOrders)
        : -1;
      
      const newPayrollItem = {
        ...newItem,
        companyId: companyId,
        displayOrder: maxDisplayOrder + 1,
        createdAt: new Date()
      };
      
      await setDoc(newItemRef, newPayrollItem);
      
      setPayrollItems([...payrollItems, { id: newItemRef.id, ...newPayrollItem }]);
      // 入力フォームをリセット
      setNewItem({ name: '', type: activeTab, displayOrder: 0, isRequired: false });
      setSuccess("項目を追加しました");
      setError('');
    } catch (error) {
      console.error("給与項目の追加エラー:", error);
      setError("項目の追加中にエラーが発生しました。");
    }
  };

  // CSVから一括で給与項目を追加（改善版）
  const bulkAddItems = async () => {
    if (!bulkItemsInput.trim()) {
      setError("項目を入力してください。");
      return;
    }

    try {
      const companyId = userDetails?.companyId;
      if (!companyId) {
        setError("会社情報が取得できないため、項目を追加できません。");
        return;
      }

      // 柔軟な区切り文字解析を使用
      const parsedItems = parseItems(bulkItemsInput);

      if (parsedItems.length === 0) {
        setError("有効な項目が見つかりません。");
        return;
      }

      // 同じタイプの項目の最大表示順を取得（安全な数値チェック付き）
      const sameTypeItems = payrollItems.filter(item => item.type === activeTab);
      const validDisplayOrders = sameTypeItems
        .map(item => item.displayOrder)
        .filter(order => typeof order === 'number' && !isNaN(order));
      let nextDisplayOrder = validDisplayOrders.length > 0 
        ? Math.max(...validDisplayOrders) + 1
        : 0;

      // バッチ処理で一括追加
      const batch = writeBatch(db);
      const newItems = [];

      for (const itemName of parsedItems) {
        if (itemName) {
          const newItemRef = doc(collection(db, "payrollItems"));
          const newItem = {
            name: itemName,
            type: activeTab,
            companyId: companyId,
            displayOrder: nextDisplayOrder++,
            isRequired: false,
            createdAt: new Date()
          };
          
          batch.set(newItemRef, newItem);
          newItems.push({ id: newItemRef.id, ...newItem });
        }
      }

      // バッチ処理を実行
      await batch.commit();
      
      // 成功メッセージとステート更新
      setPayrollItems([...payrollItems, ...newItems]);
      setBulkItemsInput('');
      setSuccess(`${newItems.length}件の項目を追加しました`);
      setError('');
    } catch (error) {
      console.error("一括追加エラー:", error);
      setError("項目の一括追加中にエラーが発生しました。");
    }
  };

  // 給与項目を削除
  const deletePayrollItem = async (id) => {
    try {
      await deleteDoc(doc(db, "payrollItems", id));
      setPayrollItems(payrollItems.filter(item => item.id !== id));
      setSuccess("項目を削除しました");
    } catch (error) {
      console.error("給与項目の削除エラー:", error);
      setError("項目の削除中にエラーが発生しました。");
    }
  };

  // 給与項目の表示順を変更
  const moveItem = (id, direction) => {
    const currentIndex = payrollItems.findIndex(item => item.id === id);
    if (currentIndex === -1) return;
    
    const currentItem = payrollItems[currentIndex];
    
    // 同じタイプの項目内での位置を確認
    const sameTypeItems = payrollItems.filter(item => item.type === currentItem.type);
    const typeIndex = sameTypeItems.findIndex(item => item.id === id);
    
    if (
      (direction === "up" && typeIndex > 0) || 
      (direction === "down" && typeIndex < sameTypeItems.length - 1)
    ) {
      const newItems = [...payrollItems];
      const sameTypeArray = newItems.filter(item => item.type === currentItem.type);
      const otherItems = newItems.filter(item => item.type !== currentItem.type);
      
      const swapIndex = direction === "up" ? typeIndex - 1 : typeIndex + 1;
      
      // 項目を交換
      [sameTypeArray[typeIndex], sameTypeArray[swapIndex]] = 
      [sameTypeArray[swapIndex], sameTypeArray[typeIndex]];
      
      // displayOrderを更新
      sameTypeArray.forEach((item, index) => {
        item.displayOrder = index;
      });
      
      // 配列を再結合
      const updatedItems = [...otherItems, ...sameTypeArray];
      setPayrollItems(updatedItems);
      
      // Firestoreの更新は一括で行う
      const updateBatch = async () => {
        try {
          const batch = writeBatch(db);
          
          for (const item of sameTypeArray) {
            batch.update(doc(db, "payrollItems", item.id), { 
              displayOrder: item.displayOrder 
            });
          }
          
          await batch.commit();
          console.log("Display order updated successfully");
        } catch (error) {
          console.error("表示順の更新エラー:", error);
          setError("表示順の更新中にエラーが発生しました。");
        }
      };
      
      updateBatch();
    }
  };

  // タブを切り替える
  const changeTab = (tabName) => {
    setActiveTab(tabName);
    setNewItem({ ...newItem, type: tabName });
  };

  // タイプ名の表示用変換
  const getTypeDisplayName = (type) => {
    const typeMap = {
      'income': '支給項目',
      'deduction': '控除項目',
      'attendance': '勤怠項目'
    };
    return typeMap[type] || type;
  };

  if (loading) {
    return <div className="text-center p-8">読み込み中...</div>;
  }

  // 現在のタブに対応する項目のみをフィルタリング
  const filteredItems = payrollItems.filter(item => item.type === activeTab);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">給与項目設定</h1>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6">
          <p>{success}</p>
        </div>
      )}
      
      {/* タブ切り替え */}
      <div className="flex border-b mb-6">
        {['income', 'deduction', 'attendance'].map(tabName => (
          <button
            key={tabName}
            className={`px-4 py-2 font-medium text-sm mr-2 ${
              activeTab === tabName
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => changeTab(tabName)}
          >
            {getTypeDisplayName(tabName)}
          </button>
        ))}
      </div>
      
      {/* 新規項目追加フォーム */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">新規{getTypeDisplayName(activeTab)}追加</h2>
        
        {/* 単一項目追加フォーム */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">項目名</label>
            <input
              type="text"
              value={newItem.name}
              onChange={(e) => setNewItem({...newItem, name: e.target.value})}
              className="w-full border rounded-md px-3 py-2"
              placeholder={activeTab === 'income' ? "基本給、残業手当など" : 
                           activeTab === 'deduction' ? "社会保険料、所得税など" :
                           "出勤日数、労働時間など"}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={addPayrollItem}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              disabled={!newItem.name}
            >
              追加
            </button>
          </div>
        </div>
        
        {/* 一括追加フォーム */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium mb-3">一括追加</h3>
          <p className="text-sm text-gray-600 mb-3">
            複数の項目を一度に追加できます。各行または区切られた項目が別々の項目として追加されます。
            <br />対応形式: タブ区切り、カンマ区切り、スペース区切り、または1行1項目
          </p>
          <textarea
            value={bulkItemsInput}
            onChange={(e) => setBulkItemsInput(e.target.value)}
            className="w-full border rounded-md px-3 py-2 h-32 font-mono"
            placeholder={activeTab === 'income' ? "基本給\n残業手当\n通勤手当\n役職手当" : 
                         activeTab === 'deduction' ? "健康保険\n厚生年金\n雇用保険\n所得税" :
                         "出勤日数\n欠勤日数\n残業時間\n有給休暇"}
          />
          <button
            onClick={bulkAddItems}
            className="mt-3 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            disabled={!bulkItemsInput.trim()}
          >
            一括追加
          </button>
        </div>
      </div>
      
      {/* 項目リスト */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">登録済み{getTypeDisplayName(activeTab)}</h2>
        
        {filteredItems.length === 0 ? (
          <p className="text-gray-500 italic">項目が登録されていません</p>
        ) : (
          <ul className="border rounded-md divide-y">
            {filteredItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between p-3">
                <span>{item.name}</span>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => moveItem(item.id, "up")}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    ↑
                  </button>
                  <button 
                    onClick={() => moveItem(item.id, "down")}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    ↓
                  </button>
                  <button 
                    onClick={() => deletePayrollItem(item.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      {/* ヘルプ情報 */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-8">
        <h3 className="font-medium text-blue-800 mb-2">項目の管理について</h3>
        <ul className="list-disc pl-5 text-sm text-blue-700 space-y-1">
          <li><strong>支給項目</strong>: 給与として支給される項目（基本給、残業手当など）</li>
          <li><strong>控除項目</strong>: 給与から差し引かれる項目（社会保険料、税金など）</li>
          <li><strong>勤怠項目</strong>: 勤務に関する情報（出勤日数、労働時間など）</li>
          <li>項目名を変更する場合は、一度削除して新規追加してください</li>
          <li>項目の順番は表示順の矢印ボタンで変更できます</li>
          <li>一括追加では、タブ区切り、カンマ区切り、スペース区切り、または1行1項目の形式に対応しています</li>
        </ul>
      </div>
    </div>
  );
}

export default PayrollItemSettings;