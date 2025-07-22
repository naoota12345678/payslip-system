// src/pages/BonusPayslipPrint.js
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import PayslipPrintView from '../components/payslip/PayslipPrintView';

// 賞与印刷用HTMLを生成する関数
const generateBonusPrintHTML = (payslipData, companyInfo, departmentInfo, employeeInfo, itemNameMapping, categoryMapping) => {
  // 項目の分類（PayslipPreview.jsと同じロジック）
  const incomeItems = [];
  const deductionItems = [];
  const attendanceItems = [];
  const summaryItems = [];



  if (payslipData.items) {
    Object.entries(payslipData.items).forEach(([itemKey, itemData]) => {
      let value, itemName, itemType, isNewFormat;
      
      if (typeof itemData === 'object' && itemData !== null && itemData.hasOwnProperty('value')) {
        // 新形式：オブジェクト形式
        value = itemData.value;
        itemName = itemData.name || itemData.itemName;
        itemType = itemData.type;
        const isVisible = itemData.isVisible !== false;
        isNewFormat = true;
        
        // 表示設定がfalseの場合はスキップ
        if (!isVisible) {
          return;
        }
      } else {
        // 旧形式：直接値
        value = itemData;
        itemName = null;
        itemType = null;
        isNewFormat = false;
      }
      
      // 0または空の項目は表示しない
      if (value === 0 || value === null || value === undefined || value === '') {
        return;
      }
      
      // 表示名を決定：項目名マッピングがあればそれを使用、なければヘッダー名
      const displayName = (itemName || itemNameMapping[itemKey] || itemKey);
      
      // CSVマッピング設定に基づく分類を実行
      const category = categoryMapping[itemKey];
      
      // マッピングされていない項目（isVisibleがfalseの項目含む）はスキップ
      if (!category) {
        return;
      }
      
      switch (category) {
        case 'income':
          incomeItems.push({ 
            name: displayName, 
            value: typeof value === 'number' ? `¥${value.toLocaleString()}` : value 
          });
          break;
        case 'deduction':
          deductionItems.push({ 
            name: displayName, 
            value: typeof value === 'number' ? `¥${value.toLocaleString()}` : value 
          });
          break;
        case 'attendance':
        case 'time':
        case 'days':
          attendanceItems.push({ name: displayName, value });
          break;
        case 'summary':
          summaryItems.push({ 
            name: displayName, 
            value: typeof value === 'number' ? `¥${value.toLocaleString()}` : value 
          });
          break;
        default:
          break;
      }
    });
  }

  // 各項目を名前順でソート（PayslipPreview.jsと同じ）
  incomeItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  deductionItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  attendanceItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  summaryItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>賞与明細書</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'MS Gothic', 'Courier New', monospace; 
            font-size: 12px; 
            line-height: 1.4; 
            color: black; 
            background: white;
            padding: 20px;
        }
        .container { max-width: 900px; margin: 0 auto; }
        .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid black; 
            padding-bottom: 15px; 
        }
        .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .company { font-size: 16px; margin-bottom: 5px; }
        .date { font-size: 14px; }
        .employee-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 20px; 
            padding: 10px; 
            border: 1px solid black; 
        }
        .employee-section { flex: 1; }
        .grid-container { 
            display: grid; 
            grid-template-columns: 1fr 1fr 1fr 1fr; 
            gap: 15px; 
            margin-bottom: 20px; 
        }
        .section { 
            border: 1px solid black; 
            padding: 8px; 
            min-height: 150px; 
        }
        .section-title { 
            font-weight: bold; 
            font-size: 12px; 
            text-align: center; 
            margin-bottom: 8px; 
            padding: 4px; 
            background: #f0f0f0; 
            border-bottom: 1px solid black; 
        }
        .item { 
            display: flex; 
            justify-content: space-between; 
            padding: 2px 0; 
            font-size: 10px; 
        }
        .item-name { flex: 1; margin-right: 4px; }
        .item-value { font-weight: bold; white-space: nowrap; }
        .no-data { 
            text-align: center; 
            font-size: 10px; 
            color: #666; 
            padding: 10px; 
            font-style: italic; 
        }
        .footer { 
            margin-top: 30px; 
            text-align: center; 
            font-size: 10px; 
            border-top: 1px solid black; 
            padding-top: 10px; 
        }
        @media print {
            body { margin: 0; padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">賞与支払明細書</div>
            <div class="company">${companyInfo?.name || '株式会社アトリテクマ'}</div>
            <div class="date">支払日: ${payslipData.paymentDate ? new Date(payslipData.paymentDate).toLocaleDateString('ja-JP') : '2025/07/28'}</div>
        </div>
        
        <div class="employee-info">
            <div class="employee-section">
                <div><strong>従業員番号:</strong> ${employeeInfo?.employeeNumber || employeeInfo?.employeeId || payslipData.employeeNumber || payslipData.employeeId || '-'}</div>
                <div><strong>氏名:</strong> ${employeeInfo?.displayName || employeeInfo?.name || payslipData.employeeName || '-'}</div>
            </div>
            <div class="employee-section">
                <div><strong>部門:</strong> ${departmentInfo?.name || ''}</div>
                <div><strong>発行日:</strong> ${new Date().toLocaleDateString('ja-JP')}</div>
            </div>
        </div>
        
        <div class="grid-container">
            <div class="section">
                <div class="section-title">勤怠</div>
                <div>
                    ${attendanceItems.length > 0 ? attendanceItems.map(item => 
                        `<div class="item"><span class="item-name">${item.name}</span><span class="item-value">${item.value}</span></div>`
                    ).join('') : '<div class="no-data">データなし</div>'}
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">支給</div>
                <div>
                    ${incomeItems.length > 0 ? incomeItems.map(item => 
                        `<div class="item"><span class="item-name">${item.name}</span><span class="item-value">${item.value}</span></div>`
                    ).join('') : '<div class="no-data">データなし</div>'}
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">控除</div>
                <div>
                    ${deductionItems.length > 0 ? deductionItems.map(item => 
                        `<div class="item"><span class="item-name">${item.name}</span><span class="item-value">${item.value}</span></div>`
                    ).join('') : '<div class="no-data">データなし</div>'}
                </div>
            </div>
            
            <div class="section">
                <div class="section-title">合計</div>
                <div>
                    ${summaryItems.length > 0 ? summaryItems.map(item => 
                        `<div class="item"><span class="item-name">${item.name}</span><span class="item-value">${item.value}</span></div>`
                    ).join('') : '<div class="no-data">データなし</div>'}
                </div>
            </div>
        </div>
        
        <div class="footer">
            この賞与明細書は ${companyInfo?.name || '株式会社アトリテクマ'} により発行されました
        </div>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
                window.close();
            }, 1000);
        };
    </script>
</body>
</html>`;
};

function BonusPayslipPrint() {
  const { payslipId } = useParams();
  const { currentUser, userDetails } = useAuth();
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [companyInfo, setCompanyInfo] = useState(null);
  const [departmentInfo, setDepartmentInfo] = useState(null);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [itemNameMapping, setItemNameMapping] = useState({});
  const [categoryMapping, setCategoryMapping] = useState({});
  const [visibilitySettings, setVisibilitySettings] = useState({});

  // 新しいウィンドウで印刷実行（給与明細と同じ方式）
  const handlePrintInNewWindow = useCallback(() => {
    if (!payslip) return;
    
    const printHTML = generateBonusPrintHTML(payslip, companyInfo, departmentInfo, employeeInfo, itemNameMapping, categoryMapping);
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert('ポップアップがブロックされました。ポップアップを許可してから再度お試しください。');
      return;
    }
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
  }, [payslip, companyInfo, departmentInfo, employeeInfo, itemNameMapping, categoryMapping]);

  // 自動印刷（一時的に無効化）
  useEffect(() => {
    if (payslip && !loading && !error) {
  
      // const timer = setTimeout(() => {
      //   handlePrintInNewWindow();
      // }, 2000);
      
      // return () => clearTimeout(timer);
    }
  }, [payslip, loading, error, handlePrintInNewWindow]);

  // 会社情報、部門情報、従業員情報、マッピング情報を取得
  useEffect(() => {
    const fetchAdditionalInfo = async () => {
      if (!payslip) return;
      
      try {
        // 賞与専用マッピングを取得（csvMappingsBonus）
        const companyId = userDetails?.companyId || payslip.companyId;
        
        if (companyId) {
          const bonusMappingRef = doc(db, 'csvMappingsBonus', companyId);
          const bonusMappingDoc = await getDoc(bonusMappingRef);
          
          const nameMapping = {};
          const categoryMapping = {};
          
          if (bonusMappingDoc.exists()) {
            const mappingResult = bonusMappingDoc.data();
            
            // headerName → itemName のマッピング取得
            ['incomeItems', 'deductionItems', 'attendanceItems', 'summaryItems'].forEach(category => {
              if (mappingResult[category] && Array.isArray(mappingResult[category])) {
                mappingResult[category].forEach(item => {
                  if (item.headerName && item.itemName && item.isVisible !== false) {
                    const itemType = category.replace('Items', ''); // incomeItems → income
                    nameMapping[item.headerName] = item.itemName;
                    categoryMapping[item.headerName] = itemType;
                  }
                });
              }
            });
          }
          
          setItemNameMapping(nameMapping);
          setCategoryMapping(categoryMapping);
          setVisibilitySettings({});
        }
        
        // 会社情報を取得
        if (payslip.companyId) {
          const companyRef = doc(db, 'companies', payslip.companyId);
          const companyDoc = await getDoc(companyRef);
          if (companyDoc.exists()) {
            setCompanyInfo(companyDoc.data());
          } else if (userDetails && userDetails.companyId === payslip.companyId) {
            setCompanyInfo({ 
              name: userDetails.companyName || '会社名未設定',
              id: payslip.companyId 
            });
          }
        }
        
        // 従業員情報を先に取得
        let employeeData = null;
        if (payslip.userId) {
          const employeeRef = doc(db, 'employees', payslip.userId);
          const employeeDoc = await getDoc(employeeRef);
          
          if (employeeDoc.exists()) {
            employeeData = employeeDoc.data();
            setEmployeeInfo(employeeData);
          }
        }
        
        // 部門情報を取得（従業員マスタの部門コードを優先）
        let departmentCodeToSearch = null;
        let searchSource = null;
        
        // 優先順位1: 従業員マスタの部門コード
        if (employeeData?.departmentCode) {
          departmentCodeToSearch = employeeData.departmentCode;
          searchSource = 'employee';
  
        }
        // 優先順位2: CSVの部門コード（フォールバック）
        else if (payslip.departmentCode) {
          departmentCodeToSearch = payslip.departmentCode;
          searchSource = 'csv';
          
        }
        
        if (payslip.companyId && departmentCodeToSearch) {
          const searchValues = [
            departmentCodeToSearch,
            String(departmentCodeToSearch).trim()
          ];
          
          const numericVersion = Number(departmentCodeToSearch);
          if (!isNaN(numericVersion)) {
            searchValues.push(numericVersion);
          }
          

          
          const departmentsQuery = query(
            collection(db, 'departments'),
            where('companyId', '==', payslip.companyId),
            where('code', 'in', searchValues.slice(0, 10))
          );
          const departmentSnapshot = await getDocs(departmentsQuery);
          
          if (!departmentSnapshot.empty) {
            setDepartmentInfo(departmentSnapshot.docs[0].data());

          } else {

          }
        }
        

      } catch (error) {
        console.error('追加情報の取得エラー:', error);
      }
    };
    
    fetchAdditionalInfo();
  }, [payslip, userDetails]);

  // 賞与明細データを取得
  useEffect(() => {
    const fetchBonusPayslipData = async () => {
      if (!payslipId || !currentUser) {
        setError("賞与明細IDまたはユーザー情報が不足しています");
        setLoading(false);
        return;
      }

      try {
        const payslipRef = doc(db, "bonusPayslips", payslipId);
        const payslipDoc = await getDoc(payslipRef);

        if (!payslipDoc.exists()) {
          setError("指定された賞与明細は存在しません");
          setLoading(false);
          return;
        }

        const payslipData = payslipDoc.data();
        
        // アクセス権チェック
        const isAdmin = userDetails?.role === 'admin' || userDetails?.userType === 'company';
        const isOwner = payslipData.userId === currentUser.uid;
        const isSameCompany = payslipData.companyId === userDetails?.companyId;
        
        if (!isAdmin && !isOwner) {
          setError("この賞与明細を閲覧する権限がありません");
          setLoading(false);
          return;
        }
        
        if (isAdmin && !isSameCompany) {
          setError("この賞与明細を閲覧する権限がありません");
          setLoading(false);
          return;
        }

        // 日付型に変換
        if (payslipData.paymentDate) {
          payslipData.paymentDate = payslipData.paymentDate.toDate();
        }
        
        setPayslip({
          ...payslipData,
          id: payslipId,
          payslipType: 'bonus'  // 賞与明細であることを明示
        });
      } catch (err) {
        console.error("賞与明細データの取得エラー:", err);
        setError("賞与明細データの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchBonusPayslipData();
  }, [payslipId, currentUser, userDetails]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">印刷データを準備中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          閉じる
        </button>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">賞与明細データが見つかりません</p>
        <button
          onClick={() => window.close()}
          className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          閉じる
        </button>
      </div>
    );
  }

    return (
    <>
      {/* 正しい印刷ボタン（日本語マッピング対応） */}
      <div className="no-print p-4 text-center bg-gray-100">
        <button 
          onClick={handlePrintInNewWindow}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 mr-4"
        >
          印刷
        </button>
        <button 
          onClick={() => window.close()} 
          className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600"
        >
          閉じる
        </button>
      </div>
      
      {/* 賞与明細表示（印刷ボタン無効化、マッピングデータ渡し） */}
      <PayslipPrintView 
        payslipData={payslip} 
        userDetails={userDetails} 
        payslipType="bonus"
        hideButtons={true}
        itemNameMapping={itemNameMapping}
        categoryMapping={categoryMapping}
      />
    </>
  );
}

export default BonusPayslipPrint; 