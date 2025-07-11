// src/components/ErrorBoundary.js
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // エラーが発生したときにstateを更新
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // エラーログを記録
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // 本番環境ではエラー追跡サービスに送信
    if (process.env.NODE_ENV === 'production') {
      // Analytics/Sentryなどのエラー追跡サービスにエラーを送信
      console.error('Production error:', {
        error: error.toString(),
        errorInfo,
        timestamp: new Date().toISOString()
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-lg shadow-md">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">
                アプリケーションエラー
              </h2>
              <p className="text-gray-600 mb-6">
                申し訳ございません。アプリケーションでエラーが発生しました。
              </p>
              
              {process.env.NODE_ENV === 'development' && (
                <details className="text-left bg-gray-100 p-4 rounded mb-4">
                  <summary className="cursor-pointer font-medium">
                    エラー詳細（開発者向け）
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 overflow-auto">
                    {this.state.error && this.state.error.toString()}
                    <br />
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  ページを再読み込み
                </button>
                
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null });
                  }}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  再試行
                </button>
                
                <a
                  href="/"
                  className="block w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-center"
                >
                  ホームページに戻る
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 