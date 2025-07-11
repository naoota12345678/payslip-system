// src/pages/CsvUpload/components/ProgressIndicator.js

import React from 'react';

/**
 * 進捗表示コンポーネント
 */
const ProgressIndicator = ({ isLoading, uploadProgress }) => {
  if (!isLoading) return null;
  
  return (
    <div className="mt-4 mb-4">
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full" 
          style={{ width: `${uploadProgress}%` }}
        ></div>
      </div>
      <p className="text-sm text-gray-600 mt-1">
        処理中...({uploadProgress}%)
      </p>
    </div>
  );
};

export default ProgressIndicator;
