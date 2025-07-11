// src/pages/CsvUpload/components/SuccessPanel.js

import React from 'react';
import PayslipDataSample from '../../../components/payslip/PayslipDataSample';

/**
 * 成功メッセージとプレビューコンポーネント
 */
const SuccessPanel = ({ 
  success, 
  uploadId, 
  isLoading, 
  testEmailNotification 
}) => {
  if (!success) return null;
  
  return (
    <div className="mt-4 text-green-600">
      {success}
      
      {/* 最後にアップロードした場合、通知テストボタンを表示 */}
      {uploadId && (
        <div className="mt-4 pt-4 border-t border-gray-300">
          <p className="text-gray-700 mb-2">給与明細発行通知：</p>
          <button
            onClick={() => testEmailNotification(uploadId, true)}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 mr-2"
            disabled={isLoading}
          >
            テスト通知送信
          </button>
          <button
            onClick={() => testEmailNotification(uploadId, false)}
            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
            disabled={isLoading}
          >
            全員に通知送信
          </button>
          <p className="text-xs text-gray-500 mt-1">
            テスト通知は現在のユーザーのみ、全員に通知送信は全従業員にメールが送信されます。
          </p>
        </div>
      )}
      
      {/* 給与データのサンプルを表示 */}
      {uploadId && (
        <div className="mt-6 pt-4 border-t border-gray-300">
          <h3 className="text-lg font-semibold mb-3">生成された給与明細プレビュー</h3>
          <PayslipDataSample uploadId={uploadId} maxSamples={3} />
        </div>
      )}
    </div>
  );
};

export default SuccessPanel;
