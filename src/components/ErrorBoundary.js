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
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '28rem',
            width: '100%',
            padding: '2.5rem',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#dc2626',
                marginBottom: '1rem'
              }}>アプリケーションエラー</h2>
              <p style={{
                color: '#6b7280',
                marginBottom: '1.5rem'
              }}>申し訳ございません。アプリケーションでエラーが発生しました。</p>
              
              {process.env.NODE_ENV === 'development' && (
                <details style={{
                  textAlign: 'left',
                  background: '#f3f4f6',
                  padding: '1rem',
                  borderRadius: '4px',
                  marginBottom: '1rem'
                }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}>エラー詳細（開発者向け）</summary>
                  <pre style={{
                    marginTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: '#dc2626',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {this.state.error && this.state.error.toString()}
                    <br />
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    width: '100%',
                    padding: '0.5rem 1rem',
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  ページを再読み込み
                </button>
                
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem 1rem',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  再試行
                </button>
                
                <a
                  href="/"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem 1rem',
                    background: '#059669',
                    color: 'white',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
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