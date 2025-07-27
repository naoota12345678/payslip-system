// src/pages/EmployeeForm.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, functions } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';

function EmployeeForm() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { currentUser, userDetails } = useAuth();
  
  // 編集モードかどうか
  const isEditMode = !!employeeId;
  
  // フォームの状態
  const [employeeData, setEmployeeData] = useState({
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    position: '',
    jobType: '',
    contractType: '',
    gender: '',
    birthDate: '',
    hireDate: '',
    departmentCode: ''
  });
  
  // UI状態
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);

  // 部門データを取得
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!userDetails?.companyId) return;
      
      try {
        const departmentsQuery = query(
          collection(db, 'departments'),
          where('companyId', '==', userDetails.companyId)
        );
        
        const snapshot = await getDocs(departmentsQuery);
        const departmentsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setDepartments(departmentsList);
      } catch (err) {
        console.error('部門データ取得エラー:', err);
      }
    };
    
    fetchDepartments();
  }, [userDetails]);

  // 編集モードの場合、従業員データを取得
  useEffect(() => {
    const fetchEmployeeData = async () => {
      if (!isEditMode || !userDetails?.companyId) {
        setInitialLoading(false);
        return;
      }
      
      try {
        const employeeDoc = await getDoc(doc(db, 'employees', employeeId));
        
        if (!employeeDoc.exists()) {
          setError('指定された従業員が見つかりません');
          setInitialLoading(false);
          return;
        }
        
        const data = employeeDoc.data();
        
        // 会社IDチェック（セキュリティ）
        if (data.companyId !== userDetails.companyId) {
          setError('この従業員の情報を編集する権限がありません');
          setInitialLoading(false);
          return;
        }
        
        // フォームに値をセット（部門変換は後で実行）
        setEmployeeData({
          employeeId: data.employeeId || '',
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          position: data.position || '',
          jobType: data.jobType || '',
          contractType: data.contractType || '',
          gender: data.gender ? String(data.gender) : '',
          birthDate: data.birthDate || '',
          hireDate: data.hireDate || '',
          departmentCode: data.departmentCode || '', // 初期値として設定
          // 部門変換用の情報を保持
          _originalDepartmentId: data.departmentId || ''
        });
        
        setInitialLoading(false);
      } catch (err) {
        console.error('従業員データ取得エラー:', err);
        setError('従業員情報の取得中にエラーが発生しました');
        setInitialLoading(false);
      }
    };
    
    fetchEmployeeData();
  }, [isEditMode, employeeId, userDetails]);

  // 部門データ読み込み後の部門変換処理
  useEffect(() => {
    if (departments.length > 0 && employeeData._originalDepartmentId && !employeeData.departmentCode) {
      // departmentIdが設定されているが、departmentCodeが設定されていない場合の変換
      const matchingDept = departments.find(dept => dept.id === employeeData._originalDepartmentId);
      if (matchingDept) {
        console.log('部門ID→部門コード変換:', employeeData._originalDepartmentId, '→', matchingDept.code);
        setEmployeeData(prev => ({
          ...prev,
          departmentCode: matchingDept.code || '',
          _originalDepartmentId: '' // 変換完了後にクリア
        }));
      }
    }
  }, [departments, employeeData._originalDepartmentId, employeeData.departmentCode]);
  
  // フォーム送信ハンドラ
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 最初にデバッグ情報を表示
    const debugInfo = {
      authUID: currentUser?.uid,
      userDetailsUID: userDetails?.uid,
      companyId: userDetails?.companyId,
      role: userDetails?.role,
      userType: userDetails?.userType,
      isEditMode: isEditMode,
      employeeId: employeeId
    };
    
    alert(`認証デバッグ情報:
Auth UID: ${debugInfo.authUID}
userDetails UID: ${debugInfo.userDetailsUID}
会社ID: ${debugInfo.companyId}
role: ${debugInfo.role}
userType: ${debugInfo.userType}
編集モード: ${debugInfo.isEditMode}
対象ID: ${debugInfo.employeeId}`);
    
    // 入力検証
    if (!employeeData.name || !employeeData.employeeId || !employeeData.email) {
      setError('氏名、従業員ID、メールアドレスは必須項目です');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      // 保存用データを準備（_originalDepartmentIdを除外）
      const { _originalDepartmentId, ...cleanEmployeeData } = employeeData;
      const saveData = {
        ...cleanEmployeeData,
        gender: cleanEmployeeData.gender ? parseInt(cleanEmployeeData.gender) : null,
        companyId: userDetails.companyId,
        updatedAt: new Date()
      };
      
      if (isEditMode) {
        // 編集対象の従業員データを事前に取得してcompanyIdを確認
        const targetEmployeeDoc = await getDoc(doc(db, 'employees', employeeId));
        const targetEmployeeData = targetEmployeeDoc.data();
        
        alert(`編集対象の従業員情報:
従業員companyId: ${targetEmployeeData?.companyId}
管理者companyId: ${userDetails?.companyId}
companyID一致: ${targetEmployeeData?.companyId === userDetails?.companyId}
対象従業員名: ${targetEmployeeData?.name}`);
        
        // 既存従業員の更新
        await updateDoc(doc(db, 'employees', employeeId), saveData);
        alert('従業員情報を更新しました');
        navigate('/admin/employees');
      } else {
        // 新規従業員の作成 - Firebase Functionsを使用
        saveData.createdAt = new Date();
        saveData.status = 'active'; // ステータス: アクティブ
        saveData.isFirstLogin = true; // 初回ログインフラグ
        saveData.userType = 'employee'; // 従業員タイプ（固定）
        saveData.role = 'employee'; // 従業員ロール（固定）
        saveData.isActive = true; // アクティブフラグ
        
        console.log('🔧 新規従業員作成:', {
          email: saveData.email,
          name: saveData.name,
          status: 'active'
        });
        
        // Firebase Functionsを呼び出してアカウント作成
        const createEmployeeAccount = httpsCallable(functions, 'createEmployeeAccount');
        const result = await createEmployeeAccount({
          email: saveData.email,
          name: saveData.name,
          employeeData: saveData
        });
        
        console.log('✅ 従業員アカウント作成結果:', result.data);
        
        // 詳細デバッグ情報を表示
        const debugMessage = `従業員登録結果:
${result.data.success ? '✅ 成功' : '❌ 失敗'}

📧 ログイン情報:
メール: ${saveData.email}
パスワード: ${result.data.testPassword}

🔍 デバッグ情報:
UID: ${result.data.uid}
メッセージ: ${result.data.message || 'なし'}

※テスト用の固定パスワードです
※Firestoreのemployeesコレクションも確認してください`;

        alert(debugMessage);
        
        navigate('/admin/employees');
      }
    } catch (err) {
      console.error('従業員保存エラー:', err);
      setError('従業員情報の保存中にエラーが発生しました: ' + (err.message || '不明なエラー'));
    } finally {
      setLoading(false);
    }
  };

  // 入力フィールド変更ハンドラ
  const handleInputChange = (field, value) => {
    setEmployeeData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (initialLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {isEditMode ? '従業員情報編集' : '新規従業員登録'}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEditMode ? '従業員情報を編集してください' : '新しい従業員の情報を入力してください'}
        </p>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 基本情報 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">基本情報</h3>
              
              <div>
                <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
                  従業員ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="employeeId"
                  value={employeeData.employeeId}
                  onChange={(e) => handleInputChange('employeeId', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={employeeData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={employeeData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  ログイン用のメールアドレスです。テスト用パスワード「000000」でログイン可能になります。
                </p>
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  電話番号
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={employeeData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                  性別
                </label>
                <select
                  id="gender"
                  value={employeeData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">-- 選択してください --</option>
                  <option value="1">男性</option>
                  <option value="2">女性</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700">
                  生年月日
                </label>
                <input
                  type="date"
                  id="birthDate"
                  value={employeeData.birthDate}
                  onChange={(e) => handleInputChange('birthDate', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            {/* 職務情報 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2">職務情報</h3>
              
              <div>
                <label htmlFor="departmentCode" className="block text-sm font-medium text-gray-700">
                  部門
                </label>
                <select
                  id="departmentCode"
                  value={employeeData.departmentCode}
                  onChange={(e) => handleInputChange('departmentCode', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">-- 部門を選択 --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.code}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                  役職
                </label>
                <input
                  type="text"
                  id="position"
                  value={employeeData.position}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="jobType" className="block text-sm font-medium text-gray-700">
                  職種
                </label>
                <input
                  type="text"
                  id="jobType"
                  value={employeeData.jobType}
                  onChange={(e) => handleInputChange('jobType', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="contractType" className="block text-sm font-medium text-gray-700">
                  契約形態
                </label>
                <select
                  id="contractType"
                  value={employeeData.contractType}
                  onChange={(e) => handleInputChange('contractType', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">-- 選択してください --</option>
                  <option value="正社員">正社員</option>
                  <option value="契約社員">契約社員</option>
                  <option value="パート">パート</option>
                  <option value="アルバイト">アルバイト</option>
                  <option value="派遣">派遣</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="hireDate" className="block text-sm font-medium text-gray-700">
                  入社日
                </label>
                <input
                  type="date"
                  id="hireDate"
                  value={employeeData.hireDate}
                  onChange={(e) => handleInputChange('hireDate', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="mt-8 flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate(isEditMode ? `/admin/employees/${employeeId}` : '/admin/employees')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              disabled={loading}
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              {loading ? '保存中...' : (isEditMode ? '更新' : '登録')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeForm; 