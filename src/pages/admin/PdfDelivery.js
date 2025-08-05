// src/pages/admin/PdfDelivery.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

function PdfDeliveryManagement() {
  const { userDetails, currentUser } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // テスト会社かどうかのチェック
  const isTestCompany = userDetails?.companyId?.includes('test-') || false;

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
              従業員への書類配信を管理します（読み取り専用テスト版）
            </p>
          </div>
          
          {/* 将来的にアップロードボタンを追加 */}
          <button 
            className="px-4 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed"
            disabled
          >
            新規配信（準備中）
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
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
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
          <h3 className="text-sm font-medium text-gray-900 mb-2">今後の実装予定：</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• PDFアップロード機能</li>
            <li>• 一斉配信・個別配信・一括個別配信</li>
            <li>• 配信履歴と閲覧状況の確認</li>
            <li>• メール通知機能</li>
            <li>• 2年後自動削除機能</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default PdfDeliveryManagement;