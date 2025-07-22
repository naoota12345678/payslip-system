// functions/index.js - Working version based on original implementation
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const { PassThrough } = require('stream');

admin.initializeApp();
const db = admin.firestore();

// Helper function for timestamp generation
const getServerTimestamp = () => {
  try {
    return admin.firestore.FieldValue.serverTimestamp();
  } catch (err) {
    console.log('Using current time instead of serverTimestamp()');
    return new Date();
  }
};

// Safe JSON stringify function to avoid circular references
function safeStringify(obj) {
  const cache = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return '[Circular Reference]';
      }
      cache.add(value);
    }
    return value;
  });
}

// Debug logging helper function
const logDebug = async (uploadId, message, data = null) => {
  console.log(`[DEBUG][${uploadId}] ${message}`, data || '');
  
  try {
    const safeData = data ? safeStringify(data).substring(0, 1000) : null;
    await db.collection('debugLogs').add({
      uploadId,
      level: 'debug',
      message,
      data: safeData,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Debug log save error:', err);
  }
};

const logError = async (uploadId, message, error) => {
  console.error(`[ERROR][${uploadId}] ${message}:`, error);
  
  try {
    await db.collection('debugLogs').add({
      uploadId,
      level: 'error',
      message,
      error: error.message || error,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error log save error:', err);
  }
};

// Main processCSV function - restored to working version
exports.processCSV = functions.https.onCall(async (data, context) => {
    console.log('processCSV function called');
    console.log('Received data (RAW):', safeStringify(data));
    
    console.log("Data type:", typeof data);
    console.log("Data structure:", data ? Object.keys(data) : "No data");
    
    // Extract parameters safely
    const actualData = data.data || data || {};
    
    const uploadId = actualData.uploadId || null;
    const fileUrl = actualData.fileUrl || null;  // Original parameter name
    const companyId = actualData.companyId || null;
    const updateEmployeeInfo = actualData.updateEmployeeInfo !== undefined ? actualData.updateEmployeeInfo : null;
    const columnMappings = actualData.columnMappings || null;
    const registerNewEmployees = actualData.registerNewEmployees || false;
    
    console.log("Extracted parameters:", {
      uploadId: uploadId ? "exists" : "missing",
      fileUrl: fileUrl ? "exists" : "missing",
      companyId: companyId ? "exists" : "missing",
      updateEmployeeInfo: updateEmployeeInfo !== null ? "exists" : "missing",
      columnMappings: columnMappings ? (typeof columnMappings === 'object' ? `(${Object.keys(columnMappings).length} items)` : 'invalid format') : "missing"
    });

    if (!uploadId) {
      console.error('uploadId parameter missing');
      throw new functions.https.HttpsError('invalid-argument', 'Required parameter missing: uploadId');
    }
    if (!fileUrl) {
      console.error('fileUrl parameter missing');
      throw new functions.https.HttpsError('invalid-argument', 'Required parameter missing: fileUrl');
    }
    if (!companyId) {
      console.error('companyId parameter missing');
      throw new functions.https.HttpsError('invalid-argument', 'Required parameter missing: companyId');
    }

    try {
      await logDebug(uploadId, 'Processing started', { companyId, updateEmployeeInfo });
      
      // Get upload information
      const uploadRef = db.collection('csvUploads').doc(uploadId);
      const uploadDoc = await uploadRef.get();
      
      if (!uploadDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Upload information not found');
      }
      
      const uploadData = uploadDoc.data();
      await logDebug(uploadId, 'Upload info retrieved', {
        fileName: uploadData.fileName,
        paymentDate: uploadData.paymentDate
      });
      
      // Update processing status
      await uploadRef.update({
        status: 'processing',
        processingStartedAt: getServerTimestamp()
      });

      // Get payroll items
      await logDebug(uploadId, 'Starting payroll items retrieval');
      const payrollItemsSnapshot = await db.collection('payrollItems')
        .where('companyId', '==', companyId)
        .get();
      
      if (payrollItemsSnapshot.empty) {
        throw new functions.https.HttpsError('not-found', 'No payroll items configured');
      }
      
      const payrollItems = payrollItemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      await logDebug(uploadId, `Retrieved ${payrollItems.length} payroll items`);
      
      // Get mapping information
      const itemColumnMapping = {};
      payrollItems.forEach(item => {
        if (item.csvColumn) {
          itemColumnMapping[item.id] = item.csvColumn;
        }
      });
      
      // Use mappings from upload if available, otherwise use item mappings
      const finalMappings = columnMappings || itemColumnMapping;
      
      await logDebug(uploadId, 'Mapping info', finalMappings);
      
      if (Object.keys(finalMappings).length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'CSV mapping settings not found');
      }
      
      // Fetch and process CSV file
      await logDebug(uploadId, 'Starting CSV file retrieval', { fileUrl });
      
      let response;
      try {
        response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
        }
      } catch (fetchError) {
        await logError(uploadId, 'CSV file fetch failed', fetchError);
        throw new functions.https.HttpsError('unknown', 'CSV file fetch failed: ' + fetchError.message);
      }
      
      await logDebug(uploadId, 'CSV file retrieved');
      
      let responseBuffer;
      try {
        responseBuffer = await response.buffer();
        await logDebug(uploadId, `CSV file size: ${responseBuffer.length} bytes`);
      } catch (bufferError) {
        await logError(uploadId, 'CSV file buffering failed', bufferError);
        throw new functions.https.HttpsError('unknown', 'CSV file reading failed: ' + bufferError.message);
      }
      
      const stream = new PassThrough();
      stream.end(responseBuffer);
      
      const results = [];
      let processedCount = 0;
      let employeesUpdated = 0;
      let employeesCreated = 0;
      let rowCount = 0;
      let errorCount = 0;
      
      // Get existing users for employee ID mapping
      const usersSnapshot = await db.collection('users')
        .where('companyId', '==', companyId)
        .get();
      
      const employeeUserMapping = {};
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.employeeId) {
          employeeUserMapping[userData.employeeId] = doc.id;
        }
      });
      
      await logDebug(uploadId, 'CSV parsing started');
      
      await new Promise((resolve, reject) => {
        stream
          .pipe(csv({
            skipEmptyLines: true,
            trim: true
          }))
          .on('data', (data) => {
            rowCount++;
            
            try {
              // Process each row
              const payslipData = {
                companyId: companyId,
                paymentDate: admin.firestore.Timestamp.fromDate(uploadData.paymentDate.toDate()),
                uploadId: uploadId,
                createdAt: getServerTimestamp(),
                items: {}
              };
              
              // Employee ID/Number column detection
              let employeeId = null;
              const possibleEmployeeColumns = ['社員番号', '従業員番号', '従業員ID', 'employeeId', 'employee_id', 'ID', 'id'];
              
              for (const column of possibleEmployeeColumns) {
                if (data[column] && data[column].toString().trim() !== '') {
                  employeeId = data[column].toString().trim();
                  break;
                }
              }
              
              if (!employeeId) {
                console.warn(`Row ${rowCount}: No employee ID found`);
                return;
              }
              
              // Find corresponding user ID
              const userId = employeeUserMapping[employeeId];
              if (!userId) {
                console.warn(`Row ${rowCount}: No user found for employee ID ${employeeId}`);
                return;
              }
              
              payslipData.employeeId = employeeId;
              payslipData.userId = userId;
              
              // Process mapping data
              for (const [itemId, columnName] of Object.entries(finalMappings)) {
                try {
                  if (columnName && data[columnName] !== undefined) {
                    const payrollItem = payrollItems.find(item => item.id === itemId);
                    if (payrollItem) {
                      const value = data[columnName];
                      let processedValue;
                      
                      try {
                        if (payrollItem.type === 'time' || payrollItem.type === 'days') {
                          processedValue = value === null || value === undefined ? '' : String(value);
                        } else {
                          const strValue = value === null || value === undefined ? '0' : 
                                        String(value).replace(/,/g, '').replace(/¥/g, '').trim();
                          const numValue = strValue === '' ? 0 : parseFloat(strValue);
                          processedValue = isNaN(numValue) ? 0 : numValue;
                        }
                      } catch (conversionErr) {
                        logError(uploadId, `Row ${rowCount}: Value conversion error: [${columnName}]=${value}, item=${payrollItem.name}`, conversionErr);
                        processedValue = payrollItem.type === 'time' || payrollItem.type === 'days' ? '' : 0;
                      }
                      
                      payslipData.items[itemId] = {
                        name: payrollItem.name,
                        type: payrollItem.type,
                        value: processedValue
                      };
                    }
                  }
                } catch (mappingError) {
                  errorCount++;
                  logError(uploadId, `Row ${rowCount}: Mapping error: itemId=${itemId}, column=${columnName}`, mappingError);
                }
              }
              
              // Calculate totals
              let totalIncome = 0;
              let totalDeduction = 0;
              
              Object.values(payslipData.items).forEach(item => {
                if (typeof item.value === 'number') {
                  if (item.type === 'income') {
                    totalIncome += item.value;
                  } else if (item.type === 'deduction') {
                    totalDeduction += item.value;
                  }
                }
              });
              
              payslipData.totalIncome = totalIncome;
              payslipData.totalDeduction = totalDeduction;
              payslipData.netAmount = totalIncome - totalDeduction;
              
              results.push(payslipData);
              processedCount++;
              
            } catch (rowError) {
              errorCount++;
              logError(uploadId, `Row ${rowCount} processing error`, rowError);
            }
          })
          .on('end', () => {
            console.log(`CSV parsing completed: ${rowCount} rows processed`);
            resolve();
          })
          .on('error', (error) => {
            console.error(`CSV parsing error:`, error);
            reject(error);
          });
      });

      await logDebug(uploadId, 'CSV parsing completed', { processedCount, errorCount });

      // Save to Firestore in batches
      const batchSize = 500;
      for (let i = 0; i < results.length; i += batchSize) {
        const batch = db.batch();
        const batchData = results.slice(i, i + batchSize);
        
        batchData.forEach(payslipData => {
          const docRef = db.collection('payslips').doc();
          batch.set(docRef, payslipData);
        });
        
        await batch.commit();
        await logDebug(uploadId, `Batch ${Math.floor(i/batchSize) + 1} saved: ${batchData.length} items`);
      }

      // Update final status
      await uploadRef.update({
        status: 'completed',
        processedCount: processedCount,
        employeesUpdated: employeesUpdated,
        employeesCreated: employeesCreated,
        errorCount: errorCount,
        processingCompletedAt: getServerTimestamp()
      });

      await logDebug(uploadId, 'Processing completed', { processedCount, employeesUpdated, employeesCreated, errorCount });

      return {
        success: true,
        processedCount: processedCount,
        employeesUpdated: employeesUpdated,
        employeesCreated: employeesCreated,
        errorCount: errorCount,
        message: `Processed ${processedCount} payroll entries. Errors: ${errorCount}`
      };

    } catch (error) {
      console.error(`[ERROR][${uploadId}] CSV processing error (top level):`, error);
      console.error(`Error details: ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
      
      try {
        await db.collection('csvUploads').doc(uploadId).update({
          status: 'error',
          errorMessage: error.message,
          errorAt: getServerTimestamp()
        });
      } catch (updateError) {
        await logError(uploadId, 'Error status update failed', updateError);
      }
      
      throw new functions.https.HttpsError(
        'internal',
        'Error occurred during CSV file processing: ' + error.message,
        error.message
      );
    }
});

// Debug functions
exports.debugPayslipData = functions.https.onCall(async (data, context) => {
  console.log("Starting payslip data structure check");
  
  try {
    const companyId = data.companyId;
    if (!companyId) {
      throw new functions.https.HttpsError('invalid-argument', 'companyId is required');
    }
    
    const payslipsQuery = await db.collection('payslips')
      .where('companyId', '==', companyId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    
    const payslips = [];
    payslipsQuery.forEach(doc => {
      const data = doc.data();
      payslips.push({
        id: doc.id,
        employeeId: data.employeeId,
        userId: data.userId,
        totalIncome: data.totalIncome,
        totalDeduction: data.totalDeduction,
        netAmount: data.netAmount,
        itemsCount: data.items ? Object.keys(data.items).length : 0,
        hasItems: !!data.items,
        itemsStructure: data.items ? Object.keys(data.items).slice(0, 3) : [],
        paymentDate: data.paymentDate
      });
    });
    
    const usersQuery = await db.collection('users')
      .where('companyId', '==', companyId)
      .limit(5)
      .get();
    
    const users = [];
    usersQuery.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        employeeId: data.employeeId,
        displayName: data.displayName,
        name: data.name,
        email: data.email,
        userType: data.userType
      });
    });
    
    return {
      success: true,
      payslips: payslips,
      users: users,
      payslipCount: payslips.length,
      userCount: users.length
    };
    
  } catch (error) {
    console.error("Debug error:", error);
    throw new functions.https.HttpsError('internal', 'Error occurred during debug: ' + error.message);
  }
});

exports.fixPayslipUserIds = functions.https.onCall(async (data, context) => {
  console.log("Starting payslip data userId fix");
  
  try {
    const companyId = data.companyId;
    if (!companyId) {
      throw new functions.https.HttpsError('invalid-argument', 'companyId is required');
    }
    
    // Get employee-user mapping
    const usersSnapshot = await db.collection('users')
      .where('companyId', '==', companyId)
      .get();
    
    const employeeUserMapping = {};
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.employeeId) {
        employeeUserMapping[userData.employeeId] = doc.id;
      }
    });
    
    const payslipsQuery = await db.collection('payslips')
      .where('companyId', '==', companyId)
      .get();
    
    const batch = db.batch();
    let fixedCount = 0;
    
    payslipsQuery.forEach(doc => {
      const data = doc.data();
      
      if (!data.userId && data.employeeId && employeeUserMapping[data.employeeId]) {
        const userId = employeeUserMapping[data.employeeId];
        batch.update(doc.ref, { userId: userId });
        fixedCount++;
        console.log(`Fix: ${doc.id} -> employeeId: ${data.employeeId}, userId: ${userId}`);
      }
    });
    
    if (fixedCount > 0) {
      await batch.commit();
    }
    
    return { 
      success: true, 
      fixedCount: fixedCount,
      message: `Added userId to ${fixedCount} payslip data entries`
    };
    
  } catch (error) {
    console.error("Fix error:", error);
    throw new functions.https.HttpsError('internal', 'Error occurred during fix: ' + error.message);
  }
}); 