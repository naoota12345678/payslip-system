// src/pages/PayslipDetail.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PayslipPreview from '../components/payslip/PayslipPreview';
import { db, functions } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';

function PayslipDetail() {
  const { payslipId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userDetails } = useAuth();
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewLogged, setViewLogged] = useState(false);
  const [relatedPayslips, setRelatedPayslips] = useState([]);
  const printRef = useRef(null);

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

        // 閲覧ログを記録（まだ記録していなければ）
        if (!viewLogged) {
          logPayslipView(payslipId);
        }
        
        // 関連する明細（同じ従業員の別の月の明細）を取得
        if (payslipData.employeeId && payslipData.userId) {
          fetchRelatedPayslips(payslipData.userId, payslipData.employeeId, payslipId);
        }
      } catch (err) {
        console.error("給与明細データの取得エラー:", err);
        setError("給与明細データの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchPayslipData();
  }, [payslipId, currentUser, userDetails, viewLogged]);

  // 関連する給与明細を取得する関数
  const fetchRelatedPayslips = async (userId, employeeId, currentPayslipId) => {
    try {
      // 同じユーザーの他の給与明細を取得（直近の5件）
      const payslipsQuery = query(
        collection(db, "payslips"),
        where("userId", "==", userId),
        where("employeeId", "==", employeeId)
      );
      
      const snapshot = await getDocs(payslipsQuery);
      
      if (!snapshot.empty) {
        const related = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            paymentDate: doc.data().paymentDate?.toDate()
          }))
          .filter(p => p.id !== currentPayslipId) // 現在の明細を除外
          .sort((a, b) => b.paymentDate - a.paymentDate) // 日付の降順
          .slice(0, 5); // 直近の5件のみ
        
        setRelatedPayslips(related);
      }
    } catch (err) {
      console.error("関連明細取得エラー:", err);
      // 関連明細の取得失敗は非致命なので、エラー表示はしない
    }
  };

  // 閲覧ログを記録する関数
  const logPayslipView = async (id) => {
    try {
      const logView = httpsCallable(functions, 'logPayslipView');
      await logView({ 
        payslipId: id,
        userAgent: navigator.userAgent 
      });
      setViewLogged(true);
    } catch (err) {
      console.error("閲覧ログ記録エラー:", err);
      // エラーがあっても処理は続行
    }
  };

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

  // 印刷ボタンのハンドラ
  const handlePrint = () => {
    window.print();
  };

  // 戻るボタンのハンドラ
  const handleBack = () => {
    navigate('/payslips');
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
          onClick={handleBack}
          className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  if (!payslip) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">給与明細データが見つかりません</p>
        <button
          onClick={handleBack}
          className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">給与明細詳細</h1>
        <div className="flex space-x-2">
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 print:hidden"
          >
            一覧に戻る
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
          <a 
            href={`/payslips/${payslip.id}/print`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 print:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
            </svg>
            印刷用ページ
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左カラム - 給与明細プレビュー */}
        <div className="lg:col-span-2">
          <div ref={printRef} className="bg-white rounded-lg shadow-md overflow-hidden p-6">
            {/* 利用中の明細の実績を表示 */}
            <PayslipPreview payslipData={payslip} showDetailedInfo={true} />
          </div>
        </div>
        
        {/* 右カラム - 対象期間と関連明細 */}
        <div className="lg:col-span-1 space-y-4 print:hidden">
          {/* 明細情報 */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 bg-blue-50 border-b">
              <h3 className="font-semibold">明細情報</h3>
            </div>
            <div className="p-4 space-y-2">
              <p>
                <span className="text-gray-600 text-sm">従業員ID:</span> 
                <span className="font-medium ml-2">{payslip.employeeId || 'N/A'}</span>
              </p>
              <p>
                <span className="text-gray-600 text-sm">支払日:</span> 
                <span className="font-medium ml-2">{formatDate(payslip.paymentDate)}</span>
              </p>
              {payslip.departmentCode && (
                <p>
                  <span className="text-gray-600 text-sm">部門:</span> 
                  <span className="font-medium ml-2">{payslip.departmentCode}</span>
                </p>
              )}
              <p>
                <span className="text-gray-600 text-sm">データ登録日:</span> 
                <span className="font-medium ml-2">{formatDate(payslip.createdAt?.toDate?.())}</span>
              </p>
              <hr className="my-2" />
              <p>
                <span className="text-gray-600 text-sm">支給額合計:</span> 
                <span className="font-medium ml-2">{formatCurrency(payslip.totalIncome)}</span>
              </p>
              <p>
                <span className="text-gray-600 text-sm">控除額合計:</span> 
                <span className="font-medium ml-2">{formatCurrency(payslip.totalDeduction)}</span>
              </p>
              <p>
                <span className="text-gray-600 text-sm">差引支給額:</span> 
                <span className="font-bold ml-2 text-red-600">{formatCurrency(payslip.netAmount)}</span>
              </p>
            </div>
          </div>
          
          {/* 関連明細 */}
          {relatedPayslips.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 bg-blue-50 border-b">
                <h3 className="font-semibold">関連明細</h3>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {relatedPayslips.map(related => (
                    <li key={related.id} className="border-b pb-2 last:border-b-0 last:pb-0">
                      <Link 
                        to={`/payslips/${related.id}`}
                        className="block hover:bg-gray-50 rounded p-2 transition-colors"
                      >
                        <div className="flex justify-between">
                          <div className="text-blue-600">
                            {formatDate(related.paymentDate)}
                          </div>
                          <div className="font-medium">
                            {formatCurrency(related.netAmount)}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {/* 操作ボタン */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4">
              <a 
                href={`/payslips/${payslip.id}/print`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full py-2 px-4 bg-blue-600 text-white text-center rounded hover:bg-blue-700 mb-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                </svg>
                印刷用ページを開く
              </a>
              <button
                onClick={handlePrint}
                className="block w-full py-2 px-4 bg-green-600 text-white text-center rounded hover:bg-green-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                </svg>
                このページを印刷
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PayslipDetail;