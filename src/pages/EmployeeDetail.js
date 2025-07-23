// src/pages/EmployeeDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

function EmployeeDetail() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { userDetails } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    const fetchEmployee = async () => {
      if (!employeeId || !userDetails?.companyId) {
        setError('必要な情報が不足しています');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        // 従業員情報を取得
        const employeeDoc = await getDoc(doc(db, 'employees', employeeId));
        
        if (!employeeDoc.exists()) {
          setError('指定された従業員が見つかりません');
          setLoading(false);
          return;
        }

        const employeeData = employeeDoc.data();

        // 会社IDチェック（セキュリティ）
        if (employeeData.companyId !== userDetails.companyId) {
          setError('この従業員の情報を閲覧する権限がありません');
          setLoading(false);
          return;
        }

        setEmployee({ id: employeeDoc.id, ...employeeData });

        // 部門情報を取得（departmentCodeベース）
        if (employeeData.departmentCode) {
          // 部門コードから部門情報を検索
          const departmentsQuery = query(
            collection(db, 'departments'),
            where('companyId', '==', userDetails.companyId),
            where('code', '==', employeeData.departmentCode)
          );
          const departmentsSnapshot = await getDocs(departmentsQuery);
          if (!departmentsSnapshot.empty) {
            setDepartment(departmentsSnapshot.docs[0].data());
          }
        } else if (employeeData.departmentId) {
          // 旧形式（departmentId）の後方互換性
          const departmentDoc = await getDoc(doc(db, 'departments', employeeData.departmentId));
          if (departmentDoc.exists()) {
            setDepartment(departmentDoc.data());
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('従業員詳細取得エラー:', err);
        setError('従業員情報の取得中にエラーが発生しました');
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId, userDetails]);

  // 日付フォーマット関数
  const formatDate = (date) => {
    if (!date) return 'N/A';
    if (date.toDate) return date.toDate().toLocaleDateString('ja-JP');
    return new Date(date).toLocaleDateString('ja-JP');
  };

  // ステータス表示用関数
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'preparation':
        return { text: '準備中', color: 'bg-gray-100 text-gray-800', description: '招待メール未送信' };
      case 'invited':
        return { text: '招待送信済み', color: 'bg-blue-100 text-blue-800', description: '初回ログイン待ち' };
      case 'auth_created':
        return { text: 'ログイン可能', color: 'bg-yellow-100 text-yellow-800', description: 'パスワード変更待ち' };
      case 'active':
        return { text: 'アクティブ', color: 'bg-green-100 text-green-800', description: '利用開始済み' };
      default:
        return { text: '不明', color: 'bg-gray-100 text-gray-800', description: '' };
    }
  };

  // 招待メール送信処理
  const handleSendInvitation = async () => {
    if (!employee || !employee.email || !employee.tempPassword) {
      alert('従業員情報が不完全です。');
      return;
    }

    try {
      setInviteLoading(true);
      
      console.log('🔧 招待メール送信処理開始:', {
        email: employee.email,
        name: employee.name,
        status: employee.status
      });

      // Firebase Authenticationユーザーを作成
      const userCredential = await createUserWithEmailAndPassword(auth, employee.email, employee.tempPassword);
      const user = userCredential.user;
      
      console.log('✅ Firebase Authユーザー作成完了:', user.uid);

      // Firestoreでステータスを更新
      await updateDoc(doc(db, 'employees', employeeId), {
        uid: user.uid,
        status: 'auth_created',
        invitedAt: new Date(),
        updatedAt: new Date()
      });

      // 従業員データを更新
      setEmployee(prev => ({
        ...prev,
        uid: user.uid,
        status: 'auth_created',
        invitedAt: new Date()
      }));

      alert(`招待処理が完了しました！\n\n✅ Firebase Authenticationユーザーを作成\n✅ 従業員ステータスを「ログイン可能」に更新\n\n【次のステップ】\n従業員に以下をお伝えください：\n• ログインページ: ${window.location.origin}/employee/login\n• 初回ログイン用のパスワードは別途お知らせします\n\n※実際の招待メール送信機能は今後実装予定です`);
      
    } catch (error) {
      console.error('❌ 招待メール送信エラー:', error);
      
      let errorMessage = '招待の送信に失敗しました';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'このメールアドレスは既に使用されています';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'パスワードが弱すぎます';
      }
      
      alert(errorMessage + '\n\nエラー: ' + (error.message || '不明なエラー'));
    } finally {
      setInviteLoading(false);
    }
  };

  // 再送信処理
  const handleResendInvitation = () => {
    if (!employee) return;
    
    const message = `【従業員ログイン情報】\nメールアドレス: ${employee.email}\n仮パスワード: ${employee.tempPassword}\n\nログインページ: ${window.location.origin}/employee/login\n\nこの情報を従業員にお伝えください。`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(message);
      alert('ログイン情報をクリップボードにコピーしました。\n従業員にお伝えください。');
    } else {
      alert(message);
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
          onClick={() => navigate('/admin/employees')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          従業員一覧に戻る
        </button>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">従業員データが見つかりません</p>
        <button
          onClick={() => navigate('/admin/employees')}
          className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          従業員一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">従業員詳細</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => navigate('/admin/employees')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            一覧に戻る
          </button>
          <Link
            to={`/admin/employees/${employeeId}/edit`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            編集
          </Link>
        </div>
      </div>

      {/* 従業員プロフィールカード */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-16 w-16 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-2xl text-gray-600 font-semibold">
                {employee.name ? employee.name.charAt(0) : 'N'}
              </span>
            </div>
            <div className="ml-6">
              <h2 className="text-xl font-semibold">{employee.name || 'N/A'}</h2>
              <p className="text-gray-600">{employee.email || 'N/A'}</p>
              <p className="text-sm text-gray-500">従業員ID: {employee.employeeId || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 詳細情報 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 基本情報 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">基本情報</h3>
          <div className="space-y-3">
            <div className="flex">
              <span className="text-gray-500 w-32">氏名:</span>
              <span className="font-medium">{employee.name || 'N/A'}</span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">従業員ID:</span>
              <span className="font-medium">{employee.employeeId || 'N/A'}</span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">メール:</span>
              <span className="font-medium">{employee.email || 'N/A'}</span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">電話番号:</span>
              <span className="font-medium">{employee.phone || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* 職務情報 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">職務情報</h3>
          <div className="space-y-3">
            <div className="flex">
              <span className="text-gray-500 w-32">部門:</span>
              <span className="font-medium">{department?.name || 'N/A'}</span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">役職:</span>
              <span className="font-medium">{employee.position || 'N/A'}</span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">職種:</span>
              <span className="font-medium">{employee.jobType || 'N/A'}</span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">契約形態:</span>
              <span className="font-medium">{employee.contractType || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* その他の情報 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">その他の情報</h3>
          <div className="space-y-3">
            <div className="flex">
              <span className="text-gray-500 w-32">性別:</span>
              <span className="font-medium">
                {employee.gender === 1 ? '男性' : employee.gender === 2 ? '女性' : 'N/A'}
              </span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">生年月日:</span>
              <span className="font-medium">{employee.birthDate || 'N/A'}</span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">入社日:</span>
              <span className="font-medium">{employee.hireDate || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* システム情報 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">システム情報</h3>
          <div className="space-y-3">
            <div className="flex">
              <span className="text-gray-500 w-32">ステータス:</span>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusDisplay(employee.status || 'preparation').color}`}>
                  {getStatusDisplay(employee.status || 'preparation').text}
                </span>
                <span className="text-sm text-gray-500">
                  {getStatusDisplay(employee.status || 'preparation').description}
                </span>
              </div>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">登録日:</span>
              <span className="font-medium">{formatDate(employee.createdAt)}</span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">最終更新:</span>
              <span className="font-medium">{formatDate(employee.updatedAt)}</span>
            </div>
            {employee.invitedAt && (
              <div className="flex">
                <span className="text-gray-500 w-32">招待送信日:</span>
                <span className="font-medium">{formatDate(employee.invitedAt)}</span>
              </div>
            )}
          </div>
          
          {/* 招待ボタンセクション */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            {employee.status === 'preparation' && (
              <div className="space-y-2">
                <button
                  onClick={handleSendInvitation}
                  disabled={inviteLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviteLoading ? '送信中...' : '🚀 招待メール送信'}
                </button>
                <p className="text-sm text-gray-500">
                  従業員がログイン可能になり、ログイン情報が表示されます
                </p>
              </div>
            )}
            
            {(employee.status === 'auth_created' || employee.status === 'invited') && (
              <div className="space-y-2">
                <button
                  onClick={handleResendInvitation}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  📋 ログイン情報をコピー
                </button>
                <p className="text-sm text-gray-500">
                  従業員にログイン情報を再度お伝えできます
                </p>
              </div>
            )}
            
            {employee.status === 'active' && (
              <div className="space-y-2">
                <span className="inline-flex items-center px-3 py-2 rounded-md bg-green-50 text-green-800">
                  ✅ 従業員は既にシステムを利用開始しています
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDetail; 