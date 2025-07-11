// tests/e2e/csv-mapping.spec.js
// CSVマッピング機能のE2Eテスト

const { test, expect } = require('@playwright/test');

// テスト用の定数
const TEST_DATA = {
  // ログイン情報（環境変数から取得することを推奨）
  email: process.env.TEST_EMAIL || 'test@example.com',
  password: process.env.TEST_PASSWORD || 'testpassword',
  
  // CSVヘッダーのサンプル
  csvHeaders: {
    basic: '識別コード,従業員コード,氏名,基本給,時間外手当,通勤手当',
    withTabs: '識別コード\t従業員コード\t氏名\t基本給\t時間外手当\t通勤手当',
    complex: '社員番号,社員名,基本給与,残業代,交通費,健康保険,厚生年金,出勤日数,欠勤日数',
    withKY: '識別コード,従業員コード,氏名,基本給,KY1,KY2,KY3',
    large: Array.from({length: 50}, (_, i) => `列${i+1}`).join(',')
  },
  
  // KY項目のサンプル
  kyItems: {
    basic: 'KY1,KY2,KY3',
    withLabels: 'KY1:評価点,KY2:ボーナス倍率,KY3:特別手当'
  },
  
  // 行ベースマッピングのサンプル
  rowBased: {
    headers: '識別コード,従業員コード,氏名,基本給,時間外手当,通勤手当',
    kyRow: 'KY001,KY002,KY003,KY004,KY005,KY006'
  }
};

// ログイン処理を行うヘルパー関数
async function login(page, email, password) {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  // ログイン完了を待つ（ダッシュボードへのリダイレクト）
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

// CSVマッピングページへ移動
async function navigateToCsvMapping(page) {
  // 設定ページへ
  await page.goto('http://localhost:3000/settings');
  await page.waitForLoadState('networkidle');
  
  // CSVマッピング設定リンクをクリック
  await page.click('text=CSVマッピング設定');
  await page.waitForURL('**/csv-mapping');
}

test.describe('CSVマッピング機能', () => {
  test.beforeEach(async ({ page }) => {
    // 各テストの前にログイン
    await login(page, TEST_DATA.email, TEST_DATA.password);
    await navigateToCsvMapping(page);
  });

  test('1. 基本的なCSVヘッダー入力と解析', async ({ page }) => {
    // CSVヘッダー入力
    await page.fill('textarea[placeholder*="CSV"]', TEST_DATA.csvHeaders.basic);
    
    // 解析ボタンをクリック
    await page.click('button:has-text("ヘッダーを解析")');
    
    // 成功メッセージの確認
    await expect(page.locator('.bg-green-100')).toContainText('6個のヘッダーを正常に解析しました');
    
    // 主要フィールドが自動マッピングされているか確認
    const identificationSelect = page.locator('select[id="identificationCode"]');
    await expect(identificationSelect).toHaveValue('0'); // 識別コードは最初の列
    
    const employeeCodeSelect = page.locator('select[id="employeeCode"]');
    await expect(employeeCodeSelect).toHaveValue('1'); // 従業員コードは2番目の列
  });

  test('2. タブ区切りのCSVヘッダー入力', async ({ page }) => {
    // タブ区切りのヘッダー入力
    await page.fill('textarea[placeholder*="CSV"]', TEST_DATA.csvHeaders.withTabs);
    await page.click('button:has-text("ヘッダーを解析")');
    
    // 成功メッセージの確認
    await expect(page.locator('.bg-green-100')).toContainText('6個のヘッダーを正常に解析しました');
  });

  test('3. KY項目の一括マッピング', async ({ page }) => {
    // KY項目マッピングモードを開く
    await page.click('button:has-text("KY項目を一括マッピング")');
    
    //