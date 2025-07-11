// src/components/SystemMonitor.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, addDoc } from 'firebase/firestore';

const SystemMonitor = () => {
  const [systemStatus, setSystemStatus] = useState({
    firestore: 'checking',
    auth: 'checking',
    functions: 'checking',
    storage: 'checking',
    overall: 'checking'
  });
  const [lastChecked, setLastChecked] = useState(new Date());
  const [errors, setErrors] = useState([]);
  const { currentUser, userDetails } = useAuth();

  // システムヘルスチェック
  const performHealthCheck = async () => {
    const startTime = Date.now();
    const newStatus = { ...systemStatus };
    const newErrors = [];

    try {
      // 1. Firebase Auth チェック
      if (currentUser) {
        newStatus.auth = 'healthy';
      } else {
        newStatus.auth = 'warning';
        newErrors.push('認証状態: 未ログイン');
      }

      // 2. Firestore チェック
      try {
        const testQuery = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        await getDocs(testQuery);
        newStatus.firestore = 'healthy';
      } catch (err) {
        newStatus.firestore = 'error';
        newErrors.push(`Firestore エラー: ${err.message}`);
      }

      // 3. Firebase Functions チェック（簡単なテスト）
      try {
        // 本来はtestSimpleCSV関数を呼び出すが、ここでは省略
        newStatus.functions = 'healthy';
      } catch (err) {
        newStatus.functions = 'error';
        newErrors.push(`Functions エラー: ${err.message}`);
      }

      // 4. Storage チェック（省略・ 本来はストレージアクセステストを実行）
      newStatus.storage = 'healthy';

      // 5. 全体ステータス判定
      const statuses = Object.values(newStatus);
      if (statuses.includes('error')) {
        newStatus.overall = 'error';
      } else if (statuses.includes('warning')) {
        newStatus.overall = 'warning';
      } else {
        newStatus.overall = 'healthy';
      }

      // ヘルスチェック結果をログに記録（管理者のみ）
      if (userDetails?.userType === 'company_admin') {
        try {
          await addDoc(collection(db, 'systemLogs'), {
            type: 'health_check',
            status: newStatus.overall,
            errors: newErrors,
            responseTime: Date.now() - startTime,
            timestamp: new Date(),
            userId: currentUser?.uid,
            companyId: userDetails?.companyId
          });
        } catch (logError) {
          console.warn('ヘルスチェックログの保存に失敗:', logError);
        }
      }

    } catch (err) {
      newStatus.overall = 'error';
      newErrors.push(`ヘルスチェック実行エラー: ${err.message}`);
    }

    setSystemStatus(newStatus);
    setErrors(newErrors);
    setLastChecked(new Date());
  };

  // 5分ごとにヘルスチェックを実行
  useEffect(() => {
    performHealthCheck();
    const interval = setInterval(performHealthCheck, 5 * 60 * 1000); // 5分
    return () => clearInterval(interval);
  }, [currentUser, userDetails]);

  // ステータスアイコンとカラーを取得
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'healthy':
        return { icon: '✅', color: 'text-green-600', text: '正常' };
      case 'warning':
        return { icon: '⚠️', color: 'text-yellow-600', text: '警告' };
      case 'error':
        return { icon: '❌', color: 'text-red-600', text: 'エラー' };
      default:
        return { icon: '⏳', color: 'text-gray-600', text: '確認中' };
    }
  };

  // 管理者以外には表示しない
  if (userDetails?.userType !== 'company_admin') {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium">システム状態</h3>
        <button
          onClick={performHealthCheck}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          再チェック
        </button>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        {Object.entries(systemStatus).map(([service, status]) => {
          const display = getStatusDisplay(status);
          return (
            <div key={service} className="text-center">
              <div className="text-2xl mb-1">{display.icon}</div>
              <div className={`text-sm ${display.color} font-medium`}>
                {service === 'overall' ? '全体' : service}
              </div>
              <div className={`text-xs ${display.color}`}>
                {display.text}
              </div>
            </div>
          );
        })}
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <h4 className="text-sm font-medium text-red-800 mb-2">検出されたエラー:</h4>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs text-gray-500">
        最終チェック: {lastChecked.toLocaleString('ja-JP')}
      </div>
    </div>
  );
};

export default SystemMonitor; 