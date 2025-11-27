# 給与明細システム - 引継ぎ書類

## ⚠️ **従業員登録の確定仕様（2025-08-08）**

### 🎯 **現在の確定仕様**
**従業員登録時（CSVアップロード・個別登録）**:
- **Firebase Auth作成**: 登録時に実行
- **初期パスワード**: `000000` 固定
- **isActive**: `true` に設定（メール送信対象）
- **status**: `"active"` に設定（在職状態）
- **新規登録制限**: 30名まで（Firebase制限対応）

**この仕様に反する記載があれば無視してください**

---

## 🚨 開発時の重要な注意事項

### 必須確認リスト（コード変更前）
1. **既存機能への影響確認**
   - 既存のボタン・UI要素を削除していないか
   - インポート文の追加漏れはないか
   - 関数の削除や名前変更をしていないか

2. **修正前の必須チェック**
   ```bash
   # 既存機能の確認
   git log --oneline | head -10
   git grep "退職\|ボタン\|function.*" src/
   ```

3. **コード変更後の必須確認**
   ```bash
   # ビルドテスト
   npm run build
   
   # ESLintチェック
   npm run lint  # もしあれば
   ```

4. **デプロイ前の最終確認**
   - 削除した機能がないか
   - 新しい機能が既存機能と競合しないか
   - インポート文は完全か

### 過去のミス事例
- **2025-08-07**: 退職ボタン追加時に`updateDoc`インポート漏れでビルドエラー
- **2025-08-07**: 従業員登録で`createEmployeeAccount`コメントアウト時にFirestore保存処理も削除
- **2025-08-07**: 一括送信修正時に不要なGmail設定スキップ処理を追加

### 開発ルール
1. **一度に1つの機能のみ修正**
2. **既存コードを削除する前に必ず確認**
3. **インポート文の追加は必須**
4. **ビルドテストしてからコミット**

---

## 📦 デプロイルール（2025-11-27確定）

### 自動デプロイの仕組み
- **GitHub Actions**: `git push`で自動デプロイ
- **ワークフロー**: `.github/workflows/firebase-hosting.yml`
- **デプロイ対象**: Hosting, Functions, Firestore Rules, Firestore Indexes

### デプロイ手順（推奨）
```bash
# 1. コード変更をコミット
git add -A
git commit -m "変更内容"

# 2. GitHubにプッシュ（自動デプロイ開始）
git push origin main

# 3. デプロイ確認（2-3分後）
# https://github.com/naoota12345678/payslip-system/actions
```

### 環境変数の管理
**GitHub Secrets設定済み**:
- `GMAIL_USER`: roumu3737@gmail.com
- `GMAIL_APP_PASSWORD`: Googleアプリパスワード（16文字）
- `FIREBASE_SERVICE_ACCOUNT_KYUYOPRINT`: Firebase認証情報

**ローカル開発時**: `functions/.env.local`に記載

### デプロイ失敗時の対処
1. **GitHub Actionsログ確認**: https://github.com/naoota12345678/payslip-system/actions
2. **エラー内容の確認**: 赤いバツマークをクリック
3. **よくあるエラー**:
   - 権限エラー → Firebase Console で権限確認
   - ビルドエラー → ローカルで`npm run build`実行
   - 環境変数エラー → GitHub Secrets確認

### 重要な注意事項
- ❌ `firebase deploy`コマンドを直接実行しない（環境変数が設定されない）
- ✅ 必ずGitHub経由でデプロイ
- ✅ デプロイ前にローカルで`npm run build`テスト推奨
- ✅ Firebase Console権限: Owner または Firebase Extensions Admin

---

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
2. **✅ パスワード**: 000000（初期パスワード固定）（2025-08-08確定）
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
   - ✅ 新規従業員登録時は自動的に`isActive: true`が設定される（2025-08-08確定）
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
   - ✅ 対象従業員数が正しいか確認（`isActive: true`の従業員のみ）（2025-08-08確定）

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

## PDF配信システム - 2年後自動削除設定（2025-08-07）

### ✅ 完了した作業

**1. Firebase Storage Lifecycle Rules設定**
- **実装日**: 2025-08-07
- **概要**: PDF配信ファイルを2年（730日）後に自動削除するLifecycle Rules設定
- **作成ファイル**:
  - `storage.lifecycle.json`: Lifecycle Rules定義ファイル
  - `setup-storage-lifecycle.md`: 設定手順書
- **設定内容**: `documents/`および`pdf-delivery/`フォルダのファイルを730日後に自動削除

**2. 安全性確認済み**
- **影響範囲**: PDF配信システムのファイルのみ（`documents/`, `pdf-delivery/`フォルダ）
- **既存機能への影響**: なし（給与明細、賞与明細、従業員データは対象外）
- **保存期間**: 2年間（法的要件を考慮した安全な期間設定）

**3. コスト削減効果**
- **推定削減額**: 年間約1,230円（200名企業想定）
- **ストレージ最適化**: 不要ファイルの自動整理

### 🔧 技術的な実装詳細

**Lifecycle Rules設定**:
```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 730,
          "matchesPrefix": [
            "documents/",
            "pdf-delivery/"
          ]
        }
      }
    ]
  }
}
```

**適用方法**:
1. Google Cloud Console GUI（推奨）
2. Google Cloud CLI（権限問題解決後）

### 📝 次回の作業予定

**設定適用**: 
- Google Cloud Consoleから手動設定
- または管理者権限でのCLI実行

## 従業員登録機能の修正履歴（2025-08-08）

### ✅ **CSVアップロード機能修正**
- **実装日**: 2025-08-08
- **問題**: 29人を超える新規従業員登録でFirebase Auth制限によりエラー
- **修正内容**:
  - 新規従業員登録に30名制限を追加
  - 必須項目を確実に設定（`isActive: true`, `tempPassword: "000000"`, `status: "active"`）
  - UI表記に制限事項を明記
- **変更ファイル**: `src/pages/EmployeeManagement.js`
- **影響**: CSVアップロード機能のみ（他機能への影響なし）

### 🎯 **確定した仕様**
**従業員登録時の動作**:
1. **Firebase Auth作成**: 登録時に実行（30名まで安全）
2. **必須項目自動設定**: `isActive: true`, `tempPassword: "000000"`, `status: "active"`
3. **メール送信**: `isActive: true`により対象となる
4. **ログイン**: `tempPassword: "000000"`で可能

## メール送信システム完全統合（2025-08-08 夜）

### ✅ 完了した作業

**1. メール送信機能のTypeError修正**
- **問題**: `startPayslipNotificationJob`でTypeErrorが発生し、メール送信が失敗
- **原因**: `processPayslipNotificationJob`内で`exports.sendPayslipNotifications`を不正な方法で呼び出し
- **解決**: `sendPayslipNotificationsInternal`関数を作成し、Cloud Functions wrapperなしで直接呼び出し
- **影響**: 既存機能（スケジュール送信、従業員管理メール送信）には影響なし

**2. 給与・賞与明細一覧のメール送信統合完了**
- 給与明細一覧: モーダル方式メール送信ボタン ✅
- 賞与明細一覧: 同様の機能を追加完了 ✅
- メール送信履歴管理: `payslipEmailHistory`コレクション ✅
- 送信済み状態表示: 緑色アイコンで判別 ✅

**3. データ整合性問題の解決**
- **問題**: 29名のみメール送信、33名失敗
- **原因**: 給与明細データに存在しない従業員ID（`000200`番台）が含まれていた
- **解決**: データクリーニングにより正常化
- **確認**: `isActive`問題ではなく、データ不整合が原因と判明

**4. 送信履歴表示問題の解決**
- **問題**: メール送信後も送信済みボタンが緑色にならない
- **原因**: 複数回のCSVアップロードによりuploadIdが不一致
- **解決**: 古い明細データ削除、正しいデータでの再アップロード

### 🔧 技術的実装詳細

**新規作成関数:**
```javascript
// functions/index.js
const sendPayslipNotificationsInternal = async (uploadId, paymentDate, type = 'payslip')
// 元のCloud Function機能を内部関数として抽出、同一ロジック保持
```

**修正した関数:**
```javascript
const processPayslipNotificationJob = async (jobId, uploadId, paymentDate, type = 'payslip')
// exports.sendPayslipNotifications → sendPayslipNotificationsInternal に変更
```

**追加機能:**
- `src/pages/BonusPayslipList.js`: メール送信モーダル機能追加
- メール送信履歴: `uploadId_paymentDate`キーで管理
- 送信済み判定: `emailHistory[historyKey]`で緑色表示制御

### 📋 現在の状況

**動作確認済み機能:**
1. ✅ PayslipNotificationUIの「今すぐ送信」- 動作確認済み
2. ✅ 給与明細一覧のモーダルメール送信 - 実装完了
3. ✅ 賞与明細一覧のモーダルメール送信 - 実装完了
4. ✅ メール送信履歴保存・表示システム - 動作確認

**影響を受けない機能:**
- PayslipNotificationUIの「スケジュール送信」
- 従業員管理の従来メール送信機能
- スケジュール済み通知の自動実行
- 従業員アカウント作成機能

### 🎯 完成した機能の最終確認

**✅ 全機能テスト完了（2025-08-08 夜）:**
1. ✅ 正しい給与明細データでのメール送信 - 成功
2. ✅ 送信後のボタン表示 - グレー色で無効化
3. ✅ 賞与明細でも同様の機能 - 正常動作確認
4. ✅ Firestoreセキュリティルール - 権限問題解決

### 🔒 送信済み再送信防止機能（2025-08-08 最終実装）

**実装内容:**
- 送信済みの場合、ボタンを`disabled`に設定
- ボタン色をグレー（`text-gray-400`）に変更
- カーソルを禁止マーク（`cursor-not-allowed`）に変更
- 給与明細・賞与明細の両方で同一実装

### 📚 トラブルシューティング履歴

**1. 29名送信制限問題**
- **症状**: 62名中29名のみ送信成功
- **原因**: 給与明細データに存在しない従業員ID（000200番台）
- **解決**: データ不整合であり、システムは正常動作

**2. 送信済みボタンが緑色にならない問題**
- **症状**: メール送信後も送信済み表示されない
- **原因1**: 複数CSVアップロードによるuploadId不一致
- **原因2**: Firestoreセキュリティルール未設定
- **解決**: 
  - 古いデータ削除と再アップロード
  - `payslipEmailHistory`コレクションのルール追加

**3. TypeError問題**
- **症状**: `Cannot read properties of undefined (reading 'on')`
- **原因**: Cloud Functions内部呼び出しの誤り
- **解決**: `sendPayslipNotificationsInternal`関数作成

### 📋 最終的なシステム仕様

**メール送信フロー:**
1. CSVアップロード時: メール送信なし（データのみ）
2. 明細一覧画面: 手動でメール送信ボタンをクリック
3. 送信済み判定: グレー表示で再送信防止
4. 履歴管理: `payslipEmailHistory`コレクション

**関連ファイル:**
- `functions/index.js`: バックエンド処理
  - `startPayslipNotificationJob`: 非同期メール送信
  - `sendPayslipNotificationsInternal`: 内部処理関数
  - `processPayslipNotificationJob`: バックグラウンド処理
- `src/pages/PayslipList.js`: 給与明細一覧
- `src/pages/BonusPayslipList.js`: 賞与明細一覧
- `src/pages/PayslipNotificationUI.js`: メール送信UI
- `firestore.rules`: セキュリティルール設定

**必要なFirestoreコレクション:**
- `payslipEmailHistory`: メール送信履歴
- `payslipNotificationJobs`: 非同期ジョブ管理
- `emailNotifications`: スケジュール送信設定
- `emailJobs`: 一括メールジョブ

---

## PDF配信システム改善・メール形式最適化（2025-09-10）

### ✅ 完了した作業

**1. PDF配信システム改善**
- **実装日**: 2025-09-10
- **概要**: 退職者への書類配信を可能にしつつ、メール送信は在職者のみに制御
- **変更ファイル**: `src/pages/admin/PdfDelivery.js`
- **主な変更**:
  - 従業員取得条件から `isActive == true` 制限を削除
  - 個別配信・一括個別配信で全従業員（退職者含む）を選択可能
  - メール通知は在職者（`isActive: true`）のみにフィルタリング
  - UI上で退職者を視覚的に識別（取り消し線＋「退職済み」ラベル）

**2. 給与明細メールのテキスト化**
- **実装日**: 2025-09-10
- **概要**: HTML形式メールが開けない環境への対応
- **変更ファイル**: `functions/index.js`
- **主な変更**:
  - `createPayslipNotificationContent`関数をテキスト専用に変更
  - 複雑なHTML・CSS・色付けを削除
  - シンプルなテキスト形式（名前、発行通知、URL、送信元のみ）
  - すべてのメール送信箇所で`sendEmail()`の引数を調整

### 🎯 仕様変更の背景

**PDF配信システム**:
- **問題**: 退職者への源泉徴収票配信ができない
- **原因**: `isActive: true`制限により退職者が選択候補に出ない
- **解決**: 書類配信は退職者も可、メール通知のみ在職者限定

**メール形式**:
- **問題**: HTML形式メールが開けないユーザーが存在
- **原因**: 色付け・CSS・複雑なレイアウト
- **解決**: プレーンテキスト形式で互換性を最大化

### 🔧 技術的詳細

**PDF配信フィルタリング**:
```javascript
// メール送信時のフィルタリング例
const activeEmployeeIds = selectedEmployees.filter(empId => {
  const employee = employees.find(emp => emp.employeeId === empId);
  return employee?.isActive === true;
});
```

**新しいメールテンプレート**:
```
田中太郎 様

2025年9月分の給与明細が発行されました。
以下のリンクから確認してください。

https://kyuyoprint.web.app/employee/login

送信元: 給与明細システム

※ このメールに心当たりがない場合は、システム管理者にお問い合わせください。
```

### 📋 影響範囲

**変更なし（安全確認済み）**:
- 給与明細送信機能の従業員フィルタリング
- PayslipNotificationUI の動作
- 従業員管理のメール送信機能
- 退職者の `isActive` 管理方針

**変更あり**:
- PDF配信での従業員選択範囲拡大
- 給与明細通知メールの表示形式

---

---

## Firebase Authentication SMTP設定によるメール問題解決（2025-09-12）

### ✅ 解決した問題

**1. パスワードリセットメールが届かない問題**
- **原因**: Firebaseデフォルトドメイン（`noreply@kyuyoprint.firebaseapp.com`）がスパムフィルタでブロック
- **解決**: Gmail SMTP設定により `roumu3737@gmail.com` から送信

**2. 従業員ログイン問題**
- **原因**: 
  - 一部従業員のFirebase AuthアカウントのUIDなし
  - パスワードリセット不可によるログイン不能
- **解決**: 
  - Firebase ConsoleでUID手動追加
  - SMTP設定でメール配信改善

### 🔧 実装内容

**Firebase Authentication SMTP設定**:
```
送信者のアドレス: roumu3737@gmail.com
SMTP サーバーホスト: smtp.gmail.com
SMTP サーバーポート: 587
SMTP アカウントのユーザー名: roumu3737@gmail.com
SMTP アカウントのパスワード: [Googleアプリパスワード]
SMTP セキュリティ モード: TLS/STARTTLS
```

**設定場所**: Firebase Console → Authentication → テンプレート → SMTP設定

### 📊 改善効果

1. **メール配信改善**
   - 企業メール（Microsoft 365等）でのブロック回避
   - 配信成功率の大幅向上
   - 迷惑メールフォルダ振り分けの減少

2. **運用改善**
   - パスワードリセット機能の正常動作
   - 従業員サポート負荷の軽減
   - システム信頼性向上

### 🔑 初期パスワード仕様（最新版）

**現在の仕様**:
- **生成方法**: `generateSecurePassword()` でランダム8文字
- **文字構成**: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（紛らわしい文字除外）
- **保存場所**: Firestoreの`tempPassword`フィールド
- **確認方法**: Firebase Console → employees → 該当従業員 → tempPassword

### ⚠️ セキュリティ対応

**削除した危険な機能**:
- デバッグツール（AuthDebug.js）
- グローバルデバッグ関数（window.debugEmployeeData等）
- 全従業員データへの無制限アクセス機能

**理由**: データ破損リスク、セキュリティホール、権限昇格の危険性

---

**最終更新**: 2025-09-12（Firebase Authentication SMTP設定・認証問題解決版）
**作成者**: Claude Code Assistant  
**プロジェクト**: 給与明細システム (kyuyoprint)
**システム名**: 「そのままWeb明細」

## 退職者の仕様確認（2025-09-02）

### ✅ 確認した仕様

**退職者のシステム利用について**:
- **退職処理**: `isActive: false`をFirestoreに設定
- **Firebase Auth**: アカウントは**有効のまま**
- **ログイン**: **2年間は可能**（給与明細閲覧のため）
- **一覧表示**: 退職済みステータスで表示される
- **メール送信**: 対象外（`isActive: false`のため）

**理由**: 法的要件（給与明細の保管期間）を考慮した合理的な仕様

## 管理者ダッシュボード支給総額重複計算修正（2025-09-02）

### ✅ 問題と原因

**問題**: 給与明細を削除して再登録すると支給総額が重複計算される
- 例：実際50万円なのに100万円と表示

**原因**: 
- 削除時にFirestoreからデータが完全に削除されていない
- 同じ`paymentDate`で複数の`uploadId`のデータが存在
- 全てのデータが合算されて表示

### ✅ 修正内容

**修正方針**: 最新の`uploadId`のみを集計

**実装内容**（`src/pages/AdminDashboard.js`）:
1. 同じ支払日の全明細を`uploadId`でグループ化
2. `uploadedAt`タイムスタンプで最新のアップロードを特定  
3. 最新の`uploadId`に属する明細のみを集計
4. `uploadId`がない古いデータも処理可能（従来通り全件集計）

**影響**:
- ✅ 既存の給与明細データに影響なし
- ✅ データ構造の変更なし
- ✅ 他の機能への影響なし
- ✅ 重複データがあっても最新のみ表示

### 💾 Git履歴（最新5件）
```
0716ac5 管理者ダッシュボードの支給総額重複計算を修正 - 最新のuploadIdのみを集計するよう改善
d5a9bac 開発ログを更新 - 2025年8月10日の全作業記録
3851c04 メール予約送信の実行エラーを修正 - スケジュール実行時の内部関数呼び出しエラー解決
567f533 個別従業員登録の詳細デバッグalertを削除 - ユーザーフレンドリーなメッセージに変更
e3fa524 個別従業員登録のメール送信パスワード修正 - ランダムパスワードを正しく送信するよう変更
```

---

## PDF配信システム - セキュリティ修正（2025-11-27）

### 🚨 緊急修正: 他社従業員への誤送信バグ

**発見された問題**:
- PDF配信の個別メール送信で、選択した従業員以外（他社の従業員）にメールが送信される重大なセキュリティバグ
- 原因: `employeeId`だけで従業員を検索していたため、`companyId`が異なる従業員が検索されていた

### ✅ 修正内容

**1. companyIdフィルタリング追加** (`functions/index.js:2472-2515`)
```javascript
// 修正前（危険）
const employeeSnapshot = await db.collection('employees')
  .where('employeeId', '==', employeeId)
  .limit(1)
  .get();

// 修正後（安全）
// ドキュメントレコードからcompanyIdを取得
const documentSnapshot = await db.collection('documents').doc(documentId).get();
const companyId = documentSnapshot.data().companyId;

// companyIdフィルタを追加
const employeeSnapshot = await db.collection('employees')
  .where('employeeId', '==', employeeId)
  .where('companyId', '==', companyId)  // ← 追加
  .limit(1)
  .get();
```

**2. デバッグログ追加**
- 受信したemployeeIds配列の記録
- 各従業員検索の詳細プロセス
- メール送信対象の追加/スキップ理由
- 従業員発見時の`isActive`とメールアドレス確認

**3. スケジュール送信のuploadIds配列対応** (`functions/index.js:2016-2197`)
- `sendPayslipNotifications`関数を複数`uploadId`に対応
- 同日に複数回アップロードした場合でもスケジュール送信可能

**4. エラー表示改善** (`src/pages/admin/PdfDelivery.js:352-356`)
- メール送信エラー時にアラート表示を追加
- ユーザーにエラー内容を明示

### 🔒 セキュリティ改善効果

**修正前**:
- ❌ 他社の同じ`employeeId`を持つ従業員にメールが送信される
- ❌ 選択した従業員にメールが届かない場合がある
- ❌ データ漏洩のリスク

**修正後**:
- ✅ 選択した従業員だけにメールが送信される
- ✅ 他社の従業員には絶対に送信されない
- ✅ `companyId`で確実にフィルタリング
- ✅ ログで対象会社を確認可能

### 📋 動作確認

**テスト実行結果**（2025-11-27 13:11:45）:
```
🔍 受信したemployeeIds: ["2","4","3","5","6","9","10","12","14","15"]
🔒 配信対象会社: bjIZZAAweEYwEEYcOoQakjHvZnw1
📧 メール送信対象: 10名
📄 PDF配信通知完了: 成功 10件、失敗 0件
```

**確認事項**:
- ✅ 全10名に正常にメール送信
- ✅ companyIdフィルタリングが正常動作
- ✅ 他社従業員への誤送信なし

### 🔧 技術的詳細

**影響範囲**:
- `sendDocumentDeliveryNotification` 関数（PDF配信個別メール送信）
- `sendPayslipNotifications` 関数（給与明細スケジュール送信）

**関連ファイル**:
- `functions/index.js`: バックエンド処理
- `src/pages/admin/PdfDelivery.js`: フロントエンド（エラー表示改善）

**デプロイ方法**:
```bash
git add -A
git commit -m "緊急修正: PDF配信個別メール送信の他社従業員への誤送信バグを修正"
git push origin main
# GitHub Actionsで自動デプロイ（2-3分）
```

### 📝 今後の注意事項

**従業員検索時の鉄則**:
- ❌ `employeeId`だけで検索しない
- ✅ 必ず`companyId`フィルタを追加
- ✅ セキュリティログで対象会社を記録

**理由**: `employeeId`は企業間で重複する可能性があり、`companyId`による明示的なフィルタリングが必須

---

**最終更新**: 2025-11-27（PDF配信セキュリティ修正・デプロイルール追加版）