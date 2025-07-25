import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { fetchUnifiedMappingSettings } from '../utils/mappingUtils';

const BonusSimpleCSVUpload = () => {
  const { userDetails } = useAuth();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [csvData, setCsvData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]); // 今日の日付をデフォルト
  const [paymentYear, setPaymentYear] = useState(new Date().getFullYear());
  const [paymentMonth, setPaymentMonth] = useState(new Date().getMonth() + 1);
  const [employeeIdColumn, setEmployeeIdColumn] = useState('');
  const [departmentCodeColumn, setDepartmentCodeColumn] = useState('');
  // 賞与専用（給与機能は分離済み）

  // 🔧 CSVヘッダーから新しい形式のマッピングデータを生成・保存（賞与版）
  const saveHeaderMappings = async (headers, mappingSettings) => {
    if (!userDetails?.companyId || !headers || headers.length === 0) {
      console.warn('⚠️ saveHeaderMappings: 必要なデータが不足しています（賞与）');
      return;
    }

    try {
      console.log('📤 新しい形式でマッピングデータを保存中...（賞与）');
      
      // ヘッダーから項目配列を生成
      const attendanceItems = [];
      const incomeItems = [];
      const deductionItems = [];
      const totalItems = [];
      
      headers.forEach((header, index) => {
        if (!header || header.trim() === '') return;
        
        // 初回アップロード時は全て'income'として扱い、後でマッピング画面で分類
        const category = mappingSettings.itemCategories[header] || 'income';
        // 初回時はheaderNameをそのまま使用、既存マッピングがあれば優先
        const itemName = (mappingSettings.simpleMapping[header] && 
                         mappingSettings.simpleMapping[header] !== header) ? 
                         mappingSettings.simpleMapping[header] : header;
        const isVisible = mappingSettings.visibilitySettings[header] !== false;
        
        const itemData = {
          columnIndex: index,                    // 正しい連番（0, 1, 2, 3...）
          headerName: header,                    // 元のCSVヘッダー名（例：KY11_1）
          id: `${category}_${header}_${index}`,
          isVisible: isVisible,
          itemName: itemName                     // 日本語表示名（例：欠勤日数）
        };
        
        // デバッグ情報
        console.log(`📊 項目${index}: ヘッダー="${header}" → 表示名="${itemName}" (${category})（賞与）`);
        console.log(`   - columnIndex: ${index}`);
        console.log(`   - headerName: "${header}"`);
        console.log(`   - itemName: "${itemName}"`);
        console.log(`   - category: "${category}"`);
        console.log(`   ---`);
        
        switch (category) {
          case 'attendance':
            attendanceItems.push(itemData);
            break;
          case 'income':
            incomeItems.push(itemData);
            break;
          case 'deduction':
            deductionItems.push(itemData);
            break;
          case 'total':
            totalItems.push(itemData);
            break;
          default:
            // デフォルトは支給項目として扱う
            incomeItems.push({...itemData, id: `income_${header}_${index}`});
        }
      });

      // 新しく生成した項目配列から正しいマッピング情報を再構築
      const newSimpleMapping = {};
      const newItemCategories = {};
      const newVisibilitySettings = {};
      
      [...attendanceItems, ...incomeItems, ...deductionItems, ...totalItems].forEach(item => {
        newSimpleMapping[item.headerName] = item.itemName;
        newItemCategories[item.headerName] = item.id.split('_')[0]; // categoryを抽出
        newVisibilitySettings[item.headerName] = item.isVisible;
      });

      // 新しい形式でFirestoreに保存（賞与版）
      const mappingDoc = {
        attendanceItems,
        incomeItems,
        deductionItems,
        totalItems,
        simpleMapping: newSimpleMapping,
        itemCategories: newItemCategories,
        visibilitySettings: newVisibilitySettings,
        employeeMapping: {
          employeeIdColumn: mappingSettings.employeeIdColumn || '',
          departmentCodeColumn: mappingSettings.departmentCodeColumn || ''
        },
        updatedAt: new Date(),
        updatedBy: userDetails.uid || 'system'
      };
      
      console.log('📋 再構築したマッピング情報（賞与）:');
      console.log('- simpleMapping:', newSimpleMapping);
      console.log('- itemCategories:', newItemCategories);
      console.log('- visibilitySettings:', newVisibilitySettings);
      
      await setDoc(doc(db, 'csvMappingsBonus', userDetails.companyId), mappingDoc);
      console.log('✅ 新しい形式でのマッピング保存完了（賞与）');
      
      // デバッグ情報を出力
      console.log('📊 保存されたマッピング統計（賞与）:');
      console.log(`- 勤怠項目: ${attendanceItems.length}個`);
      console.log(`- 支給項目: ${incomeItems.length}個`);
      console.log(`- 控除項目: ${deductionItems.length}個`);
      console.log(`- 合計項目: ${totalItems.length}個`);
      
    } catch (error) {
      console.error('❌ マッピング保存エラー（賞与）:', error);
    }
  };

  // 賞与マッピング設定を取得する関数
  const fetchMappingSettings = async () => {
    console.log('🔍 [fetchMappingSettings] 賞与マッピング設定取得開始');
    console.log('🔍 [fetchMappingSettings] userDetails?.companyId:', userDetails?.companyId);
    
    if (!userDetails?.companyId) {
      console.log('❌ [fetchMappingSettings] companyIdがありません');
      return { 
        employeeIdColumn: '', 
        departmentCodeColumn: '',
        simpleMapping: {},
        itemCategories: {},
        visibilitySettings: {}
      };
    }

    try {
      // 賞与専用マッピング設定を取得
      console.log('🔍 賞与マッピング設定取得開始 - コレクション: csvMappingsBonus, companyId:', userDetails.companyId);
      
      // 賞与マッピングコレクションから設定を取得
      const mappingRef = doc(db, 'csvMappingsBonus', userDetails.companyId);
      const mappingDoc = await getDoc(mappingRef);
      
      if (!mappingDoc.exists()) {
        console.log('❌ csvMappingsBonusドキュメントが存在しません');
        return {
          employeeIdColumn: '',
          departmentCodeColumn: '',
          simpleMapping: {},
          itemCategories: {},
          visibilitySettings: {}
        };
      }

      const data = mappingDoc.data();
      console.log('📋 csvMappingsBonusの生データ取得成功:', data);

      let employeeIdColumn = '';
      let departmentCodeColumn = '';
      
      // 最初に新しい形式のmainFieldsからカラム情報を取得
      if (data.mainFields) {
        employeeIdColumn = data.mainFields.employeeCode?.headerName || '';
        departmentCodeColumn = data.mainFields.departmentCode?.headerName || '';
        console.log('✅ 新形式(mainFields)から取得（賞与）:', { 
          employeeIdColumn, 
          departmentCodeColumn,
          employeeCodeField: data.mainFields.employeeCode,
          departmentCodeField: data.mainFields.departmentCode
        });
      }
      let simpleMapping = {};
      let itemCategories = {};
      let visibilitySettings = {};

      // 🎯 完全分離設計：各コレクション直下に設定を格納
      // 従業員設定を正しいフィールド名で取得
      console.log('🔍 [fetchMappingSettings] mainFields確認（賞与）:', data.mainFields);
      
      if (data.mainFields) {
        console.log('🔍 [fetchMappingSettings] mainFields.employeeCode（賞与）:', data.mainFields.employeeCode);
        console.log('🔍 [fetchMappingSettings] mainFields.departmentCode（賞与）:', data.mainFields.departmentCode);
        
        // 従業員コード設定
        if (data.mainFields.employeeCode && data.mainFields.employeeCode.headerName) {
          employeeIdColumn = data.mainFields.employeeCode.headerName;
          console.log('✅ 従業員コード設定取得（賞与） (mainFields):', employeeIdColumn);
        } else {
          console.log('❌ mainFields.employeeCode.headerNameが設定されていません（賞与）');
        }
        
        // 部門コード設定
        if (data.mainFields.departmentCode && data.mainFields.departmentCode.headerName) {
          departmentCodeColumn = data.mainFields.departmentCode.headerName;
          console.log('✅ 部門コード設定取得（賞与） (mainFields):', departmentCodeColumn);
        } else {
          console.log('❌ mainFields.departmentCode.headerNameが設定されていません（賞与）');
        }
      } else {
        console.log('❌ mainFieldsが存在しません（賞与）');
      }
      
      // 旧形式との互換性（employeeMapping形式）- 新形式で取得できなかった場合のみ
      if (data.employeeMapping && !employeeIdColumn && !departmentCodeColumn) {
        employeeIdColumn = data.employeeMapping.employeeIdColumn || '';
        departmentCodeColumn = data.employeeMapping.departmentCodeColumn || '';
        console.log('✅ 従業員設定取得（賞与） (旧形式employeeMapping):', { employeeIdColumn, departmentCodeColumn });
      }
      
      console.log('🎯 最終取得結果（賞与）:', { employeeIdColumn, departmentCodeColumn });

      // 項目設定（賞与専用）
      console.log('📊 賞与設定処理開始');
      
      ['incomeItems', 'deductionItems', 'attendanceItems', 'summaryItems'].forEach(category => {
        if (data[category] && Array.isArray(data[category])) {
          console.log(`  - ${category}: ${data[category].length}件`);
          
          data[category].forEach(item => {
            if (item.headerName && item.itemName) {
              let itemType = 'other';
              
              if (category === 'incomeItems') itemType = 'income';
              else if (category === 'deductionItems') itemType = 'deduction';
              else if (category === 'attendanceItems') itemType = 'attendance';
              else if (category === 'summaryItems') itemType = 'summary';

              itemCategories[item.headerName] = itemType;
              visibilitySettings[item.headerName] = item.isVisible !== false;
              simpleMapping[item.headerName] = item.itemName;

              console.log(`✅ ${category}から追加（賞与）: ${item.headerName} → ${item.itemName} (${itemType})`);
            }
          });
        }
      });

      const result = {
        employeeIdColumn,
        departmentCodeColumn,
        simpleMapping,
        itemCategories,
        visibilitySettings
      };

      console.log('✅ 賞与マッピング設定取得完了:', {
        従業員設定: { employeeIdColumn, departmentCodeColumn },
        マッピング数: Object.keys(simpleMapping).length,
        分類数: Object.keys(itemCategories).length,
        表示設定数: Object.keys(visibilitySettings).length
      });

      // 状態を更新
      setEmployeeIdColumn(employeeIdColumn);
      setDepartmentCodeColumn(departmentCodeColumn);
      
      return result;
      
    } catch (error) {
      console.error('❌ 賞与マッピング設定取得エラー:', error);
      return { 
        employeeIdColumn: '', 
        departmentCodeColumn: '',
        simpleMapping: {},
        itemCategories: {},
        visibilitySettings: {}
      };
    }
  };

  // CSVファイルを選択
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      parseCSV(selectedFile);
    } else {
      setMessage('CSVファイルを選択してください。');
    }
  };

  // CSVファイルをパース
  const parseCSV = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setMessage('CSVファイルにデータが不足しています。');
        return;
      }

      // ヘッダー行を取得
      const headerLine = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      setHeaders(headerLine);

      // 【追加】選択された給与/賞与のCSVマッピング設定を取得
      const mappingSettings = await fetchMappingSettings();

      // データ行を取得
      const dataLines = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const rowData = {};
        headerLine.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });
        return rowData;
      });

      setCsvData(dataLines);
      setShowPreview(true);
      setMessage(`${dataLines.length}件のデータが読み込まれました。`);
      
      // CSVヘッダーの詳細デバッグ
      console.log('🔍 CSVヘッダー詳細分析（賞与）:');
      console.log('ヘッダー一覧:', headerLine);
      console.log('最初の行のデータ:', dataLines[0]);
      console.log('取得したマッピング設定:', mappingSettings);
      
      console.log('🔍 CSVマッピング確認（賞与）:', {
        '従業員IDカラム': mappingSettings.employeeIdColumn,
        '部門コードカラム': mappingSettings.departmentCodeColumn,
        '実際のCSVヘッダー': headerLine
      });
    };
    reader.readAsText(file);
  };

  // 賞与明細データをFirestoreに保存
  const saveToFirestore = async () => {
    console.log('🚀 saveToFirestore 関数が呼ばれました（賞与）');
    console.log('📊 csvData.length:', csvData.length);
    console.log('🏢 userDetails?.companyId:', userDetails?.companyId);
    
    if (!csvData.length || !userDetails?.companyId) {
      console.error('❌ データまたは会社情報が不足しています（賞与）');
      setMessage('データまたは会社情報が不足しています。');
      return;
    }

    setUploading(true);
    try {
      console.log('✅ 賞与明細データ保存開始:', csvData.length, '件');

      // 【重要】最新のマッピング設定を取得
      const mappingSettings = await fetchMappingSettings();
      console.log('🔧 使用するマッピング設定（賞与）:', mappingSettings);

      // 【追加】CSVヘッダーから新しい形式のマッピングデータを生成・保存
      console.log('🧹 既存のマッピングデータをクリアして新しいデータで上書きします（賞与）');
      await saveHeaderMappings(headers, mappingSettings);

      // 各行のデータを賞与明細として保存
      for (let i = 0; i < csvData.length; i++) {
        const rowData = csvData[i];
        
        // 【修正】従業員番号を動的に検索 - マッピング設定を使用
        let employeeId = null;
        let departmentCode = null;
        
        console.log(`🔍 [行${i + 1}] CSV行データ（賞与）:`, rowData);
        console.log(`🔍 [行${i + 1}] 使用するマッピング設定（賞与）:`, {
          employeeIdColumn: mappingSettings.employeeIdColumn,
          departmentCodeColumn: mappingSettings.departmentCodeColumn
        });
        
        // 【シンプル化】マッピング設定の従業員番号カラムのみ使用
        if (mappingSettings.employeeIdColumn && rowData[mappingSettings.employeeIdColumn]) {
          employeeId = String(rowData[mappingSettings.employeeIdColumn]).trim();
          console.log(`✅ [行${i + 1}] 従業員番号取得（賞与）: カラム "${mappingSettings.employeeIdColumn}" → "${employeeId}"`);
        } else {
          console.error(`❌ [行${i + 1}] 従業員番号カラム "${mappingSettings.employeeIdColumn}" が見つからないか空です（賞与）`);
          console.log(`🔍 [行${i + 1}] 利用可能なCSVカラム:`, Object.keys(rowData));
          console.log(`🔍 [行${i + 1}] CSVデータの詳細:`, rowData);
        }
        
        // 【追加】部門コードを取得 - マッピング設定を使用
        if (mappingSettings.departmentCodeColumn && rowData[mappingSettings.departmentCodeColumn]) {
          departmentCode = String(rowData[mappingSettings.departmentCodeColumn]).trim();
          console.log(`🏢 [行${i + 1}] マッピング設定カラム "${mappingSettings.departmentCodeColumn}" から部門コード取得（賞与）: "${departmentCode}"`);
        }
        
        // デバッグ用（最初の数行のみ）
        if (i < 3) {
          console.log(`🚨 [緊急デバッグ] 行 ${i + 1}: 検出された従業員ID='${employeeId}' (使用カラム: ${mappingSettings.employeeIdColumn})（賞与）`);
          console.log(`🚨 [緊急デバッグ] 行 ${i + 1}: CSVヘッダーとマッピング設定の照合（賞与）:`);
          console.log(`🚨 [緊急デバッグ] 行 ${i + 1}: - マッピング設定employeeIdColumn: "${mappingSettings.employeeIdColumn}"`);
          console.log(`🚨 [緊急デバッグ] 行 ${i + 1}: - CSVにこのカラムは存在するか: ${mappingSettings.employeeIdColumn in rowData}`);
          console.log(`🚨 [緊急デバッグ] 行 ${i + 1}: - カラムの値: "${rowData[mappingSettings.employeeIdColumn]}"`);
        }
        
        // 【シンプル化】従業員IDに基づいてユーザー情報を取得
        let userId = null;
        try {
          if (employeeId) {
            console.log(`🔍 従業員検索開始（賞与）: companyId="${userDetails.companyId}", employeeId="${employeeId}"`);
            
            // 【修正】employeesコレクションで従業員を検索
            const employeesSnapshot = await getDocs(
              query(
                collection(db, 'employees'), 
                where('companyId', '==', userDetails.companyId),
                where('employeeId', '==', employeeId)
              )
            );
            
            console.log(`🔍 従業員検索（賞与）: companyId="${userDetails.companyId}", employeeId="${employeeId}"`);
            console.log(`🔍 employeesコレクションでの検索結果（賞与）: ${employeesSnapshot.size}件見つかりました`);
            
            if (!employeesSnapshot.empty) {
              const employeeData = employeesSnapshot.docs[0].data();
              userId = employeesSnapshot.docs[0].id; // employeeDocumentIdをuserIdとして使用
              console.log(`✅ 従業員発見（賞与）: ID=${userId}, 名前=${employeeData.name || employeeData.displayName}`, {
                name: employeeData.name,
                email: employeeData.email,
                departmentId: employeeData.departmentId,
                departmentCode: employeeData.departmentCode
              });
            } else {
              console.warn(`❌ 従業員番号 ${employeeId} に対応する従業員が見つかりません（賞与）`);
              
              // 【デバッグ】employeesコレクションの構造を確認
              console.log('🚨 [緊急デバッグ] 検索失敗の原因調査開始（賞与）');
              const allEmployeesSnapshot = await getDocs(
                query(collection(db, 'employees'), where('companyId', '==', userDetails.companyId))
              );
              
              console.log(`🔍 会社の従業員総数（賞与）: ${allEmployeesSnapshot.size}件`);
              
              if (allEmployeesSnapshot.size > 0) {
                console.log('🔍 最初の3件の従業員データ詳細（賞与）:');
                allEmployeesSnapshot.docs.slice(0, 3).forEach((doc, index) => {
                  const data = doc.data();
                  console.log(`🧑‍💼 従業員${index + 1}（賞与）:`, {
                    documentId: doc.id,
                    name: data.name,
                    displayName: data.displayName,
                    employeeId: data.employeeId,
                    employeeNumber: data.employeeNumber,
                    departmentCode: data.departmentCode,
                    email: data.email,
                    companyId: data.companyId,
                    '全フィールド': Object.keys(data),
                    '検索条件との比較': {
                      'CSV従業員ID': employeeId,
                      'DB従業員ID': data.employeeId,
                      '一致': data.employeeId === employeeId,
                      'DBemployeeNumber': data.employeeNumber,
                      'employeeNumber一致': data.employeeNumber === employeeId
                    }
                  });
                });
                
                // 🔍 employeeNumberでも検索してみる
                console.log('🔍 employeeNumberフィールドでも検索してみます...（賞与）');
                const employeeNumberSnapshot = await getDocs(
                  query(
                    collection(db, 'employees'), 
                    where('companyId', '==', userDetails.companyId),
                    where('employeeNumber', '==', employeeId)
                  )
                );
                
                console.log(`🔍 employeeNumber検索結果（賞与）: ${employeeNumberSnapshot.size}件`);
                
                if (!employeeNumberSnapshot.empty) {
                  const employeeData = employeeNumberSnapshot.docs[0].data();
                  userId = employeeNumberSnapshot.docs[0].id;
                  console.log(`✅ employeeNumberで従業員発見（賞与）: ID=${userId}`, employeeData);
                }
              } else {
                console.log('❌ この会社にemployeesデータが全く存在しません！（賞与）');
              }
            }
          } else {
            console.warn(`❌ 従業員番号が空です（賞与）`);
          }
        } catch (userQueryError) {
          console.error(`従業員ID ${employeeId} のユーザー検索エラー（賞与）:`, userQueryError);
        }

        // 【デバッグ】保存前の重要な情報を確認
        console.log(`💾 保存データ構築（賞与）: 行${i + 1}`, {
          employeeId: employeeId,
          userId: userId,
          departmentCode: departmentCode,
          'userIdがnull': userId === null,
          'employeeIdが空': !employeeId
        });

        // 賞与明細データを構築（給与/賞与分離対応）
        const bonusPayslipData = {
          companyId: userDetails.companyId,
          userId: userId, // userIdのみで運用（新設計）
          employeeId: employeeId, // 【追加】従業員IDを保存
          departmentCode: departmentCode, // 【追加】部門コードを保存
          month: paymentMonth, // 選択された月
          year: paymentYear, // 選択された年
          paymentDate: new Date(paymentDate), // 選択された支払日
          payslipType: 'bonus', // 賞与専用
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          
          // CSVの全データをそのまま保存
          csvData: rowData,
          
          // マッピング設定適用済み項目
          items: {},
          
          // 項目分類（支給・控除・勤怠）
          itemCategories: {},
          
          // 表示設定
          itemVisibility: {},
          
          // 集計値（初期化）
          totalIncome: 0,
          totalDeduction: 0,
          netAmount: 0
        };
        
        // userIdが見つからない場合の警告（保存は継続）
        if (!userId) {
          console.warn(`従業員番号 ${employeeId} に対応するユーザーが見つかりません。賞与明細は保存されますが、従業員本人は閲覧できません。`);
        }

        // マッピング設定を適用してCSVデータを処理
        let totalIncome = 0;
        let totalDeduction = 0;
        
        headers.forEach(header => {
          // ヘッダーが存在する項目を処理（空白も含む）
          if (header && header.trim() !== '') {
            // 値を取得（空白も含む）
            let rawValue = rowData[header] || ''; // undefined/nullは空文字列に変換
            rawValue = String(rawValue).trim(); // 前後の空白を除去
            
            // マッピング設定から情報を取得
            const displayName = mappingSettings.simpleMapping[header] || header;
            const category = mappingSettings.itemCategories[header] || 'other';
            const isVisible = mappingSettings.visibilitySettings[header] !== false; // デフォルトは表示
            
            // 部門コード、従業員コード、従業員氏名などの文字列項目は文字列として保持
            const isStringField = ['部門コード', '部署コード', '従業員コード', '従業員氏名', '氏名', '社員番号', '社員ID', '識別コード'].some(field => 
              header.includes(field) || displayName.includes(field)
            );
            
            // 数値に変換を試行（文字列フィールド以外で空白でない場合のみ）
            let finalValue;
            if (rawValue === '') {
              finalValue = ''; // 空白は空文字列として保存
            } else if (isStringField) {
              finalValue = rawValue; // 文字列フィールドは文字列として保存
            } else {
              const numericValue = parseFloat(rawValue.replace(/,/g, '').replace(/¥/g, ''));
              finalValue = isNaN(numericValue) ? rawValue : numericValue; // 数値変換できない場合は文字列として保存
            }
            
            // 項目データを保存
            bonusPayslipData.items[header] = finalValue;
            bonusPayslipData.itemCategories[header] = category;
            bonusPayslipData.itemVisibility[header] = isVisible;
            
            // 分類別合計計算（数値項目のみ）
            if (!isStringField && typeof finalValue === 'number') {
              if (category === 'income' && finalValue > 0) {
                totalIncome += finalValue;
              } else if (category === 'deduction' && finalValue > 0) {
                totalDeduction += finalValue;
              }
            }
            
            console.log(`📊 項目処理（賞与）: ${header} → ${displayName} (${category}) = ${finalValue} ${isStringField ? '(文字列)' : '(数値)'}`);
          }
        });
        
        // 合計値を設定
        bonusPayslipData.totalIncome = totalIncome;
        bonusPayslipData.totalDeduction = totalDeduction;
        bonusPayslipData.netAmount = totalIncome - totalDeduction;
        
        console.log(`💰 賞与明細合計: 支給=${totalIncome}, 控除=${totalDeduction}, 差引=${bonusPayslipData.netAmount}`);

        // Firestoreに保存（賞与版は別コレクション）
        await addDoc(collection(db, 'bonusPayslips'), bonusPayslipData);
        
        // 進捗表示
        const progress = Math.round(((i + 1) / csvData.length) * 100);
        setMessage(`保存中... ${progress}% (${i + 1}/${csvData.length})`);
      }

      setMessage(`✅ ${csvData.length}件の賞与明細データを保存しました！`);
      
      // 保存後にデータをクリア
      setTimeout(() => {
        setFile(null);
        setCsvData([]);
        setHeaders([]);
        setShowPreview(false);
        setMessage('');
        document.getElementById('csvFileInput').value = '';
      }, 3000);

    } catch (error) {
      console.error('データ保存エラー（賞与）:', error);
      setMessage('❌ データ保存中にエラーが発生しました: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">賞与CSVアップロード</h1>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">📝 使い方</h2>
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          <li><strong>賞与種別を選択</strong>（給与・賞与で完全分離設計）</li>
          <li>CSVファイルを選択（1行目：ヘッダー、2行目以降：データ）</li>
          <li>プレビューでデータを確認</li>
          <li>「賞与明細として保存」ボタンで完了</li>
        </ol>
        <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ 重要:</strong> 給与と賞与は<strong>完全に分離</strong>されたマッピング設定を使用します。<br/>
            事前に「賞与CSVマッピング設定」で設定を完了してください。
          </p>
        </div>
      </div>

      {/* ファイル選択 */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          CSVファイルを選択
        </label>
        <input
          id="csvFileInput"
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          disabled={uploading}
        />
      </div>

      {/* 支払情報設定 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-md font-semibold mb-3">📅 支払情報</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">支払年</label>
            <select
              value={paymentYear}
              onChange={(e) => setPaymentYear(parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={uploading}
            >
              {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}年</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">支払月</label>
            <select
              value={paymentMonth}
              onChange={(e) => setPaymentMonth(parseInt(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={uploading}
            >
              {Array.from({length: 12}, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>{month}月</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">支払日</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={uploading}
            />
          </div>
        </div>
      </div>

      {/* メッセージ表示 */}
      {message && (
        <div className={`p-3 rounded mb-4 ${
          message.includes('❌') ? 'bg-red-100 text-red-700' :
          message.includes('✅') ? 'bg-green-100 text-green-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {message}
        </div>
      )}

      {/* プレビュー表示 */}
      {showPreview && csvData.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold">データプレビュー</h3>
            <button
              onClick={() => {
                console.log('🖱️ ボタンがクリックされました（賞与）');
                saveToFirestore();
              }}
              disabled={uploading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {uploading ? '保存中...' : '賞与明細として保存'}
            </button>
          </div>

          {/* 支払情報表示 */}
          <div className="mb-3 p-3 bg-blue-50 rounded">
            <h4 className="font-medium mb-1">保存される支払情報:</h4>
            <div className="text-sm text-gray-700">
              <span className="font-medium">{paymentYear}年{paymentMonth}月</span> の賞与明細 
              （支払日: <span className="font-medium">{new Date(paymentDate).toLocaleDateString('ja-JP')}</span>）
            </div>
          </div>

          {/* ヘッダー表示 */}
          <div className="mb-3">
            <h4 className="font-medium mb-1">検出されたヘッダー ({headers.length}個):</h4>
            <div className="flex flex-wrap gap-1">
              {headers.map((header, index) => (
                <span key={index} className="px-2 py-1 bg-gray-200 rounded text-xs">
                  {header}
                </span>
              ))}
            </div>
          </div>

          {/* データテーブル */}
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full bg-white text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-2 text-left font-medium text-gray-700">#</th>
                  {headers.map((header, index) => (
                    <th key={index} className="px-2 py-2 text-left font-medium text-gray-700">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 5).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t">
                    <td className="px-2 py-2 text-gray-600">{rowIndex + 1}</td>
                    {headers.map((header, colIndex) => (
                      <td key={colIndex} className="px-2 py-2">
                        {row[header] || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
                {csvData.length > 5 && (
                  <tr>
                    <td colSpan={headers.length + 1} className="px-2 py-2 text-center text-gray-500">
                      ... 他 {csvData.length - 5} 件
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BonusSimpleCSVUpload; 