// src/pages/BonusPayslipDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import PayslipPreview from '../components/payslip/PayslipPreview';

function BonusPayslipDetail() {
  const { payslipId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userDetails } = useAuth();
  const [payslip, setPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [relatedPayslips, setRelatedPayslips] = useState([]);
  const [employeeInfo, setEmployeeInfo] = useState(null);
  const [departmentInfo, setDepartmentInfo] = useState(null);
  const [allDepartments, setAllDepartments] = useState([]);
  const [repairLoading, setRepairLoading] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('');

  // 賞与明細データと関連情報を取得
  useEffect(() => {
    const fetchBonusPayslipData = async () => {
      if (!payslipId || !currentUser) {
        setError("賞与明細IDまたはユーザー情報が不足しています");
        setLoading(false);
        return;
      }

      try {
        // 賞与明細データを取得
        const payslipRef = doc(db, "bonusPayslips", payslipId);
        const payslipDoc = await getDoc(payslipRef);

        if (!payslipDoc.exists()) {
          setError("指定された賞与明細は存在しません");
          setLoading(false);
          return;
        }

        const payslipData = payslipDoc.data();
        
        // アクセス権チェック
        const isAdmin = userDetails?.role === 'admin' || userDetails?.userType === 'company' || userDetails?.userType === 'company_admin';
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

        // 日付変換
        if (payslipData.paymentDate) {
          payslipData.paymentDate = payslipData.paymentDate.toDate();
        }
        
        setPayslip({
          ...payslipData,
          id: payslipId
        });



        // 従業員情報を取得（employeesコレクション対応）
        let employeeData = null;
        if (payslipData.userId) {
          const employeeRef = doc(db, 'employees', payslipData.userId);
          const employeeDoc = await getDoc(employeeRef);
          
          if (employeeDoc.exists()) {
            employeeData = employeeDoc.data();
            setEmployeeInfo(employeeData);
          }
        }
        
        // 従業員情報を取得（詳細版）
        if (payslipData.userId) {
          try {
            // 【修正】userIdから直接従業員情報を取得（employeesコレクション）
            const employeeRef = doc(db, 'employees', payslipData.userId);
            
            const employeeDoc = await getDoc(employeeRef);
            
            if (employeeDoc.exists()) {
              const empData = employeeDoc.data();
              setEmployeeInfo(empData);
            } else {
              // 🚨 緊急：employeesコレクション全体をチェック
              const allEmployeesSnapshot = await getDocs(collection(db, 'employees'));
              
              if (allEmployeesSnapshot.size > 0) {
                // 従業員情報が存在するが、該当ユーザーが見つからない
              } else {
                // employeesコレクションが空
              }
            }
          } catch (empError) {
            // 従業員情報取得エラー
          }
        }

        // 🔍 DEBUG: 部門情報を確認
        if (payslipData.companyId) {
          try {
            // 全部門データを取得
            const departmentsQuery = query(
              collection(db, 'departments'),
              where('companyId', '==', payslipData.companyId)
            );
            const departmentsSnapshot = await getDocs(departmentsQuery);
            const departmentsData = departmentsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            setAllDepartments(departmentsData);
            
            // 該当する部門を検索
            if (payslipData.departmentCode) {
              const matchingDepartment = departmentsData.find(dept => {
                const deptCode = dept.code;
                return deptCode === payslipData.departmentCode || 
                       String(deptCode) === String(payslipData.departmentCode) ||
                       Number(deptCode) === Number(payslipData.departmentCode);
              });
              
              setDepartmentInfo(matchingDepartment);
            }
          } catch (deptError) {
            console.error('[BonusPayslipDetail Debug] 部門情報取得エラー:', deptError);
          }
        }

        // 関連する賞与明細を取得（同じ従業員の他の期の明細）
        if (payslipData.userId) {
          try {
            const payslipsQuery = query(
              collection(db, 'bonusPayslips'),
              where('userId', '==', payslipData.userId),
              where('companyId', '==', payslipData.companyId)
            );
            
            const payslipsSnapshot = await getDocs(payslipsQuery);
            const relatedList = [];
            
            payslipsSnapshot.forEach(doc => {
              const data = doc.data();
              if (doc.id !== payslipId) {
                relatedList.push({
                  id: doc.id,
                  ...data,
                  paymentDate: data.paymentDate?.toDate() || new Date()
                });
              }
            });
            
            // 日付順でソート（新しい順）
            relatedList.sort((a, b) => b.paymentDate - a.paymentDate);
            setRelatedPayslips(relatedList);
            
          } catch (relatedError) {
            console.error('関連賞与明細取得エラー:', relatedError);
          }
        }

      } catch (err) {
        console.error("賞与明細データの取得エラー:", err);
        setError("賞与明細データの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchBonusPayslipData();
  }, [payslipId, currentUser, userDetails]);

  // データ修復機能
  const handleDataRepair = () => {
    setShowRepairModal(true);
  };

  const performDataRepair = async () => {
    if (!payslip || !payslipId) return;
    
    setRepairLoading(true);
    try {
      const updateData = {};
      
      // 従業員IDの修復
      if (!payslip.employeeId && employeeInfo?.employeeNumber) {
        updateData.employeeId = employeeInfo.employeeNumber;
      }
      
      // 部門コードの修復
      if (!payslip.departmentCode && selectedDepartment) {
        updateData.departmentCode = selectedDepartment;
      }
      
      if (Object.keys(updateData).length > 0) {
        // Firestoreを更新
        const payslipRef = doc(db, 'bonusPayslips', payslipId);
        await updateDoc(payslipRef, updateData);
        
        // ローカル状態も更新
        setPayslip(prev => ({
          ...prev,
          ...updateData
        }));
        
        alert('データの修復が完了しました！ページを更新して確認してください。');
        setShowRepairModal(false);
        
        // ページを更新
        window.location.reload();
      } else {
        alert('修復するデータがありません。');
      }
    } catch (error) {
      console.error('[修復エラー]', error);
      alert('データの修復中にエラーが発生しました: ' + error.message);
    } finally {
      setRepairLoading(false);
    }
  };

  // 印刷機能
  const handlePrint = () => {
    window.open(`/bonus-payslips/${payslipId}/print`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          戻る
        </button>
      </div>
    );
  }

  if (!payslip) {
    return <div className="text-center py-8">賞与明細データがありません</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            戻る
          </button>
          <h1 className="text-2xl font-bold">賞与明細詳細</h1>
          {employeeInfo && (
            <p className="text-gray-600 mt-2">
              {employeeInfo?.name || employeeInfo?.displayName || '-'} 
              {(employeeInfo?.employeeNumber || employeeInfo?.employeeId) && 
                ` (従業員番号: ${employeeInfo?.employeeNumber || employeeInfo?.employeeId})`}
              {departmentInfo?.name && ` | ${departmentInfo?.name}`}
            </p>
          )}
          {payslip.paymentDate && (
            <p className="text-gray-600 mt-1">
              支払日: {payslip.paymentDate.toLocaleDateString('ja-JP')}
            </p>
          )}
        </div>

        <div className="space-x-3">
          <button
            onClick={handlePrint}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            印刷
          </button>
        </div>
      </div>

      {/* 🔍 DEBUG: データ確認エリア */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <details>
          <summary className="cursor-pointer font-bold text-yellow-800">
            🔍 部門表示デバッグ情報（問題調査用）
          </summary>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <strong>賞与明細の部門情報:</strong>
              <div className="bg-white p-2 rounded">
                部門コード: {payslip?.departmentCode || '未設定'} (型: {typeof payslip?.departmentCode})
              </div>
            </div>
            
            <div>
              <strong>検索された部門:</strong>
              <div className="bg-white p-2 rounded">
                {departmentInfo ? `${departmentInfo.name} (コード: ${departmentInfo.code})` : '見つかりません'}
              </div>
            </div>
            
            <div>
              <strong>全部門一覧:</strong>
              <div className="bg-white p-2 rounded max-h-32 overflow-y-auto">
                {allDepartments.length > 0 ? (
                  allDepartments.map(dept => (
                    <div key={dept.id} className="text-xs">
                      {dept.name} (コード: {dept.code}, 型: {typeof dept.code})
                    </div>
                  ))
                ) : (
                  '部門データが見つかりません'
                )}
              </div>
            </div>
            
            <div>
              <strong>従業員情報:</strong>
              <div className="bg-white p-2 rounded">
                ID: {employeeInfo?.employeeId || employeeInfo?.employeeNumber || '未設定'}, 
                名前: {employeeInfo?.displayName || employeeInfo?.name || '未設定'}
              </div>
            </div>

            {/* 📝 データ修復ボタン */}
            {(!payslip?.departmentCode || !payslip?.employeeId) && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <strong className="text-blue-800">🔧 データ修復:</strong>
                <p className="text-sm text-blue-700 mb-2">
                  この賞与明細には部門コードまたは従業員IDが保存されていません。修復できます。
                </p>
                <button
                  onClick={handleDataRepair}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  disabled={loading}
                >
                  データを修復する
                </button>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* 賞与明細プレビュー（賞与専用版が必要） */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <PayslipPreview 
          payslipData={payslip} 
          showDetailedInfo={true}
          userDetails={userDetails}
          payslipType="bonus"
        />
      </div>
        
      {/* 関連する賞与明細 */}
      {relatedPayslips.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">同じ従業員の他の賞与明細</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    支払日
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    支給合計
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    控除合計
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    差引支給額
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {relatedPayslips.slice(0, 5).map((relatedPayslip) => (
                  <tr key={relatedPayslip.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {relatedPayslip.paymentDate.toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ¥{(relatedPayslip.totalIncome || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      ¥{(relatedPayslip.totalDeduction || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      ¥{(relatedPayslip.netAmount || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link 
                        to={`/bonus-payslips/${relatedPayslip.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        詳細を見る
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {relatedPayslips.length > 5 && (
            <p className="text-gray-500 text-sm mt-3">
              他に {relatedPayslips.length - 5} 件の賞与明細があります
            </p>
          )}
        </div>
      )}

      {/* データ修復モーダル */}
      {showRepairModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">賞与明細データの修復</h3>
            
            <div className="space-y-4">
              {!payslip?.employeeId && employeeInfo?.employeeNumber && (
                <div>
                  <p className="text-sm text-gray-600">
                    従業員ID: <span className="font-medium">{employeeInfo.employeeNumber}</span> を設定します
                  </p>
                </div>
              )}
              
              {!payslip?.departmentCode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    部門を選択してください:
                  </label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">部門を選択...</option>
                    {allDepartments.map(dept => (
                      <option key={dept.id} value={dept.code}>
                        {dept.name} ({dept.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowRepairModal(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                disabled={repairLoading}
              >
                キャンセル
              </button>
              <button
                onClick={performDataRepair}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={repairLoading || (!payslip?.departmentCode && !selectedDepartment)}
              >
                {repairLoading ? '修復中...' : '修復実行'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* デバッグ情報（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 rounded-lg p-4 mt-6">
          <h4 className="font-semibold mb-2">デバッグ情報</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify({
              payslipId: payslip.id,
              userId: payslip.userId,
              companyId: payslip.companyId,
              itemCount: payslip.items ? Object.keys(payslip.items).length : 0
            }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default BonusPayslipDetail; 