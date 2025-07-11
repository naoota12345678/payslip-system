// src/pages/DataBackup.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  writeBatch,
  query,
  where 
} from 'firebase/firestore';

function DataBackup() {
  const { userDetails } = useAuth();
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [backupData, setBackupData] = useState(null);
  const [backupHistory, setBackupHistory] = useState([]);

  // バックアップ履歴を取得
  useEffect(() => {
    const fetchBackupHistory = async () => {
      try {
        const q = query(
          collection(db, 'dataBackups'),
          where('companyId', '==', userDetails.companyId)
        );
        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()
        })).sort((a, b) => b.createdAt - a.createdAt);
        
        setBackupHistory(history);
      } catch (err) {
        console.error('バックアップ履歴の取得エラー:', err);
      }
    };

    if (userDetails?.companyId) {
      fetchBackupHistory();
    }
  }, [userDetails]);

  // データバックアップ実行
  const performBackup = async () => {
    setBackupLoading(true);
    setBackupProgress(0);
    setMessage('バックアップを開始しています...');

    try {
      const companyId = userDetails.companyId;
      const collections = [
        'users', 
        'payslips', 
        'payrollItems', 
        'csvUploads',
        'departments',
        'companies'
      ];
      
      const backupResult = {
        timestamp: new Date().toISOString(),
        companyId,
        collections: {},
        metadata: {
          version: '1.0',
          totalRecords: 0
        }
      };

      for (let i = 0; i < collections.length; i++) {
        const collectionName = collections[i];
        setMessage(`${collectionName} コレクションをバックアップ中...`);
        
        try {
          let q;
          if (collectionName === 'companies') {
            q = query(collection(db, collectionName), where('__name__', '==', companyId));
          } else {
            q = query(collection(db, collectionName), where('companyId', '==', companyId));
          }
          
          const snapshot = await getDocs(q);
          const data = {};
          
          snapshot.forEach(doc => {
            const docData = doc.data();
            // Timestampをシリアライズ可能な形式に変換
            Object.keys(docData).forEach(key => {
              if (docData[key]?.toDate && typeof docData[key].toDate === 'function') {
                docData[key] = docData[key].toDate().toISOString();
              }
            });
            data[doc.id] = docData;
          });
          
          backupResult.collections[collectionName] = data;
          backupResult.metadata.totalRecords += snapshot.size;
          
        } catch (collectionError) {
          console.warn(`${collectionName} のバックアップでエラー:`, collectionError);
          backupResult.collections[collectionName] = {};
        }
        
        setBackupProgress(((i + 1) / collections.length) * 100);
      }

      // バックアップ履歴を保存
      const backupId = `backup_${Date.now()}`;
      await setDoc(doc(db, 'dataBackups', backupId), {
        companyId,
        createdAt: new Date(),
        recordCount: backupResult.metadata.totalRecords,
        collections: Object.keys(backupResult.collections),
        status: 'completed'
      });

      // ダウンロード可能な形で設定
      setBackupData(backupResult);
      setMessage(`バックアップが完了しました。総レコード数: ${backupResult.metadata.totalRecords}`);
      
      // バックアップ履歴を更新
      setBackupHistory(prev => [
        {
          id: backupId,
          companyId,
          createdAt: new Date(),
          recordCount: backupResult.metadata.totalRecords,
          collections: Object.keys(backupResult.collections),
          status: 'completed'
        },
        ...prev
      ]);

    } catch (err) {
      console.error('バックアップエラー:', err);
      setMessage(`バックアップに失敗しました: ${err.message}`);
    } finally {
      setBackupLoading(false);
      setBackupProgress(0);
    }
  };

  // バックアップファイルをダウンロード
  const downloadBackup = () => {
    if (!backupData) return;

    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `payslip_backup_${userDetails.companyId}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ファイルからデータ復元
  const handleFileRestore = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setRestoreLoading(true);
    setRestoreProgress(0);
    setMessage('復元ファイルを読み込み中...');

    try {
      const text = await file.text();
      const restoreData = JSON.parse(text);
      
      // バックアップファイルの妥当性チェック
      if (!restoreData.collections || !restoreData.companyId) {
        throw new Error('無効なバックアップファイルです');
      }

      if (restoreData.companyId !== userDetails.companyId) {
        const confirm = window.confirm(
          '異なる会社のバックアップファイルです。復元を続行しますか？'
        );
        if (!confirm) {
          setRestoreLoading(false);
          return;
        }
      }

      // データ復元実行
      const collections = Object.keys(restoreData.collections);
      const batchSize = 500; // Firestoreのバッチ制限

      for (let i = 0; i < collections.length; i++) {
        const collectionName = collections[i];
        const collectionData = restoreData.collections[collectionName];
        
        if (!collectionData || Object.keys(collectionData).length === 0) {
          continue;
        }

        setMessage(`${collectionName} コレクションを復元中...`);
        
        const docs = Object.entries(collectionData);
        
        // バッチ処理で復元
        for (let j = 0; j < docs.length; j += batchSize) {
          const batch = writeBatch(db);
          const batchDocs = docs.slice(j, j + batchSize);
          
          batchDocs.forEach(([docId, docData]) => {
            // ISO文字列をTimestampに戻す
            Object.keys(docData).forEach(key => {
              if (typeof docData[key] === 'string' && 
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(docData[key])) {
                docData[key] = new Date(docData[key]);
              }
            });
            
            const docRef = doc(db, collectionName, docId);
            batch.set(docRef, docData);
          });
          
          await batch.commit();
        }
        
        setRestoreProgress(((i + 1) / collections.length) * 100);
      }

      setMessage('データの復元が完了しました');
      
    } catch (err) {
      console.error('復元エラー:', err);
      setMessage(`復元に失敗しました: ${err.message}`);
    } finally {
      setRestoreLoading(false);
      setRestoreProgress(0);
      event.target.value = ''; // ファイル選択をクリア
    }
  };

  // 管理者権限チェック
  if (userDetails?.userType !== 'company_admin') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          このページにはアクセス権限がありません。
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">データバックアップ・復元</h1>
      
      {/* メッセージ表示 */}
      {message && (
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-6">
          {message}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* バックアップセクション */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">データバックアップ</h2>
          <p className="text-gray-600 mb-4">
            会社のすべてのデータをJSONファイルとしてダウンロードします。
          </p>
          
          <button
            onClick={performBackup}
            disabled={backupLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300 mb-4"
          >
            {backupLoading ? 'バックアップ中...' : 'バックアップ開始'}
          </button>
          
          {backupLoading && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${backupProgress}%` }}
              ></div>
            </div>
          )}
          
          {backupData && (
            <button
              onClick={downloadBackup}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
            >
              バックアップファイルをダウンロード
            </button>
          )}
        </div>

        {/* 復元セクション */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">データ復元</h2>
          <p className="text-gray-600 mb-4">
            バックアップファイルからデータを復元します。
          </p>
          
          <div className="mb-4">
            <input
              type="file"
              accept=".json"
              onChange={handleFileRestore}
              disabled={restoreLoading}
              className="w-full p-2 border border-gray-300 rounded"
            />
          </div>
          
          {restoreLoading && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div 
                className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${restoreProgress}%` }}
              ></div>
            </div>
          )}
          
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ 復元操作は既存のデータを上書きします。必要に応じて事前にバックアップを取得してください。
            </p>
          </div>
        </div>
      </div>

      {/* バックアップ履歴 */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">バックアップ履歴</h2>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {backupHistory.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    作成日時
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    レコード数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    コレクション
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ステータス
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {backupHistory.map((backup) => (
                  <tr key={backup.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {backup.createdAt?.toLocaleString('ja-JP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {backup.recordCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {backup.collections?.join(', ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        backup.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {backup.status === 'completed' ? '完了' : 'エラー'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-center text-gray-500">
              バックアップ履歴がありません
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataBackup; 