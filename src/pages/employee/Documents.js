// src/pages/employee/Documents.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, or } from 'firebase/firestore';
import { db } from '../../firebase';

function EmployeeDocuments() {
  const { userDetails, currentUser } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!userDetails?.companyId || !userDetails?.employeeId) return;

      try {
        setLoading(true);
        
        // 一斉配信と個人宛の書類を取得
        const q = query(
          collection(db, 'documents'),
          where('companyId', '==', userDetails.companyId),
          where('status', '==', 'active')
        );
        
        const querySnapshot = await getDocs(q);
        const docs = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // 一斉配信または自分宛の書類のみ表示
          if (data.type === 'broadcast' || 
              (data.assignments && data.assignments[userDetails.employeeId])) {
            docs.push({ id: doc.id, ...data });
          }
        });
        
        // 日付でソート
        docs.sort((a, b) => {
          const dateA = a.uploadedAt?.toDate ? a.uploadedAt.toDate() : new Date(a.uploadedAt);
          const dateB = b.uploadedAt?.toDate ? b.uploadedAt.toDate() : new Date(b.uploadedAt);
          return dateB - dateA;
        });
        
        setDocuments(docs);
      } catch (err) {
        console.error('書類取得エラー:', err);
        setError('書類の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [userDetails]);

  // 日付フォーマット
  const formatDate = (date) => {
    if (!date) return 'N/A';
    if (date.toDate) return date.toDate().toLocaleDateString('ja-JP');
    return new Date(date).toLocaleDateString('ja-JP');
  };

  // 書類タイプの表示
  const getDocumentTypeIcon = (type) => {
    switch (type) {
      case 'broadcast': return '📢';
      case 'individual': return '📄';
      case 'bulk_individual': return '📑';
      default: return '📄';
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">書類一覧</h1>
          <p className="text-sm text-gray-600 mt-1">
            会社から配信された書類を確認できます
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* 書類一覧 */}
        <div className="space-y-4">
          {documents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              現在、配信された書類はありません
            </div>
          ) : (
            documents.map((doc) => {
              const isPersonal = doc.type !== 'broadcast';
              const personalFile = isPersonal && doc.assignments?.[userDetails.employeeId];
              
              return (
                <div 
                  key={doc.id} 
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">
                          {getDocumentTypeIcon(doc.type)}
                        </span>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {doc.title}
                          </h3>
                          <p className="text-sm text-gray-500">
                            配信日: {formatDate(doc.uploadedAt)}
                          </p>
                          {isPersonal && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                              個人宛
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      {(doc.fileUrl || personalFile?.fileUrl) ? (
                        <a
                          href={personalFile?.fileUrl || doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          表示
                        </a>
                      ) : (
                        <span className="text-sm text-gray-500">
                          ファイル準備中
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {doc.description && (
                    <p className="mt-2 text-sm text-gray-600">
                      {doc.description}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* テスト版の説明 */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-1">
            📌 書類配信機能について
          </h3>
          <p className="text-sm text-blue-700">
            現在、読み取り専用のテスト版です。今後、より多くの機能が追加される予定です。
          </p>
        </div>
      </div>
    </div>
  );
}

export default EmployeeDocuments;