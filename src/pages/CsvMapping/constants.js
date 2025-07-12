// src/pages/CsvMapping/constants.js
// CSVマッピングで使用する定数

// 給与システムの基本列定義
export const systemColumns = [
  "識別コード※", "部門コード", "部門名", "従業員コード※", "従業員氏名",
  "出勤日数", "欠勤日数", "普通残業時間", "深夜残業時間", "休日出勤時間",
  "休日深夜時間", "遅刻時間", "月労働時間数", "出張", "出向",
  "有給取得日数", "有給残日数", "早退時間", "普通残業単価", "深夜残業単価",
  "休日出勤単価", "休日深夜単価", "遅刻早退単価", "欠勤単価", "単価",
  "通勤手当日額", "通勤手当月額", "固定残業時間", "基本給", "管理職手当",
  "固定残業手当", "残業手当", "特別手当", "扶養手当", "前月調整",
  "固定残業超過", "深夜手当", "休日手当", "勤怠控除", "通勤手当(非)",
  "通勤手当(課)", "実総支給額", "総支給額", "健康保険", "厚生年金保険",
  "厚生年金基金", "雇用保険", "社会保険合計", "課税対象額", "所得税",
  "住民税", "賎い", "その他控除", "前月調整", "総控除額",
  "(内)基本保険", "(内)特定保険", "(内)介護保険", "年末調整", "前回端額",
  "今回端額", "振込口座１", "振込口座２", "振込口座３", "現金支給額",
  "差引支給額", "有休付与日数", "有休失効日数", "当月消化日数", "当月有休残",
  "扶養親族数", "支払基礎日数", "支払日", "課税支給計", "非税支給計",
  "社保対象計", "社保控除401k", "健康保険_標準額", "厚生年金_標準額", "健康保険_料率now",
  "介護保険_料率now", "厚生年金_料率now", "厚年基金_料率now", "通勤手当の月按分額", "残業対象金額"
];

// 主要フィールドの定義
export const mainFieldKeys = {
  'identificationCode': ['識別コード', '識別コード※'],
  'employeeCode': ['従業員コード', '従業員コード※', '社員番号', '社員ID'],
  'employeeName': ['従業員氏名', '氏名', '社員氏名'],
  'departmentCode': ['部門コード', '部署コード'],
  'departmentName': ['部門名', '部署名'],
  'basicSalary': ['基本給'],
  'totalIncome': ['総支給額', '支給額合計', '実総支給額'],
  'totalDeduction': ['総控除額', '控除額合計'],
  'netAmount': ['差引支給額', '手取り金額', '実支給額'],
  'paymentDate': ['支払日', '給与支給日']
};

// 項目カテゴリのキーワード
export const incomeKeywords = ['給', '手当', '報酬', '賞与'];
export const deductionKeywords = ['保険', '税', '控除', '天引'];
export const attendanceKeywords = ['日数', '時間', '残業', '休暇', '出勤', '欠勤'];

// 初期マッピング設定
export const initialMappingConfig = {
  mainFields: {
    identificationCode: { columnIndex: -1, headerName: '' },
    employeeCode: { columnIndex: -1, headerName: '' },
    employeeName: { columnIndex: -1, headerName: '' },
    departmentCode: { columnIndex: -1, headerName: '' },
    departmentName: { columnIndex: -1, headerName: '' },
    basicSalary: { columnIndex: -1, headerName: '' },
    totalIncome: { columnIndex: -1, headerName: '' },
    totalDeduction: { columnIndex: -1, headerName: '' },
    netAmount: { columnIndex: -1, headerName: '' },
    paymentDate: { columnIndex: -1, headerName: '' }
  },
  incomeItems: [],
  deductionItems: [],
  attendanceItems: [],
  itemCodeItems: [],
  kyItems: []
};

// タブ定数
export const TABS = {
  INCOME: 'income',
  DEDUCTION: 'deduction',
  ATTENDANCE: 'attendance',
  KY: 'itemCode'
};
