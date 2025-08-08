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

      {/* 賃金台帳タイプ選択 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 給与賃金台帳 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="text-center">
            <div className="mb-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                給与賃金台帳
              </h2>
              <p className="text-gray-600 mb-4">
                月次給与明細データから作成される賃金台帳です。
                <br />
                基本給、残業代、各種手当・控除項目を表示します。
              </p>
            </div>
            
            <button
              onClick={() => navigate('/admin/wage-ledger/period-select?type=salary')}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              給与賃金台帳を作成
            </button>
          </div>
        </div>

        {/* 賞与賃金台帳 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="text-center">
            <div className="mb-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                賞与賃金台帳
              </h2>
              <p className="text-gray-600 mb-4">
                賞与明細データから作成される賃金台帳です。
                <br />
                賞与額、社会保険料控除等の項目を表示します。
              </p>
            </div>
            
            <button
              onClick={() => navigate('/admin/wage-ledger/period-select?type=bonus')}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              賞与賃金台帳を作成
            </button>
          </div>
        </div>
        {/* 統合賃金台帳 */}
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div className="text-center">
            <div className="mb-4">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                統合賃金台帳
              </h2>
              <p className="text-gray-600 mb-4">
                給与と賞与を統合して表示する賃金台帳です。
                <br />
                賞与項目の表示設定を行ってから作成します。
              </p>
            </div>
            
            <button
              onClick={() => navigate('/admin/wage-ledger/bonus-mapping?type=integrated')}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              統合賃金台帳を作成
            </button>
          </div>
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