// src/pages/admin/PdfDelivery.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';

function PdfDeliveryManagement() {
  const { userDetails, currentUser } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // アップロード関連の状態
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [uploading, setUploading] = useState(false);

  // テスト会社かどうかのチェック
  const isTestCompany = userDetails?.companyId?.includes('test-') || false;

  // 従業員データを取得
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!userDetails?.companyId) return;

      try {
        const q = query(
          collection(db, 'employees'),
          where('companyId', '==', userDetails.companyId),
          where('isActive', '==', true)
        );
        
        const querySnapshot = await getDocs(q);
        const employeesData = [];
        querySnapshot.forEach((doc) => {
          employeesData.push({ id: doc.id, ...doc.data() });
        });
        
        setEmployees(employeesData);
      } catch (err) {
        console.error('従業員データ取得エラー:', err);
      }
    };

    fetchEmployees();
  }, [userDetails]);

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!userDetails?.companyId) return;

      try {
        setLoading(true);
        const q = query(
          collection(db, 'documents'),
          where('companyId', '==', userDetails.companyId),
          orderBy('uploadedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const docs = [];
        querySnapshot.forEach((doc) => {
          docs.push({ id: doc.id, ...doc.data() });
        });
        
        setDocuments(docs);
      } catch (err) {
        console.error('ドキュメント取得エラー:', err);
        setError('ドキュメントの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [userDetails]);

  // 配信タイプの日本語表示
  const getDeliveryTypeLabel = (type) => {
    switch (type) {
      case 'broadcast': return '一斉配信';
      case 'individual': return '個別配信';
      case 'bulk_individual': return '一括個別配信';
      default: return type;
    }
  };

  // 日付フォーマット
  const formatDate = (date) => {
    if (!date) return 'N/A';
    if (date.toDate) return date.toDate().toLocaleDateString('ja-JP');
    return new Date(date).toLocaleDateString('ja-JP');
  };

  // ファイル選択処理
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // PDF形式チェック
    if (file.type !== 'application/pdf') {
      setError('PDFファイルのみアップロード可能です');
      return;
    }

    // ファイルサイズチェック（50KB-400KB推奨、最大10MB）
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB > 10240) {
      setError('ファイルサイズは10MB以下にしてください');
      return;
    }

    if (fileSizeKB < 50) {
      console.warn('ファイルサイズが50KB未満です。内容が正しく表示されない可能性があります。');
    } else if (fileSizeKB > 400) {
      console.warn('ファイルサイズが400KBを超えています。表示に時間がかかる可能性があります。');
    }

    setSelectedFile(file);
    setError(null);
  };

  // 個別配信の実行
  const handleIndividualDelivery = async () => {
    if (!selectedFile || !documentTitle || selectedEmployees.length === 0) {
      setError('ファイル、タイトル、配信対象従業員を全て選択してください');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // ファイルをFirebase Storageにアップロード
      const timestamp = Date.now();
      const fileName = `individual_${timestamp}_${selectedFile.name}`;
      const storageRef = ref(storage, `documents/${userDetails.companyId}/${fileName}`);
      
      const uploadResult = await uploadBytes(storageRef, selectedFile);
      const fileUrl = await getDownloadURL(uploadResult.ref);

      // 個別配信用のassignmentsオブジェクトを作成
      const assignments = {};
      selectedEmployees.forEach(empId => {
        assignments[empId] = {
          fileUrl: fileUrl,
          fileName: selectedFile.name
        };
      });

      // ドキュメントデータを保存
      const documentData = {
        companyId: userDetails.companyId,
        title: documentTitle,
        type: 'individual',
        status: 'active',
        uploadedAt: serverTimestamp(),
        assignments: assignments,
        totalRecipients: selectedEmployees.length
      };

      await addDoc(collection(db, 'documents'), documentData);

      // リセット
      setShowUploadModal(false);
      setSelectedFile(null);
      setDocumentTitle('');
      setSelectedEmployees([]);

      // ドキュメント一覧を再取得
      window.location.reload();

    } catch (err) {
      console.error('個別配信エラー:', err);
      setError('配信に失敗しました: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              PDF配信管理
              {isTestCompany && (
                <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                  テスト環境
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              従業員への書類配信を管理します - 個別配信機能が利用可能
            </p>
          </div>
          
          {/* 個別配信ボタン */}
          <button 
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            onClick={() => setShowUploadModal(true)}
            disabled={uploading}
          >
            個別配信
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* ドキュメント一覧 */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  配信日
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  タイトル
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  配信タイプ
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  対象者数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                    配信された書類はありません
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(doc.uploadedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {getDeliveryTypeLabel(doc.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {doc.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.type === 'broadcast' ? '全員' : 
                       doc.type === 'individual' ? `${doc.totalRecipients || Object.keys(doc.assignments || {}).length}名` :
                       doc.type === 'bulk_individual' ? `${Object.keys(doc.assignments || {}).length}名` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                        詳細
                      </button>
                      {doc.fileUrl && (
                        <a 
                          href={doc.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          表示
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 今後の実装予定 */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-2">実装状況：</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• ✅ 個別配信機能</li>
            <li>• ⏳ 一斉配信・一括個別配信</li>
            <li>• ⏳ 配信履歴と閲覧状況の確認</li>
            <li>• ⏳ メール通知機能</li>
            <li>• ⏳ 2年後自動削除機能</li>
          </ul>
        </div>

        {/* 個別配信アップロードモーダル */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">個別配信 - 新規書類アップロード</h3>
                  <button 
                    onClick={() => setShowUploadModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* ファイル選択 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDFファイル選択
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    PDF形式のみ。推奨サイズ: 50KB-400KB（最大10MB）
                  </p>
                  {selectedFile && (
                    <p className="mt-2 text-sm text-green-600">
                      選択済み: {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
                    </p>
                  )}
                </div>

                {/* 書類タイトル */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    書類タイトル
                  </label>
                  <input
                    type="text"
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    placeholder="例：労働契約書"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* 従業員選択 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    配信対象従業員を選択 ({selectedEmployees.length}/{employees.length}名選択)
                  </label>
                  <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
                    {employees.length === 0 ? (
                      <p className="p-3 text-sm text-gray-500">従業員データが見つかりません</p>
                    ) : (
                      employees.map((emp) => (
                        <label 
                          key={emp.employeeId} 
                          className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(emp.employeeId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEmployees([...selectedEmployees, emp.employeeId]);
                              } else {
                                setSelectedEmployees(selectedEmployees.filter(id => id !== emp.employeeId));
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-3 text-sm">
                            {emp.name} ({emp.employeeId}) - {emp.department || '未設定'}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEmployees(employees.map(emp => emp.employeeId))}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      全選択
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEmployees([])}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      全解除
                    </button>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    disabled={uploading}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleIndividualDelivery}
                    disabled={!selectedFile || !documentTitle || selectedEmployees.length === 0 || uploading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {uploading ? '配信中...' : '配信実行'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfDeliveryManagement;