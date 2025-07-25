// src/pages/BonusPayslipDetail.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PayslipPreview from '../components/payslip/PayslipPreview';
import { db, functions } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';

function BonusPayslipDetail() {
  const { payslipId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userDetails } = useAuth();
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewLogged, setViewLogged] = useState(false);
  const [relatedPayslips, setRelatedPayslips] = useState([]);
  const [employeeName, setEmployeeName] = useState('N/A');
  const [departmentName, setDepartmentName] = useState('');
  const [companyName, setCompanyName] = useState('N/A');
  const [mappingConfig, setMappingConfig] = useState(null);
  const printRef = useRef(null);

  // CSVマッピング設定を取得（同期版）
  const fetchMappingConfigSync = async (companyId) => {
    try {
      const mappingDoc = await getDoc(doc(db, "bonusCsvMappings", companyId));
      if (mappingDoc.exists()) {
        const mappingData = mappingDoc.data();
        console.log('🎯 CSVマッピング設定を直接取得:', mappingData);
        
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

  // 賞与明細のデータを取得
  useEffect(() => {
    const fetchPayslipData = async () => {
      if (!payslipId || !currentUser) {
        setError("賞与明細IDまたはユーザー情報が不足しています");
        setLoading(false);
        return;
      }

      try {
        // Firestoreから賞与明細データを取得
        const payslipRef = doc(db, "bonusPayslips", payslipId);
        const payslipDoc = await getDoc(payslipRef);

        if (!payslipDoc.exists()) {
          setError("指定された賞与明細は存在しません");
          setLoading(false);
          return;
        }

        const payslipData = payslipDoc.data();
        
        // アクセス権のチェック（管理者または自分の賞与明細のみ閲覧可能）
        const isAdmin = userDetails?.role === 'admin';
        const isOwner = payslipData.employeeId === userDetails.employeeId && 
                       payslipData.companyId === userDetails.companyId;
        
        if (!isAdmin && !isOwner) {
          setError("この賞与明細を閲覧する権限がありません");
          setLoading(false);
          return;
        }

        // マッピング設定を取得
        let currentMappingConfig = null;
        if (payslipData.companyId || userDetails?.companyId) {
          currentMappingConfig = await fetchMappingConfigSync(payslipData.companyId || userDetails.companyId);
        }

        // 日付型に変換
        if (payslipData.paymentDate) {
          payslipData.paymentDate = payslipData.paymentDate.toDate();
        }
        
        console.log('📋 マッピング設定を使用して項目を分類中...');
        console.log('💾 PayslipData items:', Object.keys(payslipData.items || {}));
        
        // シンプルな分類処理（データベースから直接）
        const classifyItemsSimple = (payslipData, mappingConfig) => {
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

          // 全ての設定カテゴリを処理
          console.log('合計項目数:', (mappingConfig.totalItems || []).length);
          
          const allCategories = [
            { items: mappingConfig.incomeItems || [], type: 'income', targetArray: incomeItems },
            { items: mappingConfig.deductionItems || [], type: 'deduction', targetArray: deductionItems },
            { items: mappingConfig.attendanceItems || [], type: 'attendance', targetArray: attendanceItems },
            { items: mappingConfig.totalItems || [], type: 'total', targetArray: otherItems }
          ];

          allCategories.forEach(category => {
            category.items.forEach((item, index) => {
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
                order: index
              };

              // ハードコーディングされた分類を削除し、設定に従って分類
              category.targetArray.push(processedItem);
            });
          });

          console.log('📊 分類結果:');
          console.log(`- 支給項目: ${incomeItems.length}件`);
          console.log(`- 控除項目: ${deductionItems.length}件`);
          console.log(`- 勤怠項目: ${attendanceItems.length}件`);
          console.log(`- その他: ${otherItems.length}件`);

          return { incomeItems, deductionItems, attendanceItems, otherItems };
        };

        const { incomeItems, deductionItems, attendanceItems, otherItems } = 
          classifyItemsSimple(payslipData, currentMappingConfig);
        
        console.log('otherItems数:', otherItems.length);
        
        setPayslip({
          ...payslipData,
          id: payslipId,
          incomeItems,
          deductionItems,
          attendanceItems,
          otherItems,
          companyName: companyName,
          departmentName: departmentName,
          employeeName: employeeName
        });

        // 閲覧ログを記録（まだ記録していなければ）
        // TODO: logPayslipView関数を実装する必要があります
        // if (!viewLogged) {
        //   logPayslipView(payslipId);
        // }
        
        // 従業員名を取得（シンプル検索）
        if (payslipData.employeeId) {
          fetchEmployeeName(payslipData.employeeId);
        }
        
        // 会社名を取得
        if (payslipData.companyId || userDetails?.companyId) {
          fetchCompanyName(payslipData.companyId || userDetails.companyId);
        }

        // 関連する明細（同じ従業員の別の月の明細）を取得
        if (payslipData.employeeId && payslipData.userId) {
          fetchRelatedPayslips(payslipData.userId, payslipData.employeeId, payslipId);
        }
      } catch (err) {
        console.error("賞与明細データの取得エラー:", err);
        setError("賞与明細データの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchPayslipData();
  }, [payslipId, currentUser, userDetails, viewLogged]);

  // 会社名、部署名、従業員名が更新されたときにpayslipDataを更新
  useEffect(() => {
    if (payslip) {
      setPayslip(prev => ({
        ...prev,
        companyName: companyName,
        departmentName: departmentName,
        employeeName: employeeName
      }));
    }
  }, [companyName, departmentName, employeeName]);

  // 従業員名を取得する関数（シンプル版）
  const fetchEmployeeName = async (employeeId) => {
    try {
      console.log('従業員名取得開始:', employeeId);
      
      if (!employeeId) {
        setEmployeeName('N/A');
        return;
      }
      
      // employeesコレクションで従業員を検索
      const employeesQuery = query(
        collection(db, "employees"),
        where("companyId", "==", userDetails.companyId),
        where("employeeId", "==", employeeId)
      );
      
      const employeesSnapshot = await getDocs(employeesQuery);
      
      if (!employeesSnapshot.empty) {
        const employeeData = employeesSnapshot.docs[0].data();
        const employeeName = employeeData.name || 'N/A';
        
        console.log('従業員データ取得成功:', {
          name: employeeName,
          departmentCode: employeeData.departmentCode,
          departmentId: employeeData.departmentId, // 古い形式も確認
          allKeys: Object.keys(employeeData), // 全フィールド確認
          fullData: employeeData
        });
        setEmployeeName(employeeName);
        
        // 部門名も同時に取得
        if (employeeData.departmentCode) {
          console.log('部門コード検索開始:', employeeData.departmentCode);
          await fetchDepartmentName(employeeData.departmentCode);
        } else {
          console.log('従業員に部門コードが設定されていません');
          setDepartmentName(''); // 空欄（ブランク）
        }
      } else {
        console.log('従業員が見つかりません:', employeeId);
        setEmployeeName('N/A');
        setDepartmentName(''); // 空欄（ブランク）
      }
    } catch (err) {
      console.error('従業員名取得エラー:', err);
      setEmployeeName('N/A');
      setDepartmentName('');
    }
  };

  // 部門名を取得する関数（シンプル版）
  const fetchDepartmentName = async (departmentCode) => {
    try {
      console.log('部門名取得開始:', departmentCode);
      
      if (!departmentCode) {
        setDepartmentName('');
        return;
      }
      
      // departmentsコレクションで部門を検索
      const departmentsQuery = query(
        collection(db, "departments"),
        where("companyId", "==", userDetails.companyId),
        where("code", "==", departmentCode)
      );
      
      const departmentsSnapshot = await getDocs(departmentsQuery);
      
      console.log('部門検索結果:', {
        departmentCode: departmentCode,
        queryResult: departmentsSnapshot.size,
        isEmpty: departmentsSnapshot.empty
      });
      
      if (!departmentsSnapshot.empty) {
        const departmentData = departmentsSnapshot.docs[0].data();
        const departmentName = departmentData.name || '';
        
        console.log('部門データ取得成功:', {
          name: departmentName,
          code: departmentData.code,
          fullData: departmentData
        });
        setDepartmentName(departmentName);
      } else {
        console.log('部門が見つかりません。検索条件:', {
          companyId: userDetails.companyId,
          departmentCode: departmentCode
        });
        setDepartmentName('');
      }
    } catch (err) {
      console.error('部門名取得エラー:', err);
      setDepartmentName('');
    }
  };

  // 会社名を取得する関数
  const fetchCompanyName = async (companyId) => {
    try {
      const companyDoc = await getDoc(doc(db, "companies", companyId));
      
      if (companyDoc.exists()) {
        const companyData = companyDoc.data();
        setCompanyName(companyData.name || companyData.companyName || 'N/A');
      } else {
        // userDetailsから会社名を取得
        setCompanyName(userDetails?.companyName || 'N/A');
      }
    } catch (err) {
      console.error('会社名取得エラー:', err);
      // userDetailsから会社名を取得
      setCompanyName(userDetails?.companyName || 'N/A');
    }
  };

  // 関連する賞与明細を取得する関数
  const fetchRelatedPayslips = async (userId, employeeId, currentPayslipId) => {
    try {
      // 同じユーザーの他の賞与明細を取得（直近の5件）
      const payslipsQuery = query(
        collection(db, "bonusPayslips"),
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
    // ユーザーの権限に応じて適切なルートに戻る
    if (userDetails?.role === 'admin') {
      navigate('/admin/bonus-payslips');
    } else {
      navigate('/employee/bonus-payslips');
    }
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
        <p className="text-gray-500">賞与明細データが見つかりません</p>
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
        <h1 className="text-2xl font-bold">賞与明細詳細</h1>
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
          
    </div>
  );
}

export default BonusPayslipDetail; 