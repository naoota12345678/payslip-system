// src/pages/PayslipViewer.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

function PayslipViewer() {
  const { currentUser, userDetails } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 給与明細データを取得
  useEffect(() => {
    const fetchPayslips = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        
        // ユーザーIDに基づいて給与明細を取得
        const payslipsQuery = query(
          collection(db, 'payslips'),
          where('userId', '==', currentUser.uid),
          orderBy('paymentDate', 'desc')
        );
        
        const snapshot = await getDocs(payslipsQuery);
        
        if (snapshot.empty) {
          setPayslips([]);
          setError('給与明細データが見つかりません');
        } else {
          const payslipData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            paymentDate: doc.data().paymentDate.toDate()
          }));
          
          setPayslips(payslipData);
          // 最新の明細を初期選択
          setSelectedPayslip(payslipData[0]);
        }
      } catch (err) {
        console.error('給与明細取得エラー:', err);
        setError('給与明細データの取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchPayslips();
  }, [currentUser]);

  // 別の明細を選択
  const handleSelectPayslip = (payslip) => {
    setSelectedPayslip(payslip);
  };

  // 印刷機能
  const handlePrint = () => {
    window.print();
  };

  // 日付のフォーマット
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center">
        <div className="loading-spinner"></div>
        <p className="ml-2">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">給与明細</h1>
      
      {error && payslips.length === 0 ? (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
          <p>{error}</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6">
          {/* 給与明細リスト */}
          <div className="w-full md:w-1/4">
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold mb-3">過去の給与明細</h2>
              <ul className="divide-y">
                {payslips.map(payslip => (
                  <li key={payslip.id}>
                    <button
                      onClick={() => handleSelectPayslip(payslip)}
                      className={`w-full text-left py-3 px-2 rounded transition ${
                        selectedPayslip && selectedPayslip.id === payslip.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{formatDate(payslip.paymentDate)}</div>
                      <div className="text-sm text-gray-600">
                        支給額: {payslip.totalIncome.toLocaleString()}円
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* 明細詳細表示 */}
          <div className="w-full md:w-3/4">
            {selectedPayslip ? (
              <div className="bg-white rounded-lg shadow-md p-6" id="printable-payslip">
                <div className="mb-6 print:hidden flex justify-end">
                  <button
                    onClick={handlePrint}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                  >
                    印刷
                  </button>
                </div>
                
                <div className="border-b pb-4 mb-6">
                  <h2 className="text-xl font-bold text-center mb-2">給与明細書</h2>
                  <p className="text-center text-lg mb-4">
                    {formatDate(selectedPayslip.paymentDate)}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-600">社員番号</p>
                      <p className="font-medium">{userDetails?.employeeId || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">氏名</p>
                      <p className="font-medium">{userDetails?.displayName || currentUser?.email || '-'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* 支給項目 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 border-b pb-2">支給</h3>
                    <table className="w-full">
                      <tbody>
                        {Object.entries(selectedPayslip.items || {})
                          .filter(([_, item]) => item.type === 'income')
                          .map(([itemId, item]) => (
                            <tr key={itemId}>
                              <td className="py-2">{item.name}</td>
                              <td className="py-2 text-right">
                                {item.value.toLocaleString()}円
                              </td>
                            </tr>
                          ))}
                        <tr className="font-bold border-t">
                          <td className="py-3">支給合計</td>
                          <td className="py-3 text-right">
                            {selectedPayslip.totalIncome.toLocaleString()}円
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  {/* 控除項目 */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 border-b pb-2">控除</h3>
                    <table className="w-full">
                      <tbody>
                        {Object.entries(selectedPayslip.items || {})
                          .filter(([_, item]) => item.type === 'deduction')
                          .map(([itemId, item]) => (
                            <tr key={itemId}>
                              <td className="py-2">{item.name}</td>
                              <td className="py-2 text-right">
                                {item.value.toLocaleString()}円
                              </td>
                            </tr>
                          ))}
                        <tr className="font-bold border-t">
                          <td className="py-3">控除合計</td>
                          <td className="py-3 text-right">
                            {selectedPayslip.totalDeduction.toLocaleString()}円
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* 差引支給額 */}
                <div className="mt-8 pt-4 border-t">
                  <div className="bg-gray-100 p-4 rounded-md flex justify-between items-center">
                    <span className="text-lg font-bold">差引支給額</span>
                    <span className="text-xl font-bold">
                      {selectedPayslip.netAmount.toLocaleString()}円
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-md p-6 flex justify-center items-center h-64">
                <p className="text-gray-500">給与明細を選択してください</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PayslipViewer;