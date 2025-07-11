// src/components/payslip/PayslipDataSample.js
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import PayslipPreview from './PayslipPreview';

// アップロードされた給与データのサンプルを表示するコンポーネント
const PayslipDataSample = ({ uploadId, maxSamples = 3 }) => {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSample, setSelectedSample] = useState(0); // 選択中のサンプルインデックス
  
  useEffect(() => {
    const fetchSamples = async () => {
      if (!uploadId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError('');
        
        // このアップロードIDに関連する給与明細を取得
        const payslipsQuery = query(
          collection(db, 'payslips'),
          where('uploadId', '==', uploadId),
          orderBy('createdAt', 'desc'),
          limit(maxSamples)
        );
        
        const snapshot = await getDocs(payslipsQuery);
        
        if (snapshot.empty) {
          setError('このアップロードに関連する給与データが見つかりませんでした');
          setLoading(false);
          return;
        }
        
        // サンプルデータを取得
        const sampleData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          displayName: `${doc.data().employeeId || 'Unknown'} - ${formatCurrency(doc.data().netAmount)}` 
        }));
        
        setSamples(sampleData);
        setSelectedSample(0); // 最初のサンプルを選択
      } catch (err) {
        console.error('サンプルデータ取得エラー:', err);
        setError('サンプルデータの取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSamples();
  }, [uploadId, maxSamples]);
  
  // 金額フォーマット関数
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
      <div className="bg-white p-4 rounded-lg shadow text-center">
        <p className="text-gray-500">サンプルデータを読み込み中...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700">
        <p>{error}</p>
      </div>
    );
  }
  
  if (samples.length === 0) {
    return (
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-yellow-700">
        <p>サンプルデータがありません。処理が完了していない可能性があります。</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">給与明細サンプル</h3>
      
      {/* サンプル選択タブ */}
      {samples.length > 1 && (
        <div className="flex border-b mb-4">
          {samples.map((sample, index) => (
            <button
              key={sample.id}
              className={`px-4 py-2 text-sm ${
                selectedSample === index
                  ? 'border-b-2 border-blue-500 font-semibold text-blue-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => setSelectedSample(index)}
            >
              サンプル {index + 1}
            </button>
          ))}
        </div>
      )}
      
      {/* 現在のサンプルの情報 */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          従業員ID: <span className="font-medium">{samples[selectedSample].employeeId || 'なし'}</span>
          {samples[selectedSample].departmentCode && (
            <> | 部門: <span className="font-medium">{samples[selectedSample].departmentCode}</span></>
          )}
        </p>
      </div>
      
      {/* 給与明細プレビュー */}
      <PayslipPreview payslipData={samples[selectedSample]} />
      
      <p className="text-xs text-gray-500 mt-4">
        ※ これはサンプルデータです。実際の給与明細の表示は若干異なる場合があります。
      </p>
    </div>
  );
};

export default PayslipDataSample;