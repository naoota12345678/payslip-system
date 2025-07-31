# 給与明細システム - 引継ぎ書類

## 現在の状況

### ✅ 完了した作業
1. **Gmail SMTP設定実装** - Sendlyの代わりにGmailでメール送信（後でSendlyに切り替え可能）
2. **一括メール送信機能** - 従業員管理画面に「一括設定メール送信」ボタンを追加
3. **個別メール送信機能** - 各従業員の行に「メール送信」ボタンを追加
4. **メールテンプレート改善** - 会社情報、メール不達対策、スマホアクセス問題対応を含む詳細なメール内容
5. **UI実装完了** - フロントエンドのデプロイ完了
6. **GitHub Actions自動デプロイ** - git pushで自動的にFirebase Functionsがデプロイされる仕組みを構築
7. **メール送信機能完全動作** - 個別・一括ともに正常動作確認済み

## 技術的な実装内容

### Cloud Functions (`functions/index.js`)
- `sendBulkInvitationEmails`: 全アクティブ従業員への一括メール送信
- `testGmailConfig`: Gmail設定のテスト関数
- `testSendEmail`: メール送信のテスト関数
- `createInvitationEmailContent`: 改善されたメールテンプレート

### フロントエンド (`src/pages/EmployeeManagement.js`)
- 一括設定メール送信ボタン
- 個別メール送信ボタン（アクティブ従業員のみ表示）
- エラーハンドリングと進捗表示

### Gmail SMTP設定

#### ⚠️ 重要な注意事項
1. **Firebase Functions v2では環境変数を使用**
   - `functions.config()`は廃止されました
   - 環境変数（`process.env`）を使用してください

2. **GitHub Secretsで管理（推奨）**
   - `GMAIL_USER`: 送信用Gmailアドレス
   - `GMAIL_APP_PASSWORD`: Googleアプリパスワード（16文字）
   - GitHub Actionsで自動的に環境変数として設定されます

3. **ローカル開発時**
   - `functions/.env.local`ファイルに設定
   ```
   GMAIL_USER=roumu3737@gmail.com
   GMAIL_APP_PASSWORD=16文字のアプリパスワード
   ```

4. **アプリパスワードの取得方法**
   - Googleアカウント設定 → セキュリティ → 2段階認証プロセス
   - アプリパスワード → 「メール」を選択して生成
   - 生成された16文字のパスワードをコピー

## 変更履歴（2025-07-28）

### 解決した問題と修正内容

1. **Gmail SMTP接続エラー**
   - 原因: Firebase Functions v2では`functions.config()`が廃止
   - 修正: 環境変数（`process.env`）を使用するよう変更
   - nodemailer APIの誤り修正: `createTransporter` → `createTransport`

2. **一括メール送信の対象者問題**
   - 原因: 既存従業員の`isActive`フィールドが未設定
   - 修正: Firebase Consoleで手動で`isActive: true`を設定
   - 新規登録者は自動的に`isActive: true`が設定される

3. **デプロイプロセスの改善**
   - GitHub Actions導入により自動デプロイ実現
   - 環境変数はGitHub Secretsで安全に管理

### デプロイ方法（現在）

#### GitHub経由の自動デプロイ（推奨）
```bash
git add -A
git commit -m "変更内容"
git push origin main
# GitHub Actionsが自動的にデプロイを実行
```

#### 2. Gmail設定テスト
ブラウザコンソール（F12）で実行：
```javascript
firebase.functions().httpsCallable('testGmailConfig')({})
  .then(result => console.log('Gmail設定テスト:', result.data))
  .catch(error => console.error('テストエラー:', error));
```

#### 3. メール送信テスト
```javascript
firebase.functions().httpsCallable('testSendEmail')({
  to: 'テスト用メールアドレス@gmail.com'
})
.then(result => console.log('メール送信テスト:', result.data))
.catch(error => console.error('送信エラー:', error));
```

#### 4. ログ確認
Firebase Console: https://console.firebase.google.com/project/kyuyoprint/functions/logs

確認すべきメッセージ：
- `✅ Gmail SMTP初期化・接続テスト完了`
- `❌ Gmail SMTP接続テスト失敗:`
- `📧 Gmail SMTP経由でメール送信中:`
- `✅ メール送信成功:` または `❌ メール送信エラー:`

## 代替案

もしGmail SMTP接続が困難な場合：

### 1. Sendly復旧待ち
- DNS設定完了後、Sendlyに戻す
- コード変更は最小限（API設定のみ）

### 2. 他のメール送信サービス
- SendGrid
- Amazon SES
- Mailgun

## メールテンプレート内容

### 主要な改善点
1. **会社情報**: 合同会社グレースコンサルティング
2. **お問い合わせ**: roumu3737@gmail.com
3. **メール不達対策**: システムURL直接アクセスの案内
4. **スマホ問題対応**: コンテンツブロッカー対策
5. **配信時刻明記**: 給与支払日の午前10時まで

## ファイル構成

### 主要ファイル
- `functions/index.js`: Cloud Functions（メール送信ロジック）
- `src/pages/EmployeeManagement.js`: 従業員管理画面（UI）
- `src/pages/EmployeeForm.js`: 従業員登録・編集フォーム

### 設定ファイル
- `firebase.json`: Firebase設定
- `functions/package.json`: Cloud Functions依存関係

## 使用方法

### 管理者向け
1. **一括メール送信**: 従業員管理画面の「一括設定メール送信」ボタン
2. **個別メール送信**: 各従業員行の「メール送信」ボタン
3. **進捗確認**: ブラウザコンソールまたはFirebase Consoleログ

### 従業員向け
1. **初回ログイン**: メールに記載のURLからアクセス
2. **パスワード**: 000000（初回のみ）
3. **パスワード変更**: 初回ログイン時に必須
4. **直接アクセス**: https://kyuyoprint.web.app （ブックマーク推奨）

## トラブルシューティング

### メールが届かない場合
1. 迷惑メールフォルダを確認
2. roumu3737@gmail.com を連絡先に追加
3. 直接システムURLにアクセス

### システムにアクセスできない場合
1. コンテンツブロッカーを一時無効
2. 別のブラウザで試行
3. プライベートブラウジングモードで試行

## 今後の注意事項

### 🚨 Gmail設定で起きやすいエラーと対策

1. **nodemailer関数名の間違い**
   - ❌ 間違い: `nodemailer.createTransporter()`
   - ✅ 正しい: `nodemailer.createTransport()`

2. **環境変数の設定漏れ**
   - GitHub Secretsに`GMAIL_USER`と`GMAIL_APP_PASSWORD`を必ず設定
   - ローカルテスト時は`functions/.env.local`に記載

3. **isActiveフィールドの確認**
   - 新規従業員登録時は自動的に`isActive: true`が設定される
   - 既存従業員でメール送信対象から漏れる場合は、Firebase Consoleで確認

4. **デプロイ方法**
   - 必ずGitHub経由でデプロイ（環境変数が確実に設定される）
   - `git push`するだけで自動デプロイされる

### メール送信テスト手順

1. **個別送信テスト**
   - 従業員管理画面で特定の従業員の「メール送信」ボタンをクリック
   - ログで`✅ メール送信成功:`を確認

2. **一括送信テスト**
   - 「一括設定メール送信」ボタンをクリック
   - 対象従業員数が正しいか確認（`isActive: true`の従業員のみ）

### トラブル時の確認順序

1. Firebase Consoleでログ確認
2. GitHub Actionsのデプロイステータス確認
3. 環境変数の設定確認（GitHub Secrets）
4. `isActive`フィールドの設定確認（Firebase Console）

## UI改善・機能制御・登録フロー整理（2025-07-30）

### ✅ セッション中完了項目

**1. 管理者ダッシュボードのクイックアクション削除**
- **実装日**: 2025-07-30
- **概要**: ダッシュボードからクイックアクション部分を完全削除  
- **ファイル**: `src/pages/AdminDashboard.js` (lines 244-305削除)
- **理由**: 左メニューと重複、UI簡素化
- **影響**: 他機能への影響なし

**2. CSVマッピング画面のモード切替ボタン非表示**
- **実装日**: 2025-07-30
- **概要**: 「通常モード」「項目コードマッピングモード」ボタンを非表示
- **変更ファイル**: 
  - `src/pages/CsvMapping/components/HeaderInputPanel.js`
  - `src/pages/CsvMapping/hooks/useHeaderParser.js`
- **デフォルト**: 行ベースマッピングモードに固定
- **理由**: ユーザー混乱防止、操作簡素化

**3. 管理者登録フロー整理**
- **実装日**: 2025-07-30
- **問題解決**: 従業員登録フォームで管理者作成による混乱を解消
- **実装内容**: ホームページから管理者登録リンクを削除
- **変更ファイル**: `src/App.js` (lines 323-330削除)
- **現在のアクセス方法**: 
  - 直接URL: `/admin/register`
  - 管理者ログインページからのリンク

### 🔧 技術的な修正詳細

**CSVマッピングUI改善**:
```javascript
// HeaderInputPanel.js
{/* モード切替ボタンを非表示 - 常に行ベースマッピングモードを使用 */}

// useHeaderParser.js
const [rowMappingMode, setRowMappingMode] = useState(true); // デフォルトで行ベースマッピング有効
```

**管理者ダッシュボード簡素化**:
- クイックアクション部分（65行）を完全削除
- 統計カードのみ表示
- レスポンシブデザイン保持

**登録フロー整理の効果**:
- ユーザー混乱の防止
- 適切な権限でのアカウント作成
- セキュリティ向上

### 🎯 次回実装予定

**賃金台帳機能**
- **目的**: 個人ページから賃金台帳を生成・閲覧
- **データソース**: 既存の給与明細データ活用
- **表示形式**: 月別・年間集計、印刷対応
- **安全性**: 読み取り専用、既存機能への影響なし

---

**最終更新**: 2025-07-30
**作成者**: Claude Code Assistant  
**プロジェクト**: 給与明細システム (kyuyoprint)
**システム名**: 「そのままWeb明細」