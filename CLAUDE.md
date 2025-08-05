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

## 0値表示制御機能（2025-08-05）

### ✅ 完了した作業

**1. 0値項目の表示制御機能実装**
- **実装日**: 2025-08-05
- **概要**: 給与明細で0円の項目をデフォルトで非表示にする機能を追加
- **変更ファイル**:
  - `src/components/payslip/PayslipPreview.js`: 0値項目の表示制御
  - `src/pages/PayslipDetail.js`: showZeroValueプロパティの追加
  - `src/pages/CsvMapping/components/ItemMappingTable.js`: 「0値表示」チェックボックス列追加
  - `src/pages/CsvMapping/utils/mappingHelpers.js`: updateItemZeroDisplay関数追加
  - `MAPPING_GUIDE.md`: 機能仕様書を更新

**2. 仕様詳細**
```javascript
// デフォルト動作: 0値項目は非表示
if (item.showZeroValue === true) return true; // チェック時のみ表示
// undefined含むデフォルトは0値を非表示
```

**3. 安全性への配慮**
- 既存の給与明細データに影響しない段階的実装
- 項目名は固定化で既存データ保護
- CSVマッピング設定で項目ごとに制御可能

## PDF配信システム（2025-08-05）

### ✅ Phase1完了: 読み取り専用テスト版

**1. システム設計**
- **配信タイプ**: 
  - 一斉配信 (broadcast): 全従業員に同一ファイル
  - 個別配信 (individual): 特定従業員にファイル指定
  - 一括個別配信 (bulk_individual): ファイル名で従業員番号マッチング
- **保存期間**: 2年間（自動削除）
- **ファイル制限**: 50-400KB推奨、PDF形式
- **コスト試算**: 約1,230円/年（200名企業想定）

**2. 実装完了ファイル**

**バックエンド準備**:
- `src/firebase.js`: Firebase Storage設定済み
- Firebase Storageバケット: `kyuyoprint.firebasestorage.app`

**フロントエンド**:
- `src/pages/admin/PdfDelivery.js`: 管理者向けPDF配信管理画面
- `src/pages/employee/Documents.js`: 従業員向け書類一覧画面
- `src/App.js`: ルート設定追加
- `src/components/Navigation.js`: メニュー項目追加
- `src/components/Layout.js`: ページタイトル設定

**3. UI機能（読み取り専用）**
```javascript
// 管理者画面
- 配信済み書類の一覧表示
- 配信タイプ・日付・状態の確認
- テスト会社判定機能

// 従業員画面  
- 自分宛の書類一覧表示
- 一斉配信と個人宛書類の区別
- ファイル表示・ダウンロード機能
```

**4. テスト環境**
- 本番環境でテスト会社を使用（認証問題回避）
- `userDetails.companyId.includes('test-')`でテスト判定
- 既存機能への影響なし

### 🔧 技術的な実装詳細

**Firebase Storage設定**:
```javascript
// firebase.js
const storage = getStorage(app);
// ストレージバケット: kyuyoprint.firebasestorage.app
```

**メニュー統合**:
```javascript
// Navigation.js
{/* 管理者向け */}
<Link to="/admin/pdf-delivery">PDF配信管理</Link>

{/* 従業員向け */}
{!isAdmin && (
  <Link to="/employee/documents">書類一覧</Link>
)}
```

**データ構造想定**:
```javascript
// documents collection
{
  companyId: string,
  title: string,
  type: 'broadcast' | 'individual' | 'bulk_individual',
  status: 'active' | 'deleted',
  uploadedAt: timestamp,
  fileUrl: string, // broadcast用
  assignments: { // individual/bulk_individual用
    [employeeId]: {
      fileUrl: string,
      fileName: string
    }
  }
}
```

### 🎯 Phase2実装予定

**ファイルアップロード機能**:
- PDF形式チェック
- ファイルサイズ制限（50-400KB推奨）
- Firebase Storageへの保存

**配信機能**:
1. **一斉配信**: 単一ファイルを全従業員に配信
2. **個別配信**: 従業員選択＋ファイル指定
3. **一括個別配信**: ファイル名で従業員番号自動マッチング

**自動化機能**:
- メール通知（配信時）
- 2年後自動削除（Lifecycle Rules）
- 閲覧状況tracking

**管理機能**:
- 配信履歴管理
- ファイル削除・更新
- 統計・レポート

### 📝 開発運用ルール

**テスト方針**:
- 本番環境でテスト会社使用（Firebase認証制約のため）
- 既存機能への影響を最小化
- 段階的リリース（読み取り専用→フル機能）

**デプロイ方法**:
```bash
git add -A
git commit -m "変更内容"
git push origin main
# GitHub Actionsで自動デプロイ
```

**ファイル構成**:
```
src/
├── pages/
│   ├── admin/PdfDelivery.js (管理者画面)
│   └── employee/Documents.js (従業員画面)
├── components/
│   ├── Navigation.js (メニュー)
│   └── Layout.js (ページタイトル)
└── firebase.js (Storage設定)
```

## 追加修正（2025-08-05 午後）

### ✅ 賞与明細一覧の従業員名表示問題修正

**問題**: 賞与明細一覧で従業員名が「不明なユーザー」と表示
**原因**: `userId`ベースで従業員情報を取得していたが、実際は`employeeId`を使用
**修正**: `employeeId`ベースに統一（給与明細と同じロジック）

**変更ファイル**: `src/pages/BonusPayslipList.js`
- fetchEmployeeNames関数の修正
- getEmployeeName関数の修正  
- ソート処理の修正

### ✅ 重複メール送信機能の整理

**問題**: 給与・賞与アップロード画面で2つのメール送信機能が重複
- 古い「メール通知設定」（アップロード中）
- 新しい「PayslipNotificationUI」（アップロード後）

**修正**: PayslipNotificationUIに統一
**変更ファイル**: 
- `src/pages/SimpleCSVUpload.js`: 古いメール通知設定を削除
- `src/pages/BonusSimpleCSVUpload.js`: 古いメール通知設定を削除

**効果**:
- UI/UXの統一
- 給与・賞与画面で同じ操作感
- より安全で確実なメール送信フロー

### 🔧 技術的詳細

**データフィールド統一**:
```javascript
// 修正前（問題）
payslip.userId && employeeNames[payslip.userId]

// 修正後（統一）
payslip.employeeId && employeeNames[payslip.employeeId]
```

**メール送信フロー統一**:
```
CSVアップロード → データ保存完了 → PayslipNotificationUI表示 → メール送信操作
```

---

**最終更新**: 2025-08-05 午後
**作成者**: Claude Code Assistant  
**プロジェクト**: 給与明細システム (kyuyoprint)
**システム名**: 「そのままWeb明細」

### 💾 Git履歴（最新3件）
```
2ddb32f 給与・賞与アップロード画面の重複メール送信機能を修正
cf146dd 賞与明細一覧の従業員名表示問題を修正
89b8aa4 CLAUDE.mdに今回の開発経緯を追記
```