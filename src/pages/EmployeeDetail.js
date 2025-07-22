// src/pages/EmployeeDetail.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function EmployeeDetail() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { userDetails } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

        // 部門情報を取得
        if (employeeData.departmentId) {
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
              <span className="text-gray-500 w-32">登録日:</span>
              <span className="font-medium">{formatDate(employee.createdAt)}</span>
            </div>
            <div className="flex">
              <span className="text-gray-500 w-32">最終更新:</span>
              <span className="font-medium">{formatDate(employee.updatedAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDetail; 