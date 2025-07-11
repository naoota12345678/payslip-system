// src/pages/CsvUpload/constants.js

// デバッグモード用の設定
export const DEBUG_STORAGE_KEY = 'csvTestSettings';

// アップロード進捗状態の割合設定
export const PROGRESS_STAGES = {
  FILE_UPLOAD: 40, // ファイルアップロードフェーズに割り当てる進捗割合
  DATA_PROCESSING: 70 // データ処理フェーズに割り当てる進捗割合
};

// メール通知関連の設定
export const EMAIL_NOTIFICATION_TYPES = {
  TEST: 'test',
  ALL: 'all'
};

// アップロードステータス
export const UPLOAD_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
};
