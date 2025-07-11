// src/pages/PayslipPrint.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function PayslipPrint() {
  const { payslipId } = useParams();
  const { currentUser, userDetails } = useAuth();
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 自動的に印刷する
  useEffect(() => {
    if (payslip && !loading && !error) {
      // 少し遅延させて、レンダリングが完了してから印刷する
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [payslip, loading, error]);

  // 給与明細のデータを取得
  useEffect(() => {
    const fetchPayslipData = async () => {
      if (!payslipId || !currentUser) {
        setError("給与明細IDまたはユーザー情報が不足しています");
        setLoading(false);
        return;
      }

      try {
        // Firestoreから給与明細データを取得
        const payslipRef = doc(db, "payslips", payslipId);
        const payslipDoc = await getDoc(payslipRef);

        if (!payslipDoc.exists()) {
          setError("指定された給与明細は存在しません");
          setLoading(false);
          return;
        }

        const payslipData = payslipDoc.data();
        
        // アクセス権のチェック（管理者または自分の給与明細のみ閲覧可能）
        const isAdmin = userDetails?.role === 'admin';
        const isOwner = payslipData.userId === currentUser.uid;
        
        if (!isAdmin && !isOwner) {
          setError("この給与明細を閲覧する権限がありません");
          setLoading(false);
          return;
        }

        // 日付型に変換
        if (payslipData.paymentDate) {
          payslipData.paymentDate = payslipData.paymentDate.toDate();
        }
        
        // 項目を種類ごとに分類
        const incomeItems = [];
        const deductionItems = [];
        const otherItems = [];
        
        Object.entries(payslipData.items || {}).forEach(([id, item]) => {
          if (item.type === 'income') {
            incomeItems.push({ id, ...item });
          } else if (item.type === 'deduction') {
            deductionItems.push({ id, ...item });
          } else {
            otherItems.push({ id, ...item });
          }
        });
        
        // 並び替え（項目名でソート）
        incomeItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        deductionItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        otherItems.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        
        setPayslip({
          ...payslipData,
          id: payslipId,
          incomeItems,
          deductionItems,
          otherItems
        });
      } catch (err) {
        console.error("給与明細データの取得エラー:", err);
        setError("給与明細データの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchPayslipData();
  }, [payslipId, currentUser, userDetails]);

  // 日付フォーマット関数
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  // 金額フォーマット関数
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '¥0';
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">読み込み中...</p>
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
          className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          閉じる
        </button>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">給与明細データが見つかりません</p>
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
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="bg-white p-6 border border-gray-300">
        {/* 会社情報ヘッダー */}
        <div className="text-center mb-6 border-b pb-4">
          <h1 className="text-2xl font-bold mb-2">給与支払明細書</h1>
          <p className="text-lg">支払日: {formatDate(payslip.paymentDate)}</p>
        </div>
        
        {/* 従業員情報 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">従業員情報</h2>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-1 text-gray-600 w-1/3">従業員番号:</td>
                  <td className="py-1 font-medium">{payslip.employeeId || 'N/A'}</td>
                </tr>
                {payslip.departmentCode && (
                  <tr>
                    <td className="py-1 text-gray-600">部門:</td>
                    <td className="py-1 font-medium">{payslip.departmentCode}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">支給サマリー</h2>
            <table className="w-full">
              <tbody>
                <tr>
                  <td className="py-1 text-gray-600">支給額合計:</td>
                  <td className="py-1 font-medium text-right">{formatCurrency(payslip.totalIncome)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-600">控除額合計:</td>
                  <td className="py-1 font-medium text-right">{formatCurrency(payslip.totalDeduction)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-gray-600 font-semibold">差引支給額:</td>
                  <td className="py-1 font-bold text-right text-red-600">{formatCurrency(payslip.netAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-6">
          {/* 支給項目 */}
          <div>
            <h3 className="text-lg font-semibold mb-2 border-b pb-1">支給項目</h3>
            <table className="w-full mb-4">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left text-gray-600">項目</th>
                  <th className="py-2 text-right text-gray-600">金額</th>
                </tr>
              </thead>
              <tbody>
                {payslip.incomeItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-right">
                      {typeof item.value === 'number' 
                        ? formatCurrency(item.value) 
                        : item.value}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">合計</td>
                  <td className="py-2 text-right">{formatCurrency(payslip.totalIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          {/* 控除項目 */}
          <div>
            <h3 className="text-lg font-semibold mb-2 border-b pb-1">控除項目</h3>
            <table className="w-full mb-4">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left text-gray-600">項目</th>
                  <th className="py-2 text-right text-gray-600">金額</th>
                </tr>
              </thead>
              <tbody>
                {payslip.deductionItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-2">{item.name}</td>
                    <td className="py-2 text-right">
                      {typeof item.value === 'number' 
                        ? formatCurrency(item.value) 
                        : item.value}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2">合計</td>
                  <td className="py-2 text-right">{formatCurrency(payslip.totalDeduction)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* その他項目（時間、日数など） */}
        {payslip.otherItems && payslip.otherItems.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2 border-b pb-1">その他項目</h3>
            <div className="grid grid-cols-2 gap-4">
              {payslip.otherItems.map((item) => (
                <div key={item.id} className="flex justify-between border-b border-gray-100 py-2">
                  <span>{item.name}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* フッター */}
        <div className="mt-6 pt-4 border-t border-gray-300 text-center">
          <p className="text-gray-600 text-sm">
            この給与明細は自動生成されたものです。
            <br />
            支払日: {formatDate(payslip.paymentDate)} / 発行日: {new Date().toLocaleDateString('ja-JP')}
          </p>
        </div>
      </div>
      
      {/* 印刷ページにのみ表示されるボタン */}
      <div className="mt-4 text-center print:hidden">
        <button 
          onClick={() => window.print()} 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
        >
          印刷
        </button>
        <button 
          onClick={() => window.close()} 
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

export default PayslipPrint;