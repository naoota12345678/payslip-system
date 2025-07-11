// src/pages/UserDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { userDetails: currentUserDetails } = useAuth();
  
  const [user, setUser] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId || !currentUserDetails?.companyId) {
        setError('ユーザー情報または会社情報が取得できませんでした');
        setLoading(false);
        return;
      }
      
      try {
        // ユーザー情報を取得
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);
        
        if (!userDoc.exists()) {
          setError('指定されたユーザーが見つかりません');
          setLoading(false);
          return;
        }
        
        const userData = userDoc.data();
        
        // ユーザーが同じ会社に所属しているか確認（セキュリティチェック）
        if (userData.companyId !== currentUserDetails.companyId) {
          setError('このユーザーの情報を閲覧する権限がありません');
          setLoading(false);
          return;
        }
        
        // 日付を変換
        if (userData.createdAt) {
          userData.createdAt = userData.createdAt.toDate();
        }
        if (userData.updatedAt) {
          userData.updatedAt = userData.updatedAt.toDate();
        }
        
        setUser({
          id: userDoc.id,
          ...userData
        });
        
        // 部門情報を取得（部門IDがある場合）
        if (userData.departmentId) {
          try {
            const deptRef = doc(db, 'departments', userData.departmentId);
            const deptDoc = await getDoc(deptRef);
            
            if (deptDoc.exists()) {
              setUser(prevUser => ({
                ...prevUser,
                departmentName: deptDoc.data().name
              }));
            }
          } catch (deptErr) {
            console.error('部門情報取得エラー:', deptErr);
            // 部門情報の取得失敗は致命的ではないので処理続行
          }
        }
        
        // 最近の給与明細を取得
        if (userData.employeeId) {
          try {
            const payslipsQuery = query(
              collection(db, 'payslips'),
              where('companyId', '==', currentUserDetails.companyId),
              where('employeeId', '==', userData.employeeId),
              orderBy('paymentDate', 'desc'),
              limit(5)
            );
            
            const payslipsSnapshot = await getDocs(payslipsQuery);
            
            const payslipsList = payslipsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              paymentDate: doc.data().paymentDate?.toDate()
            }));
            
            setPayslips(payslipsList);
          } catch (payslipErr) {
            console.error('給与明細取得エラー:', payslipErr);
            // 給与明細の取得失敗は致命的ではないので処理続行
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error('ユーザー情報取得エラー:', err);
        setError('ユーザー情報の取得中にエラーが発生しました');
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [userId, currentUserDetails]);
  
  // 日付フォーマット関数
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('ja-JP');
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
  
  // ユーザー種別の表示用
  const getUserTypeDisplay = () => {
    if (!user) return null;
    
    if (user.userType === 'company_admin' || user.role === 'admin') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          管理者
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          従業員
        </span>
      );
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
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-4">
          {error}
        </div>
        <button
          onClick={() => navigate('/users')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          ユーザー一覧に戻る
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">ユーザーデータが見つかりません</p>
        <button
          onClick={() => navigate('/users')}
          className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          ユーザー一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">ユーザー詳細</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => navigate('/users')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            一覧に戻る
          </button>
          <Link
            to={`/users/${userId}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            編集
          </Link>
        </div>
      </div>
      
      {/* ユーザープロフィールカード */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-2xl text-gray-600 font-semibold">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-6">
              <h2 className="text-xl font-semibold">{user.displayName || user.email}</h2>
              <div className="flex items-center mt-1">
                <p className="text-gray-600">{user.email}</p>
                <div className="ml-3">{getUserTypeDisplay()}</div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 border-t pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium mb-4">基本情報</h3>
                <div className="space-y-3">
                  {user.employeeId && (
                    <div className="flex">
                      <span className="text-gray-500 w-32">従業員ID:</span>
                      <span className="font-medium">{user.employeeId}</span>
                    </div>
                  )}
                  {user.departmentName && (
                    <div className="flex">
                      <span className="text-gray-500 w-32">部門:</span>
                      <span className="font-medium">{user.departmentName}</span>
                    </div>
                  )}
                  {user.position && (
                    <div className="flex">
                      <span className="text-gray-500 w-32">役職:</span>
                      <span className="font-medium">{user.position}</span>
                    </div>
                  )}
                  {user.phone && (
                    <div className="flex">
                      <span className="text-gray-500 w-32">電話番号:</span>
                      <span className="font-medium">{user.phone}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-4">アカウント情報</h3>
                <div className="space-y-3">
                  <div className="flex">
                    <span className="text-gray-500 w-32">ユーザータイプ:</span>
                    <span className="font-medium">
                      {user.userType === 'company_admin' || user.role === 'admin' 
                        ? '管理者' 
                        : '従業員'}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-32">登録日:</span>
                    <span className="font-medium">{formatDate(user.createdAt)}</span>
                  </div>
                  {user.updatedAt && (
                    <div className="flex">
                      <span className="text-gray-500 w-32">最終更新日:</span>
                      <span className="font-medium">{formatDate(user.updatedAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 給与明細履歴（従業員IDがある場合のみ表示） */}
      {user.employeeId && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">給与明細履歴</h3>
            
            {payslips.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        支払日
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        支給額
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        控除額
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        差引支給額
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payslips.map((payslip) => (
                      <tr key={payslip.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatDate(payslip.paymentDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatCurrency(payslip.totalIncome)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatCurrency(payslip.totalDeduction)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {formatCurrency(payslip.netAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link to={`/payslips/${payslip.id}`} className="text-blue-600 hover:text-blue-900">
                            詳細
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">給与明細データはありません</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDetail;