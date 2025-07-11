// src/pages/CsvUpload/utils/csvProcessor.js

/**
 * CSVデータとマッピング情報を照合してマッピング状況を確認する
 * @param {string[]} csvHeaders CSVのヘッダー情報
 * @param {Array} payrollItems 給与項目データ
 * @param {boolean} debugMode デバッグモードの有無
 * @returns {Object} マッピング状況の情報
 */
export const checkMappingStatus = (csvHeaders, payrollItems, debugMode = false) => {
  if (!csvHeaders || !payrollItems) {
    return {
      hasMappings: false,
      validMappings: 0,
      invalidMappings: 0,
      mappingDetails: {}
    };
  }

  const mappingStatus = {};
  let validCount = 0;
  let invalidCount = 0;

  payrollItems.forEach(item => {
    if (item.csvColumn) {
      const exists = csvHeaders.includes(item.csvColumn);
      mappingStatus[item.name] = {
        itemId: item.id,
        csvColumn: item.csvColumn,
        exists: exists
      };
      
      if (exists) {
        validCount++;
      } else {
        invalidCount++;
        
        if (debugMode) {
          console.warn('[Debug] マッピングが設定されているが、CSVにカラムが存在しません:', {
            itemName: item.name,
            csvColumn: item.csvColumn
          });
        }
      }
    }
  });
  
  if (debugMode) {
    console.log('[Debug] マッピング状況確認:', {
      total: payrollItems.length,
      mapped: Object.keys(mappingStatus).length,
      valid: validCount,
      invalid: invalidCount
    });
  }
  
  return {
    hasMappings: Object.keys(mappingStatus).length > 0,
    validMappings: validCount,
    invalidMappings: invalidCount,
    mappingDetails: mappingStatus
  };
};

/**
 * 給与項目のCSVマッピング情報を構築する
 * @param {Array} payrollItems 給与項目データ
 * @returns {Object} マッピング情報オブジェクト
 */
export const buildColumnMappings = (payrollItems) => {
  const columnMappings = {};
  payrollItems.forEach(item => {
    if (item.csvColumn) {
      columnMappings[item.id] = item.csvColumn;
    }
  });
  return columnMappings;
};

/**
 * アップロード情報を構築する
 * @param {Object} params 必要なパラメータ
 * @returns {Object} アップロード情報オブジェクト
 */
export const buildUploadInfo = ({
  uploadId,
  fileName,
  userId,
  companyId,
  paymentDate,
  sendEmailDate,
  fileUrl,
  updateEmployeeInfo,
  registerNewEmployees,
  employeeIdColumn,
  departmentCodeColumn,
  columnMappings
}) => {
  return {
    uploadId: uploadId,
    fileName: fileName,
    uploadedBy: userId,
    companyId: companyId,
    uploadDate: new Date(),
    paymentDate: new Date(paymentDate),
    sendEmailDate: sendEmailDate ? new Date(sendEmailDate) : null,
    fileUrl: fileUrl,
    status: 'pending',
    processedCount: 0,
    // 従業員情報更新用の設定
    updateEmployeeInfo: updateEmployeeInfo,
    registerNewEmployees: registerNewEmployees || false,
    employeeIdColumn: employeeIdColumn,
    departmentCodeColumn: departmentCodeColumn,
    // 給与項目マッピング
    columnMappings: columnMappings
  };
};

/**
 * CSVヘッダーの検証
 * @param {string[]} requiredColumns 必須カラム
 * @param {string[]} csvHeaders CSVヘッダー
 * @returns {Object} 検証結果
 */
export const validateCSVHeaders = (requiredColumns, csvHeaders) => {
  const missing = [];
  let isValid = true;
  
  for (const column of requiredColumns) {
    if (!csvHeaders.includes(column)) {
      missing.push(column);
      isValid = false;
    }
  }
  
  return {
    isValid,
    missing
  };
};
