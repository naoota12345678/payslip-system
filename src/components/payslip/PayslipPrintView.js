// src/components/payslip/PayslipPrintView.js
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * 給与明細印刷専用コンポーネント
 * インラインスタイルを使用して確実に印刷に対応
 */
const PayslipPrintView = ({ 
  payslipData, 
  userDetails = null, 
  hideButtons = false, 
  itemNameMapping: externalItemNameMapping, 
  categoryMapping: externalCategoryMapping 
}) => {
  
  const [companyInfo, setCompanyInfo] = useState(null);
  const [departmentInfo, setDepartmentInfo] = useState(null);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [itemNameMapping, setItemNameMapping] = useState({});
  const [categoryMapping, setCategoryMapping] = useState({});
  const [visibilitySettings, setVisibilitySettings] = useState({});

  // 外部から渡されたマッピングを優先的に使用
  useEffect(() => {
    if (externalItemNameMapping) {
      setItemNameMapping(externalItemNameMapping);
    }
    if (externalCategoryMapping) {
      setCategoryMapping(externalCategoryMapping);
    }
  }, [externalItemNameMapping, externalCategoryMapping]);

  // マッピング設定を取得する関数
  const fetchMappingSettings = async (payslipType, companyId) => {
    try {
      // 給与種別に応じて異なるコレクションを使用
      const collectionName = payslipType === 'bonus' ? 'csvMappingsBonus' : 'csvMappings';
      
      const mappingRef = doc(db, collectionName, companyId);
      const mappingDoc = await getDoc(mappingRef);
      
      if (!mappingDoc.exists()) {
        return {
          simpleMapping: {},
          itemCategories: {},
          visibilitySettings: {}
        };
      }

      const data = mappingDoc.data();
      let simpleMapping = {};
      let itemCategories = {};
      let visibilitySettings = {};

      // 新しい形式の場合
      if (data.simpleMapping) {
        simpleMapping = data.simpleMapping;
        itemCategories = data.itemCategories || {};
        visibilitySettings = data.visibilitySettings || {};
      } 
      // 古い形式の場合 - 各項目配列から構築
      else if (data.incomeItems || data.deductionItems || data.attendanceItems) {
        const allItems = [
          ...(data.incomeItems || []),
          ...(data.deductionItems || []),
          ...(data.attendanceItems || []),
          ...(data.totalItems || []),
          ...(data.itemCodeItems || [])
        ];

        allItems.forEach(item => {
            if (item.headerName && item.itemName) {
            simpleMapping[item.headerName] = item.itemName;
            
            // カテゴリ推定
            if (data.incomeItems && data.incomeItems.includes(item)) {
              itemCategories[item.headerName] = 'income';
            } else if (data.deductionItems && data.deductionItems.includes(item)) {
              itemCategories[item.headerName] = 'deduction';
            } else if (data.attendanceItems && data.attendanceItems.includes(item)) {
              itemCategories[item.headerName] = 'attendance';
            } else if (data.totalItems && data.totalItems.includes(item)) {
              itemCategories[item.headerName] = 'total';
            } else {
              itemCategories[item.headerName] = 'other';
            }
            
            visibilitySettings[item.headerName] = item.isVisible !== false;
          }
        });
      }

      return { simpleMapping, itemCategories, visibilitySettings };
      
    } catch (error) {
      console.error('マッピング設定取得エラー:', error);
      return {
        simpleMapping: {},
        itemCategories: {},
        visibilitySettings: {}
      };
    }
  };

  // 会社情報、部門情報、従業員情報を取得
  useEffect(() => {
    const fetchInfo = async () => {
      if (!payslipData || !userDetails?.companyId) return;

      try {
        // 会社情報を取得
        const companyRef = doc(db, 'companies', userDetails.companyId);
        const companyDoc = await getDoc(companyRef);
        if (companyDoc.exists()) {
          setCompanyInfo(companyDoc.data());
        }

        // 部門情報を取得
        if (payslipData.departmentCode) {
          const departmentRef = doc(db, 'departments', payslipData.departmentCode);
          const departmentDoc = await getDoc(departmentRef);
          if (departmentDoc.exists()) {
            setDepartmentInfo(departmentDoc.data());
          }
        }
        
        // 従業員情報を取得
        if (payslipData.employeeId) {
          const employeeRef = doc(db, 'employees', payslipData.employeeId);
          const employeeDoc = await getDoc(employeeRef);
          if (employeeDoc.exists()) {
            setEmployeeInfo(employeeDoc.data());
          }
        }

        // マッピング設定を取得（外部マッピングが提供されていない場合のみ）
        if (!externalItemNameMapping || !externalCategoryMapping) {
          const payslipType = payslipData.payslipType || 'salary';
          const mappingSettings = await fetchMappingSettings(payslipType, userDetails.companyId);
          
          if (!externalItemNameMapping) {
            setItemNameMapping(mappingSettings.simpleMapping);
          }
          if (!externalCategoryMapping) {
            setCategoryMapping(mappingSettings.itemCategories);
          }
          setVisibilitySettings(mappingSettings.visibilitySettings);
        }

      } catch (error) {
        console.error('情報取得エラー:', error);
      }
    };

    fetchInfo();
  }, [payslipData, userDetails, externalItemNameMapping, externalCategoryMapping]);

  // 日付フォーマット関数
  const formatDate = (date) => {
    if (!date) return 'N/A';
    
    let dateObj;
    if (date.toDate && typeof date.toDate === 'function') {
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      try {
        dateObj = new Date(date);
      } catch {
        return 'N/A';
      }
    }
    
    return dateObj.toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  // 金額フォーマット関数
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === '') return '¥0';
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(numAmount);
  };

  // 項目の表示名を取得
  const getDisplayName = (itemKey) => {
    return itemNameMapping[itemKey] || itemKey;
  };

  // 項目をカテゴリ別に分類
  const categorizeItems = () => {
    if (!payslipData?.items) return { income: [], deduction: [], attendance: [], total: [], other: [] };

    const categorized = {
      income: [],
      deduction: [],
      attendance: [],
      total: [],
      other: []
    };
    
    Object.entries(payslipData.items).forEach(([itemKey, itemData]) => {
      // 表示設定をチェック
      if (visibilitySettings[itemKey] === false) return;

      const category = categoryMapping[itemKey] || 'other';
      const value = typeof itemData === 'object' ? itemData.value : itemData;
      const displayName = getDisplayName(itemKey);

      const item = {
        key: itemKey,
        name: displayName,
        value: value
      };

      if (categorized[category]) {
        categorized[category].push(item);
      } else {
        categorized.other.push(item);
      }
    });

    // 各カテゴリを名前順でソート
    Object.keys(categorized).forEach(category => {
      categorized[category].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    });

    return categorized;
  };

  const categorizedItems = categorizeItems();

  // 印刷処理
  const handlePrint = () => {
    window.print();
  };

  // 閉じる処理
  const handleClose = () => {
    window.close();
  };

  if (!payslipData) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <p>給与明細データがありません</p>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px',
      backgroundColor: 'white'
    }}>
      {/* 印刷時は非表示のボタン */}
      {!hideButtons && (
        <div style={{ 
          marginBottom: '20px', 
          textAlign: 'center',
          '@media print': { display: 'none' }
        }} className="no-print">
          <button 
            onClick={handlePrint}
            style={{
              backgroundColor: '#3B82F6',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              marginRight: '10px',
              cursor: 'pointer'
            }}
          >
            印刷
          </button>
          <button 
            onClick={handleClose}
            style={{
              backgroundColor: '#6B7280',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            閉じる
          </button>
        </div>
      )}

      {/* ヘッダー */}
      <div style={{ 
        textAlign: 'center', 
        borderBottom: '2px solid #000', 
        paddingBottom: '10px', 
        marginBottom: '20px' 
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          margin: '0 0 10px 0' 
        }}>
          {payslipData.payslipType === 'bonus' ? '賞与明細書' : '給与明細書'}
        </h1>
        <p style={{ margin: '5px 0', fontSize: '16px' }}>
          支給年月: {formatDate(payslipData.paymentDate)}
        </p>
        {companyInfo && (
          <p style={{ margin: '5px 0', fontSize: '14px' }}>
            {companyInfo.name}
          </p>
        )}
          </div>

      {/* 基本情報 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '20px', 
        marginBottom: '20px',
        border: '1px solid #000',
        padding: '10px'
      }}>
        <div>
          <p style={{ margin: '5px 0' }}>
            <strong>従業員番号:</strong> {payslipData.employeeId || 'N/A'}
          </p>
          <p style={{ margin: '5px 0' }}>
            <strong>氏名:</strong> {employeeInfo?.name || payslipData.employeeName || 'N/A'}
          </p>
        </div>
            <div>
          <p style={{ margin: '5px 0' }}>
            <strong>部門:</strong> {departmentInfo?.name || payslipData.departmentCode || 'N/A'}
          </p>
          <p style={{ margin: '5px 0' }}>
            <strong>所属:</strong> {payslipData.position || 'N/A'}
          </p>
            </div>
          </div>

      {/* 支給項目 */}
      {categorizedItems.income.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ 
            backgroundColor: '#E3F2FD', 
            padding: '8px', 
            margin: '0 0 10px 0', 
            fontSize: '16px',
            border: '1px solid #2196F3'
          }}>
            支給項目
          </h3>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: '1px solid #000' 
          }}>
            <tbody>
              {categorizedItems.income.map((item, index) => (
                <tr key={index}>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    width: '60%' 
                  }}>
                    {item.name}
                  </td>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    textAlign: 'right',
                    width: '40%'
                  }}>
                    {item.value === '' || item.value === null ? 
                      <span style={{ fontStyle: 'italic', color: '#666' }}>-</span> :
                      (typeof item.value === 'number' ? formatCurrency(item.value) : item.value)
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 控除項目 */}
      {categorizedItems.deduction.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ 
            backgroundColor: '#FFEBEE', 
            padding: '8px', 
            margin: '0 0 10px 0', 
            fontSize: '16px',
            border: '1px solid #F44336'
          }}>
            控除項目
          </h3>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: '1px solid #000' 
          }}>
            <tbody>
              {categorizedItems.deduction.map((item, index) => (
                <tr key={index}>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    width: '60%' 
                  }}>
                    {item.name}
                  </td>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    textAlign: 'right',
                    width: '40%'
                  }}>
                    {item.value === '' || item.value === null ? 
                      <span style={{ fontStyle: 'italic', color: '#666' }}>-</span> :
                      (typeof item.value === 'number' ? formatCurrency(item.value) : item.value)
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 勤怠項目 */}
      {categorizedItems.attendance.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ 
            backgroundColor: '#FFF3E0', 
            padding: '8px', 
            margin: '0 0 10px 0', 
            fontSize: '16px',
            border: '1px solid #FF9800'
          }}>
            勤怠項目
          </h3>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: '1px solid #000' 
          }}>
            <tbody>
              {categorizedItems.attendance.map((item, index) => (
                <tr key={index}>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    width: '60%' 
                  }}>
                    {item.name}
                  </td>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    textAlign: 'right',
                    width: '40%'
                  }}>
                    {item.value === '' || item.value === null ? 
                      <span style={{ fontStyle: 'italic', color: '#666' }}>-</span> :
                      item.value
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 合計項目 */}
      {categorizedItems.total.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ 
            backgroundColor: '#E8F5E8', 
            padding: '8px', 
            margin: '0 0 10px 0', 
            fontSize: '16px',
            border: '1px solid #4CAF50'
          }}>
            合計項目
          </h3>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: '1px solid #000' 
          }}>
            <tbody>
              {categorizedItems.total.map((item, index) => (
                <tr key={index}>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    width: '60%' 
                  }}>
                    {item.name}
                  </td>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    textAlign: 'right',
                    width: '40%'
                  }}>
                    {item.value === '' || item.value === null ? 
                      <span style={{ fontStyle: 'italic', color: '#666' }}>-</span> :
                      (typeof item.value === 'number' ? formatCurrency(item.value) : item.value)
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* その他項目 */}
      {categorizedItems.other.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ 
            backgroundColor: '#F5F5F5', 
            padding: '8px', 
            margin: '0 0 10px 0', 
            fontSize: '16px',
            border: '1px solid #9E9E9E'
          }}>
            その他項目
          </h3>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            border: '1px solid #000' 
          }}>
            <tbody>
              {categorizedItems.other.map((item, index) => (
                <tr key={index}>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    width: '60%' 
                  }}>
                    {item.name}
                  </td>
                  <td style={{ 
                    border: '1px solid #000', 
                    padding: '6px', 
                    textAlign: 'right',
                    width: '40%'
                  }}>
                    {item.value === '' || item.value === null ? 
                      <span style={{ fontStyle: 'italic', color: '#666' }}>-</span> :
                      (typeof item.value === 'number' ? formatCurrency(item.value) : item.value)
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        
      {/* 支給合計 */}
      <div style={{ 
        border: '2px solid #000', 
        backgroundColor: '#F0F8FF', 
        padding: '15px',
        marginTop: '20px'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr', 
          gap: '20px',
          textAlign: 'center'
        }}>
          <div>
            <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>支給額</p>
            <p style={{ 
              margin: '5px 0 0 0', 
              fontSize: '18px', 
              fontWeight: 'bold',
              color: '#2196F3'
            }}>
              {formatCurrency(payslipData.totalIncome)}
            </p>
          </div>
          <div>
            <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>控除額</p>
            <p style={{ 
              margin: '5px 0 0 0', 
              fontSize: '18px', 
              fontWeight: 'bold',
              color: '#F44336'
            }}>
              {formatCurrency(payslipData.totalDeduction)}
            </p>
          </div>
          <div>
            <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>差引支給額</p>
            <p style={{ 
              margin: '5px 0 0 0', 
              fontSize: '20px', 
              fontWeight: 'bold',
              color: '#4CAF50'
            }}>
              {formatCurrency(payslipData.netAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* 印刷用CSS */}
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default PayslipPrintView; 

