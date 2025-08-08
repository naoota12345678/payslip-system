// src/pages/admin/WageLedger/WageLedgerView.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';

function WageLedgerView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userDetails } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payslipData, setPayslipData] = useState([]);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [mappingConfig, setMappingConfig] = useState(null);

  // URLパラメータから期間、従業員情報、タイプを取得
  const ledgerType = searchParams.get('type') || 'salary';
  const startYear = parseInt(searchParams.get('startYear'));
  const startMonth = parseInt(searchParams.get('startMonth'));
  const endYear = parseInt(searchParams.get('endYear'));
  const endMonth = parseInt(searchParams.get('endMonth'));
  const employeeId = searchParams.get('employeeId');
  const employeeName = searchParams.get('employeeName');

  // CSVマッピング設定を取得（給与明細と同じロジック）
  const fetchMappingConfigSync = async (companyId) => {
    try {
      const mappingDoc = await getDoc(doc(db, "csvMappings", companyId));
      if (mappingDoc.exists()) {
        const mappingData = mappingDoc.data();
        console.log('🎯 賃金台帳用マッピング設定取得:', mappingData);
        setMappingConfig(mappingData);
        return mappingData;
      } else {
        console.log('❌ マッピング設定が見つかりません');
        setMappingConfig(null);
        return null;
      }
    } catch (err) {
      console.error('🚨 マッピング設定取得エラー:', err);
      setMappingConfig(null);
      return null;
    }
  };

  // 賞与用マッピング設定取得
  const fetchBonusMappingConfigSync = async (companyId) => {
    try {
      const mappingDoc = await getDoc(doc(db, "csvMappingsBonus", companyId));
      if (mappingDoc.exists()) {
        const mappingData = mappingDoc.data();
        console.log('🎁 賞与マッピング設定取得:', mappingData);
        return mappingData;
      } else {
        console.log('❌ 賞与マッピング設定が見つかりません');
        return null;
      }
    } catch (err) {
      console.error('🚨 賞与マッピング設定取得エラー:', err);
      return null;
    }
  };

  // 統合賃金台帳設定取得
  const fetchIntegratedConfigSync = async (companyId) => {
    try {
      const configDoc = await getDoc(doc(db, "wageLedgerIntegratedConfig", companyId));
      if (configDoc.exists()) {
        const configData = configDoc.data();
        console.log('💜 統合賃金台帳設定取得:', configData);
        return configData;
      } else {
        console.log('❌ 統合賃金台帳設定が見つかりません');
        return null;
      }
    } catch (err) {
      console.error('🚨 統合賃金台帳設定取得エラー:', err);
      return null;
    }
  };

  // 統合賃金台帳用の全データ統合処理関数
  const createIntegratedLedgerData = (salaryPayslips, bonusPayslips, salaryConfig, bonusConfig, integratedConfig) => {
    console.log('💜 統合データ作成開始');
    
    const incomeItems = [];
    const deductionItems = [];
    const attendanceItems = [];
    const otherItems = [];
    
    // 月別データマップを作成
    const monthlyData = {};
    
    // 給与明細データを月別に分類
    salaryPayslips.forEach(payslip => {
      const payDate = payslip.paymentDate?.toDate ? payslip.paymentDate.toDate() : new Date(payslip.paymentDate);
      const monthKey = `${payDate.getFullYear()}-${(payDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
      monthlyData[monthKey].salary = payslip;
    });
    
    // 賞与明細データを月別に分類
    bonusPayslips.forEach(payslip => {
      const payDate = payslip.paymentDate?.toDate ? payslip.paymentDate.toDate() : new Date(payslip.paymentDate);
      const monthKey = `${payDate.getFullYear()}-${(payDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
      monthlyData[monthKey].bonus = payslip;
    });
    
    // 全期間の項目を収集
    const allItemsMap = new Map(); // itemName -> {category, config}
    
    // 1. 給与項目から基本項目を収集
    if (salaryConfig) {
      const salaryCategories = [
        { items: salaryConfig.incomeItems || [], type: 'income', targetArray: incomeItems },
        { items: salaryConfig.deductionItems || [], type: 'deduction', targetArray: deductionItems },
        { items: salaryConfig.attendanceItems || [], type: 'attendance', targetArray: attendanceItems },
        { items: salaryConfig.totalItems || [], type: 'total', targetArray: otherItems }
      ];
      
      salaryCategories.forEach(category => {
        category.items.forEach(item => {
          const displayName = (item.itemName && item.itemName.trim() !== '') 
            ? item.itemName 
            : item.headerName;
          
          allItemsMap.set(displayName, {
            id: item.headerName,
            name: displayName,
            type: category.type,
            csvColumn: item.headerName,
            showZeroValue: item.showZeroValue !== undefined ? item.showZeroValue : false,
            order: item.displayOrder || item.columnIndex || 0,
            source: 'salary',
            config: item
          });
        });
      });
    }
    
    console.log('💜 給与項目収集完了:', allItemsMap.size, '項目');
    
    // 2. 賞与項目を統合設定に基づいて処理
    if (bonusConfig && integratedConfig) {
      const bonusCategories = [
        { items: bonusConfig.incomeItems || [], type: 'income' },
        { items: bonusConfig.deductionItems || [], type: 'deduction' },
        { items: bonusConfig.attendanceItems || [], type: 'attendance' },
        { items: bonusConfig.totalItems || [], type: 'total' }
      ];
      
      bonusCategories.forEach(category => {
        category.items.forEach(item => {
          const itemId = item.headerName;
          const displayName = (item.itemName && item.itemName.trim() !== '') 
            ? item.itemName 
            : item.headerName;
          
          if (integratedConfig.showSeparately.includes(itemId)) {
            // 別項目として追加
            const bonusDisplayName = `賞与${displayName}`;
            allItemsMap.set(bonusDisplayName, {
              id: `bonus_${itemId}`,
              name: bonusDisplayName,
              type: category.type,
              csvColumn: itemId,
              showZeroValue: item.showZeroValue !== undefined ? item.showZeroValue : false,
              order: 1000 + (item.displayOrder || item.columnIndex || 0),
              source: 'bonus',
              config: item
            });
            console.log('💜 賞与別項目追加:', bonusDisplayName);
            
          } else if (integratedConfig.mergeWithSalary.includes(itemId)) {
            // 給与項目に統合
            if (allItemsMap.has(displayName)) {
              // 既存項目あり - 統合対象としてマーク
              const existingItem = allItemsMap.get(displayName);
              existingItem.source = 'integrated';
              existingItem.bonusConfig = item;
              console.log('💜 統合対象:', displayName);
            } else {
              // 既存項目なし - 新規追加
              allItemsMap.set(displayName, {
                id: `merged_${itemId}`,
                name: displayName,
                type: category.type,
                csvColumn: itemId,
                showZeroValue: item.showZeroValue !== undefined ? item.showZeroValue : false,
                order: 500 + (item.displayOrder || item.columnIndex || 0),
                source: 'bonus',
                config: item
              });
              console.log('💜 賞与新規項目追加:', displayName);
            }
          }
        });
      });
    }
    
    console.log('💜 全項目統合完了:', allItemsMap.size, '項目');
    
    // 3. 統合された項目データを作成
    return {
      id: 'integrated',
      type: 'integrated',
      classifiedItems: {
        incomeItems: Array.from(allItemsMap.values()).filter(item => item.type === 'income'),
        deductionItems: Array.from(allItemsMap.values()).filter(item => item.type === 'deduction'),
        attendanceItems: Array.from(allItemsMap.values()).filter(item => item.type === 'attendance'),
        otherItems: Array.from(allItemsMap.values()).filter(item => item.type === 'total')
      },
      monthlyData: monthlyData,
      allItems: Array.from(allItemsMap.values())
    };
  };

  // 統合賃金台帳用の分類ロジック
  const classifyItemsForIntegratedLedger = (payslipData, salaryConfig, bonusConfig, integratedConfig) => {
    const incomeItems = [];
    const deductionItems = [];
    const attendanceItems = [];
    const otherItems = [];
    
    if (!payslipData.items) {
      return { incomeItems, deductionItems, attendanceItems, otherItems };
    }

    // 給与項目の処理（salaryConfigに基づく）
    if (salaryConfig) {
      const salaryCategories = [
        { items: salaryConfig.incomeItems || [], type: 'income', targetArray: incomeItems },
        { items: salaryConfig.deductionItems || [], type: 'deduction', targetArray: deductionItems },
        { items: salaryConfig.attendanceItems || [], type: 'attendance', targetArray: attendanceItems },
        { items: salaryConfig.totalItems || [], type: 'total', targetArray: otherItems }
      ];

      salaryCategories.forEach(category => {
        const sortedItems = category.items.slice().sort((a, b) => {
          const orderA = (typeof a.displayOrder === 'number' && !isNaN(a.displayOrder)) 
            ? a.displayOrder 
            : (typeof a.columnIndex === 'number' && !isNaN(a.columnIndex)) 
              ? a.columnIndex 
              : 999;
          const orderB = (typeof b.displayOrder === 'number' && !isNaN(b.displayOrder)) 
            ? b.displayOrder 
            : (typeof b.columnIndex === 'number' && !isNaN(b.columnIndex)) 
              ? b.columnIndex 
              : 999;
          return orderA - orderB;
        });

        sortedItems.forEach((item, index) => {
          const value = payslipData.items[item.headerName];
          if (value === undefined || value === null || item.isVisible === false) {
            return;
          }

          const displayName = (item.itemName && item.itemName.trim() !== '') 
            ? item.itemName 
            : item.headerName;

          const processedItem = {
            id: item.headerName,
            name: displayName,
            value: value,
            type: category.type,
            csvColumn: item.headerName,
            showZeroValue: item.showZeroValue !== undefined ? item.showZeroValue : false,
            order: (typeof item.displayOrder === 'number' && !isNaN(item.displayOrder)) 
              ? item.displayOrder 
              : (typeof item.columnIndex === 'number' && !isNaN(item.columnIndex)) 
                ? item.columnIndex 
                : index,
            source: payslipData.type || 'salary' // データの由来を記録
          };

          category.targetArray.push(processedItem);
        });
      });
    }

    // 賞与項目の処理（bonusConfigとintegratedConfigに基づく）
    if (bonusConfig && integratedConfig && payslipData.type === 'bonus') {
      console.log('💜 賞与項目統合処理開始', payslipData.items);
      
      const bonusCategories = [
        { items: bonusConfig.incomeItems || [], type: 'income', targetArray: incomeItems },
        { items: bonusConfig.deductionItems || [], type: 'deduction', targetArray: deductionItems },
        { items: bonusConfig.attendanceItems || [], type: 'attendance', targetArray: attendanceItems },
        { items: bonusConfig.totalItems || [], type: 'total', targetArray: otherItems }
      ];

      bonusCategories.forEach(category => {
        console.log(`💜 ${category.type}カテゴリ処理開始, 既存項目数: ${category.targetArray.length}`);
        
        category.items.forEach((item, index) => {
          const itemId = item.headerName;
          const value = payslipData.items[itemId];
          
          if (value === undefined || value === null || item.isVisible === false) {
            return;
          }

          console.log(`💜 賞与項目処理: ${itemId} = ${value}`);

          // 統合設定に基づいて処理
          if (integratedConfig.showSeparately.includes(itemId)) {
            // 別項目として表示
            const displayName = `賞与${(item.itemName && item.itemName.trim() !== '') ? item.itemName : item.headerName}`;
            
            const processedItem = {
              id: `bonus_${itemId}`,
              name: displayName,
              value: value,
              type: category.type,
              csvColumn: itemId,
              showZeroValue: item.showZeroValue !== undefined ? item.showZeroValue : false,
              order: 1000 + index, // 賞与項目は給与項目の後に表示
              source: 'bonus'
            };

            category.targetArray.push(processedItem);
            console.log(`💜 別項目として追加: ${displayName}`);
          } else if (integratedConfig.mergeWithSalary.includes(itemId)) {
            // 給与項目に統合
            const displayName = (item.itemName && item.itemName.trim() !== '') 
              ? item.itemName 
              : item.headerName;
            
            console.log(`💜 統合対象: ${displayName}, 既存項目から検索中...`);
            console.log(`💜 既存項目一覧:`, category.targetArray.map(item => `${item.name} (source: ${item.source})`));
            
            // 同名の給与項目を探す（統合賃金台帳でのみ実行）
            const existingItem = category.targetArray.find(salaryItem => 
              salaryItem.name === displayName && salaryItem.source === 'salary'
            );
            
            if (existingItem) {
              // 既存項目に加算（統合賃金台帳専用処理）
              const currentValue = parseFloat(existingItem.value) || 0;
              const bonusValue = parseFloat(value) || 0;
              existingItem.value = currentValue + bonusValue;
              existingItem.source = 'integrated'; // 統合項目であることを記録
              console.log(`💜 統合成功: ${displayName} ${currentValue} + ${bonusValue} = ${existingItem.value}`);
            } else {
              // 新規項目として追加（統合賃金台帳専用処理）
              const processedItem = {
                id: `merged_${itemId}`,
                name: displayName,
                value: parseFloat(value) || 0,
                type: category.type,
                csvColumn: itemId,
                showZeroValue: item.showZeroValue !== undefined ? item.showZeroValue : false,
                order: 500 + index, // 給与項目と賞与項目の中間に表示
                source: 'bonus'
              };

              category.targetArray.push(processedItem);
              console.log(`💜 既存項目なし、新規追加: ${displayName} = ${processedItem.value}`);
            }
          }
          // 非表示の場合は何もしない
        });
      });
    }

    return { incomeItems, deductionItems, attendanceItems, otherItems };
  };

  // 給与明細と賞与明細の分類ロジックを適用
  const classifyItemsForWageLedger = (payslipData, mappingConfig) => {
    const incomeItems = [];
    const deductionItems = [];
    const attendanceItems = [];
    const otherItems = [];
    
    if (!payslipData.items || !mappingConfig) {
      // マッピング設定がない場合はCSVのキーをそのまま表示
      Object.entries(payslipData.items || {}).forEach(([csvColumn, value]) => {
        otherItems.push({
          id: csvColumn,
          name: csvColumn,
          value: value,
          type: 'other',
          csvColumn: csvColumn
        });
      });
      return { incomeItems, deductionItems, attendanceItems, otherItems };
    }

    // 全ての設定カテゴリを処理（給与明細と同じロジック）
    const allCategories = [
      { items: mappingConfig.incomeItems || [], type: 'income', targetArray: incomeItems },
      { items: mappingConfig.deductionItems || [], type: 'deduction', targetArray: deductionItems },
      { items: mappingConfig.attendanceItems || [], type: 'attendance', targetArray: attendanceItems },
      { items: mappingConfig.totalItems || [], type: 'total', targetArray: otherItems }
    ];

    allCategories.forEach(category => {
      // カテゴリ内でソート（displayOrder > columnIndex > 配列index の優先順位）
      const sortedItems = category.items.slice().sort((a, b) => {
        const orderA = (typeof a.displayOrder === 'number' && !isNaN(a.displayOrder)) 
          ? a.displayOrder 
          : (typeof a.columnIndex === 'number' && !isNaN(a.columnIndex)) 
            ? a.columnIndex 
            : 999;
        const orderB = (typeof b.displayOrder === 'number' && !isNaN(b.displayOrder)) 
          ? b.displayOrder 
          : (typeof b.columnIndex === 'number' && !isNaN(b.columnIndex)) 
            ? b.columnIndex 
            : 999;
        return orderA - orderB;
      });

      sortedItems.forEach((item, index) => {
        // CSVデータに対応する値があるかチェック
        const value = payslipData.items[item.headerName];
        if (value === undefined || value === null) {
          return; // データがない項目はスキップ
        }

        // 表示/非表示のチェック
        if (item.isVisible === false) {
          return;
        }

        // 表示名を決定（itemName優先、なければheaderName）
        const displayName = (item.itemName && item.itemName.trim() !== '') 
          ? item.itemName 
          : item.headerName;

        const processedItem = {
          id: item.headerName,
          name: displayName,
          value: value,
          type: category.type,
          csvColumn: item.headerName,
          showZeroValue: item.showZeroValue !== undefined ? item.showZeroValue : false, // デフォルトで0値非表示
          order: (typeof item.displayOrder === 'number' && !isNaN(item.displayOrder)) 
            ? item.displayOrder 
            : (typeof item.columnIndex === 'number' && !isNaN(item.columnIndex)) 
              ? item.columnIndex 
              : index
        };

        category.targetArray.push(processedItem);
      });
    });

    return { incomeItems, deductionItems, attendanceItems, otherItems };
  };

  // 統合賃金台帳用の統合処理関数（順序改善版）
  const createIntegratedPayslips = (salaryPayslips, bonusPayslips, salaryConfig, bonusConfig, integratedConfig) => {
    console.log('💜 統合処理開始: 給与項目を先に収集');
    
    // 全体の統合項目を管理するマップ
    const integratedItemsMap = new Map();
    
    // 1. 給与明細を処理して基本項目を作成
    const processedPayslips = [];
    
    salaryPayslips.forEach(payslip => {
      console.log('💜 給与明細処理:', payslip.id);
      const classifiedItems = classifyItemsForWageLedger(payslip, salaryConfig);
      
      // 給与項目を統合マップに追加
      ['incomeItems', 'deductionItems', 'attendanceItems', 'otherItems'].forEach(category => {
        classifiedItems[category].forEach(item => {
          const key = `${item.name}_${item.type}`;
          if (!integratedItemsMap.has(key)) {
            integratedItemsMap.set(key, {
              ...item,
              source: 'salary',
              months: new Map()
            });
          }
          
          // 月データを追加
          const payDate = payslip.paymentDate?.toDate ? payslip.paymentDate.toDate() : new Date(payslip.paymentDate);
          const monthKey = `${payDate.getFullYear()}-${(payDate.getMonth() + 1).toString().padStart(2, '0')}`;
          integratedItemsMap.get(key).months.set(monthKey, {
            value: item.value,
            type: 'salary'
          });
        });
      });
      
      processedPayslips.push({
        ...payslip,
        classifiedItems
      });
    });
    
    console.log('💜 給与項目収集完了。統合マップ:', integratedItemsMap.size, '項目');
    
    // 2. 賞与明細を処理して統合
    bonusPayslips.forEach(payslip => {
      console.log('💜 賞与明細処理:', payslip.id);
      const classifiedItems = classifyItemsForWageLedger(payslip, bonusConfig);
      
      // 賞与項目を統合設定に基づいて処理
      const payDate = payslip.paymentDate?.toDate ? payslip.paymentDate.toDate() : new Date(payslip.paymentDate);
      const monthKey = `${payDate.getFullYear()}-${(payDate.getMonth() + 1).toString().padStart(2, '0')}`;
      
      ['incomeItems', 'deductionItems', 'attendanceItems', 'otherItems'].forEach(category => {
        classifiedItems[category].forEach(item => {
          const itemId = item.csvColumn;
          
          console.log(`💜 賞与項目確認: ${item.name} (${itemId})`);
          
          // 統合設定をチェック
          if (integratedConfig.mergeWithSalary.includes(itemId)) {
            // 給与項目に統合する設定
            const key = `${item.name}_${item.type}`;
            console.log(`💜 統合設定確認: ${item.name} -> ${key}`);
            
            if (integratedItemsMap.has(key)) {
              // 既存の給与項目に統合
              const existingItem = integratedItemsMap.get(key);
              const existingMonthData = existingItem.months.get(monthKey);
              
              if (existingMonthData) {
                // 同月の給与データに加算
                const oldValue = parseFloat(existingMonthData.value) || 0;
                const bonusValue = parseFloat(item.value) || 0;
                existingMonthData.value = oldValue + bonusValue;
                existingMonthData.type = 'integrated';
                console.log(`💜 統合成功: ${item.name} 月:${monthKey} ${oldValue} + ${bonusValue} = ${existingMonthData.value}`);
              } else {
                // 新しい月データとして追加
                existingItem.months.set(monthKey, {
                  value: parseFloat(item.value) || 0,
                  type: 'bonus'
                });
                console.log(`💜 新月データ追加: ${item.name} 月:${monthKey} 値:${item.value}`);
              }
              existingItem.source = 'integrated';
            } else {
              console.log(`💜 統合対象項目なし: ${key} (新規追加)`);
              // 新規項目として追加
              integratedItemsMap.set(key, {
                ...item,
                months: new Map([[monthKey, {
                  value: parseFloat(item.value) || 0,
                  type: 'bonus'
                }]])
              });
            }
          } else if (integratedConfig.showSeparately.includes(itemId)) {
            // 別項目として追加
            const bonusKey = `賞与${item.name}_${item.type}`;
            integratedItemsMap.set(bonusKey, {
              ...item,
              name: `賞与${item.name}`,
              source: 'bonus',
              months: new Map([[monthKey, {
                value: parseFloat(item.value) || 0,
                type: 'bonus'
              }]])
            });
            console.log(`💜 別項目追加: 賞与${item.name} 月:${monthKey} 値:${item.value}`);
          }
          // 非表示の場合は何もしない
        });
      });
      
      processedPayslips.push({
        ...payslip,
        classifiedItems
      });
    });
    
    console.log('💜 統合処理完了。最終項目数:', integratedItemsMap.size);
    
    return processedPayslips;
  };

  useEffect(() => {
    const fetchWageLedgerData = async () => {
      if (!userDetails?.companyId || !employeeId) return;

      try {
        setLoading(true);
        
        // 期間の開始日と終了日を計算（useEffect内で実行）
        const startDate = new Date(startYear, startMonth - 1, 1);
        const endDate = new Date(endYear, endMonth, 0);
        
        console.log('🔍 賃金台帳詳細データ取得開始', `タイプ: ${ledgerType}`);
        console.log('従業員ID:', employeeId);
        console.log('期間:', startDate.toISOString().split('T')[0], '〜', endDate.toISOString().split('T')[0]);
        
        let allPayslips = [];
        
        if (ledgerType === 'integrated') {
          // 統合賃金台帳の場合：給与・賞与両方を取得
          console.log('💜 統合賃金台帳モード - 給与・賞与データ両方を取得');
          
          // 給与明細を取得
          const payslipsQuery = query(
            collection(db, 'payslips'),
            where('companyId', '==', userDetails.companyId),
            where('employeeId', '==', employeeId),
            where('paymentDate', '>=', startDate),
            where('paymentDate', '<=', endDate),
            orderBy('paymentDate', 'asc')
          );
          
          const payslipsSnapshot = await getDocs(payslipsQuery);
          const payslips = payslipsSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'salary',
            ...doc.data()
          }));
          
          // 賞与明細を取得
          const bonusQuery = query(
            collection(db, 'bonusPayslips'),
            where('companyId', '==', userDetails.companyId),
            where('employeeId', '==', employeeId),
            where('paymentDate', '>=', startDate),
            where('paymentDate', '<=', endDate),
            orderBy('paymentDate', 'asc')
          );
          
          const bonusSnapshot = await getDocs(bonusQuery);
          const bonusPayslips = bonusSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'bonus',
            ...doc.data()
          }));
          
          allPayslips = [...payslips, ...bonusPayslips];
          console.log('📄 該当する給与明細:', payslips.length, '件');
          console.log('🎁 該当する賞与明細:', bonusPayslips.length, '件');
        } else if (ledgerType === 'bonus') {
          // 賞与賃金台帳の場合：賞与明細のみ取得
          const bonusQuery = query(
            collection(db, 'bonusPayslips'),
            where('companyId', '==', userDetails.companyId),
            where('employeeId', '==', employeeId),
            where('paymentDate', '>=', startDate),
            where('paymentDate', '<=', endDate),
            orderBy('paymentDate', 'asc')
          );
          
          const bonusSnapshot = await getDocs(bonusQuery);
          const bonusPayslips = bonusSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'bonus',
            ...doc.data()
          }));
          
          allPayslips = bonusPayslips;
          console.log('🎁 該当する賞与明細:', bonusPayslips.length, '件');
        } else {
          // 給与賃金台帳の場合：給与明細のみ取得
          const payslipsQuery = query(
            collection(db, 'payslips'),
            where('companyId', '==', userDetails.companyId),
            where('employeeId', '==', employeeId),
            where('paymentDate', '>=', startDate),
            where('paymentDate', '<=', endDate),
            orderBy('paymentDate', 'asc')
          );
          
          const payslipsSnapshot = await getDocs(payslipsQuery);
          const payslips = payslipsSnapshot.docs.map(doc => ({
            id: doc.id,
            type: 'salary',
            ...doc.data()
          }));
          
          allPayslips = payslips;
          console.log('📄 該当する給与明細:', payslips.length, '件');
        }
        
        // 日付順でソート
        allPayslips.sort((a, b) => {
          const dateA = a.paymentDate?.toDate ? a.paymentDate.toDate() : new Date(a.paymentDate);
          const dateB = b.paymentDate?.toDate ? b.paymentDate.toDate() : new Date(b.paymentDate);
          return dateA - dateB;
        });
        
        console.log('📊 対象データ合計:', allPayslips.length, '件');

        // タイプに応じて必要なマッピング設定のみ取得
        let mappingConfig, bonusMapping, integratedConfig;
        if (ledgerType === 'integrated') {
          // 統合賃金台帳の場合：給与・賞与・統合設定を取得
          mappingConfig = await fetchMappingConfigSync(userDetails.companyId);
          bonusMapping = await fetchBonusMappingConfigSync(userDetails.companyId);
          integratedConfig = await fetchIntegratedConfigSync(userDetails.companyId);
          console.log('📋 給与マッピング設定取得結果:', mappingConfig ? '✅あり' : '❌なし');
          console.log('📋 賞与マッピング設定取得結果:', bonusMapping ? '✅あり' : '❌なし');
          console.log('📋 統合設定取得結果:', integratedConfig ? '✅あり' : '❌なし');
        } else if (ledgerType === 'bonus') {
          mappingConfig = await fetchBonusMappingConfigSync(userDetails.companyId);
          console.log('📋 賞与マッピング設定取得結果:', mappingConfig ? '✅あり' : '❌なし');
        } else {
          mappingConfig = await fetchMappingConfigSync(userDetails.companyId);
          console.log('📋 給与マッピング設定取得結果:', mappingConfig ? '✅あり' : '❌なし');
        }
        
        // 各明細データを分類処理
        let processedPayslips;
        
        if (ledgerType === 'integrated') {
          // 統合賃金台帳の場合は特別な処理が必要
          console.log('💜 統合賃金台帳モード: 給与項目を先に処理してから賞与項目を統合');
          
          const salaryPayslips = allPayslips.filter(p => p.type === 'salary');
          const bonusPayslips = allPayslips.filter(p => p.type === 'bonus');
          
          console.log(`💜 給与明細: ${salaryPayslips.length}件, 賞与明細: ${bonusPayslips.length}件`);
          
          // 統合データを作成（処理順序の改善）
          processedPayslips = createIntegratedPayslips(
            salaryPayslips, bonusPayslips, mappingConfig, bonusMapping, integratedConfig
          );
          
        } else {
          // 従来の分類ロジックを使用
          processedPayslips = allPayslips.map(payslip => {
            const classifiedItems = classifyItemsForWageLedger(payslip, mappingConfig);
            const { incomeItems, deductionItems, attendanceItems, otherItems } = classifiedItems;
            
            return {
              ...payslip,
              classifiedItems: {
                incomeItems,
                deductionItems, 
                attendanceItems,
                otherItems
              }
            };
          });
        }
        
        console.log('📋 分類処理完了:', processedPayslips.length, '件');
        setPayslipData(processedPayslips);

        // 従業員情報を取得
        const employeeQuery = query(
          collection(db, 'employees'),
          where('companyId', '==', userDetails.companyId),
          where('employeeId', '==', employeeId)
        );
        
        const employeeSnapshot = await getDocs(employeeQuery);
        if (!employeeSnapshot.empty) {
          setEmployeeInfo(employeeSnapshot.docs[0].data());
          console.log('👤 従業員情報取得完了');
        }

        setLoading(false);
      } catch (err) {
        console.error('❌ 賃金台帳データ取得エラー:', err);
        setError('データの取得中にエラーが発生しました');
        setLoading(false);
      }
    };

    fetchWageLedgerData();
  }, [userDetails, employeeId, startYear, startMonth, endYear, endMonth]);

  // 期間中の全ての月を生成する関数
  const generateAllMonthsInPeriod = () => {
    const months = [];
    let currentDate = new Date(startYear, startMonth - 1, 1);
    const endDate = new Date(endYear, endMonth - 1, 1);
    
    while (currentDate <= endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      
      months.push({
        year,
        month,
        monthKey,
        displayText: `${year}年${month}月`
      });
      
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return months;
  };

  // 給与明細データを月別にマップ化
  const getPayslipByMonth = () => {
    const payslipMap = {};
    
    payslipData.forEach(payslip => {
      let payDate;
      if (payslip.paymentDate) {
        if (payslip.paymentDate.toDate) {
          payDate = payslip.paymentDate.toDate();
        } else {
          payDate = new Date(payslip.paymentDate);
        }
      } else if (payslip.year && payslip.month) {
        payDate = new Date(payslip.year, payslip.month - 1, 1);
      } else {
        console.warn('給与明細の日付が取得できません:', payslip);
        return;
      }
      
      const monthKey = `${payDate.getFullYear()}-${(payDate.getMonth() + 1).toString().padStart(2, '0')}`;
      payslipMap[monthKey] = payslip;
    });
    
    return payslipMap;
  };

  // 分類済み項目をマトリックス形式で生成（給与明細表示形式）
  const generateClassifiedItemMatrix = () => {
    const allMonths = generateAllMonthsInPeriod();
    const payslipMap = getPayslipByMonth();
    
    // 全期間の分類済み項目を収集
    const allClassifiedItems = new Map(); // id -> {name, type, showZeroValue}
    
    payslipData.forEach(payslip => {
      if (!payslip.classifiedItems) return;
      
      // 4つのカテゴリから項目を収集
      ['incomeItems', 'deductionItems', 'attendanceItems', 'otherItems'].forEach(category => {
        const items = payslip.classifiedItems[category] || [];
        items.forEach(item => {
          if (!allClassifiedItems.has(item.id)) {
            allClassifiedItems.set(item.id, {
              id: item.id,
              name: item.name,
              type: item.type,
              showZeroValue: item.showZeroValue || false,
              order: item.order || 0,
              csvColumn: item.csvColumn
            });
          }
        });
      });
    });
    
    const allItems = Array.from(allClassifiedItems.values())
      .sort((a, b) => {
        // タイプ別ソート: attendance, income, deduction, total
        const typeOrder = { attendance: 1, income: 2, deduction: 3, total: 4 };
        const typeA = typeOrder[a.type] || 5;
        const typeB = typeOrder[b.type] || 5;
        
        if (typeA !== typeB) return typeA - typeB;
        return (a.order || 0) - (b.order || 0);
      });
    
    console.log('📋 分類済み全項目一覧:', allItems.map(item => `${item.name} (${item.type})`));
    
    // マトリックスデータを生成
    const matrix = allItems.map(itemDef => {
      const row = {
        itemName: itemDef.name,
        itemId: itemDef.id,
        itemType: itemDef.type,
        showZeroValue: itemDef.showZeroValue,
        months: {}
      };
      
      allMonths.forEach(month => {
        const payslip = payslipMap[month.monthKey];
        let value = null;
        let hasData = false;
        
        if (payslip && payslip.classifiedItems) {
          // 分類済み項目から該当する項目を探す
          const categories = ['incomeItems', 'deductionItems', 'attendanceItems', 'otherItems'];
          for (const category of categories) {
            const items = payslip.classifiedItems[category] || [];
            const foundItem = items.find(item => item.id === itemDef.id);
            if (foundItem) {
              value = foundItem.value;
              hasData = true;
              break;
            }
          }
        }
        
        if (hasData && value !== null && value !== undefined) {
          const numericValue = typeof value === 'number' ? value : parseFloat(value || 0);
          
          row.months[month.monthKey] = {
            value: numericValue,
            category: itemDef.type,
            type: payslip?.type || 'salary',
            hasData: true
          };
        } else {
          row.months[month.monthKey] = {
            value: 0,
            category: itemDef.type,
            type: 'salary',
            hasData: false
          };
        }
      });
      
      return row;
    });
    
    return { matrix, allMonths, allItems };
  };

  const getClassifiedTotals = () => {
    const { matrix, allMonths } = generateClassifiedItemMatrix();
    const totals = {};
    
    matrix.forEach(row => {
      const itemTotal = allMonths.reduce((sum, month) => {
        const monthData = row.months[month.monthKey];
        return sum + (monthData.hasData ? monthData.value : 0);
      }, 0);
      totals[row.itemName] = itemTotal;
    });
    
    return totals;
  };

  const formatPeriod = () => {
    return `${startYear}年${startMonth}月 〜 ${endYear}年${endMonth}月`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP').format(amount);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">賃金台帳を生成中...</p>
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

  const { matrix, allMonths } = generateClassifiedItemMatrix();
  const totals = getClassifiedTotals();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ブレッドクラム */}
      <div className="mb-6">
        <nav className="text-sm breadcrumbs mb-4">
          <span className="text-gray-500 cursor-pointer" onClick={() => navigate('/admin/wage-ledger')}>
            賃金台帳
          </span>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-gray-500 cursor-pointer" onClick={() => navigate(`/admin/wage-ledger/period-select?type=${ledgerType}`)}>
            {ledgerType === 'integrated' ? '統合' : ledgerType === 'bonus' ? '賞与' : '給与'}期間選択
          </span>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-gray-500 cursor-pointer" onClick={() => navigate(`/admin/wage-ledger/employees?${searchParams.toString()}`)}>
            従業員選択
          </span>
          <span className="mx-2 text-gray-400">›</span>
          <span className="text-blue-600 font-medium">
            {ledgerType === 'integrated' ? '統合' : ledgerType === 'bonus' ? '賞与' : '給与'}賃金台帳
          </span>
        </nav>
        <div className="flex items-center space-x-3 mb-2">
          <div className={`w-3 h-3 rounded-full ${
            ledgerType === 'integrated' ? 'bg-purple-500' : 
            ledgerType === 'bonus' ? 'bg-green-500' : 'bg-blue-500'
          }`}></div>
          <h1 className="text-2xl font-bold text-gray-900">
            {ledgerType === 'integrated' ? '統合' : ledgerType === 'bonus' ? '賞与' : '給与'}賃金台帳
          </h1>
        </div>
        <p className="text-gray-600 mt-2">
          {employeeName}さんの{ledgerType === 'integrated' ? '統合（給与・賞与）' : ledgerType === 'bonus' ? '賞与' : '給与'}賃金台帳（{formatPeriod()}）
        </p>
      </div>

      {/* 従業員情報ヘッダー */}
      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">従業員情報</h2>
        </div>
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">従業員ID</label>
              <p className="text-gray-900">{employeeId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">氏名</label>
              <p className="text-gray-900">{employeeName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">部門</label>
              <p className="text-gray-900">{employeeInfo?.departmentCode || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">対象期間</label>
              <p className="text-gray-900">{formatPeriod()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 賃金台帳テーブル（マトリックス形式） */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {ledgerType === 'integrated' ? '統合' : ledgerType === 'bonus' ? '賞与' : '給与'}賃金台帳（項目別表示）
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            横軸：各月、縦軸：{
              ledgerType === 'integrated' ? '給与・賞与明細の統合' : 
              ledgerType === 'bonus' ? '賞与明細' : '給与明細'
            }項目
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50">
                  項目名
                </th>
                {allMonths.map(month => (
                  <th key={month.monthKey} className="px-3 py-8 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="transform -rotate-45 origin-center h-6 flex items-center justify-center">
                      {month.month}月
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">
                  合計
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {matrix.map((row, index) => {
                // 0値表示制御: showZeroValueがtrueでない限り、全ての月が0値の行は非表示
                const hasNonZeroValue = allMonths.some(month => {
                  const monthData = row.months[month.monthKey];
                  return monthData.hasData && monthData.value !== 0;
                });
                
                if (!row.showZeroValue && !hasNonZeroValue) {
                  return null; // この行をスキップ
                }

                return (
                  <tr key={row.itemId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white border-r">
                      <div className="flex items-center">
                        <span className="truncate max-w-32" title={row.itemName}>
                          {row.itemName}
                        </span>
                        {(() => {
                          const category = row.itemType;
                          if (category === 'income') {
                            return <span className="ml-2 px-1 py-0.5 text-xs bg-green-100 text-green-600 rounded">支給</span>;
                          } else if (category === 'deduction') {
                            return <span className="ml-2 px-1 py-0.5 text-xs bg-red-100 text-red-600 rounded">控除</span>;
                          } else if (category === 'attendance') {
                            return <span className="ml-2 px-1 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">勤怠</span>;
                          } else if (category === 'total') {
                            return <span className="ml-2 px-1 py-0.5 text-xs bg-purple-100 text-purple-600 rounded">合計</span>;
                          }
                          return null;
                        })()}
                      </div>
                    </td>
                    {allMonths.map(month => {
                      const monthData = row.months[month.monthKey];
                      const value = monthData.value;
                      const hasData = monthData.hasData;
                      const isBonus = monthData.type === 'bonus';
                      
                      // 0値表示制御を適用
                      const shouldShowZero = row.showZeroValue === true;
                      const shouldDisplay = hasData && (value !== 0 || shouldShowZero);
                      
                      return (
                        <td key={month.monthKey} className="px-3 py-2 whitespace-nowrap text-sm text-right">
                          <div className="flex flex-col items-end">
                            {shouldDisplay ? (
                              <>
                                <span className={`font-medium ${
                                  row.itemType === 'income' ? 'text-gray-900' : 
                                  row.itemType === 'deduction' ? 'text-red-600' : 
                                  row.itemType === 'attendance' ? 'text-blue-600' :
                                  row.itemType === 'total' ? 'text-purple-600' : 'text-gray-600'
                                }`}>
                                  {row.itemType === 'attendance' ? 
                                    value : // 勤怠項目は数値をそのまま表示
                                    `¥${formatCurrency(value)}` // 金額項目は通貨フォーマット
                                  }
                                </span>
                                {isBonus && (
                                  <span className="text-xs px-1 py-0.5 bg-orange-100 text-orange-600 rounded mt-1">
                                    賞与
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-bold bg-gray-50">
                      {row.itemType === 'attendance' ? (
                        <span className="text-gray-400">-</span> // 勤怠項目は合計を表示しない
                      ) : totals[row.itemName] !== 0 ? (
                        <span className={`${
                          row.itemType === 'income' ? 'text-gray-900' : 
                          row.itemType === 'deduction' ? 'text-red-600' : 
                          row.itemType === 'total' ? 'text-purple-600' : 'text-gray-600'
                        }`}>
                          ¥{formatCurrency(totals[row.itemName])}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* アクションボタン */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={() => navigate(`/admin/wage-ledger/employees?${searchParams.toString()}`)}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          従業員選択に戻る
        </button>
        <div className="space-x-4">
          <button
            onClick={() => alert('PDF出力機能は今後実装予定です')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            PDF出力
          </button>
          <button
            onClick={() => alert('Excel出力機能は今後実装予定です')}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Excel出力
          </button>
        </div>
      </div>
    </div>
  );
}

export default WageLedgerView;