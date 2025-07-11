// handleUpload関数内のマッピングチェック部分の修正

// 給与項目のCSVマッピングをチェック
const hasMappedItems = payrollItems.some(item => item.csvColumn);
if (!hasMappedItems) {
  // この時点でエラーを表示するのではなく、警告を表示するだけにする
  console.warn('給与項目とCSVカラムのマッピングが設定されていません');
  
  // ユーザーに確認を求める
  if (!window.confirm('給与項目とCSVカラムのマッピングが設定されていないようです。このまま続行しますか？')) {
    setError('給与項目とCSVカラムのマッピングが設定されていません。先に給与項目設定画面でマッピングを行ってください。');
    return;
  }
  
  // 続行する場合は警告をクリア
  setError('');
}
