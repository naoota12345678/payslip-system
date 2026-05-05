// src/pages/PayslipDetail.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import PayslipPreview from '../components/payslip/PayslipPreview';
import NenshuKabeStatus from '../components/payslip/NenshuKabeStatus';
import { db, functions } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';

function PayslipDetail() {
  const { payslipId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, userDetails } = useAuth();
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewLogged, setViewLogged] = useState(false);
  const [relatedPayslips, setRelatedPayslips] = useState([]);
  const [sameDatePayslips, setSameDatePayslips] = useState([]); // 同じ支払日の明細一覧
  const [currentIndex, setCurrentIndex] = useState(-1); // 現在の明細のインデックス
  const [employeeName, setEmployeeName] = useState('N/A');
  const [departmentName, setDepartmentName] = useState('');
  const [companyName, setCompanyName] = useState('N/A');
  const [mappingConfig, setMappingConfig] = useState(null);
  const printRef = useRef(null);

  // CSVマッピング設定を取得（同期版）
  const fetchMappingConfigSync = async (companyId) => {
    try {
      const mappingDoc = await getDoc(doc(db, "csvMappings", companyId));
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
        const isOwner = payslipData.employeeId === userDetails.employeeId && 
                       payslipData.companyId === userDetails.companyId;
        
        if (!isAdmin && !isOwner) {
          setError("この給与明細を閲覧する権限がありません");
          setLoading(false);
          return;
        }

        // マッピング設定を取得（過去の明細は保存時の設定を優先）
        let currentMappingConfig = null;
        if (payslipData.originalMapping) {
          // 過去の明細：保存時のマッピング設定を使用
          console.log('📋 保存時のマッピング設定を使用:', payslipData.originalMapping.timestamp);
          currentMappingConfig = payslipData.originalMapping;
        } else if (payslipData.companyId || userDetails?.companyId) {
          // 新しい明細またはマッピング未保存：現在の設定を使用
          console.log('📋 現在のマッピング設定を使用');
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
            // カテゴリ内でソート（displayOrder > columnIndex > 配列index の優先順位）
            const sortedItems = category.items.slice().sort((a, b) => {
              // 安全な数値変換でクラッシュを防止
              const orderA = (typeof a.displayOrder === 'number' && !isNaN(a.displayOrder)) 
                ? a.displayOrder 
                : (typeof a.columnIndex === 'number' && !isNaN(a.columnIndex)) 
                  ? a.columnIndex 
                  : 999;
              const orderB = (typeof b.displayOrder === 'number' && !isNaN(b.displayOrder)) 
                ? b.displayOrder 
                : (typeof b.columnIndex === 'number' && !isNaN(b.columnIndex)) 
                  ? b.columnIndex 
                  : 999;
              return orderA - orderB;
            });

            sortedItems.forEach((item, index) => {
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
                showZeroValue: item.showZeroValue !== undefined ? item.showZeroValue : false, // デフォルトで0値非表示
                order: (typeof item.displayOrder === 'number' && !isNaN(item.displayOrder)) 
                  ? item.displayOrder 
                  : (typeof item.columnIndex === 'number' && !isNaN(item.columnIndex)) 
                    ? item.columnIndex 
                    : index
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
          employeeName: employeeName // 常に最新の従業員名を使用
        });

        // 閲覧ログを記録（まだ記録していなければ）
        // TODO: logPayslipView関数を実装する必要があります
        // if (!viewLogged) {
        //   logPayslipView(payslipId);
        // }
        
        // 従業員名を取得（常に最新の従業員情報から取得）
        if (payslipData.employeeId) {
          fetchEmployeeName(payslipData.employeeId);
        } else {
          setEmployeeName('N/A');
        }
        
        // 会社名を取得
        if (payslipData.companyId || userDetails?.companyId) {
          fetchCompanyName(payslipData.companyId || userDetails.companyId);
        }

        // 関連する明細（同じ従業員の別の月の明細）を取得
        if (payslipData.employeeId && payslipData.userId) {
          fetchRelatedPayslips(payslipData.userId, payslipData.employeeId, payslipId);
        }

        // 同じ支払日の明細一覧を取得（管理者用・前後移動用）
        if (payslipData.companyId && payslipData.paymentDate) {
          const paymentDateObj = payslipData.paymentDate?.toDate?.() || payslipData.paymentDate;
          const paymentDateStr = paymentDateObj instanceof Date
            ? paymentDateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
            : String(payslipData.paymentDate);
          fetchSameDatePayslips(payslipData.companyId, paymentDateStr, payslipId);
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

  // 同じ支払日の明細一覧を取得する関数（管理者用・前後移動用）
  const fetchSameDatePayslips = async (companyId, paymentDateStr, currentPayslipId) => {
    if (userDetails?.role !== 'admin') return; // 管理者のみ

    try {
      const payslipsQuery = query(
        collection(db, "payslips"),
        where("companyId", "==", companyId)
      );

      const snapshot = await getDocs(payslipsQuery);

      if (!snapshot.empty) {
        // 支払日でフィルタリングし、従業員番号でソート
        const sameDate = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            paymentDate: doc.data().paymentDate?.toDate?.() || doc.data().paymentDate
          }))
          .filter(p => {
            const pDateStr = p.paymentDate instanceof Date
              ? p.paymentDate.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
              : String(p.paymentDate);
            return pDateStr === paymentDateStr;
          })
          .sort((a, b) => {
            // 従業員番号でソート（数値順）
            const aNum = parseInt(a.employeeId || '0', 10);
            const bNum = parseInt(b.employeeId || '0', 10);
            return aNum - bNum;
          });

        setSameDatePayslips(sameDate);

        // 現在の明細のインデックスを計算
        const index = sameDate.findIndex(p => p.id === currentPayslipId);
        setCurrentIndex(index);

        console.log(`📋 同じ支払日の明細: ${sameDate.length}件, 現在位置: ${index + 1}/${sameDate.length}`);
      }
    } catch (err) {
      console.error("同じ支払日の明細取得エラー:", err);
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

  // 支払日を取得するヘルパー
  const getPaymentDateStr = () => {
    if (!payslip?.paymentDate) return null;
    const dateObj = payslip.paymentDate instanceof Date
      ? payslip.paymentDate
      : payslip.paymentDate?.toDate?.() || new Date(payslip.paymentDate);
    return dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // 戻るボタンのハンドラ（支払日別一覧に戻る）
  const handleBack = () => {
    const paymentDateStr = getPaymentDateStr();
    const basePath = userDetails?.role === 'admin' ? '/admin/payslips' : '/employee/payslips';

    // 管理者の場合は支払日パラメータを付けて戻る
    if (userDetails?.role === 'admin' && paymentDateStr) {
      navigate(`${basePath}?paymentDate=${encodeURIComponent(paymentDateStr)}`);
    } else {
      navigate(basePath);
    }
  };

  // 前の明細に移動
  const handlePrev = () => {
    if (currentIndex > 0 && sameDatePayslips[currentIndex - 1]) {
      const prevId = sameDatePayslips[currentIndex - 1].id;
      const paymentDateStr = getPaymentDateStr();
      navigate(`/admin/payslips/${prevId}?paymentDate=${encodeURIComponent(paymentDateStr)}`);
    }
  };

  // 次の明細に移動
  const handleNext = () => {
    if (currentIndex < sameDatePayslips.length - 1 && sameDatePayslips[currentIndex + 1]) {
      const nextId = sameDatePayslips[currentIndex + 1].id;
      const paymentDateStr = getPaymentDateStr();
      navigate(`/admin/payslips/${nextId}?paymentDate=${encodeURIComponent(paymentDateStr)}`);
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
      <div className="mb-4 flex justify-between items-center print:hidden">
        {/* 左側: 戻るボタン */}
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          一覧に戻る
        </button>

        {/* 右側: 前後移動ボタンと印刷ボタン */}
        <div className="flex items-center space-x-2">
          {/* 管理者のみ前後移動ボタンを表示 */}
          {userDetails?.role === 'admin' && sameDatePayslips.length > 1 && (
            <div className="flex items-center space-x-1 mr-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex <= 0}
                className={`px-3 py-2 rounded flex items-center ${
                  currentIndex <= 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="前の明細"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                前へ
              </button>
              <span className="text-sm text-gray-500 px-2">
                {currentIndex + 1} / {sameDatePayslips.length}
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex >= sameDatePayslips.length - 1}
                className={`px-3 py-2 rounded flex items-center ${
                  currentIndex >= sameDatePayslips.length - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="次の明細"
              >
                次へ
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
          <button
            onClick={handlePrint}
            className="hidden md:flex px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
            </svg>
            印刷
          </button>
        </div>
      </div>

      {/* 給与明細プレビュー（全幅表示） */}
      <div>
        <div ref={printRef} className="bg-white rounded-lg shadow-md overflow-hidden p-6">
          <PayslipPreview payslipData={payslip} showDetailedInfo={true} />
        </div>
      </div>

      {/* 年収の壁ステータス（遅延読み込み） */}
      {payslip?.employeeId && (payslip?.companyId || userDetails?.companyId) && (
        <NenshuKabeStatus
          employeeId={payslip.employeeId}
          companyId={payslip.companyId || userDetails?.companyId}
        />
      )}

    </div>
  );
}

export default PayslipDetail;