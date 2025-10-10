# 削除履歴の確認方法

## 方法1: Firebaseログ確認（推奨）

Firebase Consoleでログを確認:
```
https://console.firebase.google.com/project/kyuyoprint/firestore/usage
```

または

```
gcloud logging read "resource.type=firestore_database" --limit=50 --format=json
```

## 方法2: 現在のデータで確認

1. Firebase Console → Firestore → employees
2. 従業員ID 48（KOH WAN JIA）のドキュメントをクリック
3. 「createdAt」と「updatedAt」のタイムスタンプを確認

**もし本当に削除→再登録されていたら**:
- createdAt: 最近の日時（今日）
- updatedAt: 最近の日時（今日）

**もし削除されていなかったら**:
- createdAt: 元の登録日時（2025-10-10 10:52:12 UTC+9）
- updatedAt: 編集した日時

## 方法3: Firebase Authentication確認

Firebase Console → Authentication → Users
→ Bellekohwanjia@gmail.com のユーザー作成日時を確認
