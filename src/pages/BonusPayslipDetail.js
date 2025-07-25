// src/pages/BonusPayslipDetail.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import PayslipPreview from '../components/payslip/PayslipPreview';

function BonusPayslipDetail() {
  const { payslipId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userDetails } = useAuth();
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const printRef = useRef();

  // 金額フォーマット関数
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '¥0';
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // 日付フォーマット関数
  const formatDate = (date) => {
    if (!date) return '';
    
    let dateObject;
    if (date.toDate && typeof date.toDate === 'function') {
      dateObject = date.toDate();
    } else if (date instanceof Date) {
      dateObject = date;
    } else {
      dateObject = new Date(date);
    }
    
    if (isNaN(dateObject.getTime())) return '';
    
    return dateObject.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // 印刷ボタンのハンドラ
  const handlePrint = () => {
    window.print();
  };

  // 戻るボタンのハンドラ
  const handleBack = () => {
    // ユーザーの権限に応じて適切なルートに戻る
    if (userDetails?.role === 'admin') {
      navigate('/admin/bonus-payslips');
    } else {
      navigate('/employee/bonus-payslips');
    }
  };

  // 会社名を取得
  const fetchCompanyName = async (companyId) => {
    if (!companyId) return '';
    try {
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      return companyDoc.exists() ? companyDoc.data().name || '' : '';
    } catch (error) {
      console.error('会社名取得エラー:', error);
      return '';
    }
  };

  // 従業員名を取得
  const fetchEmployeeName = async (userId) => {
    if (!userId) return '';
    try {
      const employeeDoc = await getDoc(doc(db, 'employees', userId));
      if (employeeDoc.exists()) {
        const data = employeeDoc.data();
        return data.name || data.displayName || '';
      }
      return '';
    } catch (error) {
      console.error('従業員名取得エラー:', error);
      return '';
    }
  };

  // 賞与明細データと関連情報を取得
  useEffect(() => {
    const fetchPayslipData = async () => {
      if (!payslipId || !currentUser) {
        setError("賞与明細IDまたはユーザー情報が不足しています");
        setLoading(false);
        return;
      }

      try {
        console.log('賞与明細データを取得中:', payslipId);

        // bonusPayslipsコレクションから賞与明細データを取得
        const payslipRef = doc(db, "bonusPayslips", payslipId);
        const payslipDoc = await getDoc(payslipRef);

        if (!payslipDoc.exists()) {
          setError("指定された賞与明細は存在しません");
          setLoading(false);
          return;
        }

        const payslipData = payslipDoc.data();
        console.log('賞与明細データ:', payslipData);
        
        // アクセス権のチェック（管理者または自分の賞与明細のみ閲覧可能）
        const isAdmin = userDetails?.role === 'admin';
        const isOwner = payslipData.userId === currentUser.uid && 
                       payslipData.companyId === userDetails?.companyId;
        
        if (!isAdmin && !isOwner) {
          setError("この賞与明細を閲覧する権限がありません");
          setLoading(false);
          return;
        }

        // PayslipPreviewコンポーネント用にデータを変換
        const transformedPayslip = {
          id: payslipId,
          userId: payslipData.userId,
          employeeId: payslipData.employeeId,
          companyId: payslipData.companyId,
          departmentCode: payslipData.departmentCode,
          paymentDate: payslipData.paymentDate,
          payslipType: 'bonus',
          
          // 項目データを4セクション形式に変換
          incomeItems: [],
          deductionItems: [],
          attendanceItems: [],
          totalItems: []
        };

        // itemsオブジェクトから各カテゴリに分類
        if (payslipData.items) {
          Object.keys(payslipData.items).forEach(key => {
            const item = payslipData.items[key];
            const itemData = {
              name: item.name || key,
              value: item.value,
              isVisible: item.isVisible !== false
            };

            // カテゴリ別に分類
            switch (item.type) {
              case 'income':
                transformedPayslip.incomeItems.push(itemData);
                break;
              case 'deduction':
                transformedPayslip.deductionItems.push(itemData);
                break;
              case 'attendance':
                transformedPayslip.attendanceItems.push(itemData);
                break;
              case 'total':
                transformedPayslip.totalItems.push(itemData);
                break;
              default:
                // デフォルトは支給項目として扱う
                transformedPayslip.incomeItems.push(itemData);
                break;
            }
          });
        }

        setPayslip(transformedPayslip);

        // 関連情報を取得
        const [fetchedCompanyName, fetchedEmployeeName] = await Promise.all([
          fetchCompanyName(payslipData.companyId),
          fetchEmployeeName(payslipData.userId)
        ]);

        setCompanyName(fetchedCompanyName);
        setEmployeeName(fetchedEmployeeName);

        // 部門名も設定（部門コードがある場合）
        if (payslipData.departmentCode) {
          setDepartmentName(payslipData.departmentCode);
        }

      } catch (error) {
        console.error('賞与明細データ取得エラー:', error);
        setError('賞与明細データの取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchPayslipData();
  }, [payslipId, currentUser, userDetails]);

  // PayslipPreviewにcompanyNameを設定
  useEffect(() => {
    if (payslip && companyName) {
      setPayslip(prev => ({
        ...prev,
        companyName: companyName
      }));
    }
  }, [companyName]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
          <p>{error}</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-500">賞与明細が見つかりません</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">賞与明細詳細</h1>
            <div className="text-gray-600 space-y-1">
              {employeeName && <p>従業員: {employeeName}</p>}
              {payslip.employeeId && <p>従業員ID: {payslip.employeeId}</p>}
              {departmentName && <p>部門: {departmentName}</p>}
              <p>支払日: {formatDate(payslip.paymentDate)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* エラー・成功メッセージ */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6">
          {success}
        </div>
      )}

      {/* アクションボタン */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 print:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            戻る
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 print:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
            </svg>
            印刷
          </button>
        </div>
      </div>

      {/* 賞与明細プレビュー（全幅表示） */}
      <div>
        {/* 画面表示用 */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden p-6 print:hidden">
          <PayslipPreview payslipData={payslip} showDetailedInfo={true} />
        </div>
        
        {/* 印刷用レイアウト（画面表示と同じUIを使用） */}
        <div ref={printRef} className="hidden print:block print:p-0">
          <div className="bg-white p-6">
            {/* 印刷用ヘッダー */}
            <div className="text-center mb-4 print:mb-2">
              <h1 className="text-xl font-bold mb-1 print:text-lg">賞与支払明細書</h1>
              <p className="text-sm print:text-xs">支払日: {formatDate(payslip.paymentDate)}</p>
            </div>
            {/* PayslipPreviewコンポーネントを印刷用に使用 */}
            <PayslipPreview payslipData={payslip} showDetailedInfo={true} />
            
            {/* 印刷用フッター */}
            <div className="mt-4 pt-2 border-t border-gray-300 text-center print:mt-2">
              <p className="text-xs text-gray-600">
                {payslip.companyName && `${payslip.companyName} - `}賞与支払明細書 / 発行日: {new Date().toLocaleDateString('ja-JP')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* フッター情報 */}
      <div className="mt-8 text-center text-sm text-gray-500 print:hidden">
        <p>この賞与明細は電子的に生成されています。</p>
        <p>お問い合わせは管理者までご連絡ください。</p>
      </div>
    </div>
  );
}

export default BonusPayslipDetail; 