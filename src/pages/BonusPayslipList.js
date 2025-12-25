// src/pages/BonusPayslipList.js
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, deleteDoc, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import PayslipNotificationUI from './PayslipNotificationUI';

function BonusPayslipList() {
  const { currentUser, userDetails } = useAuth();
  const [searchParams] = useSearchParams();
  const [bonusPayslips, setBonusPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employeeNames, setEmployeeNames] = useState({}); // ユーザー名のキャッシュ
  const [expandedDates, setExpandedDates] = useState(new Set()); // 展開された支払い日
  const [deletingDate, setDeletingDate] = useState(null); // 削除処理中の支払い日
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedEmailData, setSelectedEmailData] = useState(null);
  const [emailHistory, setEmailHistory] = useState({});
  const [scheduleHistory, setScheduleHistory] = useState({});

  // メール送信履歴を取得
  useEffect(() => {
    const fetchEmailHistory = async () => {
      if (!userDetails?.companyId) return;
      
      try {
        const historyQuery = query(
          collection(db, "payslipEmailHistory"),
          where("companyId", "==", userDetails.companyId),
          where("type", "==", "bonus")
        );
        
        const historySnapshot = await getDocs(historyQuery);
        const historyMap = {};
        
        historySnapshot.forEach(doc => {
          const data = doc.data();
          const key = `${data.uploadId}_${data.paymentDate}`;
          historyMap[key] = data;
        });
        
        setEmailHistory(historyMap);
        console.log('📧 賞与メール送信履歴取得:', Object.keys(historyMap).length, '件');
      } catch (err) {
        console.error("賞与メール送信履歴取得エラー:", err);
      }
    };
    
    fetchEmailHistory();
  }, [userDetails]);

  // スケジュール送信情報を取得
  useEffect(() => {
    const fetchScheduleHistory = async () => {
      if (!userDetails?.companyId) return;

      try {
        const scheduleQuery = query(
          collection(db, "emailNotifications"),
          where("status", "in", ["scheduled", "executing"]),
          where("type", "==", "bonus")
        );

        const scheduleSnapshot = await getDocs(scheduleQuery);
        const scheduleMap = {};

        scheduleSnapshot.forEach(doc => {
          const data = doc.data();
          // uploadIds配列の各要素に対してマッピング
          const uploadIds = data.uploadIds || (data.uploadId ? [data.uploadId] : []);
          uploadIds.forEach(uid => {
            const key = `${uid}_${data.paymentDate}`;
            scheduleMap[key] = {
              ...data,
              scheduleDate: data.scheduleDate?.toDate?.() || data.scheduleDate
            };
          });
        });

        setScheduleHistory(scheduleMap);
        console.log('📅 賞与スケジュール送信情報取得:', Object.keys(scheduleMap).length, '件');
      } catch (err) {
        console.error("賞与スケジュール送信情報取得エラー:", err);
      }
    };

    fetchScheduleHistory();
  }, [userDetails]);

  // URLパラメータから支払日を読み取り、自動的に展開
  useEffect(() => {
    const paymentDateParam = searchParams.get('paymentDate');
    if (paymentDateParam && bonusPayslips.length > 0) {
      // 該当する支払日があるか確認
      const hasDate = bonusPayslips.some(p => {
        const dateStr = p.paymentDate instanceof Date
          ? p.paymentDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : formatDate(p.paymentDate);
        return dateStr === paymentDateParam;
      });

      if (hasDate) {
        setExpandedDates(new Set([paymentDateParam]));
      }
    }
  }, [searchParams, bonusPayslips]);

  // 従業員情報を取得する関数（employeeIdベース）
  const fetchEmployeeNames = useCallback(async (payslipList) => {
    if (!userDetails?.companyId) {
      return {};
    }
    
    // employeeIdのリストを抽出
    const employeeIds = [...new Set(payslipList.map(p => p.employeeId).filter(Boolean))];
    
    if (employeeIds.length === 0) {
      return {};
    }
    
    try {
      // 会社の全従業員情報を一度に取得
      const employeesQuery = query(
        collection(db, 'employees'),
        where('companyId', '==', userDetails.companyId)
      );
      
      const employeesSnapshot = await getDocs(employeesQuery);
      const nameMap = {};
      
      employeesSnapshot.forEach((doc) => {
        const employeeData = doc.data();
        const empId = employeeData.employeeId;
        
        // payslipListに含まれるemployeeIdのみ処理
        if (empId && employeeIds.includes(empId)) {
          nameMap[empId] = {
            displayName: employeeData.name || employeeData.displayName || '名前なし',
            employeeNumber: employeeData.employeeNumber || employeeData.employeeId || 'N/A',
            department: employeeData.department || ''
          };
        }
      });
      
      return nameMap;
      
    } catch (error) {
      console.error('従業員情報取得エラー:', error);
      return {};
    }
  }, [userDetails]);

  // 賞与明細データを取得
  useEffect(() => {
    const fetchBonusPayslips = async () => {
      if (!currentUser || !userDetails) return;

      try {
        setLoading(true);
        setError('');
        
        // 全ての賞与明細を取得してクライアントサイドでフィルタリング
        const querySnapshot = await getDocs(collection(db, "bonusPayslips"));

        const filteredPayslips = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          let shouldInclude = false;
          
          // 権限に応じて適切なフィルタリング
          if (userDetails.role === 'admin' || userDetails.userType === 'company_admin') {
            // 管理者の場合は会社全体の明細を含める
            shouldInclude = data.companyId === userDetails.companyId;
          } else {
            // 従業員の場合は自分の明細のみ含める（employeeIdで判定）
            shouldInclude = data.employeeId === userDetails.employeeId;
          }
          
          if (shouldInclude) {
            filteredPayslips.push({
              id: doc.id,
              ...data,
              paymentDate: data.paymentDate?.toDate()
            });
          }
        });
        


        // クライアントサイドでソート
        filteredPayslips.sort((a, b) => (b.paymentDate || new Date(0)) - (a.paymentDate || new Date(0)));
        
        setBonusPayslips(filteredPayslips);
        
        // ユーザー名を取得（すべてのユーザー）
        const names = await fetchEmployeeNames(filteredPayslips);
        setEmployeeNames(names);
        
      } catch (err) {
        console.error('賞与明細取得エラー:', err);
        setError('賞与明細データの取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchBonusPayslips();
  }, [currentUser, userDetails, fetchEmployeeNames]);

  // 支払い日でグループ化
  const groupedPayslips = React.useMemo(() => {
    const grouped = {};
    
    bonusPayslips.forEach(payslip => {
      const dateKey = payslip.paymentDate ? 
        payslip.paymentDate.toISOString().split('T')[0] : 
        'unknown';
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = {
          date: payslip.paymentDate,
          payslips: []
        };
      }
      
      grouped[dateKey].payslips.push(payslip);
    });
    
    // 各日付内の賞与明細を従業員番号順でソート
    Object.values(grouped).forEach(group => {
      group.payslips.sort((a, b) => {
        const employeeA = employeeNames[a.employeeId]?.employeeNumber || a.employeeId || '';
        const employeeB = employeeNames[b.employeeId]?.employeeNumber || b.employeeId || '';
        
        // 従業員番号を文字列として比較（数値の場合は数値として比較）
        const numA = parseFloat(employeeA);
        const numB = parseFloat(employeeB);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB; // 数値として昇順
        } else {
          return employeeA.toString().localeCompare(employeeB.toString()); // 文字列として昇順
        }
      });
    });
    
    // 日付でソート（新しい順）
    return Object.entries(grouped)
      .sort(([a], [b]) => {
        if (a === 'unknown') return 1;
        if (b === 'unknown') return -1;
        return new Date(b) - new Date(a);
      });
  }, [bonusPayslips, employeeNames]);

  // 支払い日の展開/折り畳み
  const toggleDateExpansion = (dateKey) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(dateKey)) {
      newExpanded.delete(dateKey);
    } else {
      newExpanded.add(dateKey);
    }
    setExpandedDates(newExpanded);
  };

  // 支払い日ごとの削除機能
  const deletePayslipsByDate = async (dateKey, date) => {
    if (!window.confirm(`${formatDate(date)}の賞与明細をすべて削除しますか？この操作は元に戻せません。`)) {
      return;
    }

    try {
      setDeletingDate(dateKey);
      
      // その日付の賞与明細を取得
      const payslipsToDelete = groupedPayslips.find(([key]) => key === dateKey)?.[1]?.payslips || [];
      

      
      // 個別に削除
      for (const payslip of payslipsToDelete) {
        await deleteDoc(doc(db, 'bonusPayslips', payslip.id));

      }
      
      // ローカル状態を更新
      setBonusPayslips(prev => 
        prev.filter(p => {
          const pDateKey = p.paymentDate ? 
            p.paymentDate.toISOString().split('T')[0] : 
            'unknown';
          return pDateKey !== dateKey;
        })
      );
      
      // 展開状態もクリア
      const newExpanded = new Set(expandedDates);
      newExpanded.delete(dateKey);
      setExpandedDates(newExpanded);
      

      
    } catch (error) {
      console.error('賞与明細削除エラー:', error);
      setError('賞与明細の削除中にエラーが発生しました');
    } finally {
      setDeletingDate(null);
    }
  };

  // 従業員名を取得する関数
  const getEmployeeName = (payslip) => {
    if (payslip.employeeId && employeeNames[payslip.employeeId]) {
      const userInfo = employeeNames[payslip.employeeId];
      return `${userInfo.displayName} (${userInfo.employeeNumber})`;
    }
    return '不明なユーザー';
  };

  // 日付フォーマット
  const formatDate = (date) => {
    if (!date) return '不明な日付';
    return new Date(date).toLocaleDateString('ja-JP');
  };

  // メール送信モーダルを開く
  const openEmailModal = (paymentDate, payslipsForDate) => {
    // 同じ日の全uploadIdを収集（重複排除）
    const uploadIds = [...new Set(payslipsForDate.map(p => p.uploadId).filter(Boolean))];

    if (uploadIds.length === 0) {
      alert('uploadIdが取得できませんでした');
      return;
    }

    // 複数uploadIdがある場合は警告表示
    if (uploadIds.length > 1) {
      const confirmed = window.confirm(
        `この日は${uploadIds.length}回アップロードされています。\n` +
        `全${payslipsForDate.length}件の明細にメール送信します。\n\n` +
        `よろしいですか？`
      );
      if (!confirmed) return;
    }

    setSelectedEmailData({
      uploadIds,  // 配列で渡す
      paymentDate,
      type: 'bonus'
    });
    setEmailModalOpen(true);
  };

  // メール送信モーダルを閉じる
  const closeEmailModal = () => {
    setEmailModalOpen(false);
    setSelectedEmailData(null);
    
    // メール送信履歴を再取得
    setTimeout(() => {
      const fetchEmailHistory = async () => {
        if (!userDetails?.companyId) return;
        
        try {
          const historyQuery = query(
            collection(db, "payslipEmailHistory"),
            where("companyId", "==", userDetails.companyId),
            where("type", "==", "bonus")
          );
          
          const historySnapshot = await getDocs(historyQuery);
          const historyMap = {};
          
          historySnapshot.forEach(doc => {
            const data = doc.data();
            const key = `${data.uploadId}_${data.paymentDate}`;
            historyMap[key] = data;
          });
          
          setEmailHistory(historyMap);
        } catch (err) {
          console.error("賞与メール送信履歴更新エラー:", err);
        }
      };
      
      fetchEmailHistory();
    }, 1000);
  };

  if (loading) {
    return <div className="text-center p-8">読み込み中...</div>;
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="text-red-600">{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">賞与明細一覧</h1>
        <p className="text-gray-600 mt-2">支払い日をクリックして詳細を表示/非表示できます</p>
      </div>

      {groupedPayslips.length === 0 ? (
        <div className="text-center p-8">
          <p className="text-gray-500">賞与明細データがありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedPayslips.map(([dateKey, { date, payslips: datePayslips }]) => {
            const isExpanded = expandedDates.has(dateKey);
            const isDeleting = deletingDate === dateKey;
            
            return (
              <div key={dateKey} className="bg-white shadow-md rounded-lg overflow-hidden">
                {/* 支払い日ヘッダー */}
                <div 
                  className="px-6 py-4 bg-gray-50 border-b cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleDateExpansion(dateKey)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        <h3 className="text-lg font-semibold">
                          {formatDate(date)}
                        </h3>
                      </div>
                      <div className="text-sm text-gray-600">
                        {datePayslips.length}名
                      </div>
                    </div>
                   
                   <div className="flex items-center space-x-2">
                     {/* 管理者の場合のみメール送信ボタンを表示 */}
                     {(userDetails.userType === 'company' || userDetails.role === 'admin') && (() => {
                       // 複数のuploadIdがある場合、いずれかが送信済みかチェック
                       const formattedDate = formatDate(date);
                       const uploadIds = [...new Set(datePayslips.map(p => p.uploadId).filter(Boolean))];
                       const isSent = uploadIds.some(uid => emailHistory[`${uid}_${formattedDate}`]);
                       const isScheduled = uploadIds.some(uid => scheduleHistory[`${uid}_${formattedDate}`])
                         ? scheduleHistory[`${uploadIds[0]}_${formattedDate}`]
                         : null;

                       // 状態判定: 送信済み > 予約済み > 未送信
                       let status = 'unsent';
                       let statusColor = 'text-blue-600 hover:text-blue-800 hover:bg-blue-50';
                       let statusTitle = 'メール送信';
                       let isDisabled = false;

                       if (isSent) {
                         status = 'sent';
                         statusColor = 'text-green-600 cursor-default';
                         statusTitle = '送信済み';
                         isDisabled = true;
                       } else if (isScheduled) {
                         status = 'scheduled';
                         const scheduleDate = isScheduled.scheduleDate;
                         const dateStr = scheduleDate instanceof Date
                           ? `${scheduleDate.getMonth() + 1}/${scheduleDate.getDate()} ${scheduleDate.getHours()}:00`
                           : '送信予定';
                         statusColor = 'text-orange-500 cursor-default';
                         statusTitle = `${dateStr} 送信予定`;
                         isDisabled = true;
                       }

                       return (
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             if (!isDisabled) {
                               openEmailModal(formatDate(date), datePayslips);
                             }
                           }}
                           disabled={isDisabled}
                           className={`p-2 rounded-lg transition-colors ${statusColor}`}
                           title={statusTitle}
                         >
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26c.07.04.14.06.21.06s.14-.02.21-.06L19 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                             {status === 'sent' && <circle cx="18" cy="6" r="3" fill="currentColor" />}
                             {status === 'scheduled' && <circle cx="18" cy="6" r="3" fill="currentColor" stroke="none" />}
                           </svg>
                         </button>
                       );
                     })()}
                   
                     {/* 管理者の場合のみ削除ボタンを表示 */}
                     {(userDetails.userType === 'company' || userDetails.role === 'admin') && (
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           deletePayslipsByDate(dateKey, date);
                         }}
                         disabled={isDeleting}
                         className={`px-3 py-1 text-sm rounded transition-colors ${
                           isDeleting 
                             ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                             : 'bg-red-600 hover:bg-red-700 text-white'
                         }`}
                       >
                         {isDeleting ? '削除中...' : '削除'}
                       </button>
                     )}
                   </div>
                 </div>
               </div>

               {/* 従業員リスト（展開時のみ表示） */}
               {isExpanded && (
                 <div className="divide-y divide-gray-200">
                   {datePayslips.map((payslip) => (
                     <div key={payslip.id} className="px-6 py-4 hover:bg-gray-50">
                       <div className="flex items-center justify-between">
                         <div className="flex-1">
                           {/* 管理者の場合は従業員名を表示 */}
                           {(userDetails.userType === 'company' || userDetails.role === 'admin') ? (
                             <div className="font-medium text-gray-900">
                               {getEmployeeName(payslip)}
                             </div>
                           ) : (
                             <div className="font-medium text-gray-900">
                               あなたの賞与明細
                             </div>
                           )}
                         </div>
                         <div className="ml-4">
                           <Link
                             to={userDetails?.role === 'admin' || userDetails?.userType === 'company_admin' 
                               ? `/admin/bonus-payslips/${payslip.id}` 
                               : `/employee/bonus-payslips/${payslip.id}`}
                             className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                           >
                             詳細を見る
                           </Link>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          );
        })}
      </div>
    )}

      {/* メール送信モーダル */}
      {emailModalOpen && selectedEmailData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                賞与明細メール送信 - {selectedEmailData.paymentDate}
              </h3>
              <button
                onClick={closeEmailModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="p-4">
              <PayslipNotificationUI
                uploadIds={selectedEmailData.uploadIds}
                paymentDate={selectedEmailData.paymentDate}
                type={selectedEmailData.type}
              />
            </div>
          </div>
        </div>
      )}
  </div>
  );
}

export default BonusPayslipList; 