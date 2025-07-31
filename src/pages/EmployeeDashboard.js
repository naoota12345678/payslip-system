// src/pages/EmployeeDashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs, Timestamp, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function EmployeeDashboard() {
  const { currentUser, userDetails } = useAuth();
  
  console.log('📊 EmployeeDashboard レンダリング:', {
    currentUser: currentUser ? `${currentUser.email}` : 'null',
    userDetails: userDetails ? `${userDetails.name} (${userDetails.employeeId})` : 'null'
  });
  const [payslips, setPayslips] = useState([]);
  const [latestPayslip, setLatestPayslip] = useState(null);
  const [bonusPayslips, setBonusPayslips] = useState([]);
  const [latestBonusPayslip, setLatestBonusPayslip] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    totalPayslips: 0,
    averageNetAmount: 0,
    yearlyIncome: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('=== EmployeeDashboard useEffect 開始 ===');
    console.log('currentUser:', currentUser ? currentUser.email : 'null');
    console.log('userDetails:', userDetails);
    
    if (!currentUser || !userDetails) {
      console.log('❌ currentUser または userDetails が null - データ取得をスキップ');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError('');
    
    console.log('🔍 給与明細検索条件:');
    console.log('  - employeeId:', userDetails.employeeId);
    console.log('  - companyId:', userDetails.companyId);
    
    // リアルタイムリスナーを設定（給与明細）
    const q = query(
      collection(db, "payslips"),
      where("employeeId", "==", userDetails.employeeId),
      where("companyId", "==", userDetails.companyId),
      orderBy("paymentDate", "desc")
    );
    
    console.log('📋 リアルタイムリスナーを設定中...');
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        console.log('🔄 給与明細データが更新されました:', querySnapshot.size, '件');
        
        const payslipList = [];
        querySnapshot.forEach((doc) => {
          const docData = doc.data();
          // 給与のみを表示（賞与は除外）
          if (!docData.payslipType || docData.payslipType === 'salary') {
            payslipList.push({
              id: doc.id,
              ...docData,
              paymentDate: docData.paymentDate?.toDate() // Timestamp→Date変換
            });
          }
        });
        
        console.log('✅ 取得した給与明細数:', payslipList.length);
        setPayslips(payslipList);
        
        // 最新の給与明細
        if (payslipList.length > 0) {
          setLatestPayslip(payslipList[0]);
          console.log('📋 最新の給与明細:', payslipList[0].paymentDate?.toLocaleDateString('ja-JP'));
        } else {
          console.log('⚠️ 給与明細が見つかりませんでした');
          setLatestPayslip(null);
        }
        
        setLoading(false);
      },
      (error) => {
        console.error("給与データのリアルタイム取得エラー:", error);
        setError(`給与データの取得中にエラーが発生しました: ${error.message}`);
        setLoading(false);
      }
    );
    
    // 初回ロード時のみ実行する処理
    const fetchInitialData = async () => {
      try {
        // 賞与明細も取得
        await fetchBonusPayslips();
        
        // 通知をチェック
        await checkNotifications();
        
        // 集計データの計算
        await calculateStats();
      } catch (err) {
        console.error("初期データの取得エラー:", err);
      }
    };
    
    // 年間の給与総額などを計算
    const calculateStats = async () => {
      try {
        // 過去12ヶ月の給与明細を取得
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const yearlyQuery = query(
          collection(db, "payslips"),
          where("employeeId", "==", userDetails.employeeId),
          where("companyId", "==", userDetails.companyId),
          where("paymentDate", ">=", Timestamp.fromDate(oneYearAgo)),
          orderBy("paymentDate", "desc")
        );
        
        const yearlySnapshot = await getDocs(yearlyQuery);
        const yearlyPayslips = [];
        
        yearlySnapshot.forEach((doc) => {
          yearlyPayslips.push(doc.data());
        });
        
        // 集計計算
        const totalPayslips = yearlyPayslips.length;
        let totalNetAmount = 0;
        let yearlyIncomeTotal = 0;
        
        yearlyPayslips.forEach(payslip => {
          totalNetAmount += payslip.netAmount || 0;
          yearlyIncomeTotal += payslip.totalIncome || 0;
        });
        
        const averageNetAmount = totalPayslips > 0 ? totalNetAmount / totalPayslips : 0;
        
        setStats({
          totalPayslips,
          averageNetAmount,
          yearlyIncome: yearlyIncomeTotal
        });
      } catch (err) {
        console.error("集計データの計算エラー:", err);
      }
    };

    // 賞与明細を取得する関数
    const fetchBonusPayslips = async () => {
      try {
        console.log('🎁 賞与明細を検索中...');
        
        const bonusQuery = query(
          collection(db, "bonusPayslips"),
          where("employeeId", "==", userDetails.employeeId),
          where("companyId", "==", userDetails.companyId),
          orderBy("paymentDate", "desc")
        );
        
        const bonusSnapshot = await getDocs(bonusQuery);
        console.log('🎁 賞与明細結果:', bonusSnapshot.size, '件');
        
        const bonusList = [];
        
        bonusSnapshot.forEach((doc) => {
          const docData = doc.data();
          console.log('  - 賞与明細:', doc.id, docData.paymentDate?.toDate().toLocaleDateString('ja-JP'));
          bonusList.push({
            id: doc.id,
            ...docData,
            paymentDate: docData.paymentDate?.toDate()
          });
        });
        
        setBonusPayslips(bonusList);
        
        if (bonusList.length > 0) {
          setLatestBonusPayslip(bonusList[0]);
          console.log('🎁 最新の賞与明細:', bonusList[0].paymentDate?.toLocaleDateString('ja-JP'));
        } else {
          console.log('⚠️ 賞与明細が見つかりませんでした');
        }
      } catch (err) {
        console.error("賞与データの取得エラー:", err);
        console.error("エラーコード:", err.code);
        console.error("エラーメッセージ:", err.message);
      }
    };
    
    // 通知をチェックする関数
    const checkNotifications = async () => {
      try {
        const newNotifications = [];
        
        // 最後のログイン時刻を取得（localStorageから）
        const lastLoginStr = localStorage.getItem(`lastLogin_${currentUser.uid}`);
        const lastLogin = lastLoginStr ? new Date(lastLoginStr) : new Date(0);
        
        // 新しい給与明細をチェック
        const newPayslipsQuery = query(
          collection(db, "payslips"),
          where("employeeId", "==", userDetails.employeeId),
          where("companyId", "==", userDetails.companyId),
          where("createdAt", ">", Timestamp.fromDate(lastLogin)),
          orderBy("createdAt", "desc")
        );
        
        const newPayslipsSnapshot = await getDocs(newPayslipsQuery);
        newPayslipsSnapshot.forEach((doc) => {
          const data = doc.data();
          newNotifications.push({
            id: doc.id,
            type: 'payslip',
            message: `${data.paymentDate?.toDate().toLocaleDateString('ja-JP')}の給与明細が追加されました`,
            createdAt: data.createdAt?.toDate(),
            link: `/payslips/${doc.id}`
          });
        });
        
        // 新しい賞与明細をチェック
        const newBonusQuery = query(
          collection(db, "bonusPayslips"),
          where("employeeId", "==", userDetails.employeeId),
          where("companyId", "==", userDetails.companyId),
          where("createdAt", ">", Timestamp.fromDate(lastLogin)),
          orderBy("createdAt", "desc")
        );
        
        const newBonusSnapshot = await getDocs(newBonusQuery);
        newBonusSnapshot.forEach((doc) => {
          const data = doc.data();
          newNotifications.push({
            id: doc.id,
            type: 'bonus',
            message: `${data.paymentDate?.toDate().toLocaleDateString('ja-JP')}の賞与明細が追加されました`,
            createdAt: data.createdAt?.toDate(),
            link: `/bonus-payslips/${doc.id}`
          });
        });
        
        setNotifications(newNotifications);
        
        // 現在の時刻を保存
        localStorage.setItem(`lastLogin_${currentUser.uid}`, new Date().toISOString());
      } catch (err) {
        console.error("通知チェックエラー:", err);
      }
    };

    fetchInitialData();
    
    // クリーンアップ関数（コンポーネントがアンマウントされる時にリスナーを解除）
    return () => {
      console.log('🔌 リアルタイムリスナーを解除');
      unsubscribe();
    };
  }, [currentUser, userDetails]);

  // 日付を整形する関数
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('ja-JP', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  };

  // 金額を整形する関数
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '¥0';
    return new Intl.NumberFormat('ja-JP', { 
      style: 'currency', 
      currency: 'JPY',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">給与明細一覧</h1>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      ) : (
        <>
          {/* 給与明細一覧 */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {payslips.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        支払日
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payslips.map((payslip) => (
                      <tr key={payslip.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(payslip.paymentDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <Link
                            to={`/employee/payslips/${payslip.id}`}
                            className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            詳細
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">給与明細データがありません</p>
              </div>
            )}
          </div>
          
          {/* 賞与明細一覧 */}
          {bonusPayslips.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden mt-8">
              <div className="px-6 py-4 bg-gray-50 border-b">
                <h3 className="text-lg font-semibold text-gray-700">賞与明細</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        支払日
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bonusPayslips.map((bonus) => (
                      <tr key={bonus.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(bonus.paymentDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <Link
                            to={`/employee/bonus-payslips/${bonus.id}`}
                            className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            詳細
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default EmployeeDashboard;