# 雇用契約書管理システム セットアップガイド

## 概要
給与明細システムの認証基盤とアーキテクチャを活用して、雇用契約書管理システムを構築するためのガイドです。

## プロジェクト構成

### 1. Firebase側の構成
```
Firebaseプロジェクト: kyuyoprint（共通）
├── 認証（Authentication）- 共通利用
├── 会社データ（companies）- 共通利用
├── 従業員データ（employees）- 共通利用
│
├── 給与明細用コレクション
│   ├── payslips
│   ├── bonusPayslips
│   └── csvMappings
│
└── 雇用契約書用コレクション（新規）
    ├── contracts
    ├── contractTemplates
    └── contractMappings
```

### 2. 開発環境側の構成
```
Cursorワークスペース1: payslip-system（現在）
Cursorワークスペース2: employment-contract-system（新規）
```

## セットアップ手順

### 1. プロジェクトのコピーと初期化

```bash
# 1. 新しいディレクトリで現在のプロジェクトをコピー
cd ..  # payslip-systemの親ディレクトリへ
cp -r payslip-system employment-contract-system
cd employment-contract-system

# 2. Gitの初期化（履歴をリセット）
rm -rf .git
git init

# 3. 新しいGitHubリポジトリを作成して接続
git remote add origin https://github.com/[あなたのユーザー名]/employment-contract-system.git

# 4. package.jsonの更新
# nameを "employment-contract-system" に変更

# 5. 初回コミット
git add .
git commit -m "Initial commit: Fork from payslip-system"
git push -u origin main
```

### 2. Cursorでの作業

1. **新しいウィンドウで開く**
   - File → New Window
   - Open Folder → employment-contract-systemを選択

2. **別ワークスペースの利点**
   - 給与システムを誤って変更しない
   - それぞれ独立したGit管理
   - 別々のターミナルセッション
   - プロジェクト固有の設定

### 3. 初期クリーンアップ

```javascript
// 1. README.mdを更新
# 雇用契約書管理システム

// 2. 不要なページを削除
- src/pages/PayslipList.js
- src/pages/BonusPayslipList.js
- src/pages/SimpleCSVUpload.js
- src/pages/BonusSimpleCSVUpload.js
- src/pages/PayslipDetail.js
- src/pages/BonusPayslipDetail.js
- src/pages/CsvUpload/*
- src/pages/BonusCsvUpload/*
- etc...

// 3. ナビゲーションを更新
// src/components/Navigation.js
- 給与明細関連のリンクを削除
+ 契約書関連のリンクを追加

// 4. ホームページを契約書用に変更
// src/App.js のルーティング更新
```

### 4. 環境変数の設定

```bash
# .env.local
REACT_APP_SYSTEM_TYPE=CONTRACT
REACT_APP_SYSTEM_NAME=雇用契約書管理システム

# 給与システム側の.env.local（参考）
REACT_APP_SYSTEM_TYPE=PAYSLIP
REACT_APP_SYSTEM_NAME=給与明細システム
```

## データ構造の設計

### 雇用契約書コレクション

```javascript
// contracts コレクション
{
  id: auto,
  companyId: string,
  employeeId: string,
  contractType: '正社員' | '契約社員' | 'パート' | 'アルバイト',
  status: 'draft' | 'pending' | 'signed' | 'expired',
  
  // 基本情報
  employeeInfo: {
    name: string,
    nameKana: string,
    address: string,
    phone: string,
    email: string,
    birthDate: date,
    gender: string
  },
  
  // 契約条件
  terms: {
    startDate: date,
    endDate: date | null,
    probationPeriod: number, // 試用期間（月）
    position: string,        // 職位
    department: string,      // 部署
    workLocation: string,    // 勤務地
    
    // 給与情報
    salary: {
      base: number,          // 基本給
      allowances: {          // 手当
        transport: number,
        housing: number,
        position: number,
        overtime: number,
        other: {}
      },
      paymentDay: number,    // 支払日
      paymentMethod: string  // 支払方法
    },
    
    // 勤務条件
    workingHours: {
      regularHours: string,  // 定時（例: "9:00-18:00"）
      breakTime: string,     // 休憩時間
      weeklyDays: number,    // 週の勤務日数
      holidays: [],          // 休日
      annualLeave: number    // 年次有給休暇
    },
    
    // その他の条件
    insurance: {
      healthInsurance: boolean,
      employmentInsurance: boolean,
      workersCompensation: boolean,
      pension: boolean
    },
    
    specialTerms: string     // 特記事項
  },
  
  // 署名情報
  signatures: {
    employee: {
      signed: boolean,
      signedAt: timestamp,
      signatureData: string,  // 署名画像データ
      ipAddress: string
    },
    employer: {
      signed: boolean,
      signedAt: timestamp,
      signerName: string,
      signerTitle: string,
      signatureData: string
    }
  },
  
  // 管理情報
  templateId: string,        // 使用したテンプレート
  version: number,           // バージョン番号
  previousVersionId: string, // 前バージョンのID
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: string,
  pdfUrl: string,           // 生成されたPDFのURL
  
  // 通知履歴
  notifications: [{
    type: 'created' | 'sent' | 'reminder' | 'signed',
    sentAt: timestamp,
    method: 'email' | 'system'
  }]
}
```

### 契約書テンプレートコレクション

```javascript
// contractTemplates コレクション
{
  id: auto,
  companyId: string,
  templateName: string,
  contractType: '正社員' | '契約社員' | 'パート' | 'アルバイト',
  isActive: boolean,
  
  // フィールド定義
  fields: {
    // 各フィールドの設定
    fieldName: {
      label: string,          // 表示名
      type: 'text' | 'number' | 'date' | 'select' | 'checkbox',
      required: boolean,
      editable: boolean,      // 個別契約で編集可能か
      defaultValue: any,
      options: [],            // selectタイプの場合の選択肢
      validation: {
        min: number,
        max: number,
        pattern: string
      }
    }
  },
  
  // PDF生成用の設定
  pdfTemplate: {
    layout: string,           // レイアウトHTML
    styles: string,           // CSS
    headerImage: string,      // ヘッダー画像URL
    footerText: string        // フッターテキスト
  },
  
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: string
}
```

### 契約書マッピングコレクション

```javascript
// contractMappings コレクション
{
  id: companyId,
  companyId: string,
  
  // CSVマッピング設定
  csvMapping: {
    employeeIdColumn: string,
    fieldMappings: {
      csvHeader: contractField
    }
  },
  
  // デフォルト値設定
  defaults: {
    contractType: string,
    workingHours: {},
    insurance: {}
  },
  
  updatedAt: timestamp,
  updatedBy: string
}
```

## 機能実装の優先順位

### Phase 1: 基本機能（1-2週間）
- [ ] 認証システムの動作確認
- [ ] 基本的なルーティング設定
- [ ] 契約書一覧画面
- [ ] 契約書詳細画面
- [ ] 契約書作成フォーム

### Phase 2: テンプレート機能（1週間）
- [ ] テンプレート管理画面
- [ ] テンプレート作成・編集
- [ ] テンプレートからの契約書生成

### Phase 3: マッピング機能（1週間）
- [ ] CSVアップロード機能
- [ ] マッピング設定画面
- [ ] 一括契約書作成
- [ ] 手動編集機能

### Phase 4: PDF生成（1週間）
- [ ] HTMLからPDF生成
- [ ] PDFテンプレートデザイン
- [ ] プレビュー機能
- [ ] PDFダウンロード

### Phase 5: 電子署名（2週間）
- [ ] 署名用URL生成
- [ ] 従業員署名画面
- [ ] 管理者承認画面
- [ ] タイムスタンプ機能
- [ ] 署名済みPDFの保管

### Phase 6: 通知・管理機能（1週間）
- [ ] メール通知機能
- [ ] リマインダー機能
- [ ] 契約更新アラート
- [ ] 監査ログ

## セキュリティルールの設定

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 既存の給与明細ルール（変更なし）
    match /payslips/{document} {
      // 既存のルール
    }
    
    // 契約書ルール
    match /contracts/{contractId} {
      // 読み取り：本人または管理者
      allow read: if request.auth != null && (
        request.auth.uid == resource.data.employeeId ||
        isCompanyAdmin(resource.data.companyId)
      );
      
      // 作成・更新：管理者のみ
      allow create: if request.auth != null && 
        isCompanyAdmin(request.resource.data.companyId);
      
      allow update: if request.auth != null && 
        isCompanyAdmin(resource.data.companyId);
      
      // 従業員による署名のみ許可
      allow update: if request.auth != null &&
        request.auth.uid == resource.data.employeeId &&
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['signatures.employee']);
      
      // 削除：不可
      allow delete: if false;
    }
    
    // テンプレートルール
    match /contractTemplates/{templateId} {
      allow read: if request.auth != null && 
        isCompanyAdmin(resource.data.companyId);
      
      allow write: if request.auth != null && 
        isCompanyAdmin(request.resource.data.companyId);
    }
    
    // ヘルパー関数
    function isCompanyAdmin(companyId) {
      return request.auth.token.role == 'admin' && 
             request.auth.token.companyId == companyId;
    }
  }
}
```

## 将来の統合を見据えた設計

### アプリ切り替えUI

```javascript
// 共通ヘッダーコンポーネント
const SystemSwitcher = () => {
  const currentSystem = process.env.REACT_APP_SYSTEM_TYPE;
  
  return (
    <div className="system-switcher">
      <a 
        href="https://kyuyoprint.web.app" 
        className={currentSystem === 'PAYSLIP' ? 'active' : ''}
      >
        給与明細システム
      </a>
      <a 
        href="https://employment-contract.web.app"
        className={currentSystem === 'CONTRACT' ? 'active' : ''}
      >
        雇用契約書システム
      </a>
    </div>
  );
};
```

### 共通コンポーネントの管理

```javascript
// 将来的に共通パッケージ化を検討
@your-company/common-components
├── AuthContext
├── Layout
├── Navigation
├── EmployeeSelector
└── CompanyGuard
```

## 注意事項

1. **データの分離**
   - 給与データと契約書データは完全に別コレクション
   - 共通マスタ（会社・従業員）は参照のみ、更新は各アプリから可能

2. **権限管理**
   - 契約書専用の権限設定を追加
   - 従業員は自分の契約書のみ閲覧・署名可能

3. **バージョン管理**
   - 契約書の変更履歴を保持
   - 法的要件に応じた保管期間の設定

4. **セキュリティ**
   - 個人情報の暗号化
   - PDFへのアクセス制限
   - 監査ログの実装

5. **法的要件**
   - 電子署名法への準拠
   - タイムスタンプの実装
   - 改ざん防止対策

## 開発のヒント

1. 給与明細システムのコードを参考にしながら、契約書特有の要件に合わせて改修
2. 認証・会社管理・従業員管理の基本部分はそのまま活用
3. UIコンポーネントは再利用しつつ、契約書用にカスタマイズ
4. Firebaseの機能（Authentication, Firestore, Storage, Functions）をフル活用

頑張って開発してください！質問があればいつでもどうぞ。