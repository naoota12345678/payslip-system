// src/pages/CsvUpload/components/SuccessPanel.js

import React from 'react';

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
        <div className="mt-6 pt-4 border-gray-300">
          <h3 className="text-lg font-semibold mb-3">処理完了通知</h3>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="text-green-800">
              <strong>✅ CSV処理が正常に完了しました</strong><br/>
              給与明細データが正常に保存されました。<br/>
              <span className="text-sm text-green-600">
                ※ データプレビューはFirestoreインデックス作成完了後に表示されます
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuccessPanel;
