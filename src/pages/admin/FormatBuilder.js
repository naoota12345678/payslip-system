// src/pages/admin/FormatBuilder.js
// 取り込みCSVフォーマットビルダー - プリセット項目から選んでCSVテンプレートを作成

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// プリセット項目定義
const PRESET_ITEMS = {
  attendance: {
    label: '勤怠',
    items: [
      { name: '出勤日数', code: '出勤日数' },
      { name: '欠勤日数', code: '欠勤日数' },
      { name: '有休日数', code: '有休日数' },
      { name: '有休残日数', code: '有休残日数' },
      { name: '所定労働時間', code: '所定労働時間' },
      { name: '実労働時間', code: '実労働時間' },
      { name: '残業時間', code: '残業時間' },
      { name: '深夜時間', code: '深夜時間' },
      { name: '休日出勤日数', code: '休日出勤日数' },
      { name: '休日労働時間', code: '休日労働時間' },
      { name: '遅刻回数', code: '遅刻回数' },
      { name: '早退回数', code: '早退回数' },
      { name: '特別休暇日数', code: '特別休暇日数' },
    ]
  },
  income: {
    label: '支給',
    items: [
      { name: '基本給', code: '基本給' },
      { name: '残業手当', code: '残業手当' },
      { name: '深夜手当', code: '深夜手当' },
      { name: '休日手当', code: '休日手当' },
      { name: '通勤手当', code: '通勤手当' },
      { name: '住宅手当', code: '住宅手当' },
      { name: '家族手当', code: '家族手当' },
      { name: '役職手当', code: '役職手当' },
      { name: '資格手当', code: '資格手当' },
      { name: '技術手当', code: '技術手当' },
      { name: '皆勤手当', code: '皆勤手当' },
      { name: '調整手当', code: '調整手当' },
      { name: 'その他手当', code: 'その他手当' },
      { name: '非課税通勤費', code: '非課税通勤費' },
    ]
  },
  deduction: {
    label: '控除',
    items: [
      { name: '健康保険', code: '健康保険' },
      { name: '介護保険', code: '介護保険' },
      { name: '厚生年金', code: '厚生年金' },
      { name: '雇用保険', code: '雇用保険' },
      { name: '所得税', code: '所得税' },
      { name: '住民税', code: '住民税' },
      { name: '年末調整', code: '年末調整' },
      { name: '社宅控除', code: '社宅控除' },
      { name: '財形貯蓄', code: '財形貯蓄' },
      { name: '組合費', code: '組合費' },
      { name: 'その他控除', code: 'その他控除' },
    ]
  },
  total: {
    label: '合計',
    items: [
      { name: '総支給額', code: '総支給額' },
      { name: '総控除額', code: '総控除額' },
      { name: '差引支給額', code: '差引支給額' },
      { name: '課税対象額', code: '課税対象額' },
      { name: '社会保険合計', code: '社会保険合計' },
    ]
  }
};

// デフォルトで選択される項目
const DEFAULT_SELECTED = [
  '基本給', '残業手当', '通勤手当',
  '健康保険', '厚生年金', '雇用保険', '所得税', '住民税',
  '出勤日数', '残業時間',
  '総支給額', '総控除額', '差引支給額'
];

function FormatBuilder() {
  const { userDetails } = useAuth();
  const [orientation, setOrientation] = useState('row'); // 'row' or 'column'
  const [selectedItems, setSelectedItems] = useState({}); // { code: { category, name, order, enabled } }
  const [customItemName, setCustomItemName] = useState('');
  const [customItemCategory, setCustomItemCategory] = useState('income');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // 初期化：プリセットからデフォルト項目を設定
  const initializeDefaults = useCallback(() => {
    const items = {};
    let order = 0;
    Object.entries(PRESET_ITEMS).forEach(([category, { items: presetItems }]) => {
      presetItems.forEach(item => {
        items[item.code] = {
          category,
          name: item.name,
          code: item.code,
          order: order++,
          enabled: DEFAULT_SELECTED.includes(item.code)
        };
      });
    });
    return items;
  }, []);

  // Firestoreから既存設定を読み込み
  useEffect(() => {
    const loadSettings = async () => {
      if (!userDetails?.companyId) return;
      try {
        const docRef = doc(db, 'csvFormatSettings', userDetails.companyId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrientation(data.orientation || 'row');
          if (data.items && Object.keys(data.items).length > 0) {
            setSelectedItems(data.items);
          } else {
            setSelectedItems(initializeDefaults());
          }
        } else {
          setSelectedItems(initializeDefaults());
        }
      } catch (err) {
        console.error('設定読み込みエラー:', err);
        setSelectedItems(initializeDefaults());
      }
      setLoading(false);
    };
    loadSettings();
  }, [userDetails, initializeDefaults]);

  // 項目の有効/無効を切り替え
  const toggleItem = (code) => {
    setSelectedItems(prev => ({
      ...prev,
      [code]: { ...prev[code], enabled: !prev[code].enabled }
    }));
  };

  // 全選択/全解除
  const toggleAllInCategory = (category, enable) => {
    setSelectedItems(prev => {
      const updated = { ...prev };
      Object.entries(updated).forEach(([code, item]) => {
        if (item.category === category) {
          updated[code] = { ...item, enabled: enable };
        }
      });
      return updated;
    });
  };

  // 項目の順番を移動
  const moveItem = (code, direction) => {
    setSelectedItems(prev => {
      const items = { ...prev };
      const currentItem = items[code];
      const category = currentItem.category;

      // 同じカテゴリの項目を順番順に取得
      const categoryItems = Object.entries(items)
        .filter(([, item]) => item.category === category)
        .sort(([, a], [, b]) => a.order - b.order);

      const currentIndex = categoryItems.findIndex(([c]) => c === code);
      const swapIndex = currentIndex + direction;

      if (swapIndex < 0 || swapIndex >= categoryItems.length) return prev;

      const [swapCode] = categoryItems[swapIndex];
      const tempOrder = items[code].order;
      items[code] = { ...items[code], order: items[swapCode].order };
      items[swapCode] = { ...items[swapCode], order: tempOrder };

      return items;
    });
  };

  // カスタム項目を追加
  const addCustomItem = () => {
    const name = customItemName.trim();
    if (!name) return;
    if (selectedItems[name]) {
      setMessage({ type: 'error', text: `「${name}」は既に存在します` });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    const categoryItems = Object.values(selectedItems).filter(i => i.category === customItemCategory);
    const maxOrder = categoryItems.length > 0 ? Math.max(...categoryItems.map(i => i.order)) : -1;

    setSelectedItems(prev => ({
      ...prev,
      [name]: {
        category: customItemCategory,
        name: name,
        code: name,
        order: maxOrder + 1,
        enabled: true,
        custom: true
      }
    }));
    setCustomItemName('');
  };

  // カスタム項目を削除
  const removeCustomItem = (code) => {
    setSelectedItems(prev => {
      const updated = { ...prev };
      delete updated[code];
      return updated;
    });
  };

  // 保存 → csvMappingsにも同期
  const saveFormat = async () => {
    if (!userDetails?.companyId) return;
    setSaving(true);
    try {
      // フォーマット設定を保存
      const docRef = doc(db, 'csvFormatSettings', userDetails.companyId);
      await setDoc(docRef, {
        orientation,
        items: selectedItems,
        updatedAt: new Date()
      });

      // csvMappingsにも同期（給与アップロードで使用）
      const enabledItems = Object.values(selectedItems)
        .filter(i => i.enabled)
        .sort((a, b) => a.order - b.order);

      const incomeItems = enabledItems
        .filter(i => i.category === 'income')
        .map((item, idx) => ({
          headerName: item.code,
          itemName: item.name,
          isVisible: true,
          showZeroValue: false,
          order: idx,
          id: `income_${idx}`
        }));

      const deductionItems = enabledItems
        .filter(i => i.category === 'deduction')
        .map((item, idx) => ({
          headerName: item.code,
          itemName: item.name,
          isVisible: true,
          showZeroValue: false,
          order: idx,
          id: `deduction_${idx}`
        }));

      const attendanceItems = enabledItems
        .filter(i => i.category === 'attendance')
        .map((item, idx) => ({
          headerName: item.code,
          itemName: item.name,
          isVisible: true,
          showZeroValue: false,
          order: idx,
          id: `attendance_${idx}`
        }));

      const totalItems = enabledItems
        .filter(i => i.category === 'total')
        .map((item, idx) => ({
          headerName: item.code,
          itemName: item.name,
          isVisible: true,
          showZeroValue: false,
          order: idx,
          id: `total_${idx}`
        }));

      const mappingDocRef = doc(db, 'csvMappings', userDetails.companyId);
      await setDoc(mappingDocRef, {
        orientation,
        incomeItems,
        deductionItems,
        attendanceItems,
        totalItems,
        itemCodeItems: [],
        mainFields: {
          employeeCode: '社員番号'
        },
        parsedHeaders: enabledItems.map(i => i.code),
        headerInput: '',
        rowBasedInput: '',
        updatedAt: new Date(),
        version: 'format_builder_v1'
      });

      setMessage({ type: 'success', text: 'フォーマットを保存しました' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (err) {
      console.error('保存エラー:', err);
      setMessage({ type: 'error', text: '保存に失敗しました: ' + err.message });
    }
    setSaving(false);
  };

  // テンプレートCSVダウンロード
  const downloadTemplate = () => {
    const enabledItems = Object.values(selectedItems)
      .filter(i => i.enabled)
      .sort((a, b) => a.order - b.order);

    if (enabledItems.length === 0) {
      setMessage({ type: 'error', text: '項目を1つ以上選択してください' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    let csvContent;

    if (orientation === 'row') {
      // 横ベース: 1行目がヘッダー
      const headers = ['社員番号', ...enabledItems.map(i => i.code)];
      csvContent = headers.join(',') + '\n';
    } else {
      // 縦ベース: 1列目が項目名、1行目が社員番号
      const lines = ['社員番号'];
      enabledItems.forEach(item => {
        lines.push(item.code);
      });
      csvContent = lines.join('\n') + '\n';
    }

    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `給与取り込みテンプレート_${orientation === 'row' ? '横' : '縦'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // カテゴリごとの項目一覧をレンダリング
  const renderCategory = (categoryKey, { label }) => {
    const categoryItems = Object.entries(selectedItems)
      .filter(([, item]) => item.category === categoryKey)
      .sort(([, a], [, b]) => a.order - b.order);

    const enabledCount = categoryItems.filter(([, i]) => i.enabled).length;
    const totalCount = categoryItems.length;

    // カテゴリごとのヘッダー色
    const headerColors = {
      attendance: { bg: '#0D2137', text: '#B8976C' },
      income: { bg: '#0D2137', text: '#B8976C' },
      deduction: { bg: '#0D2137', text: '#B8976C' },
      total: { bg: '#B8976C', text: '#0D2137' }
    };
    const color = headerColors[categoryKey];

    return (
      <div key={categoryKey} className="border rounded-lg overflow-hidden">
        <div
          className="px-4 py-2 font-medium flex items-center justify-between"
          style={{ backgroundColor: color.bg, color: color.text }}
        >
          <span>{label}（{enabledCount}/{totalCount}）</span>
          <div className="flex gap-1">
            <button
              onClick={() => toggleAllInCategory(categoryKey, true)}
              className="text-xs px-2 py-0.5 rounded opacity-80 hover:opacity-100"
              style={{ backgroundColor: color.text, color: color.bg }}
            >
              全選択
            </button>
            <button
              onClick={() => toggleAllInCategory(categoryKey, false)}
              className="text-xs px-2 py-0.5 rounded opacity-80 hover:opacity-100"
              style={{ backgroundColor: color.text, color: color.bg }}
            >
              全解除
            </button>
          </div>
        </div>
        <div className="divide-y">
          {categoryItems.map(([code, item], idx) => (
            <div key={code} className={`flex items-center px-4 py-2 text-sm ${item.enabled ? 'bg-white' : 'bg-gray-50 text-gray-400'}`}>
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => toggleItem(code)}
                className="mr-3 h-4 w-4"
              />
              <span className="flex-1">{item.name}</span>
              {item.custom && (
                <button
                  onClick={() => removeCustomItem(code)}
                  className="text-red-400 hover:text-red-600 mr-2 text-xs"
                  title="削除"
                >
                  削除
                </button>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => moveItem(code, -1)}
                  disabled={idx === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 px-1"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveItem(code, 1)}
                  disabled={idx === categoryItems.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-20 px-1"
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const enabledCount = Object.values(selectedItems).filter(i => i.enabled).length;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">取り込みフォーマット作成</h1>
      <p className="text-gray-600 mb-6">
        給与データCSVの取り込みフォーマットを作成します。項目を選んで保存すると、テンプレートCSVをダウンロードできます。
      </p>

      {/* メッセージ */}
      {message.text && (
        <div className={`mb-4 p-3 rounded-md text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
          'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* ステップ1: 縦横選択 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-3">1. CSVの形式を選択</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setOrientation('row')}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              orientation === 'row' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium mb-1">横ベース（行ベース）</div>
            <div className="text-xs text-gray-500 mb-2">1行 = 1人の従業員</div>
            <div className="text-xs font-mono bg-gray-100 p-2 rounded overflow-x-auto">
              社員番号,基本給,残業手当...<br/>
              001,300000,50000...<br/>
              002,280000,30000...
            </div>
          </button>
          <button
            onClick={() => setOrientation('column')}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              orientation === 'column' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-medium mb-1">縦ベース（列ベース）</div>
            <div className="text-xs text-gray-500 mb-2">1列 = 1人の従業員</div>
            <div className="text-xs font-mono bg-gray-100 p-2 rounded overflow-x-auto">
              社員番号,001,002...<br/>
              基本給,300000,280000...<br/>
              残業手当,50000,30000...
            </div>
          </button>
        </div>
      </div>

      {/* ステップ2: 項目選択 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">2. 項目を選択（{enabledCount}項目選択中）</h2>
        <p className="text-xs text-gray-500 mb-4">
          0円の項目は明細に表示されません。迷ったら多めに選んでおいてOKです。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(PRESET_ITEMS).map(([key, data]) => renderCategory(key, data))}
        </div>

        {/* カスタム項目追加 */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium mb-2">カスタム項目を追加</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              placeholder="項目名を入力"
              className="flex-1 px-3 py-2 border rounded-md text-sm"
              onKeyDown={(e) => e.key === 'Enter' && addCustomItem()}
            />
            <select
              value={customItemCategory}
              onChange={(e) => setCustomItemCategory(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="attendance">勤怠</option>
              <option value="income">支給</option>
              <option value="deduction">控除</option>
              <option value="total">合計</option>
            </select>
            <button
              onClick={addCustomItem}
              className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm hover:bg-gray-700"
            >
              追加
            </button>
          </div>
        </div>
      </div>

      {/* ステップ3: 保存 & ダウンロード */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">3. 保存 & テンプレートダウンロード</h2>
        <div className="flex gap-4">
          <button
            onClick={saveFormat}
            disabled={saving || enabledCount === 0}
            className="px-6 py-3 text-white rounded-md font-medium disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: '#0D2137' }}
          >
            {saving ? '保存中...' : 'フォーマットを保存'}
          </button>
          <button
            onClick={downloadTemplate}
            disabled={enabledCount === 0}
            className="px-6 py-3 text-white rounded-md font-medium disabled:opacity-50 hover:opacity-90"
            style={{ backgroundColor: '#B8976C' }}
          >
            テンプレートCSVをダウンロード
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          保存するとマッピング設定も自動的に更新されます。テンプレートCSVに数字を入れてアップロードしてください。
        </p>
      </div>

      {/* 給与ソフト利用者向けリンク */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">
          <strong>給与ソフトをお使いの方へ：</strong>
          給与ソフトからCSVを出力できる場合は、
          <a href="/admin/settings/csv-mapping" className="text-blue-600 hover:underline ml-1">
            CSVマッピング設定（上級者向け）
          </a>
          をご利用ください。
        </p>
      </div>
    </div>
  );
}

export default FormatBuilder;
