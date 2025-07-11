// src/pages/NotificationSettings.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

function NotificationSettings() {
  const navigate = useNavigate();
  const { userDetails } = useAuth();
  
  // 通知設定
  const [emailNotification, setEmailNotification] = useState(true);
  const [autoNotify, setAutoNotify] = useState(true);
  const [notifyDays, setNotifyDays] = useState(0);
  const [emailSubject, setEmailSubject] = useState('給与明細が発行されました');
  const [emailTemplate, setEmailTemplate] = useState('');
  const [emailFooter, setEmailFooter] = useState('このメールは自動送信されています。お問い合わせは担当者までご連絡ください。');
  
  // UI状態
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 既存の設定データを読み込む
  useEffect(() => {
    const fetchSettings = async () => {
      if (!userDetails?.companyId) {
        setError('会社情報が取得できませんでした');
        setLoading(false);
        return;
      }
      
      try {
        const settingsDoc = await getDoc(doc(db, 'notificationSettings', userDetails.companyId));
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setEmailNotification(data.emailNotification !== false);
          setAutoNotify(data.autoNotify !== false);
          setNotifyDays(data.notifyDays || 0);
          setEmailSubject(data.emailSubject || '給与明細が発行されました');
          setEmailTemplate(data.emailTemplate || '');
          setEmailFooter(data.emailFooter || 'このメールは自動送信されています。お問い合わせは担当者までご連絡ください。');
        }
        
        // デフォルトのテンプレートを設定（データが空の場合）
        if (!emailTemplate) {
          setEmailTemplate(`{{employee_name}} 様

{{month}}月分の給与明細が発行されました。
以下のリンクからご確認いただけます。

{{payslip_link}}

支給額合計: {{total_income}}
控除額合計: {{total_deduction}}
差引支給額: {{net_amount}}`);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('設定データ取得エラー:', err);
        setError('設定データの取得中にエラーが発生しました');
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [userDetails]);
  
  // 設定の保存
  const handleSave = async () => {
    if (!userDetails?.companyId) {
      setError('会社情報が取得できませんでした');
      return;
    }
    
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      // 設定データを保存
      await setDoc(doc(db, 'notificationSettings', userDetails.companyId), {
        emailNotification,
        autoNotify,
        notifyDays,
        emailSubject,
        emailTemplate,
        emailFooter,
        updatedAt: new Date(),
        updatedBy: userDetails.id || ''
      });
      
      setSuccess('通知設定を保存しました');
      
      // 少し待ってから成功メッセージをクリア
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('設定保存エラー:', err);
      setError('設定の保存中にエラーが発生しました: ' + (err.message || 'エラーが発生しました'));
    } finally {
      setSaving(false);
    }
  };
  
  // テンプレートのプレビュー
  const getTemplatePreview = () => {
    // プレースホルダーを実際の値に置き換えたプレビュー
    let preview = emailTemplate
      .replace('{{employee_name}}', '山田 太郎')
      .replace('{{month}}', '5')
      .replace('{{payslip_link}}', 'https://example.com/payslips/123456')
      .replace('{{total_income}}', '¥300,000')
      .replace('{{total_deduction}}', '¥60,000')
      .replace('{{net_amount}}', '¥240,000');
    
    return preview;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">設定の読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">通知設定</h1>
        <button
          onClick={() => navigate('/settings')}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
        >
          システム設定に戻る
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          {success}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">メール通知設定</h2>
          
          <div className="space-y-6">
            {/* 基本設定 */}
            <div>
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="emailNotification"
                    type="checkbox"
                    checked={emailNotification}
                    onChange={(e) => setEmailNotification(e.target.checked)}
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="emailNotification" className="font-medium text-gray-700">
                    メール通知を有効にする
                  </label>
                  <p className="text-gray-500">
                    給与明細が発行されたときに従業員にメール通知を送信します
                  </p>
                </div>
              </div>
              
              {emailNotification && (
                <div className="mt-4 ml-7 space-y-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="autoNotify"
                        type="checkbox"
                        checked={autoNotify}
                        onChange={(e) => setAutoNotify(e.target.checked)}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="autoNotify" className="font-medium text-gray-700">
                        自動通知を有効にする
                      </label>
                      <p className="text-gray-500">
                        CSVアップロード時に自動的に通知を送信または予約します
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <label htmlFor="notifyDays" className="text-sm font-medium text-gray-700 mr-3">
                      通知日の遅延:
                    </label>
                    <select
                      id="notifyDays"
                      value={notifyDays}
                      onChange={(e) => setNotifyDays(parseInt(e.target.value))}
                      className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="0">当日（即時送信）</option>
                      <option value="1">1日後</option>
                      <option value="2">2日後</option>
                      <option value="3">3日後</option>
                      <option value="7">1週間後</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            
            {/* メールテンプレート設定 */}
            {emailNotification && (
              <div className="border-t pt-6">
                <h3 className="text-md font-medium mb-4">メールテンプレート</h3>
                
                <div className="mb-4">
                  <label htmlFor="emailSubject" className="block text-sm font-medium text-gray-700 mb-1">
                    メール件名
                  </label>
                  <input
                    type="text"
                    id="emailSubject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="emailTemplate" className="block text-sm font-medium text-gray-700 mb-1">
                    メール本文
                  </label>
                  <textarea
                    id="emailTemplate"
                    rows="8"
                    value={emailTemplate}
                    onChange={(e) => setEmailTemplate(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
                  ></textarea>
                  <p className="mt-1 text-xs text-gray-500">
                    以下のプレースホルダーが使用できます: {'{{employee_name}}'}, {'{{month}}'}, {'{{payslip_link}}'}, {'{{total_income}}'}, {'{{total_deduction}}'}, {'{{net_amount}}'}
                  </p>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="emailFooter" className="block text-sm font-medium text-gray-700 mb-1">
                    メールフッター
                  </label>
                  <textarea
                    id="emailFooter"
                    rows="2"
                    value={emailFooter}
                    onChange={(e) => setEmailFooter(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md p-2 border"
                  ></textarea>
                </div>
              </div>
            )}
            
            {/* プレビュー */}
            {emailNotification && (
              <div className="border-t pt-6">
                <h3 className="text-md font-medium mb-4">プレビュー</h3>
                
                <div className="bg-gray-50 p-4 rounded border">
                  <div className="mb-2">
                    <span className="text-sm font-medium text-gray-700">件名: </span>
                    <span className="text-sm">{emailSubject}</span>
                  </div>
                  <div className="mb-4">
                    <div className="text-sm whitespace-pre-wrap">{getTemplatePreview()}</div>
                  </div>
                  <div className="text-xs text-gray-500 border-t pt-2">
                    {emailFooter}
                  </div>
                </div>
                
                <p className="mt-2 text-xs text-gray-500">
                  注意: これはプレビューです。実際のメールは受信環境によって表示が異なる場合があります。
                </p>
              </div>
            )}
            
            {/* 保存ボタン */}
            <div className="pt-5 border-t">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                >
                  {saving ? '保存中...' : '設定を保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* テスト送信機能 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">テスト通知</h2>
          
          <p className="text-gray-600 mb-6">
            設定したテンプレートでテスト通知を送信できます。実際に従業員に送信される通知の内容を確認することができます。
          </p>
          
          <div className="bg-blue-50 p-4 rounded border border-blue-200 mb-6">
            <p className="text-sm text-blue-700">
              <span className="font-medium">注意: </span>
              テスト通知はご自身のメールアドレスに送信されます。実際の従業員には送信されません。
            </p>
          </div>
          
          <div className="flex justify-center">
            <button
              type="button"
              className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              onClick={() => alert('この機能は現在開発中です')}
            >
              テスト通知を送信
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationSettings;