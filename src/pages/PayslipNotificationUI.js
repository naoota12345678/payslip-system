// src/pages/PayslipNotificationUI.js
import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

function PayslipNotificationUI({ uploadId, paymentDate, type = 'payslip' }) {
  const [sending, setSending] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // 今すぐ送信（非同期ジョブ対応）
  const sendNow = async () => {
    if (!window.confirm('全ての在職従業員にメール送信しますか？\n\n処理は数分かかる場合があります。')) {
      return;
    }
    
    setSending(true);
    setError('');
    setMessage('');

    try {
      console.log('🚀 非同期給与明細メール送信開始');
      
      // 非同期ジョブを開始
      const startJob = httpsCallable(functions, 'startPayslipNotificationJob');
      const result = await startJob({
        uploadId,
        paymentDate,
        type
      });
      
      console.log('🎯 ジョブ開始結果:', result.data);

      if (result.data.success) {
        setMessage(`${result.data.message} (推定時間: 約${result.data.estimatedTime}秒) - 件数が多い場合はさらに時間がかかります。処理完了までしばらくお待ちください。`);
        
        // 推定時間後に完了メッセージに変更
        setTimeout(() => {
          setMessage('給与明細メール送信処理が完了しました。');
        }, result.data.estimatedTime * 1000 + 30000); // 推定時間 + 30秒のバッファ
      } else {
        setError(result.data.message || 'ジョブの開始に失敗しました');
      }
    } catch (error) {
      console.error('❌ 給与明細メール送信エラー:', error);
      setError(`送信開始エラー: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  // スケジュール送信
  const scheduleNotification = async () => {
    if (!scheduleDate) {
      setError('送信日を選択してください');
      return;
    }

    setScheduled(true);
    setError('');
    setMessage('');

    try {
      // 選択された日付の9時に設定
      const scheduledDateTime = new Date(scheduleDate);
      scheduledDateTime.setHours(9, 0, 0, 0);

      const sendPayslipNotifications = httpsCallable(functions, 'sendPayslipNotifications');
      const result = await sendPayslipNotifications({
        uploadId,
        paymentDate,
        type,
        scheduleDate: scheduledDateTime.toISOString()
      });

      if (result.data.success) {
        setMessage(`📅 ${result.data.scheduledCount}件のメールを${scheduledDateTime.toLocaleDateString('ja-JP')} 9:00に送信予約しました`);
      }
    } catch (error) {
      console.error('スケジュール設定エラー:', error);
      setError(`エラー: ${error.message}`);
    } finally {
      setScheduled(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">
        {type === 'bonus' ? '賞与' : '給与'}明細メール配信
      </h3>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          支払日: {paymentDate}
        </p>
      </div>

      {/* 今すぐ送信 */}
      <div className="mb-6">
        <button
          onClick={sendNow}
          disabled={sending}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
        >
          {sending ? '開始中...' : '今すぐ全員に送信'}
        </button>
      </div>

      {/* スケジュール送信 */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">日付指定で送信予約（9時に自動送信）</h4>
        <div className="flex gap-2">
          <input
            type="date"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2"
          />
          <button
            onClick={scheduleNotification}
            disabled={scheduled || !scheduleDate}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-green-300 transition-colors"
          >
            {scheduled ? '設定中...' : '送信予約'}
          </button>
        </div>
      </div>

      {/* メッセージ表示 */}
      {message && (
        <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}

      {/* 注意事項 */}
      <div className="mt-4 text-sm text-gray-500">
        <p>※ メールは在職者（isActive: true）のみに送信されます</p>
        <p>※ スケジュール送信は日本時間の朝9時に実行されます</p>
      </div>
    </div>
  );
}

export default PayslipNotificationUI;