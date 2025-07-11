// tests/manual-test-helper.js
// ローカルテストを補助するためのヘルパースクリプト

// ブラウザのコンソールで実行するためのテストヘルパー関数

// テストデータ
const testData = {
  // 基本的なCSVヘッダー
  basicHeaders: '識別コード,従業員コード,氏名,基本給,時間外手当,通勤手当,健康保険,厚生年金,出勤日数,欠勤日数',
  
  // タブ区切り
  tabHeaders: '識別コード\t従業員コード\t氏名\t基本給\t時間外手当\t通勤手当',
  
  // KY項目を含む
  kyHeaders: '識別コード,従業員コード,氏名,基本給,KY001,KY002,KY003,KY004,KY005',
  
  // 行ベースマッピング
  rowBasedData: `識別コード,従業員コード,氏名,基本給,時間外手当,通勤手当,健康保険,厚生年金
KY001,KY002,KY003,KY004,KY005,KY006,KY007,KY008`,
  
  // 大量データ（50列）
  largeHeaders: (() => {
    const columns = ['識別コード', '従業員コード', '氏名'];
    for (let i = 1; i <= 47; i++) {
      columns.push(`列${i}`);
    }
    return columns.join(',');
  })(),
  
  // KY項目
  kyItems: 'KY001,KY002,KY003,KY004,KY005',
  
  // 有効なJSON設定
  validJson: JSON.stringify({
    csvMapping: {
      mainFields: {
        identificationCode: { columnIndex: 0, headerName: "識別コード" },
        employeeCode: { columnIndex: 1, headerName: "従業員コード" },
        employeeName: { columnIndex: 2, headerName: "氏名" },
        departmentCode: { columnIndex: -1, headerName: "" }
      },
      incomeItems: [
        { columnIndex: 3, headerName: "基本給", itemName: "基本給", isVisible: true, id: "income_基本給_3" }
      ],
      deductionItems: [],
      attendanceItems: [],
      kyItems: []
    }
  }, null, 2),
  
  // 無効なJSON
  invalidJson: '{ invalid json format'
};

// テスト実行用の関数
const testHelpers = {
  // ヘッダー入力欄にデータを設定
  setHeaderInput: (data) => {
    const textarea = document.querySelector('textarea[placeholder*="CSV"]');
    if (textarea) {
      textarea.value = data;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      console.log('✅ ヘッダー入力完了');
    } else {
      console.error('❌ ヘッダー入力欄が見つかりません');
    }
  },
  
  // 解析ボタンをクリック
  clickParseButton: () => {
    const button = Array.from(document.querySelectorAll('button')).find(
      btn => btn.textContent.includes('ヘッダーを解析')
    );
    if (button) {
      button.click();
      console.log('✅ 解析ボタンクリック');
    } else {
      console.error('❌ 解析ボタンが見つかりません');
    }
  },
  
  // 保存ボタンをクリック
  clickSaveButton: () => {
    const button = Array.from(document.querySelectorAll('button')).find(
      btn => btn.textContent.includes('設定を保存')
    );
    if (button) {
      button.click();
      console.log('✅ 保存ボタンクリック');
    } else {
      console.error('❌ 保存ボタンが見つかりません');
    }
  },
  
  // マッピング状態を確認
  checkMappingState: () => {
    const selects = document.querySelectorAll('select');
    const state = {};
    
    selects.forEach(select => {
      if (select.id) {
        state[select.id] = {
          value: select.value,
          text: select.options[select.selectedIndex]?.text || '未選択'
        };
      }
    });
    
    console.log('📊 現在のマッピング状態:', state);
    return state;
  },
  
  // エラーメッセージを確認
  checkErrors: () => {
    const errorElements = document.querySelectorAll('.bg-red-100');
    if (errorElements.length > 0) {
      errorElements.forEach(el => {
        console.error('❌ エラー:', el.textContent);
      });
      return true;
    }
    console.log('✅ エラーなし');
    return false;
  },
  
  // 成功メッセージを確認
  checkSuccess: () => {
    const successElements = document.querySelectorAll('.bg-green-100');
    if (successElements.length > 0) {
      successElements.forEach(el => {
        console.log('✅ 成功:', el.textContent);
      });
      return true;
    }
    return false;
  },
  
  // タブを切り替え
  switchTab: (tabName) => {
    const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
    const tab = tabs.find(t => t.textContent.includes(tabName));
    if (tab) {
      tab.click();
      console.log(`✅ ${tabName}タブに切り替え`);
    } else {
      console.error(`❌ ${tabName}タブが見つかりません`);
    }
  },
  
  // 全てのテストを順番に実行
  runAllTests: async () => {
    console.log('🚀 総合テスト開始...\n');
    
    // テスト1: 基本的なヘッダー解析
    console.log('📝 テスト1: 基本的なヘッダー解析');
    testHelpers.setHeaderInput(testData.basicHeaders);
    await new Promise(resolve => setTimeout(resolve, 500));
    testHelpers.clickParseButton();
    await new Promise(resolve => setTimeout(resolve, 1000));
    testHelpers.checkSuccess();
    testHelpers.checkMappingState();
    
    // テスト2: タブ区切り
    console.log('\n📝 テスト2: タブ区切りヘッダー');
    testHelpers.setHeaderInput(testData.tabHeaders);
    await new Promise(resolve => setTimeout(resolve, 500));
    testHelpers.clickParseButton();
    await new Promise(resolve => setTimeout(resolve, 1000));
    testHelpers.checkSuccess();
    
    // テスト3: エラーケース
    console.log('\n📝 テスト3: 空入力エラー');
    testHelpers.setHeaderInput('');
    await new Promise(resolve => setTimeout(resolve, 500));
    testHelpers.clickParseButton();
    await new Promise(resolve => setTimeout(resolve, 1000));
    testHelpers.checkErrors();
    
    // テスト4: 大量データ
    console.log('\n📝 テスト4: 大量データ（50列）');
    testHelpers.setHeaderInput(testData.largeHeaders);
    await new Promise(resolve => setTimeout(resolve, 500));
    testHelpers.clickParseButton();
    await new Promise(resolve => setTimeout(resolve, 2000));
    testHelpers.checkSuccess();
    
    console.log('\n✅ 総合テスト完了！');
  }
};

// グローバルに公開
window.testHelpers = testHelpers;
window.testData = testData;

console.log(`
🧪 CSVマッピング テストヘルパー読み込み完了！

使用方法:
- testHelpers.setHeaderInput(testData.basicHeaders) - 基本ヘッダーを入力
- testHelpers.clickParseButton() - 解析実行
- testHelpers.checkMappingState() - 現在の状態確認
- testHelpers.runAllTests() - 全テスト実行

テストデータ:
- testData.basicHeaders - 基本的なCSVヘッダー
- testData.tabHeaders - タブ区切り
- testData.kyHeaders - KY項目を含む
- testData.largeHeaders - 50列のヘッダー
- testData.validJson - 有効なJSON設定

詳細は window.testHelpers と window.testData を参照してください。
`);
