// src/pages/CsvMapping/constants.js
// CSVマッピングで使用する定数（汎用化版）

// 主要フィールドの定義（最小限の汎用的な項目のみ）
export const mainFieldKeys = {
  'employeeCode': ['従業員コード', '従業員ID', '社員番号', '社員ID', 'Employee ID', 'Employee Code'],
  'employeeName': ['従業員氏名', '氏名', '社員氏名', 'Employee Name', 'Name'],
  'departmentCode': ['部門コード', '部署コード', 'Department Code'],
  'departmentName': ['部門名', '部署名', 'Department Name', 'Department'],
  'paymentDate': ['支払日', '給与支給日', 'Payment Date', 'Pay Date']
};

// 項目カテゴリの汎用的キーワード（多言語対応）
export const incomeKeywords = [
  // 日本語
  '給', '手当', '報酬', '賞与', '支給',
  // 英語
  'salary', 'allowance', 'bonus', 'income', 'pay', 'wage'
];

export const deductionKeywords = [
  // 日本語
  '保険', '税', '控除', '天引', '差引',
  // 英語
  'tax', 'insurance', 'deduction', 'withholding'
];

export const attendanceKeywords = [
  // 日本語
  '日数', '時間', '残業', '休暇', '出勤', '欠勤',
  // 英語
  'days', 'hours', 'overtime', 'vacation', 'attendance', 'absence'
];

// 初期マッピング設定（最小限）
export const initialMappingConfig = {
  mainFields: {
    employeeCode: { columnIndex: -1, headerName: '' },
    employeeName: { columnIndex: -1, headerName: '' },
    departmentCode: { columnIndex: -1, headerName: '' },
    departmentName: { columnIndex: -1, headerName: '' },
    paymentDate: { columnIndex: -1, headerName: '' }
  },
  incomeItems: [],
  deductionItems: [],
  attendanceItems: [],
  totalItems: [],
  summaryItems: [],
  itemCodeItems: [],
  kyItems: []
};

// タブ定数
export const TABS = {
  INCOME: 'income',
  DEDUCTION: 'deduction',
  ATTENDANCE: 'attendance',
  TOTAL: 'total',
  KY: 'itemCode'
};

// カテゴリ名の定義（多言語対応準備）
export const CATEGORY_NAMES = {
  incomeItems: '支給項目',
  deductionItems: '控除項目',
  attendanceItems: '勤怠項目',
  totalItems: '合計項目',
  itemCodeItems: '項目コード'
};
