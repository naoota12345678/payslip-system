// src/pages/admin/WageLedger/WageLedgerIndex.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

function WageLedgerIndex() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">賃金台帳</h1>
        <p className="text-gray-600 mt-2">
          労働基準法に基づく賃金台帳を作成します。給与明細データから自動的に生成されます。
        </p>
      </div>

      {/* メインアクション */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="mb-6">
            <div className="mx-auto w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              賃金台帳を作成
            </h2>
            <p className="text-gray-600 mb-6">
              期間と従業員を選択して、法定様式に準拠した賃金台帳を生成できます。
              <br />
              最大12ヶ月間の期間を指定可能です。
            </p>
          </div>
          
          <button
            onClick={() => navigate('/admin/wage-ledger/period-select')}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            期間を選択して開始
          </button>
        </div>
      </div>

      {/* 機能説明 */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-medium text-gray-900">自動データ取得</h3>
          </div>
          <p className="text-gray-600 text-sm">
            既存の給与明細データから自動的に賃金台帳を生成
          </p>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="font-medium text-gray-900">法定様式準拠</h3>
          </div>
          <p className="text-gray-600 text-sm">
            労働基準法で定められた様式に準拠した台帳を作成
          </p>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <h3 className="font-medium text-gray-900">柔軟な出力</h3>
          </div>
          <p className="text-gray-600 text-sm">
            PDF・Excel形式での出力に対応（今後実装予定）
          </p>
        </div>
      </div>
    </div>
  );
}

export default WageLedgerIndex;