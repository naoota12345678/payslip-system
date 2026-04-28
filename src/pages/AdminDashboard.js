// src/pages/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs, Timestamp, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function AdminDashboard() {
  const { currentUser, userDetails } = useAuth();
  const [showAnnouncement, setShowAnnouncement] = useState(() => {
    return localStorage.getItem('hideNenshuKabeAnnouncement') !== 'true';
  });
  const [recentPayslips, setRecentPayslips] = useState([]);
  // const [recentUploads, setRecentUploads] = useState([]); // csvUploads削除のためコメントアウト
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalPayslips: 0,
    monthlyPayslips: 0,
    totalAmount: 0,
    totalNetAmount: 0,
    // 賞与用フィールド
    totalBonusPayslips: 0,
    bonusMonthlyPayslips: 0,
    bonusTotalAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // 管理者権限チェック
    if (userDetails?.role !== 'admin') {
      setError("このページへのアクセス権限がありません");
      setLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      if (!currentUser || !userDetails?.companyId) return;
      
      try {
        setLoading(true);
        setError('');
        
        await Promise.all([
          fetchRecentPayslips(),
          calculateStats()
        ]);
      } catch (err) {
        console.error("ダッシュボードデータの取得エラー:", err);
        setError("データの取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };
    
    // 最近の給与明細を取得
    const fetchRecentPayslips = async () => {
      try {
        console.log('🔍 AdminDashboard: payslipsクエリ実行中...', userDetails.companyId);
        const q = query(
          collection(db, "payslips"),
          where("companyId", "==", userDetails.companyId),
          orderBy("paymentDate", "desc"),
          limit(5)
        );
        
        const querySnapshot = await getDocs(q);
        const payslipList = [];
        
        querySnapshot.forEach((doc) => {
          payslipList.push({
            id: doc.id,
            ...doc.data(),
            paymentDate: doc.data().paymentDate?.toDate()
          });
        });
        
        setRecentPayslips(payslipList);
      } catch (err) {
        console.error("❌ AdminDashboard: 給与明細データの取得エラー:", err);
        console.error("エラー詳細:", {
          code: err.code,
          message: err.message,
          companyId: userDetails.companyId
        });
      }
    };
    
    // csvUploads削除のため、この関数は無効化
    // const fetchRecentUploads = async () => { ... };
    
    // 統計データ計算
    const calculateStats = async () => {
      try {
        // 全従業員数
        const employeesQuery = query(
          collection(db, "employees"),
          where("companyId", "==", userDetails.companyId)
        );
        const employeesSnapshot = await getDocs(employeesQuery);
        const totalEmployees = employeesSnapshot.size;
        
        // 給与明細の総数
        const allPayslipsQuery = query(
          collection(db, "payslips"),
          where("companyId", "==", userDetails.companyId)
        );
        const allPayslipsSnapshot = await getDocs(allPayslipsQuery);
        const totalPayslips = allPayslipsSnapshot.size;
        
        // 最新の支払日の給与明細を取得
        console.log('🔍 AdminDashboard: 最新の支払日を検索中...');
        const latestPaymentQuery = query(
          collection(db, "payslips"),
          where("companyId", "==", userDetails.companyId),
          orderBy("paymentDate", "desc"),
          limit(1)
        );
        const latestPaymentSnapshot = await getDocs(latestPaymentQuery);
        
        let monthlyPayslips = 0;
        let totalAmount = 0;
        let totalNetAmount = 0;
        
        if (!latestPaymentSnapshot.empty) {
          const latestPaymentDate = latestPaymentSnapshot.docs[0].data().paymentDate;
          console.log('🔍 AdminDashboard: 最新支払日の給与明細を取得中...', {
            paymentDate: latestPaymentDate?.toDate()
          });
          
          // 同じ支払日の全ての給与明細を取得
          const samePaymentDateQuery = query(
            collection(db, "payslips"),
            where("companyId", "==", userDetails.companyId),
            where("paymentDate", "==", latestPaymentDate)
          );
          const samePaymentDateSnapshot = await getDocs(samePaymentDateQuery);
          
          // uploadIdでグループ化して最新のuploadIdを特定
          const uploadGroups = {};
          let latestUploadId = null;

          console.log(`🔍 AdminDashboard: 同じ支払日の明細を分析中... (総明細数: ${samePaymentDateSnapshot.size})`);

          samePaymentDateSnapshot.forEach(doc => {
            const data = doc.data();
            const uploadId = data.uploadId;
            const uploadedAt = data.uploadedAt;

            if (!uploadGroups[uploadId]) {
              uploadGroups[uploadId] = {
                uploadedAt: uploadedAt,
                payslips: []
              };
            }
            uploadGroups[uploadId].payslips.push(data);
          });

          // グループ化後に最新のuploadIdを特定
          const uploadIds = Object.keys(uploadGroups);
          if (uploadIds.length > 0) {
            latestUploadId = uploadIds.reduce((latest, current) => {
              // uploadIdからタイムスタンプを抽出（upload_TIMESTAMP_RANDOM形式）
              const extractTimestamp = (uploadId) => {
                if (!uploadId || uploadId === 'undefined') return 0;
                const match = uploadId.match(/upload_(\d+)_/);
                return match ? parseInt(match[1]) : 0;
              };

              const latestTime = extractTimestamp(latest);
              const currentTime = extractTimestamp(current);

              console.log(`🔍 比較: ${latest} (${latestTime}) vs ${current} (${currentTime})`);

              return currentTime > latestTime ? current : latest;
            });
            console.log(`📊 最新のuploadIdを特定: ${latestUploadId}`);
          }
          
          // 最新のuploadIdのデータのみを集計
          if (latestUploadId && uploadGroups[latestUploadId]) {
            const latestPayslips = uploadGroups[latestUploadId].payslips;
            monthlyPayslips = latestPayslips.length;
            
            console.log(`📊 最新のアップロード(uploadId: ${latestUploadId})のみを集計中... (明細数: ${monthlyPayslips})`);

            // デバッグ: uploadId別の明細数とタイムスタンプを確認
            console.log(`📋 uploadGroups分析:`);
            Object.keys(uploadGroups).forEach(uid => {
              const uploadedAt = uploadGroups[uid].uploadedAt;
              const timestamp = uploadedAt?.toMillis?.() || uploadedAt?.seconds ? uploadedAt.seconds * 1000 : 0;
              const date = timestamp ? new Date(timestamp).toLocaleString('ja-JP') : '不明';
              console.log(`  - ${uid}: ${uploadGroups[uid].payslips.length}件 (アップロード: ${date}, タイムスタンプ: ${timestamp})`);
            });

            // デバッグ: 従業員IDの重複チェック
            const employeeIds = latestPayslips.map(d => d.employeeId);
            const uniqueEmployeeIds = [...new Set(employeeIds)];
            console.log(`👥 従業員ID: 全${employeeIds.length}件, ユニーク${uniqueEmployeeIds.length}件`);
            if (employeeIds.length !== uniqueEmployeeIds.length) {
              console.warn(`⚠️ 重複している従業員IDがあります！`);
              const duplicates = employeeIds.filter((id, index) => employeeIds.indexOf(id) !== index);
              console.warn(`重複ID: ${[...new Set(duplicates)].join(', ')}`);
            }

            // デバッグ: 最初と最後の5件を表示
            console.log(`📝 最初の5件:`);
            latestPayslips.slice(0, 5).forEach((data, i) => {
              console.log(`  ${i + 1}. 従業員${data.employeeId}: ¥${data.totalIncome?.toLocaleString()}`);
            });

            latestPayslips.forEach(data => {
              const income = data.totalIncome || 0;
              totalAmount += income;
              totalNetAmount += data.netAmount || 0;
            });
            console.log(`✅ 最新支払日の総支給額（重複除外）: ${totalAmount}, 手取り総額: ${totalNetAmount}`);
          } else {
            // uploadIdがない古いデータの場合は従来通り処理
            monthlyPayslips = samePaymentDateSnapshot.size;
            console.log(`⚠️ uploadIdが見つからないため、全明細を集計します (明細数: ${monthlyPayslips})`);
            
            samePaymentDateSnapshot.forEach(doc => {
              const data = doc.data();
              const income = data.totalIncome || 0;
              totalAmount += income;
              totalNetAmount += data.netAmount || 0;
              console.log(`従業員: ${data.employeeId}, 支給額: ${income}`);
            });
            console.log(`📊 最新支払日の総支給額: ${totalAmount}, 手取り総額: ${totalNetAmount}`);
          }
        } else {
          console.log('⚠️ AdminDashboard: 給与明細データがありません');
        }

        // ========== 賞与明細の統計計算（独立したtry-catchで給与に影響させない） ==========
        let totalBonusPayslips = 0;
        let bonusMonthlyPayslips = 0;
        let bonusTotalAmount = 0;

        try {
          console.log('🎁 AdminDashboard: 賞与明細の統計計算開始...');

          // 賞与明細の総数
          const allBonusQuery = query(
            collection(db, "bonusPayslips"),
            where("companyId", "==", userDetails.companyId)
          );
          const allBonusSnapshot = await getDocs(allBonusQuery);
          totalBonusPayslips = allBonusSnapshot.size;
          console.log(`📊 賞与明細総数: ${totalBonusPayslips}件`);

          // 最新の賞与支払日を取得
          const latestBonusQuery = query(
            collection(db, "bonusPayslips"),
            where("companyId", "==", userDetails.companyId),
            orderBy("paymentDate", "desc"),
            limit(1)
          );
          const latestBonusSnapshot = await getDocs(latestBonusQuery);

          if (!latestBonusSnapshot.empty) {
            const latestBonusPaymentDate = latestBonusSnapshot.docs[0].data().paymentDate;
            console.log('🎁 AdminDashboard: 最新賞与支払日の明細を取得中...', {
              paymentDate: latestBonusPaymentDate?.toDate()
            });

            // 同じ支払日の全ての賞与明細を取得
            const sameBonusPaymentDateQuery = query(
              collection(db, "bonusPayslips"),
              where("companyId", "==", userDetails.companyId),
              where("paymentDate", "==", latestBonusPaymentDate)
            );
            const sameBonusPaymentDateSnapshot = await getDocs(sameBonusPaymentDateQuery);

            // uploadIdでグループ化して最新のuploadIdを特定（給与と同じロジック）
            const bonusUploadGroups = {};
            let latestBonusUploadId = null;

            sameBonusPaymentDateSnapshot.forEach(doc => {
              const data = doc.data();
              const uploadId = data.uploadId;

              if (!bonusUploadGroups[uploadId]) {
                bonusUploadGroups[uploadId] = {
                  uploadedAt: data.uploadedAt,
                  payslips: []
                };
              }
              bonusUploadGroups[uploadId].payslips.push(data);
            });

            // 最新のuploadIdを特定
            const bonusUploadIds = Object.keys(bonusUploadGroups);
            if (bonusUploadIds.length > 0) {
              latestBonusUploadId = bonusUploadIds.reduce((latest, current) => {
                const extractTimestamp = (uploadId) => {
                  if (!uploadId || uploadId === 'undefined') return 0;
                  const match = uploadId.match(/upload_(\d+)_/);
                  return match ? parseInt(match[1]) : 0;
                };
                const latestTime = extractTimestamp(latest);
                const currentTime = extractTimestamp(current);
                return currentTime > latestTime ? current : latest;
              });
              console.log(`📊 最新の賞与uploadIdを特定: ${latestBonusUploadId}`);
            }

            // 最新のuploadIdのデータのみを集計
            if (latestBonusUploadId && bonusUploadGroups[latestBonusUploadId]) {
              const latestBonusPayslips = bonusUploadGroups[latestBonusUploadId].payslips;
              bonusMonthlyPayslips = latestBonusPayslips.length;

              latestBonusPayslips.forEach(data => {
                const income = data.totalIncome || 0;
                bonusTotalAmount += income;
              });
              console.log(`✅ 最新賞与支払日の総支給額（重複除外）: ${bonusTotalAmount}`);
            } else {
              // uploadIdがない古いデータの場合
              bonusMonthlyPayslips = sameBonusPaymentDateSnapshot.size;
              sameBonusPaymentDateSnapshot.forEach(doc => {
                const data = doc.data();
                bonusTotalAmount += data.totalIncome || 0;
              });
              console.log(`📊 最新賞与支払日の総支給額: ${bonusTotalAmount}`);
            }
          } else {
            console.log('⚠️ AdminDashboard: 賞与明細データがありません');
          }
        } catch (bonusErr) {
          console.error("❌ 賞与統計データの計算エラー（給与統計には影響なし）:", bonusErr);
        }

        setStats({
          totalEmployees,
          totalPayslips,
          monthlyPayslips,
          totalAmount,
          totalNetAmount,
          // 賞与統計
          totalBonusPayslips,
          bonusMonthlyPayslips,
          bonusTotalAmount
        });
      } catch (err) {
        console.error("統計データの計算エラー:", err);
      }
    };

    fetchDashboardData();
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
        <Link to="/" className="text-blue-600 hover:underline">ダッシュボードに戻る</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">管理ダッシュボード</h1>

      {/* 新機能お知らせ */}
      {showAnnouncement && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-base font-semibold text-blue-800 mb-2">新機能: 年収の壁ステータス</h3>
              <p className="text-sm text-blue-700 mb-2">
                従業員が給与明細画面で「年収の壁」との関係を確認できる機能を追加しました。
                累計収入と各壁（110万・123万・130万・150万・178万・201万円）の残り金額が表示されます。
              </p>
              <p className="text-sm text-blue-700 mb-1 font-medium">ご対応をお願いします:</p>
              <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                <li><strong>CSVマッピング設定 → 合計項目タブ</strong>で、総支給額にあたる項目に「総支給額」チェックを入れてください</li>
                <li><strong>CSVマッピング設定 → 支給項目タブ</strong>で、通勤手当にあたる項目に「通勤手当」チェックを入れてください</li>
              </ul>
              <p className="text-xs text-blue-500 mt-2">※ チェックを入れないと年収の壁の累計が正しく計算されません</p>
            </div>
            <button
              onClick={() => setShowAnnouncement(false)}
              className="text-blue-400 hover:text-blue-600 ml-4 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200 flex items-center justify-between">
            <label className="flex items-center text-sm text-blue-600 cursor-pointer">
              <input
                type="checkbox"
                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded"
                onChange={(e) => {
                  if (e.target.checked) {
                    localStorage.setItem('hideNenshuKabeAnnouncement', 'true');
                    setShowAnnouncement(false);
                  }
                }}
              />
              今後表示しない
            </label>
            <Link
              to="/admin/settings/csv-mapping"
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700"
            >
              CSVマッピング設定へ
            </Link>
          </div>
        </div>
      )}

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        {/* 従業員数 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">従業員数</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.totalEmployees}</p>
          <p className="text-sm text-gray-500 mt-2">
            登録済みユーザー数
          </p>
        </div>
        
        {/* 給与明細総数 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">給与明細総数</h3>
          <p className="text-2xl font-bold text-green-600">{stats.totalPayslips}</p>
          <p className="text-sm text-gray-500 mt-2">
            処理済み給与明細の総数
          </p>
        </div>
        
        {/* 最新支払日の支給数 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">最新支払日の支給数</h3>
          <p className="text-2xl font-bold text-indigo-600">{stats.monthlyPayslips}</p>
          <p className="text-sm text-gray-500 mt-2">
            最新支払日の給与明細件数
          </p>
        </div>
        
        {/* 最新支払日の支給総額 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">最新支払日の支給総額</h3>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalAmount)}</p>
          <p className="text-sm text-gray-500 mt-2">
            最新支払日の総支給額
          </p>
        </div>

        {/* 最新支払日の手取り総額 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">最新支払日の手取り総額</h3>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalNetAmount)}</p>
          <p className="text-sm text-gray-500 mt-2">
            最新支払日の差引支給額合計
          </p>
        </div>
      </div>

      {/* 賞与統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* 空欄（従業員数は上で表示済み） */}
        <div className="hidden md:block"></div>

        {/* 賞与明細総数 */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-400">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">賞与明細総数</h3>
          <p className="text-2xl font-bold text-yellow-600">{stats.totalBonusPayslips}</p>
          <p className="text-sm text-gray-500 mt-2">
            処理済み賞与明細の総数
          </p>
        </div>

        {/* 最新支払日の賞与支給数 */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-400">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">最新支払日の賞与支給数</h3>
          <p className="text-2xl font-bold text-yellow-600">{stats.bonusMonthlyPayslips}</p>
          <p className="text-sm text-gray-500 mt-2">
            最新支払日の賞与明細件数
          </p>
        </div>

        {/* 最新支払日の賞与支給総額 */}
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-400">
          <h3 className="text-sm font-medium text-gray-500 uppercase mb-1">最新支払日の賞与支給総額</h3>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.bonusTotalAmount)}</p>
          <p className="text-sm text-gray-500 mt-2">
            最新支払日の賞与総支給額
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 最近の給与明細 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">最近の給与明細</h3>
            <Link 
              to="/payslips" 
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              全て表示 →
            </Link>
          </div>
          
          {recentPayslips.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      従業員ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      支払日
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      支給額
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentPayslips.map((payslip) => (
                    <tr key={payslip.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {payslip.employeeId || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDate(payslip.paymentDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {formatCurrency(payslip.totalIncome)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          to={`/payslips/${payslip.id}`}
                          className="text-blue-600 hover:text-blue-900"
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
            <p className="text-gray-500 text-center py-4">給与明細データがありません</p>
          )}
        </div>
        
        {/* csvUploads削除のため、アップロード履歴セクションを削除 */}
      </div>
    </div>
  );
}

export default AdminDashboard;