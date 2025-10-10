# Firestoreデータ確認手順

## 従業員ID 48番のデータ確認

### Firebase Consoleでの確認方法
1. https://console.firebase.google.com/project/kyuyoprint/firestore
2. `employees` コレクションを開く
3. 従業員ID `48` または メールアドレス `Bellekohwanjia@gmail.com` で検索
4. `name` フィールドの値を確認してください

### 確認すべき内容
- `name` フィールドの実際の値
- `displayName` フィールドがあるか
- `updatedAt` のタイムスタンプ（いつ保存されたか）

この情報があれば、問題の原因が特定できます。
