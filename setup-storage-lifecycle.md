# Firebase Storage Lifecycle Rules 設定手順

## 概要
PDF配信システムで配信されたファイルを2年後に自動削除するためのLifecycle Rules設定手順です。

## 設定方法

### 1. Google Cloud Console GUI設定（推奨）

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクト「kyuyoprint」を選択
3. Cloud Storage → Buckets → kyuyoprint.firebasestorage.app
4. 「ライフサイクル」タブをクリック
5. 「ルールを追加」をクリック
6. 以下の設定を入力：
   - **アクション**: 削除
   - **条件**: 
     - 経過日数: 730日（2年）
     - プレフィックス: `documents/` または `pdf-delivery/`

**設定完了後の確認手順:**
- Cloud Consoleでルールが追加されていることを確認
- 既存ファイルに影響がないことを確認

### 2. Google Cloud CLIを使用する方法（権限エラー解決後）

```bash
# 管理者権限でコマンドプロンプトを開いてから実行
gcloud config set project kyuyoprint
gsutil lifecycle set storage.lifecycle.json gs://kyuyoprint.firebasestorage.app
```

## 設定内容

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

## 設定確認

```bash
# 現在のライフサイクル設定を確認
gsutil lifecycle get gs://kyuyoprint.firebasestorage.app
```

## 注意事項

1. **テスト環境での確認**: まずテストファイルで動作確認を行ってください
2. **法的要件**: 労働基準法では賃金台帳等は3年保存が義務とされていますが、PDF配信書類は2年で設定
3. **手動削除**: 必要に応じて手動での削除も可能です
4. **バックアップ**: 重要な書類は別途バックアップを検討してください

## コスト削減効果

- 年間約1,230円のストレージコスト削減（200名企業想定）
- 不要ファイルの自動整理によるストレージ使用量最適化