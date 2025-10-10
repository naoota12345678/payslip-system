# デバッグ手順

## ブラウザコンソールで確認

1. 従業員管理画面を開く
2. F12キーを押してデベロッパーツールを開く
3. Consoleタブを選択
4. 以下のコードを実行:

```javascript
// 従業員データを確認
console.table(
  Array.from(document.querySelectorAll('tbody tr')).map(row => ({
    表示名: row.cells[1]?.textContent,
    HTML: row.cells[1]?.innerHTML
  }))
);
```

5. 結果をスクリーンショットで教えてください
