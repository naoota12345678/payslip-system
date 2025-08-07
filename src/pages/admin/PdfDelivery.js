// src/pages/admin/PdfDelivery.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, addDoc, updateDoc, doc, limit, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../firebase';

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
  
  // 一括個別配信関連の状態
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [bulkTitle, setBulkTitle] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);
  const [matchedFiles, setMatchedFiles] = useState([]);
  const [unmatchedFiles, setUnmatchedFiles] = useState([]);
  
  // 詳細表示関連の状態
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [recipientDetails, setRecipientDetails] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

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
      if (!userDetails?.companyId) {
        console.log('❌ companyIdが見つかりません:', userDetails);
        return;
      }

      try {
        setLoading(true);
        console.log('📄 配信履歴取得開始 - companyId:', userDetails.companyId);
        
        const q = query(
          collection(db, 'documents'),
          where('companyId', '==', userDetails.companyId),
          orderBy('uploadedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        console.log('📄 Firestore検索結果:', querySnapshot.size, '件');
        
        const docs = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('📄 取得書類:', { id: doc.id, title: data.title, type: data.type, uploadedAt: data.uploadedAt });
          docs.push({ id: doc.id, ...data });
        });
        
        console.log('📄 最終書類リスト:', docs);
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

  // 従業員番号をファイル名から抽出する関数
  const extractEmployeeIdFromFilename = (filename) => {
    // ファイル名から従業員番号を抽出（様々なパターンに対応）
    // 例: "001.pdf", "emp001.pdf", "社員001_源泉徴収票.pdf", "123.pdf" など
    const patterns = [
      /^(\d+)/,                     // 数字で始まる: "001.pdf", "123.pdf"
      /emp(\d+)/i,                  // emp + 数字: "emp001.pdf"
      /社員(\d+)/,                   // 社員 + 数字: "社員001.pdf"
      /従業員(\d+)/,                 // 従業員 + 数字: "従業員001.pdf"
      /[_-](\d+)/,                  // アンダースコア/ハイフン + 数字: "doc_001.pdf"
      /(\d+)[_-]/,                  // 数字 + アンダースコア/ハイフン: "001_source.pdf"
      /番号(\d+)/                    // 番号 + 数字: "番号001.pdf"
    ];
    
    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        const extractedId = match[1];
        // ゼロ埋めを除去して数値として正規化
        const normalizedId = parseInt(extractedId, 10).toString();
        console.log(`📄 ファイル名「${filename}」から従業員番号「${normalizedId}」を抽出`);
        return normalizedId;
      }
    }
    
    console.warn(`⚠️ ファイル名「${filename}」から従業員番号を抽出できませんでした`);
    return null;
  };
  
  // 従業員番号と従業員IDをマッチング
  const findEmployeeByNumber = (employeeNumber) => {
    return employees.find(emp => {
      // 完全一致
      if (emp.employeeId === employeeNumber) return true;
      
      // ゼロ埋めパターンのチェック（2〜8桁）
      for (let digits = 2; digits <= 8; digits++) {
        if (emp.employeeId === employeeNumber.padStart(digits, '0')) return true;
      }
      
      // 数値変換での一致（両方向）
      if (parseInt(emp.employeeId, 10).toString() === employeeNumber) return true;
      if (emp.employeeId === parseInt(employeeNumber, 10).toString()) return true;
      
      return false;
    });
  };

  // ファイル選択処理（個別配信用）
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
  
  // 一括ファイル選択処理（一括個別配信用）
  const handleBulkFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    console.log(`📄 ${files.length}個のファイルが選択されました`);
    
    // PDF形式チェック
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    const nonPdfFiles = files.filter(file => file.type !== 'application/pdf');
    
    if (nonPdfFiles.length > 0) {
      console.warn(`⚠️ PDF以外のファイルがスキップされました: ${nonPdfFiles.map(f => f.name).join(', ')}`);
    }
    
    if (pdfFiles.length === 0) {
      setError('PDFファイルが見つかりませんでした');
      return;
    }
    
    // ファイルサイズチェック
    const oversizedFiles = pdfFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      setError(`以下のファイルが10MBを超えています: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }
    
    setSelectedFiles(pdfFiles);
    
    // ファイル名から従業員番号を抽出してマッチング
    const matched = [];
    const unmatched = [];
    
    pdfFiles.forEach(file => {
      const employeeNumber = extractEmployeeIdFromFilename(file.name);
      if (employeeNumber) {
        const employee = findEmployeeByNumber(employeeNumber);
        if (employee) {
          matched.push({ 
            file, 
            employee, 
            employeeNumber,
            status: 'matched'
          });
        } else {
          unmatched.push({ 
            file, 
            employeeNumber, 
            status: 'no_employee',
            reason: `従業員番号 ${employeeNumber} に該当する従業員が見つかりません`
          });
        }
      } else {
        unmatched.push({ 
          file, 
          employeeNumber: null, 
          status: 'no_pattern',
          reason: 'ファイル名から従業員番号を抽出できません'
        });
      }
    });
    
    setMatchedFiles(matched);
    setUnmatchedFiles(unmatched);
    
    console.log(`📄 マッチング結果: 成功 ${matched.length}件, 失敗 ${unmatched.length}件`);
    
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

      const docRef = await addDoc(collection(db, 'documents'), documentData);

      // メール通知送信
      try {
        const sendNotification = httpsCallable(functions, 'sendDocumentDeliveryNotification');
        const notificationResult = await sendNotification({
          documentId: docRef.id,
          documentTitle: documentTitle,
          recipientEmployeeIds: selectedEmployees
        });
        
        console.log('📧 通知メール送信結果:', notificationResult.data);
      } catch (emailError) {
        console.error('📧 通知メール送信エラー:', emailError);
        // メール送信失敗は配信成功を妨げない
      }

      // リセット
      setShowUploadModal(false);
      setSelectedFile(null);
      setDocumentTitle('');
      setSelectedEmployees([]);

      // ドキュメント一覧を再取得（リロードではなく関数呼び出し）
      console.log('📄 配信完了 - 履歴を再取得します');
      setTimeout(() => {
        window.location.reload();
      }, 1000); // 1秒後にリロード（データベース同期待ち）

    } catch (err) {
      console.error('個別配信エラー:', err);
      setError('配信に失敗しました: ' + err.message);
    } finally {
      setUploading(false);
    }
  };
  
  // 一括個別配信の実行
  const handleBulkIndividualDelivery = async () => {
    if (matchedFiles.length === 0 || !bulkTitle) {
      setError('マッチングされたファイルとタイトルが必要です');
      return;
    }
    
    try {
      setBulkUploading(true);
      setError(null);
      
      console.log(`📄 一括個別配信開始: ${matchedFiles.length}件`);
      
      // 各ファイルをStorageにアップロードし、assignmentsを作成
      const assignments = {};
      const timestamp = Date.now();
      let uploadCount = 0;
      
      for (const matchedFile of matchedFiles) {
        try {
          // ファイルをFirebase Storageにアップロード
          const fileName = `bulk_individual_${timestamp}_${matchedFile.employee.employeeId}_${matchedFile.file.name}`;
          const storageRef = ref(storage, `documents/${userDetails.companyId}/${fileName}`);
          
          const uploadResult = await uploadBytes(storageRef, matchedFile.file);
          const fileUrl = await getDownloadURL(uploadResult.ref);
          
          // assignmentsに追加
          assignments[matchedFile.employee.employeeId] = {
            fileUrl: fileUrl,
            fileName: matchedFile.file.name
          };
          
          uploadCount++;
          console.log(`📄 アップロード完了 (${uploadCount}/${matchedFiles.length}): ${matchedFile.employee.name}`);
          
        } catch (fileError) {
          console.error(`📄 ファイルアップロードエラー (${matchedFile.file.name}):`, fileError);
          // 個別ファイルのエラーは全体の処理を停止しない
        }
      }
      
      if (Object.keys(assignments).length === 0) {
        throw new Error('すべてのファイルのアップロードに失敗しました');
      }
      
      // ドキュメントデータを保存
      const documentData = {
        companyId: userDetails.companyId,
        title: bulkTitle,
        type: 'bulk_individual',
        status: 'active',
        uploadedAt: serverTimestamp(),
        assignments: assignments,
        totalRecipients: Object.keys(assignments).length,
        originalFileCount: matchedFiles.length,
        successfulUploads: Object.keys(assignments).length
      };
      
      const docRef = await addDoc(collection(db, 'documents'), documentData);
      
      // メール通知送信
      try {
        const sendNotification = httpsCallable(functions, 'sendDocumentDeliveryNotification');
        const notificationResult = await sendNotification({
          documentId: docRef.id,
          documentTitle: bulkTitle,
          recipientEmployeeIds: Object.keys(assignments)
        });
        
        console.log('📧 一括配信通知メール送信結果:', notificationResult.data);
      } catch (emailError) {
        console.error('📧 一括配信通知メール送信エラー:', emailError);
        // メール送信失敗は配信成功を妨げない
      }
      
      // 成功メッセージ表示
      alert(`一括個別配信が完了しました\n\n配信成功: ${Object.keys(assignments).length}件\n元ファイル数: ${matchedFiles.length}件`);
      
      // リセット
      setShowBulkModal(false);
      setSelectedFiles([]);
      setBulkTitle('');
      setMatchedFiles([]);
      setUnmatchedFiles([]);
      
      // 画面を更新
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (err) {
      console.error('一括個別配信エラー:', err);
      setError('一括配信に失敗しました: ' + err.message);
    } finally {
      setBulkUploading(false);
    }
  };

  // 配信取り消し処理
  const handleCancelDelivery = async (documentId, documentTitle) => {
    if (!window.confirm(`「${documentTitle}」の配信を取り消しますか？\n\n取り消し後は従業員から見えなくなります。`)) {
      return;
    }

    try {
      setCancelling(true);
      
      // ドキュメントのstatusをcancelledに更新
      const docRef = doc(db, 'documents', documentId);
      await updateDoc(docRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        cancelledBy: userDetails.employeeId || currentUser.uid
      });

      console.log('📄 配信取り消し完了:', documentId);
      
      // 画面を更新
      setShowDetailModal(false);
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (err) {
      console.error('配信取り消しエラー:', err);
      setError('配信の取り消しに失敗しました: ' + err.message);
    } finally {
      setCancelling(false);
    }
  };

  // 配信対象者の詳細情報を取得
  const fetchRecipientDetails = async (document) => {
    if (document.type === 'broadcast') {
      // 一斉配信の場合は全従業員（今後実装時）
      setRecipientDetails([{ name: '全従業員', employeeId: 'all', department: '全部署' }]);
      return;
    }

    if (!document.assignments) {
      setRecipientDetails([]);
      return;
    }

    try {
      setLoadingRecipients(true);
      const employeeIds = Object.keys(document.assignments);
      const recipientList = [];

      // 各従業員IDの詳細情報を取得
      for (const employeeId of employeeIds) {
        const q = query(
          collection(db, 'employees'),
          where('employeeId', '==', employeeId),
          where('companyId', '==', userDetails.companyId),
          limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const employeeData = querySnapshot.docs[0].data();
          recipientList.push({
            employeeId: employeeData.employeeId,
            name: employeeData.name || '不明',
            department: employeeData.department || '未設定',
            email: employeeData.email || '未設定'
          });
        } else {
          // 従業員が見つからない場合
          recipientList.push({
            employeeId: employeeId,
            name: '従業員が見つかりません',
            department: '未設定',
            email: '未設定'
          });
        }
      }

      setRecipientDetails(recipientList);
    } catch (err) {
      console.error('配信対象者情報取得エラー:', err);
      setRecipientDetails([]);
    } finally {
      setLoadingRecipients(false);
    }
  };

  // 詳細表示
  const handleShowDetail = async (document) => {
    console.log('📄 詳細ボタンがクリックされました:', document);
    console.log('📄 モーダル表示状態を変更します');
    setSelectedDocument(document);
    setShowDetailModal(true);
    
    // 配信対象者の詳細情報を取得
    await fetchRecipientDetails(document);
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
          
          {/* PDF配信ボタン */}
          <div className="flex gap-2">
            <button 
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              onClick={() => setShowUploadModal(true)}
              disabled={uploading || bulkUploading}
            >
              📄 個別配信
            </button>
            <button 
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              onClick={() => setShowBulkModal(true)}
              disabled={uploading || bulkUploading}
            >
              📦 一括個別配信
            </button>
          </div>
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
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        doc.status === 'cancelled' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {doc.status === 'cancelled' ? '取り消し済み' : '配信中'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {doc.type === 'broadcast' ? '全員' : 
                       doc.type === 'individual' ? `${doc.totalRecipients || Object.keys(doc.assignments || {}).length}名` :
                       doc.type === 'bulk_individual' ? `${Object.keys(doc.assignments || {}).length}名` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => {
                          console.log('📄 詳細ボタンクリック開始');
                          handleShowDetail(doc);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
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

        {/* 実装状況 */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900 mb-2">実装状況：</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• ✅ 個別配信機能（従業員選択式）</li>
            <li>• ✅ 一括個別配信機能（ファイル名自動マッチング）</li>
            <li>• ✅ 配信履歴と詳細確認</li>
            <li>• ✅ メール通知機能</li>
            <li>• ⏳ 一斉配信機能</li>
            <li>• ⏳ 2年後自動削除機能</li>
          </ul>
        </div>

        {/* 一括個別配信モーダル */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">📦 一括個別配信 - ファイル名自動マッチング</h3>
                  <button 
                    onClick={() => setShowBulkModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* 説明 */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <h4 className="font-medium text-blue-900 mb-1">📋 使用方法</h4>
                  <ul className="text-blue-700 space-y-1">
                    <li>• ファイル名に従業員番号を含むPDFファイルを選択してください</li>
                    <li>• 対応パターン: "001.pdf", "emp001.pdf", "社員001_源泉.pdf" など</li>
                    <li>• フォルダ選択または複数ファイル選択（Ctrl+A）に対応</li>
                    <li>• 自動的に従業員とマッチングし、個別配信を実行します</li>
                  </ul>
                </div>

                {/* ファイル選択 */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PDFファイル選択
                  </label>
                  <div className="mb-3">
                    <label className="block">
                      <span className="text-xs text-gray-600 mb-1 block">📄 複数ファイル選択（Ctrl+Aで全選択可）</span>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".pdf"
                          multiple
                          onChange={handleBulkFileSelect}
                          id="file-multiple"
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                        />
                      </div>
                    </label>
                  </div>
                  <div className="mb-3">
                    <label className="block">
                      <span className="text-xs text-gray-600 mb-1 block">📁 フォルダ選択（フォルダ内のPDFを一括選択）</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => document.getElementById('folder-select').click()}
                          className="px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-sm font-semibold hover:bg-purple-100"
                        >
                          ファイル選択
                        </button>
                        <input
                          type="file"
                          webkitdirectory=""
                          onChange={handleBulkFileSelect}
                          id="folder-select"
                          className="hidden"
                        />
                        {selectedFiles.length > 0 && (
                          <span className="ml-3 text-sm text-gray-600">
                            {selectedFiles.length}個のファイルが選択されています
                          </span>
                        )}
                      </div>
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    PDF形式のみ。推奨サイズ: 50KB-400KB（最大10MB）
                  </p>
                </div>
                
                {/* 書類タイトル */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    書類タイトル
                  </label>
                  <input
                    type="text"
                    value={bulkTitle}
                    onChange={(e) => setBulkTitle(e.target.value)}
                    placeholder="例：令和5年度源泉徴収票"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* マッチング結果 */}
                {(matchedFiles.length > 0 || unmatchedFiles.length > 0) && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">
                      📊 マッチング結果 (選択ファイル数: {selectedFiles.length})
                    </h4>
                    
                    {/* 成功したマッチング */}
                    {matchedFiles.length > 0 && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                        <h5 className="text-sm font-medium text-green-800 mb-2">
                          ✅ 配信対象 ({matchedFiles.length}件)
                        </h5>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {matchedFiles.map((match, index) => (
                            <div key={index} className="text-xs text-green-700 flex justify-between">
                              <span>📄 {match.file.name}</span>
                              <span>→ {match.employee.name} ({match.employee.employeeId})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 失敗したマッチング */}
                    {unmatchedFiles.length > 0 && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <h5 className="text-sm font-medium text-yellow-800 mb-2">
                          ⚠️ 配信対象外 ({unmatchedFiles.length}件)
                        </h5>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {unmatchedFiles.map((unmatch, index) => (
                            <div key={index} className="text-xs text-yellow-700">
                              <div>📄 {unmatch.file.name}</div>
                              <div className="ml-4 text-yellow-600">理由: {unmatch.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* アクションボタン */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowBulkModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    disabled={bulkUploading}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleBulkIndividualDelivery}
                    disabled={matchedFiles.length === 0 || !bulkTitle || bulkUploading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {bulkUploading ? '一括配信中...' : `📦 一括個別配信実行 (${matchedFiles.length}件)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 個別配信アップロードモーダル */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">📄 PDF書類配信 - アップロード</h3>
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
                  <div className="mt-2 flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedEmployees(employees.map(emp => emp.employeeId))}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                    >
                      🌐 全員選択 ({employees.length}名)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedEmployees([])}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                    >
                      全解除
                    </button>
                  </div>
                  
                  {/* 一斉配信の説明 */}
                  {selectedEmployees.length === employees.length && employees.length > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                      💡 <strong>一斉配信モード:</strong> 全従業員 ({employees.length}名) に同じ書類が配信されます
                    </div>
                  )}
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
                    {uploading ? '配信中...' : 
                     selectedEmployees.length === employees.length && employees.length > 0 ?
                     `📢 一斉配信実行 (${selectedEmployees.length}名)` :
                     `📄 個別配信実行 (${selectedEmployees.length}名)`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 配信詳細モーダル */}
        {console.log('📄 モーダル表示判定:', { showDetailModal, hasSelectedDocument: !!selectedDocument })}
        {showDetailModal && selectedDocument && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">配信詳細</h3>
                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 基本情報 */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-3">📋 基本情報</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">書類名:</span>
                      <p className="mt-1">{selectedDocument.title}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">配信タイプ:</span>
                      <p className="mt-1">{getDeliveryTypeLabel(selectedDocument.type)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">配信日時:</span>
                      <p className="mt-1">{formatDate(selectedDocument.uploadedAt)}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">ステータス:</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedDocument.status === 'cancelled' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {selectedDocument.status === 'cancelled' ? '取り消し済み' : '配信中'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 対象者情報 */}
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    👥 配信対象者 ({selectedDocument.totalRecipients || Object.keys(selectedDocument.assignments || {}).length}名)
                  </h4>
                  
                  {selectedDocument.type === 'broadcast' ? (
                    <div className="text-sm">
                      <p className="text-green-700 font-medium">🌐 全従業員対象</p>
                      <p className="text-gray-600 text-xs mt-1">※ アクティブな全従業員に配信されます</p>
                    </div>
                  ) : (
                    <div className="text-sm">
                      {loadingRecipients ? (
                        <p className="text-gray-600">📋 対象者情報を取得中...</p>
                      ) : recipientDetails.length > 0 ? (
                        <div className="space-y-2">
                          {recipientDetails.map((recipient, index) => (
                            <div 
                              key={recipient.employeeId}
                              className="flex items-center justify-between bg-white rounded p-2 border"
                            >
                              <div className="flex items-center">
                                <span className="text-green-600 mr-2">✓</span>
                                <div>
                                  <span className="font-medium text-gray-900">
                                    {recipient.name} ({recipient.employeeId})
                                  </span>
                                  <div className="text-xs text-gray-500">
                                    {recipient.department} • {recipient.email}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-600">対象者情報が見つかりません</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 取り消し情報 */}
                {selectedDocument.status === 'cancelled' && (
                  <div className="bg-red-50 rounded-lg p-4 mb-4">
                    <h4 className="font-medium text-red-900 mb-2">🚫 取り消し情報</h4>
                    <div className="text-sm text-red-700">
                      <p>取り消し日時: {formatDate(selectedDocument.cancelledAt)}</p>
                      {selectedDocument.cancelledBy && (
                        <p>取り消し実行者: {selectedDocument.cancelledBy}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* アクションボタン */}
                <div className="flex justify-between items-center pt-4 border-t">
                  <div>
                    {selectedDocument.fileUrl && (
                      <a
                        href={selectedDocument.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        📄 ファイル表示
                      </a>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      閉じる
                    </button>
                    
                    {selectedDocument.status !== 'cancelled' && (
                      <button
                        onClick={() => handleCancelDelivery(selectedDocument.id, selectedDocument.title)}
                        disabled={cancelling}
                        className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {cancelling ? '取り消し中...' : '配信取り消し'}
                      </button>
                    )}
                  </div>
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