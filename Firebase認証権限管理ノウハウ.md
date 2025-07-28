# Firebase認証・権限管理トラブルシューティングノウハウ

## 概要
給与明細システム開発で遭遇したFirebase認証・権限関連の問題と解決策をまとめました。新規アプリ開発時の参考資料として活用してください。

## 主要な問題領域

### 1. 従業員登録時のFirebase Auth連携問題

#### 問題の背景
- 管理者が従業員を一括登録する際、Firebase Authenticationアカウントの自動作成が必要
- 従業員データ（Firestore）とAuthアカウントの整合性確保が困難
- Cloud Functionsでの認証処理が複雑化

#### 遭遇した具体的な問題

**A. Cloud Functions実行権限エラー**
```
Error: Missing or insufficient permissions
```
- **原因**: Cloud Functionsの実行者にFirestore読み書き権限が不足
- **解決策**: 
  - Firestore Rules を一時的に緩和（開発中）
  - IAM設定でCloud Functions実行者に適切な権限を付与
  - Service Accountの権限を見直し

**B. 従業員UID不整合問題**
- **問題**: EmployeesコレクションにUIDが設定されていない従業員が存在
- **影響**: 認証済みでもFirestoreからユーザー詳細を取得できない
- **解決策**: 
  ```javascript
  // 修正用Cloud Function
  exports.fixEmployeeUIDs = onCall(async (request) => {
    // 既存Firebase Authユーザーを検索
    const userRecord = await admin.auth().getUserByEmail(employeeData.email);
    // FirestoreドキュメントにUIDを追加
    await doc.ref.update({
      uid: userRecord.uid,
      status: 'auth_created'
    });
  });
  ```

**C. 認証フロー中の権限エラー**
- **問題**: AuthContextでuserDetails取得時にFirestore権限エラー
- **解決策**: 
  - エラー時の自動リトライ機能を実装
  - 権限エラー時の適切なログアウト処理
  ```javascript
  // 権限エラー時の処理
  if (error.message?.includes('Missing or insufficient permissions')) {
    console.log('🔄 権限エラー検出 - 3秒後にリトライ');
    setTimeout(async () => {
      try {
        const details = await fetchUserDetails(user);
        console.log('✅ リトライ成功:', details);
      } catch (retryError) {
        await signOut(auth); // 自動ログアウト
      }
    }, 3000);
  }
  ```

### 2. Firestore Security Rules設計

#### 開発中の権限設定
```javascript
// 開発・デバッグ用（緩い設定）
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /employees/{employeeId} {
      allow read, write: if request.auth != null;
    }
    match /payslips/{payslipId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

#### 本番環境推奨設定
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /employees/{employeeId} {
      // 自分のデータまたは同じ会社の管理者のみ
      allow read: if request.auth != null && (
        resource.data.uid == request.auth.uid ||
        isCompanyAdmin(request.auth.uid, resource.data.companyId)
      );
      allow write: if request.auth != null && 
        isCompanyAdmin(request.auth.uid, resource.data.companyId);
    }
    
    function isCompanyAdmin(uid, companyId) {
      return exists(/databases/$(database)/documents/users/$(uid)) &&
        get(/databases/$(database)/documents/users/$(uid)).data.role == 'admin' &&
        get(/databases/$(database)/documents/users/$(uid)).data.companyId == companyId;
    }
  }
}
```

### 3. 認証状態管理（AuthContext）

#### 問題と解決策

**A. モバイルデバイスでの認証遅延**
```javascript
// モバイル対応の認証処理
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      // モバイルデバイスの場合は遅延を追加
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        console.log('📱 モバイルデバイス検出 - 認証トークン同期のため待機');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const details = await fetchUserDetails(user);
    }
  });
}, []);
```

**B. ログアウト時のリダイレクト問題**
```javascript
// 確実なログアウト処理
function logout() {
  return signOut(auth).then(() => {
    // ログアウト後の状態クリア
    setCurrentUser(null);
    setUserDetails(null);
    
    // 強制リダイレクト（携帯対応）
    if (window.location.pathname !== '/') {
      window.location.replace('/');
    }
  });
}
```

### 4. Cloud Functions設計パターン

#### 従業員アカウント作成Function
```javascript
exports.createEmployeeAccount = onCall({ 
  enforceAppCheck: false,
  invoker: 'public'
}, async (request) => {
  // 認証チェック
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', '管理者認証が必要です');
  }
  
  try {
    // Firebase Authでユーザー作成
    const userRecord = await admin.auth().createUser({
      email: email,
      password: TEST_PASSWORD,
      displayName: name,
      emailVerified: false
    });
    
    // Firestoreの従業員データにUIDを紐付け
    await employeeDoc.ref.update({
      uid: userRecord.uid,
      status: 'auth_created',
      tempPassword: TEST_PASSWORD
    });
    
    return { success: true, uid: userRecord.uid };
  } catch (error) {
    throw new HttpsError('internal', `アカウント作成失敗: ${error.message}`);
  }
});
```

### 5. 開発・デバッグのベストプラクティス

#### A. エラーログの充実
```javascript
// 詳細なログ出力
console.log('🔍 認証デバッグ情報:', {
  currentUser: currentUser ? `${currentUser.email} (${currentUser.uid})` : 'null',
  userDetails: userDetails ? `${userDetails.name} (${userDetails.employeeId})` : 'null',
  loading: loading
});
```

#### B. 段階的権限緩和
1. **開発初期**: すべて `allow read, write: if request.auth != null;`
2. **機能実装**: 必要最小限の権限チェックを追加
3. **本番前**: 厳密なセキュリティルールを実装

#### C. テスト用データとFunction
```javascript
// デバッグ用Function
exports.debugEmployeeData = onCall(async (request) => {
  // 全従業員データの状態確認
  const employeesSnapshot = await db.collection('employees').get();
  
  return {
    totalEmployees: employeesSnapshot.size,
    employeesWithUID: employeesSnapshot.docs.filter(doc => doc.data().uid).length,
    employeesWithoutUID: employeesSnapshot.docs.filter(doc => !doc.data().uid).length
  };
});
```

### 6. トラブルシューティングチェックリスト

#### 認証エラー発生時
- [ ] Firebase Console > Authentication でユーザーが作成されているか
- [ ] Firestore > employees コレクションでUIDが設定されているか
- [ ] Security Rules で適切な権限が設定されているか
- [ ] Cloud Functions の実行権限が正しいか
- [ ] ブラウザのコンソールでネットワークエラーがないか

#### 権限エラー発生時
- [ ] request.auth.uid が正しく取得できているか
- [ ] Firestore Rules の条件文が正しいか
- [ ] companyId の整合性が取れているか
- [ ] 一時的にRulesを緩和して問題を特定

### 7. 本番運用での推奨事項

#### A. セキュリティ
- Cloud Functions は `enforceAppCheck: true` を設定
- Firestore Rules は最小権限の原則
- 定期的なセキュリティ監査

#### B. エラーハンドリング
- ユーザーフレンドリーなエラーメッセージ
- 自動リトライ機能
- フォールバック処理の実装

#### C. モニタリング
- Firebase Console でエラー率を監視
- Cloud Functions のログ監視
- 認証失敗の傾向分析

## まとめ

Firebase認証・権限管理で最も重要なのは：

1. **段階的実装**: 最初は緩い権限で機能を作り、徐々に厳格化
2. **詳細なログ**: 問題特定のための十分なデバッグ情報
3. **エラーハンドリング**: ユーザー体験を損なわない適切なエラー処理
4. **テスト環境**: 本番に影響しない検証環境の整備

これらのノウハウを活用することで、Firebase認証システムの安定した開発・運用が可能になります。