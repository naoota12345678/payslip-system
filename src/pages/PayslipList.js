// src/pages/PayslipList.js
import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import PayslipNotificationUI from './PayslipNotificationUI';

function PayslipList() {
  const { currentUser, userDetails } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPaymentDate, setSelectedPaymentDate] = useState(null);
  const [groupedPayslips, setGroupedPayslips] = useState({});
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedEmailData, setSelectedEmailData] = useState(null);
  const [emailHistory, setEmailHistory] = useState({});
  const [scheduleHistory, setScheduleHistory] = useState({});

    // 従業員情報と部門情報を取得
  useEffect(() => {
    const fetchEmployeesAndDepartments = async () => {
      if (!userDetails?.companyId) return;
      
      try {
        // 従業員データを取得
        const employeesQuery = query(
          collection(db, "employees"),
          where("companyId", "==", userDetails.companyId)
        );
        
        const employeesSnapshot = await getDocs(employeesQuery);
        const employeesList = [];
        
        employeesSnapshot.forEach((doc) => {
          const data = doc.data();
          employeesList.push({
            id: doc.id,
            employeeId: data.employeeId,
            name: data.name,
            departmentCode: data.departmentCode
          });
        });
        
        setEmployees(employeesList);
        
        console.log('👥 取得した従業員データ:', employeesList.slice(0, 3)); // 最初の3件のみログ出力

        // 部門データを取得
        const departmentsQuery = query(
          collection(db, "departments"),
          where("companyId", "==", userDetails.companyId)
        );
        
        const departmentsSnapshot = await getDocs(departmentsQuery);
        const departmentsList = [];
        
        departmentsSnapshot.forEach((doc) => {
          const data = doc.data();
          departmentsList.push({
            id: doc.id,
            code: data.code,
            name: data.name
          });
        });
        
        setDepartments(departmentsList);
      } catch (err) {
        console.error("従業員・部門データの取得エラー:", err);
      }
    };
    
    fetchEmployeesAndDepartments();
  }, [userDetails]);

  // メール送信履歴を取得
  useEffect(() => {
    const fetchEmailHistory = async () => {
      if (!userDetails?.companyId) return;
      
      try {
        const historyQuery = query(
          collection(db, "payslipEmailHistory"),
          where("companyId", "==", userDetails.companyId)
        );
        
        const historySnapshot = await getDocs(historyQuery);
        const historyMap = {};
        
        historySnapshot.forEach(doc => {
          const data = doc.data();
          const key = `${data.uploadId}_${data.paymentDate}`;
          historyMap[key] = data;
        });
        
        setEmailHistory(historyMap);
        console.log('📧 メール送信履歴取得:', Object.keys(historyMap).length, '件');
      } catch (err) {
        console.error("メール送信履歴取得エラー:", err);
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
          where("status", "in", ["scheduled", "executing"])
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
        console.log('📅 スケジュール送信情報取得:', Object.keys(scheduleMap).length, '件');
      } catch (err) {
        console.error("スケジュール送信情報取得エラー:", err);
      }
    };

    fetchScheduleHistory();
  }, [userDetails]);

  useEffect(() => {
    const fetchPayslips = async () => {
      if (!currentUser || !userDetails) return;
      
      try {
        setLoading(true);
        setError('');
        
        console.log('🔍 PayslipList デバッグ情報:');
        console.log('- currentUser.uid:', currentUser.uid);
        console.log('- userDetails.companyId:', userDetails.companyId);
        console.log('- userDetails.role:', userDetails.role);
        
        let q;
        
        // 権限に応じて適切なクエリを実行
        if (userDetails.role === 'admin' || userDetails.userType === 'company_admin') {
          console.log('📊 管理者として会社全体の明細を取得中...');
          q = query(
            collection(db, "payslips"),
            where("companyId", "==", userDetails.companyId)
          );
        } else {
          console.log('👤 従業員として自分の明細のみ取得中...');
          // 従業員ID + companyIDで絞り込み
          q = query(
            collection(db, "payslips"),
            where("employeeId", "==", userDetails.employeeId),
            where("companyId", "==", userDetails.companyId)
          );
        }
        
        const querySnapshot = await getDocs(q);
        const payslipList = [];
        
        console.log('🔍 クエリ結果:', querySnapshot.docs.length, '件のドキュメント');
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          
          console.log('📋 給与明細データ詳細:', {
            id: doc.id,
            userId: data.userId,
            companyId: data.companyId,
            employeeId: data.employeeId,
            paymentDate: data.paymentDate,
            totalIncome: data.totalIncome,
            hasItems: data.items ? Object.keys(data.items).length : 0
          });
          
          // 🛠️ デバッグ用: 一時的に従業員IDチェックを緩和
          // 従業員番号が空のデータは除外（一時的にコメントアウト）
          if (!data.employeeId || data.employeeId.trim() === '') {
            console.log('⚠️ 従業員番号が空ですが、デバッグのため表示します:', doc.id);
            // 一時的にスキップしない
            // return;
          }
          
                     // データ構造を詳細にログ出力（最初の数件のみ）
           if (payslipList.length < 3) {
             console.log(`📊 データ構造詳細 #${payslipList.length + 1}:`, {
               id: doc.id,
               allKeys: Object.keys(data),
               employeeId: data.employeeId,
               userId: data.userId,
               companyId: data.companyId,
               items: data.items ? Object.keys(data.items) : 'なし',
               totalIncome: data.totalIncome,
               totalDeduction: data.totalDeduction,
               netAmount: data.netAmount
             });
             
             // 🔍 完全なデータ構造を確認
             console.log(`🔍 完全データ #${payslipList.length + 1}:`, data);
             
             // itemsフィールドの詳細確認
             if (data.items) {
               console.log(`📋 itemsフィールド詳細 #${payslipList.length + 1}:`, data.items);
               console.log(`📋 itemsのサンプルキー:`, Object.keys(data.items).slice(0, 10));
               
               // 従業員情報が含まれているかもしれないキーを探す
               const employeeKeys = Object.keys(data.items).filter(key => 
                 key.includes('従業員') || key.includes('社員') || key.includes('employee') || 
                 key.includes('Employee') || key.includes('番号') || key.includes('コード') ||
                 key.includes('ID') || key.includes('id')
               );
               console.log(`🔍 従業員関連キー候補:`, employeeKeys);
               
               // 従業員関連キーの値も確認
               employeeKeys.forEach(key => {
                 console.log(`📊 ${key}: ${data.items[key]}`);
               });
             }
           }
          
          payslipList.push({
            id: doc.id,
            ...data,
            paymentDate: data.paymentDate?.toDate()
          });
        });

        console.log('✅ 最終的な給与明細リスト:', payslipList.length, '件');
        
        // データが見つからない場合の詳細情報
        if (payslipList.length === 0) {
          console.log('⚠️ 給与明細が見つかりません');
          console.log('デバッグ情報:');
          console.log('- クエリしたcompanyId:', userDetails.companyId);
          console.log('- 実際に取得したドキュメント数:', querySnapshot.docs.length);
          console.log('- 従業員番号チェックでスキップされた件数:', querySnapshot.docs.length - payslipList.length);
          
          // Firestoreのpayslipsコレクション全体をチェック（デバッグ用）
          try {
            const allPayslipsQuery = query(collection(db, "payslips"));
            const allPayslipsSnapshot = await getDocs(allPayslipsQuery);
            console.log('📊 Firestore内の全給与明細数:', allPayslipsSnapshot.docs.length);
            
                         if (allPayslipsSnapshot.docs.length > 0) {
               console.log('📋 最初のドキュメントのサンプル:');
               const firstDoc = allPayslipsSnapshot.docs[0];
               const data = firstDoc.data();
               console.log('完全なドキュメントデータ:', data);
               console.log('itemsフィールドの内容:', data.items);
               console.log('全フィールド一覧:', Object.keys(data));
               
               // 従業員IDが他のフィールドに保存されていないかチェック
               console.log('🔍 従業員ID関連フィールドの確認:');
               console.log('- employeeId:', data.employeeId);
               console.log('- employee_id:', data.employee_id);
               console.log('- 従業員コード:', data['従業員コード']);
               console.log('- 従業員番号:', data['従業員番号']);
               console.log('- employeeCode:', data.employeeCode);
               
               // employeesコレクションの従業員ID設定状況を確認
               console.log('👥 employeesコレクションの従業員ID設定確認を開始...');
               try {
                 const employeesSnapshot = await getDocs(query(
                   collection(db, "employees"),
                   where("companyId", "==", userDetails.companyId)
                 ));
                 
                 console.log(`👥 会社の従業員数: ${employeesSnapshot.docs.length}`);
                 employeesSnapshot.docs.forEach((empDoc, index) => {
                   const empData = empDoc.data();
                   console.log(`👤 従業員${index + 1}: {id: ${empDoc.id}, employeeId: ${empData.employeeId}, name: ${empData.name}}`);
                 });
               } catch (employeesError) {
                 console.error('👥 employeesコレクション確認エラー:', employeesError);
               }
             }
          } catch (debugErr) {
            console.error('デバッグクエリエラー:', debugErr);
          }
        }
        
        setPayslips(payslipList);
        
        // 支払い日別にグループ化
        const grouped = payslipList.reduce((acc, payslip) => {
          const dateKey = payslip.paymentDate ? formatDate(payslip.paymentDate) : 'N/A';
          if (!acc[dateKey]) {
            acc[dateKey] = [];
          }
          acc[dateKey].push(payslip);
          return acc;
        }, {});
        
        setGroupedPayslips(grouped);
        
      } catch (err) {
        console.error("明細データの取得エラー:", err);
        setError("給与明細データの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchPayslips();
  }, [currentUser, userDetails]);

  // URLパラメータから支払日を読み取り、自動的に支払日別表示に切り替え
  useEffect(() => {
    const paymentDateParam = searchParams.get('paymentDate');
    if (paymentDateParam && groupedPayslips[paymentDateParam]) {
      setSelectedPaymentDate(paymentDateParam);
      // URLパラメータをクリア（ブラウザバックで元に戻れるようにするため）
      // setSearchParams({});
    }
  }, [searchParams, groupedPayslips]);

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

  // 従業員IDから従業員名を取得する関数
  const getEmployeeName = (employeeId) => {
    if (!employeeId) {
      console.log('❌ getEmployeeName: employeeIdが空です');
      return 'N/A';
    }
    const employee = employees.find(emp => emp.employeeId === employeeId);
    if (!employee) {
      console.log('❌ getEmployeeName: employeeIdに一致する従業員が見つかりません:', employeeId);
      console.log('📋 利用可能な従業員ID:', employees.map(e => e.employeeId).slice(0, 5));
    }
    return employee ? employee.name : 'N/A';
  };

  // 従業員IDから部門名を取得する関数
  const getDepartmentName = (employeeId) => {
    if (!employeeId) return '';
    const employee = employees.find(emp => emp.employeeId === employeeId);
    if (!employee || !employee.departmentCode) return '';
    
    const department = departments.find(dept => dept.code === employee.departmentCode);
    return department ? department.name : '';
  };

  // 削除確認ダイアログを開く
  const handleDeleteClick = (paymentDate) => {
    setDeleteTarget(paymentDate);
    setDeleteDialogOpen(true);
  };

  // 削除実行
  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleting) return;
    
    try {
      setDeleting(true);
      
      // 指定した支払日の給与明細をすべて削除
      const payslipsToDelete = groupedPayslips[deleteTarget] || [];
      
      if (payslipsToDelete.length === 0) {
        console.log('削除対象の給与明細がありません');
        return;
      }
      
      // バッチ削除処理
      const batch = writeBatch(db);
      payslipsToDelete.forEach(payslip => {
        const docRef = doc(db, 'payslips', payslip.id);
        batch.delete(docRef);
      });
      
      await batch.commit();
      
      // ローカルの状態を更新
      const updatedGrouped = { ...groupedPayslips };
      delete updatedGrouped[deleteTarget];
      setGroupedPayslips(updatedGrouped);
      
      // payslips配列からも削除
      const updatedPayslips = payslips.filter(p => {
        const dateKey = p.paymentDate ? formatDate(p.paymentDate) : 'N/A';
        return dateKey !== deleteTarget;
      });
      setPayslips(updatedPayslips);
      
      console.log(`${deleteTarget}の給与明細${payslipsToDelete.length}件を削除しました`);
      
    } catch (error) {
      console.error('削除エラー:', error);
      setError('削除中にエラーが発生しました: ' + error.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  // 削除キャンセル
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
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
      type: 'payslip'
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
            where("companyId", "==", userDetails.companyId)
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
          console.error("メール送信履歴更新エラー:", err);
        }
      };
      
      fetchEmailHistory();
    }, 1000);
  };

  // 支払い日一覧に戻る
  const handleBackToDateList = () => {
    setSelectedPaymentDate(null);
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
      </div>
    );
  }

  // デバッグ情報表示
  if (!loading && payslips.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">給与明細一覧</h1>
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          <p className="font-bold">🔍 デバッグ: 給与明細が見つかりません</p>
          <p>ブラウザのコンソール（F12）を開いて詳細なデバッグ情報を確認してください。</p>
          <ul className="mt-2 text-sm">
            <li>• 給与データが正しくアップロードされているか</li>
            <li>• companyIdが正しく設定されているか</li>
            <li>• employeeIdフィールドが空でないか</li>
          </ul>
        </div>
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4">
          <p>給与データをアップロードしたい場合は、<a href="/csv-upload" className="underline font-bold">CSVアップロード</a>ページをご利用ください。</p>
        </div>
      </div>
    );
  }

  // 支払い日が選択されている場合：その日の従業員一覧を表示
  if (selectedPaymentDate) {
    const payslipsForDate = groupedPayslips[selectedPaymentDate] || [];
    
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center mb-6">
          <button
            onClick={handleBackToDateList}
            className="flex items-center text-blue-600 hover:text-blue-800 mr-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            戻る
          </button>
          <h1 className="text-2xl font-bold">
            {selectedPaymentDate} の給与明細
          </h1>
        </div>

        {payslipsForDate.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      従業員番号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      従業員名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      部門
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payslipsForDate
                    .sort((a, b) => {
                      // 従業員番号でソート（数値として比較）
                      const aId = a.employeeId || '';
                      const bId = b.employeeId || '';
                      
                      // 数値として解析できる場合は数値比較、そうでなければ文字列比較
                      const aNum = parseInt(aId, 10);
                      const bNum = parseInt(bId, 10);
                      
                      if (!isNaN(aNum) && !isNaN(bNum)) {
                        return aNum - bNum;
                      } else {
                        return aId.localeCompare(bId);
                      }
                    })
                    .map((payslip) => (
                    <tr key={payslip.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payslip.employeeId || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {getEmployeeName(payslip.employeeId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getDepartmentName(payslip.employeeId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Link
                          to={userDetails?.role === 'admin' || userDetails?.userType === 'company_admin' 
                            ? `/admin/payslips/${payslip.id}` 
                            : `/employee/payslips/${payslip.id}`}
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
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">この日の給与明細はありません</p>
          </div>
        )}
      </div>
    );
  }

  // デフォルト表示：支払い日一覧
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">給与明細一覧</h1>

      {Object.keys(groupedPayslips).length > 0 ? (
        <div className="grid gap-4">
          {Object.entries(groupedPayslips)
            .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA))
            .map(([paymentDate, payslipsForDate]) => (
            <div
              key={paymentDate}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-center">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => setSelectedPaymentDate(paymentDate)}
                >
                  <h3 className="text-lg font-semibold text-gray-900">
                    {paymentDate}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {payslipsForDate.length}件の給与明細
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {userDetails?.role === 'admin' && (() => {
                    // 複数のuploadIdがある場合、いずれかが送信済みかチェック
                    const uploadIds = [...new Set(payslipsForDate.map(p => p.uploadId).filter(Boolean))];
                    const isSent = uploadIds.some(uid => emailHistory[`${uid}_${paymentDate}`]);
                    const isScheduled = uploadIds.some(uid => scheduleHistory[`${uid}_${paymentDate}`])
                      ? scheduleHistory[`${uploadIds[0]}_${paymentDate}`] // 表示用に最初のものを使用
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
                            openEmailModal(paymentDate, payslipsForDate);
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
                  {userDetails?.role === 'admin' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(paymentDate);
                      }}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                      title={`${paymentDate}の給与明細を削除`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  )}
                  <div className="text-gray-400 cursor-pointer" onClick={() => setSelectedPaymentDate(paymentDate)}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">給与明細がありません</p>
          {userDetails?.role === 'admin' && (
            <Link
              to="/admin/upload"
              className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              給与データをアップロード
            </Link>
          )}
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              給与明細の削除確認
            </h3>
            <p className="text-gray-600 mb-6">
              <strong>{deleteTarget}</strong> の給与明細
              <strong>{groupedPayslips[deleteTarget]?.length || 0}件</strong>
              をすべて削除しますか？
              <br />
              <span className="text-red-600 text-sm mt-2 block">
                ※ この操作は取り消せません
              </span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                disabled={deleting}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? '削除中...' : '削除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* メール送信モーダル */}
      {emailModalOpen && selectedEmailData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                給与明細メール送信 - {selectedEmailData.paymentDate}
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

export default PayslipList;