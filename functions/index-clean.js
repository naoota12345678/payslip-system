const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const csv = require('csv-parser');
const { PassThrough } = require('stream');

admin.initializeApp();
const db = admin.firestore();

const getServerTimestamp = () => {
  try {
    return admin.firestore.FieldValue.serverTimestamp();
  } catch (err) {
    console.log('Using current time instead of serverTimestamp()');
    return new Date();
  }
};

const safeStringify = (obj) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (err) {
    return '[JSON conversion error: ' + err.message + ']';
  }
};

const logDebug = async (uploadId, message, data = null) => {
  const logEntry = {
    uploadId,
    level: 'debug',
    message,
    timestamp: new Date().toISOString(),
    data: data ? safeStringify(data) : null
  };
  
  console.log(`[DEBUG][${uploadId}] ${message}`, data || '');
  
  try {
    await db.collection('processLogs').add(logEntry);
  } catch (err) {
    console.error('Log save error:', err);
  }
};

const logError = async (uploadId, message, error) => {
  const logEntry = {
    uploadId,
    level: 'error',
    message,
    error: error.message || error,
    timestamp: new Date().toISOString()
  };
  
  console.error(`[ERROR][${uploadId}] ${message}:`, error);
  
  try {
    await db.collection('processLogs').add(logEntry);
  } catch (err) {
    console.error('Error log save error:', err);
  }
};

const generatePayrollItemsFromMappings = async (companyId) => {
  try {
    console.log(`[DEBUG] Generating payroll items: companyId=${companyId}`);
    
    const items = [];
    
    const mappingDoc = await db.collection('csvMappings').doc(companyId).get();
    
    if (mappingDoc.exists) {
      const mappingData = mappingDoc.data();
      console.log('[DEBUG] csvMappings data:', JSON.stringify(mappingData, null, 2));
      
      const payrollItemsSnapshot = await db.collection('payrollItems')
        .where('companyId', '==', companyId)
        .get();
      
      if (!payrollItemsSnapshot.empty) {
        console.log(`[DEBUG] Retrieved ${payrollItemsSnapshot.docs.length} payroll items`);
        
        const payrollItems = payrollItemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const mappings = mappingData.mappings || {};
        console.log('[DEBUG] Mapping info:', JSON.stringify(mappings, null, 2));
        
        payrollItems.forEach(item => {
          const csvColumn = mappings[item.id];
          if (csvColumn) {
            items.push({
              id: item.id,
              name: item.name,
              type: item.type,
              csvColumn: csvColumn,
              formula: item.formula || null,
              isRequired: item.isRequired || false,
              description: item.description || ''
            });
          }
        });
        
        console.log(`[DEBUG] Set ${items.length} items with new method`);
        if (items.length > 0) {
          return items;
        }
      }
    }
    
    const csvSettingsDoc = await db.collection('companies').doc(companyId)
      .collection('csvSettings').doc('default').get();
    
    if (csvSettingsDoc.exists) {
      const csvSettings = csvSettingsDoc.data();
      console.log('[DEBUG] csvSettings data:', JSON.stringify(csvSettings, null, 2));
      
      if (csvSettings.payrollItems && Array.isArray(csvSettings.payrollItems)) {
        csvSettings.payrollItems.forEach(item => {
          items.push({
            id: item.id || `item_${Date.now()}_${Math.random()}`,
            name: item.name,
            type: item.type || 'other',
            csvColumn: item.csvColumn,
            formula: item.formula || null,
            isRequired: item.isRequired || false,
            description: item.description || ''
          });
        });
        
        console.log(`[DEBUG] Set ${items.length} items with old method`);
        if (items.length > 0) {
          return items;
        }
      }
    }
    
    console.log('[DEBUG] Creating default items');
    return [
      { id: 'default_income', name: 'Basic Salary', type: 'income', csvColumn: 'Basic Salary', isRequired: true },
      { id: 'default_deduction', name: 'Income Tax', type: 'deduction', csvColumn: 'Income Tax', isRequired: false }
    ];
    
  } catch (error) {
    console.error('Payroll item generation error:', error);
    return [];
  }
};

const detectEmployeeNameColumn = (headers) => {
  const nameColumns = ['Name', 'Employee Name', 'Full Name'];
  return headers.find(header => nameColumns.includes(header));
};

const detectEmailColumn = (headers) => {
  const emailColumns = ['Email', 'Email Address', 'mail', 'Mail'];
  return headers.find(header => emailColumns.includes(header));
};

const detectEmployeeIdColumn = (headers) => {
  const idColumns = ['Employee ID', 'employeeId', 'employee_id', 'ID', 'id'];
  return headers.find(header => idColumns.includes(header));
};

const registerNewEmployee = async (companyId, employeeData, existingUserIds) => {
  try {
    const { employeeId, name, email, departmentCode } = employeeData;
    
    if (existingUserIds.has(employeeId)) {
      console.log(`[DEBUG] Employee ID ${employeeId} already exists`);
      return null;
    }
    
    let authUserId = null;
    if (email) {
      try {
        const userRecord = await admin.auth().createUser({
          email: email,
          password: '11111111',
          displayName: name
        });
        authUserId = userRecord.uid;
        console.log(`[DEBUG] Firebase Auth user created: ${email} -> ${authUserId}`);
      } catch (authError) {
        console.warn(`[WARN] Firebase Auth user creation failed (${email}):`, authError.message);
      }
    }
    
    const newUserData = {
      employeeId: employeeId,
      displayName: name,
      name: name,
      email: email || null,
      userType: 'employee',
      companyId: companyId,
      departmentCode: departmentCode || null,
      createdAt: getServerTimestamp(),
      createdBy: 'csv_auto_register',
      isActive: true,
      isAutoRegistered: true
    };
    
    let userRef;
    if (authUserId) {
      userRef = db.collection('users').doc(authUserId);
      await userRef.set(newUserData);
    } else {
      userRef = await db.collection('users').add(newUserData);
    }
    
    const finalUserId = authUserId || userRef.id;
    console.log(`[DEBUG] New employee registered: ${employeeId} (${name}) -> ${finalUserId}`);
    
    return finalUserId;
    
  } catch (error) {
    console.error(`[ERROR] Employee registration error (${employeeData.employeeId}):`, error);
    return null;
  }
};

const getEmployeeUserMapping = async (companyId, registerNewEmployees = false, csvHeaders = [], csvData = []) => {
  try {
    console.log(`[DEBUG] Getting employee mapping: companyId=${companyId}, registerNewEmployees=${registerNewEmployees}`);
    
    const usersSnapshot = await db.collection('users')
      .where('companyId', '==', companyId)
      .get();
    
    const mapping = {};
    const existingUserIds = new Set();
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.employeeId) {
        mapping[userData.employeeId] = doc.id;
        existingUserIds.add(userData.employeeId);
      }
    });
    
    console.log(`[DEBUG] Existing user mapping: ${Object.keys(mapping).length} items`);
    
    if (registerNewEmployees && csvHeaders.length > 0 && csvData.length > 0) {
      console.log('[DEBUG] Starting automatic new employee registration');
      
      const nameColumn = detectEmployeeNameColumn(csvHeaders);
      const emailColumn = detectEmailColumn(csvHeaders);
      const employeeIdColumn = detectEmployeeIdColumn(csvHeaders);
      
      console.log(`[DEBUG] Detected columns: name=${nameColumn}, email=${emailColumn}, employeeId=${employeeIdColumn}`);
      
      if (nameColumn && employeeIdColumn) {
        let employeesCreated = 0;
        
        for (const row of csvData) {
          const employeeId = row[employeeIdColumn];
          const name = row[nameColumn];
          const email = row[emailColumn];
          
          if (employeeId && name && !existingUserIds.has(employeeId)) {
            const newUserId = await registerNewEmployee(companyId, {
              employeeId,
              name,
              email,
              departmentCode: row['Department Code'] || null
            }, existingUserIds);
            
            if (newUserId) {
              mapping[employeeId] = newUserId;
              existingUserIds.add(employeeId);
              employeesCreated++;
            }
          }
        }
        
        console.log(`[DEBUG] Registered ${employeesCreated} new employees`);
        return { mapping, employeesCreated };
      }
    }
    
    return { mapping, employeesCreated: 0 };
    
  } catch (error) {
    console.error('Employee mapping retrieval error:', error);
    return { mapping: {}, employeesCreated: 0 };
  }
};

exports.processCSV = functions.https.onCall(async (data, context) => {
  const uploadId = data.uploadId || `upload_${Date.now()}`;
  
  try {
    console.log(`[INFO][${uploadId}] Starting CSV processing`);
    console.log(`[DEBUG] Received data:`, JSON.stringify(data, null, 2));
    console.log(`[DEBUG] Data keys:`, Object.keys(data));
    console.log(`[DEBUG] csvUrl:`, data.csvUrl, typeof data.csvUrl);
    console.log(`[DEBUG] companyId:`, data.companyId, typeof data.companyId);
    
    await logDebug(uploadId, 'Starting CSV processing', data);
    
    const { csvUrl, companyId, registerNewEmployees = false } = data;
    
    console.log(`[DEBUG] Extracted parameters: csvUrl=${csvUrl}, companyId=${companyId}, registerNewEmployees=${registerNewEmployees}`);
    
    if (!csvUrl || !companyId) {
      console.error(`[ERROR] Missing parameters: csvUrl=${csvUrl}, companyId=${companyId}`);
      throw new functions.https.HttpsError('invalid-argument', `csvUrl and companyId are required. Received: csvUrl=${csvUrl}, companyId=${companyId}`);
    }
    
    await db.collection('csvUploads').doc(uploadId).update({
      status: 'processing',
      startedAt: getServerTimestamp()
    });
    
    const payrollItems = await generatePayrollItemsFromMappings(companyId);
    await logDebug(uploadId, 'Payroll item settings retrieved', { itemCount: payrollItems.length, items: payrollItems });
    
    if (payrollItems.length === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'Payroll item settings not found');
    }
    
    await logDebug(uploadId, 'Starting CSV download', { csvUrl });
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new functions.https.HttpsError('not-found', `CSV file download failed: ${response.status}`);
    }
    
    const csvData = [];
    const csvHeaders = [];
    
    await new Promise((resolve, reject) => {
      const stream = new PassThrough();
      stream.end(response.body);
      
      stream
        .pipe(csv())
        .on('headers', (headers) => {
          csvHeaders.push(...headers);
          console.log(`[DEBUG][${uploadId}] CSV headers:`, headers);
        })
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', () => {
          console.log(`[DEBUG][${uploadId}] CSV parsing completed: ${csvData.length} rows`);
          resolve();
        })
        .on('error', (error) => {
          console.error(`[ERROR][${uploadId}] CSV parsing error:`, error);
          reject(error);
        });
    });
    
    await logDebug(uploadId, 'CSV parsing completed', { rowCount: csvData.length, headers: csvHeaders });
    
    if (csvData.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'CSV file contains no data');
    }
    
    const { mapping: employeeUserMapping, employeesCreated } = await getEmployeeUserMapping(
      companyId, 
      registerNewEmployees, 
      csvHeaders, 
      csvData
    );
    
    await logDebug(uploadId, 'Employee mapping retrieval completed', { 
      mappingCount: Object.keys(employeeUserMapping).length,
      employeesCreated
    });
    
    const results = [];
    const batch = db.batch();
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowNumber = i + 1;
      
      try {
        const employeeIdColumn = detectEmployeeIdColumn(csvHeaders);
        if (!employeeIdColumn || !row[employeeIdColumn]) {
          console.warn(`[WARN][${uploadId}] Row ${rowNumber}: Employee ID not found`);
          continue;
        }
        
        const employeeId = row[employeeIdColumn];
        const userId = employeeUserMapping[employeeId];
        
        if (!userId) {
          console.warn(`[WARN][${uploadId}] Row ${rowNumber}: User not found for employee ID ${employeeId}`);
          continue;
        }
        
        const payslipData = {
          companyId: companyId,
          employeeId: employeeId,
          userId: userId,
          uploadId: uploadId,
          paymentDate: getServerTimestamp(),
          createdAt: getServerTimestamp(),
          items: {},
          totalIncome: 0,
          totalDeduction: 0,
          netAmount: 0
        };
        
        payrollItems.forEach(item => {
          if (row[item.csvColumn]) {
            const value = parseFloat(row[item.csvColumn]) || 0;
            
            payslipData.items[item.id] = {
              name: item.name,
              type: item.type,
              value: value,
              formula: item.formula || null
            };
            
            if (item.type === 'income') {
              payslipData.totalIncome += value;
            } else if (item.type === 'deduction') {
              payslipData.totalDeduction += value;
            }
          }
        });
        
        payslipData.netAmount = payslipData.totalIncome - payslipData.totalDeduction;
        
        const payslipRef = db.collection('payslips').doc();
        batch.set(payslipRef, payslipData);
        
        results.push({
          employeeId: employeeId,
          userId: userId,
          totalIncome: payslipData.totalIncome,
          totalDeduction: payslipData.totalDeduction,
          netAmount: payslipData.netAmount,
          itemCount: Object.keys(payslipData.items).length
        });
        
      } catch (rowError) {
        console.error(`[ERROR][${uploadId}] Row ${rowNumber} processing error:`, rowError);
        await logError(uploadId, `Row ${rowNumber} processing error`, rowError);
      }
    }
    
    await batch.commit();
    await logDebug(uploadId, 'Batch commit completed', { processedCount: results.length });
    
    await db.collection('csvUploads').doc(uploadId).update({
      status: 'completed',
      processedCount: results.length,
      employeesCreated: employeesCreated,
      completedAt: getServerTimestamp()
    });
    
    await logDebug(uploadId, 'Processing completed', { processedCount: results.length, employeesCreated });
    
    let message = `Processed ${results.length} payroll data entries`;
    if (employeesCreated > 0) {
      message += `, registered ${employeesCreated} new employees`;
    }
    
    return {
      success: true,
      processedCount: results.length,
      employeesCreated: employeesCreated,
      message: message
    };
    
  } catch (error) {
    console.error(`[ERROR][${uploadId}] CSV processing error:`, error);
    
    try {
      await db.collection('csvUploads').doc(uploadId).update({
        status: 'error',
        errorMessage: error.message,
        errorAt: getServerTimestamp()
      });
    } catch (updateError) {
      console.error('Error status update failed:', updateError);
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Error occurred during CSV file processing: ' + error.message
    );
  }
});

exports.testSimpleCSV = functions.https.onCall(async (data, context) => {
  console.log("Simple CSV test started");
  console.log("Received data:", safeStringify(data));
  
  try {
    return {
      success: true,
      message: "Test successful",
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Test error:", error);
    throw new functions.https.HttpsError(
      'internal',
      'Error occurred during test: ' + error.message
    );
  }
});

// HTTP endpoint version for testing
exports.processCSVHttp = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    console.log('[DEBUG] HTTP Request method:', req.method);
    console.log('[DEBUG] HTTP Request body:', JSON.stringify(req.body, null, 2));
    console.log('[DEBUG] HTTP Request query:', JSON.stringify(req.query, null, 2));
    
    const data = req.method === 'POST' ? req.body : req.query;
    const uploadId = data.uploadId || `upload_${Date.now()}`;
    
    console.log('[DEBUG] Processing data:', JSON.stringify(data, null, 2));
    
    const { csvUrl, companyId, registerNewEmployees = false } = data;
    
    if (!csvUrl || !companyId) {
      res.status(400).json({ 
        error: `csvUrl and companyId are required. Received: csvUrl=${csvUrl}, companyId=${companyId}`,
        receivedData: data
      });
      return;
    }
    
    // 実際のCSV処理を実行
    console.log('[DEBUG] Starting actual CSV processing via HTTP endpoint');
    
    await db.collection('csvUploads').doc(uploadId).update({
      status: 'processing',
      startedAt: getServerTimestamp()
    });
    
    const payrollItems = await generatePayrollItemsFromMappings(companyId);
    console.log(`[DEBUG] Retrieved ${payrollItems.length} payroll items`);
    
    if (payrollItems.length === 0) {
      res.status(400).json({ error: 'Payroll item settings not found' });
      return;
    }
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      res.status(400).json({ error: `CSV file download failed: ${response.status}` });
      return;
    }
    
    const csvData = [];
    const csvHeaders = [];
    
    await new Promise((resolve, reject) => {
      const stream = new PassThrough();
      stream.end(response.body);
      
      stream
        .pipe(csv())
        .on('headers', (headers) => {
          csvHeaders.push(...headers);
        })
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    const { mapping: employeeUserMapping, employeesCreated } = await getEmployeeUserMapping(
      companyId, 
      registerNewEmployees, 
      csvHeaders, 
      csvData
    );
    
    const results = [];
    const batch = db.batch();
    
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const employeeIdColumn = detectEmployeeIdColumn(csvHeaders);
      
      if (!employeeIdColumn || !row[employeeIdColumn]) continue;
      
      const employeeId = row[employeeIdColumn];
      const userId = employeeUserMapping[employeeId];
      
      if (!userId) continue;
      
      const payslipData = {
        companyId: companyId,
        employeeId: employeeId,
        userId: userId,
        uploadId: uploadId,
        paymentDate: getServerTimestamp(),
        createdAt: getServerTimestamp(),
        items: {},
        totalIncome: 0,
        totalDeduction: 0,
        netAmount: 0
      };
      
      payrollItems.forEach(item => {
        if (row[item.csvColumn]) {
          const value = parseFloat(row[item.csvColumn]) || 0;
          payslipData.items[item.id] = {
            name: item.name,
            type: item.type,
            value: value
          };
          
          if (item.type === 'income') {
            payslipData.totalIncome += value;
          } else if (item.type === 'deduction') {
            payslipData.totalDeduction += value;
          }
        }
      });
      
      payslipData.netAmount = payslipData.totalIncome - payslipData.totalDeduction;
      
      const payslipRef = db.collection('payslips').doc();
      batch.set(payslipRef, payslipData);
      results.push({ employeeId, userId });
    }
    
    await batch.commit();
    
    await db.collection('csvUploads').doc(uploadId).update({
      status: 'completed',
      processedCount: results.length,
      employeesCreated: employeesCreated,
      completedAt: getServerTimestamp()
    });
    
    res.json({
      success: true,
      processedCount: results.length,
      employeesCreated: employeesCreated,
      message: `Processed ${results.length} payroll entries, created ${employeesCreated} employees`
    });
    
  } catch (error) {
    console.error("HTTP endpoint error:", error);
    res.status(500).json({ error: error.message });
  }
});

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
    throw new functions.https.HttpsError(
      'internal',
      'Error occurred during debug: ' + error.message
    );
  }
});

exports.fixPayslipUserIds = functions.https.onCall(async (data, context) => {
  console.log("Starting payslip data userId fix");
  
  try {
    const companyId = data.companyId;
    if (!companyId) {
      throw new functions.https.HttpsError('invalid-argument', 'companyId is required');
    }
    
    const { mapping: employeeUserMapping } = await getEmployeeUserMapping(companyId);
    
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
    throw new functions.https.HttpsError(
      'internal',
      'Error occurred during fix: ' + error.message
    );
  }
});

exports.checkData = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const companyId = req.query.companyId;
    if (!companyId) {
      res.status(400).json({ error: 'companyId is required' });
      return;
    }
    
    const payslipsQuery = await db.collection('payslips')
      .where('companyId', '==', companyId)
      .limit(10)
      .get();
    
    const payslips = [];
    payslipsQuery.forEach(doc => {
      const data = doc.data();
      payslips.push({
        id: doc.id,
        employeeId: data.employeeId,
        hasUserId: !!data.userId,
        totalIncome: data.totalIncome,
        itemsKeys: data.items ? Object.keys(data.items).slice(0, 5) : []
      });
    });
    
    const usersQuery = await db.collection('users')
      .where('companyId', '==', companyId)
      .limit(10)
      .get();
    
    const users = [];
    usersQuery.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        hasEmployeeId: !!data.employeeId,
        employeeId: data.employeeId,
        displayName: data.displayName
      });
    });
    
    res.json({
      success: true,
      payslips: payslips,
      users: users
    });
    
  } catch (error) {
    console.error("Data check error:", error);
    res.status(500).json({ error: error.message });
  }
});

exports.fixData = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  try {
    const companyId = req.query.companyId;
    if (!companyId) {
      res.status(400).json({ error: 'companyId is required' });
      return;
    }
    
    const { mapping: employeeUserMapping } = await getEmployeeUserMapping(companyId);
    
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
      }
    });
    
    if (fixedCount > 0) {
      await batch.commit();
    }
    
    res.json({
      success: true,
      fixedCount: fixedCount,
      message: `Added userId to ${fixedCount} payslip data entries`
    });
    
  } catch (error) {
    console.error("Data fix error:", error);
    res.status(500).json({ error: error.message });
  }
}); 