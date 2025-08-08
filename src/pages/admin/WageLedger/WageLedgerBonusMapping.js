// src/pages/admin/WageLedger/WageLedgerBonusMapping.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';

function WageLedgerBonusMapping() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userDetails } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [bonusMapping, setBonusMapping] = useState(null);
  const [salaryMapping, setSalaryMapping] = useState(null);
  const [bonusMappingConfig, setBonusMappingConfig] = useState({
    showSeparately: [],
    mergeWithSalary: []
  });

  const ledgerType = searchParams.get('type') || 'integrated';

  useEffect(() => {
    const fetchMappingData = async () => {
      if (!userDetails?.companyId) return;

      try {
        setLoading(true);
        
        // 給与マッピング設定を取得
        const salaryMappingDoc = await getDoc(doc(db, "csvMappings", userDetails.companyId));
        if (salaryMappingDoc.exists()) {
          setSalaryMapping(salaryMappingDoc.data());
          console.log('✅ 給与マッピング設定取得完了');
        }

        // 賞与マッピング設定を取得
        const bonusMappingDoc = await getDoc(doc(db, "csvMappingsBonus", userDetails.companyId));
        if (bonusMappingDoc.exists()) {
          setBonusMapping(bonusMappingDoc.data());
          console.log('✅ 賞与マッピング設定取得完了');
        }

        // 統合賃金台帳設定を取得（存在する場合）
        const integratedConfigDoc = await getDoc(doc(db, "wageLedgerIntegratedConfig", userDetails.companyId));
        if (integratedConfigDoc.exists()) {
          setBonusMappingConfig(integratedConfigDoc.data());
          console.log('✅ 統合賃金台帳設定を読み込みました');
        }

        setLoading(false);
      } catch (err) {
        console.error('❌ マッピングデータ取得エラー:', err);
        setError('設定データの取得中にエラーが発生しました');
        setLoading(false);
      }
    };

    fetchMappingData();
  }, [userDetails]);

  // 賞与項目をカテゴリ別に分類
  const getBonusItemsByCategory = () => {
    if (!bonusMapping) return { incomeItems: [], deductionItems: [], attendanceItems: [], totalItems: [] };

    return {
      incomeItems: bonusMapping.incomeItems || [],
      deductionItems: bonusMapping.deductionItems || [],
      attendanceItems: bonusMapping.attendanceItems || [],
      totalItems: bonusMapping.totalItems || []
    };
  };

  const { incomeItems, deductionItems, attendanceItems, totalItems } = getBonusItemsByCategory();

  // 項目の表示設定を変更
  const handleItemToggle = (itemId, displayType) => {
    setBonusMappingConfig(prev => {
      const newConfig = { ...prev };
      
      // 既存の設定から該当項目を削除
      newConfig.showSeparately = newConfig.showSeparately.filter(id => id !== itemId);
      newConfig.mergeWithSalary = newConfig.mergeWithSalary.filter(id => id !== itemId);
      
      // 新しい設定に追加
      if (displayType === 'separate') {
        newConfig.showSeparately.push(itemId);
      } else if (displayType === 'merge') {
        newConfig.mergeWithSalary.push(itemId);
      }
      
      return newConfig;
    });
  };

  // 項目の現在の表示設定を取得
  const getItemDisplayType = (itemId) => {
    if (bonusMappingConfig.showSeparately.includes(itemId)) return 'separate';
    if (bonusMappingConfig.mergeWithSalary.includes(itemId)) return 'merge';
    return 'hidden';
  };

  // 設定を保存
  const handleSave = async () => {
    try {
      setSaving(true);
      
      await setDoc(doc(db, "wageLedgerIntegratedConfig", userDetails.companyId), bonusMappingConfig);
      console.log('✅ 統合賃金台帳設定を保存しました');
      
      // 期間選択画面に進む
      navigate('/admin/wage-ledger/period-select?type=integrated');
    } catch (err) {
      console.error('❌ 設定保存エラー:', err);
      setError('設定の保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  // 項目を表示するコンポーネント
  const renderItemList = (items, categoryName, categoryColor) => (
    <div className="bg-white rounded-lg border p-4">
      <h3 className={`text-lg font-medium mb-3 ${categoryColor}`}>
        {categoryName} ({items.length}件)
      </h3>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm">該当する項目がありません</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const itemId = item.headerName;
            const displayType = getItemDisplayType(itemId);
            const displayName = (item.itemName && item.itemName.trim() !== '') 
              ? item.itemName 
              : item.headerName;
            
            return (
              <div key={itemId} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{displayName}</span>
                  <span className="ml-2 text-sm text-gray-500">({item.headerName})</span>
                </div>
                <div className="flex space-x-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name={`item-${itemId}`}
                      value="hidden"
                      checked={displayType === 'hidden'}
                      onChange={() => handleItemToggle(itemId, 'hidden')}
                      className="mr-1"
                    />
                    <span className="text-sm text-gray-600">非表示</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name={`item-${itemId}`}
                      value="separate"
                      checked={displayType === 'separate'}
                      onChange={() => handleItemToggle(itemId, 'separate')}
                      className="mr-1"
                    />
                    <span className="text-sm text-blue-600">別項目表示</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name={`item-${itemId}`}
                      value="merge"
                      checked={displayType === 'merge'}
                      onChange={() => handleItemToggle(itemId, 'merge')}
                      className="mr-1"
                    />
                    <span className="text-sm text-green-600">給与項目に統合</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">設定データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 text-red-700 p-4 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <nav className="text-sm breadcrumbs mb-4">
          <span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/wage-ledger')}>
            賃金台帳
          </span>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-blue-600 font-medium">統合賃金台帳設定</span>
        </nav>
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <h1 className="text-2xl font-bold text-gray-900">統合賃金台帳 - 賞与項目表示設定</h1>
        </div>
        <p className="text-gray-600 mt-2">
          統合賃金台帳で賞与項目をどのように表示するかを設定してください
        </p>
      </div>

      {/* 設定説明 */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="font-medium text-blue-900 mb-2">表示オプション</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">非表示:</span>
            <p className="text-gray-600">統合賃金台帳に表示しません</p>
          </div>
          <div>
            <span className="font-medium text-blue-700">別項目表示:</span>
            <p className="text-blue-600">「賞与◯◯」として独立した項目で表示</p>
          </div>
          <div>
            <span className="font-medium text-green-700">給与項目に統合:</span>
            <p className="text-green-600">同名の給与項目がある場合は合算して表示</p>
          </div>
        </div>
      </div>

      {!bonusMapping ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                賞与マッピング設定がありません。先に賞与明細のCSVマッピング設定を行ってください。
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 支給項目 */}
          {renderItemList(incomeItems, '賞与支給項目', 'text-green-600')}
          
          {/* 控除項目 */}
          {renderItemList(deductionItems, '賞与控除項目', 'text-red-600')}
          
          {/* 勤怠項目 */}
          {renderItemList(attendanceItems, '賞与勤怠項目', 'text-blue-600')}
          
          {/* 合計項目 */}
          {renderItemList(totalItems, '賞与合計項目', 'text-purple-600')}

          {/* 設定サマリー */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">設定サマリー</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-blue-700">別項目表示: </span>
                <span className="text-blue-600">{bonusMappingConfig.showSeparately.length}項目</span>
              </div>
              <div>
                <span className="font-medium text-green-700">給与項目に統合: </span>
                <span className="text-green-600">{bonusMappingConfig.mergeWithSalary.length}項目</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">非表示: </span>
                <span className="text-gray-600">
                  {(incomeItems.length + deductionItems.length + attendanceItems.length + totalItems.length) - 
                   (bonusMappingConfig.showSeparately.length + bonusMappingConfig.mergeWithSalary.length)}項目
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="mt-8 flex justify-between">
        <button
          onClick={() => navigate('/admin/wage-ledger')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !bonusMapping}
          className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {saving ? '保存中...' : '設定保存して次へ'}
        </button>
      </div>
    </div>
  );
}

export default WageLedgerBonusMapping;