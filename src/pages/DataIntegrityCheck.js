import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, deleteField, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

const DataIntegrityCheck = () => {
  const { userDetails } = useAuth();
  const [duplicates, setDuplicates] = useState([]);
  const [payslipData, setPayslipData] = useState([]);
  const [masterData, setMasterData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixResults, setFixResults] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // 処理中のフラグ

  // 重複データの検出
  const checkDuplicates = async () => {
    setLoading(true);
    try {
      // ユーザーデータを取得
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = [];
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.companyId === userDetails.companyId) {
          users.push({
            id: doc.id,
            ...data
          });
        }
      });

      // 給与明細データを取得
      const payslipsSnapshot = await getDocs(collection(db, 'payslips'));
      const payslips = [];
      payslipsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.companyId === userDetails.companyId) {
          payslips.push({
            id: doc.id,
            ...data
          });
        }
      });
      setPayslipData(payslips);

      // 正しいマスターデータ（employeesコレクション）を取得
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      const employees = [];
      employeesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.companyId === userDetails.companyId) {
          employees.push({
            id: doc.id,
            ...data
          });
        }
      });
      setMasterData(employees);
      console.log('マスターデータ（employees）:', employees);

      // マスターデータ（employeesコレクション）の重複チェック
      const masterEmployeeIdGroups = {};
      employees.forEach(emp => {
        if (emp.employeeId) {
          if (!masterEmployeeIdGroups[emp.employeeId]) {
            masterEmployeeIdGroups[emp.employeeId] = [];
          }
          masterEmployeeIdGroups[emp.employeeId].push(emp);
        }
      });

      const masterDuplicates = Object.entries(masterEmployeeIdGroups).filter(([employeeId, empList]) => empList.length > 1);
      
      if (masterDuplicates.length > 0) {
        console.warn('⚠️ マスターデータ（employeesコレクション）にも重複があります:', masterDuplicates);
        alert(`警告: マスターデータ（employeesコレクション）にも重複があります。\n重複employeeId: ${masterDuplicates.map(([id]) => id).join(', ')}\n\nまずemployeesコレクションの重複を解決してください。`);
      }

      // employeeIdの重複を検出
      const employeeIdGroups = {};
      users.forEach(user => {
        if (user.employeeId) {
          if (!employeeIdGroups[user.employeeId]) {
            employeeIdGroups[user.employeeId] = [];
          }
          employeeIdGroups[user.employeeId].push(user);
        }
      });

      // 重複があるemployeeIdのみ抽出
      const duplicateList = [];
      Object.entries(employeeIdGroups).forEach(([employeeId, userList]) => {
        if (userList.length > 1) {
          // この給与明細データと関連付け
          const relatedPayslips = payslips.filter(p => 
            userList.some(u => u.id === p.userId)
          );
          
          duplicateList.push({
            employeeId,
            users: userList,
            payslips: relatedPayslips,
            count: userList.length
          });
        }
      });

      setDuplicates(duplicateList);
    } catch (error) {
      console.error('データチェックエラー:', error);
      alert('データチェック中にエラーが発生しました: ' + error.message);
    }
    setLoading(false);
  };

  // 重複データの自動修正
  const fixDuplicate = async (duplicateItem) => {
    if (!window.confirm(`employeeId ${duplicateItem.employeeId} の重複を修正しますか？`)) {
      return;
    }

    setFixing(true);
    try {
      const { employeeId, users, payslips } = duplicateItem;
      
      // 給与明細に関連付けられているユーザーを特定
      const usersWithPayslips = users.filter(user => 
        payslips.some(p => p.userId === user.id)
      );
      
      const usersWithoutPayslips = users.filter(user => 
        !payslips.some(p => p.userId === user.id)
      );

      console.log('修正処理開始:', {
        employeeId,
        usersWithPayslips: usersWithPayslips.map(u => ({ id: u.id, name: u.displayName || u.name })),
        usersWithoutPayslips: usersWithoutPayslips.map(u => ({ id: u.id, name: u.displayName || u.name }))
      });

      // 給与明細に関連付けられていないユーザーの処理
      for (const user of usersWithoutPayslips) {
        const choice = window.prompt(
          `${user.displayName || user.name} (ID: ${user.id}) は給与明細に関連付けられていません。\n` +
          `1: 削除する\n` +
          `2: 新しいemployeeIdを設定する (例: ${employeeId}_2)\n` +
          `3: スキップ\n` +
          `選択してください (1-3):`,
          '2'
        );

        if (choice === '1') {
          // ユーザーを削除
          await deleteDoc(doc(db, 'users', user.id));
          console.log(`ユーザー削除: ${user.displayName || user.name}`);
        } else if (choice === '2') {
          // 新しいemployeeIdを設定
          const newEmployeeId = window.prompt(
            `${user.displayName || user.name} の新しいemployeeIdを入力してください:`,
            `${employeeId}_alt`
          );
          if (newEmployeeId && newEmployeeId !== employeeId) {
            await updateDoc(doc(db, 'users', user.id), {
              employeeId: newEmployeeId
            });
            console.log(`employeeId更新: ${user.displayName || user.name} -> ${newEmployeeId}`);
          }
        }
        // choice === '3' の場合はスキップ
      }

      alert(`employeeId ${employeeId} の重複修正が完了しました`);
      
      // データを再チェック
      await checkDuplicates();
      
    } catch (error) {
      console.error('修正エラー:', error);
      alert('修正中にエラーが発生しました: ' + error.message);
    }
    setFixing(false);
  };

  // マスターデータ同期機能
  const syncWithMasterData = async () => {
    if (!window.confirm('employeesコレクションのマスターデータに基づいて、usersコレクションのemployeeIdを一括修正しますか？\n\nこの操作により、重複問題が根本的に解決されます。')) {
      return;
    }

    setFixing(true);
    try {
      console.log('マスターデータ同期開始');
      console.log('employees マスターデータ:', masterData);
      
      // usersコレクションを取得
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const users = [];
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.companyId === userDetails.companyId) {
          users.push({
            id: doc.id,
            ...data
          });
        }
      });

      let updatedCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      const syncDetails = [];

      console.log('=== 同期処理詳細ログ開始 ===');
      console.log('マスターデータ数:', masterData.length);
      console.log('ユーザーデータ数:', users.length);

      // 各ユーザーに対してマスターデータと照合
      for (const user of users) {
        try {
          // 名前でマスターデータを検索（displayName または name）
          const userName = user.displayName || user.name || '';
          const userNameClean = userName.replace(/\s+/g, '');
          
          console.log(`\n--- ユーザー処理: ${userName} (現在のemployeeId: ${user.employeeId}) ---`);
          
          // employeesコレクションで名前が一致する従業員を検索
          const potentialMatches = masterData.filter(emp => {
            const empName = emp.name || emp.displayName || '';
            const empNameClean = empName.replace(/\s+/g, '');
            
            const match1 = empName && empName.includes(userNameClean);
            const match2 = emp.displayName && emp.displayName.includes(userNameClean);
            const match3 = userName && userName.includes(empNameClean);
            const match4 = userName && userName.includes(emp.displayName?.replace(/\s+/g, '') || '');
            
            return match1 || match2 || match3 || match4;
          });
          
          console.log(`潜在的一致: ${potentialMatches.length}件`, potentialMatches.map(m => `${m.name || m.displayName}(ID:${m.employeeId})`));
          
          const matchingEmployee = potentialMatches[0]; // 最初の一致を使用
          
          if (matchingEmployee && matchingEmployee.employeeId && matchingEmployee.employeeId !== user.employeeId) {
            console.log(`✅ 同期実行: ${userName} -> employeeId: ${user.employeeId} → ${matchingEmployee.employeeId}`);
            
            // usersコレクションのemployeeIdを更新
            await updateDoc(doc(db, 'users', user.id), {
              employeeId: matchingEmployee.employeeId
            });
            
            syncDetails.push({
              userId: user.id,
              userName: userName,
              oldEmployeeId: user.employeeId,
              newEmployeeId: matchingEmployee.employeeId
            });
            
            updatedCount++;
          } else if (matchingEmployee && matchingEmployee.employeeId === user.employeeId) {
            console.log(`⚪ スキップ（既に正しい）: ${userName} -> employeeId: ${user.employeeId}`);
            skippedCount++;
          } else {
            console.log(`❌ 一致なし: ${userName} -> employeeId: ${user.employeeId}`);
            skippedCount++;
          }
        } catch (error) {
          console.error(`❌ ユーザー ${user.displayName || user.name} の同期エラー:`, error);
          errorCount++;
        }
      }
      
      console.log('=== 同期処理詳細ログ終了 ===');
      console.log('同期詳細:', syncDetails);

      alert(`マスターデータ同期完了\n更新: ${updatedCount}件\nスキップ: ${skippedCount}件\nエラー: ${errorCount}件\n\n詳細はコンソールログを確認してください。`);
      
      // データを再チェック
      await checkDuplicates();
      
    } catch (error) {
      console.error('同期エラー:', error);
      alert('同期中にエラーが発生しました: ' + error.message);
    }
    setFixing(false);
  };

  // 詳細データ解析機能
  const analyzeDataStructure = async () => {
    setLoading(true);
    try {
      console.log('=== 詳細データ解析開始 ===');

      // 全データを再取得
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const payslipsSnapshot = await getDocs(collection(db, 'payslips'));
      
      const users = [];
      const payslips = [];
      
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.companyId === userDetails.companyId) {
          users.push({ id: doc.id, ...data });
        }
      });
      
      payslipsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.companyId === userDetails.companyId) {
          payslips.push({ id: doc.id, ...data });
        }
      });

      console.log('ユーザー総数:', users.length);
      console.log('給与明細総数:', payslips.length);

      // employeeId別の分析
      const employeeIdAnalysis = {};
      users.forEach(user => {
        const empId = user.employeeId;
        if (!employeeIdAnalysis[empId]) {
          employeeIdAnalysis[empId] = {
            users: [],
            payslips: []
          };
        }
        employeeIdAnalysis[empId].users.push(user);
        
        // このユーザーに関連する給与明細を検索
        const userPayslips = payslips.filter(p => p.userId === user.id);
        employeeIdAnalysis[empId].payslips.push(...userPayslips);
      });

      console.log('\n=== employeeId別分析結果 ===');
      Object.entries(employeeIdAnalysis).forEach(([empId, data]) => {
        console.log(`\nemployeeId: ${empId}`);
        console.log(`  ユーザー数: ${data.users.length}`);
        console.log(`  給与明細数: ${data.payslips.length}`);
        
        if (data.users.length > 1) {
          console.log('  🚨 重複ユーザー:');
          data.users.forEach((user, index) => {
            console.log(`    ${index + 1}. ${user.displayName || user.name} (ID: ${user.id})`);
            console.log(`       Email: ${user.email}`);
            console.log(`       作成日: ${user.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}`);
          });
        }
        
        if (data.payslips.length > 0) {
          console.log('  💰 関連給与明細:');
          data.payslips.forEach((payslip, index) => {
            console.log(`    ${index + 1}. 明細ID: ${payslip.id}, ユーザーID: ${payslip.userId}`);
            console.log(`       支払日: ${payslip.paymentDate?.toDate?.()?.toLocaleDateString() || 'N/A'}`);
          });
        }
      });

      // 特にemployeeId "4"の詳細分析
      if (employeeIdAnalysis['4']) {
        console.log('\n=== employeeId "4" 詳細分析 ===');
        const emp4Data = employeeIdAnalysis['4'];
        
        console.log(`重複ユーザー数: ${emp4Data.users.length}`);
        console.log('マスターデータとの照合:');
        
        emp4Data.users.forEach((user, index) => {
          const userName = user.displayName || user.name || '';
          console.log(`\n${index + 1}. ${userName}`);
          
          // マスターデータで名前が一致する候補を検索
          const nameMatches = masterData.filter(emp => {
            const empName = emp.name || emp.displayName || '';
            const userNameClean = userName.replace(/\s+/g, '');
            const empNameClean = empName.replace(/\s+/g, '');
            
            return empName.includes(userNameClean) || 
                   userName.includes(empNameClean) ||
                   empNameClean === userNameClean;
          });
          
          console.log(`   候補マスターデータ:`, nameMatches.map(m => `${m.name || m.displayName}(ID:${m.employeeId})`));
          
          // このユーザーの給与明細数
          const userPayslipCount = payslips.filter(p => p.userId === user.id).length;
          console.log(`   給与明細数: ${userPayslipCount}`);
          
          // 推奨修正案
          if (nameMatches.length === 1) {
            console.log(`   ✅ 推奨修正: employeeId "4" → "${nameMatches[0].employeeId}"`);
          } else if (nameMatches.length > 1) {
            console.log(`   ⚠️ 複数候補あり: 手動確認が必要`);
          } else {
            console.log(`   ❌ マスターデータに一致なし: 手動調査が必要`);
          }
        });
      }

      console.log('\n=== 詳細データ解析終了 ===');
      
      // 分析結果を構造化して返す
      const analysisResult = {
        totalUsers: users.length,
        totalPayslips: payslips.length,
        employeeIdAnalysis: Object.entries(employeeIdAnalysis).map(([empId, data]) => ({
          employeeId: empId,
          userCount: data.users.length,
          payslipCount: data.payslips.length,
          users: data.users.map(user => ({
            id: user.id,
            displayName: user.displayName || user.name || '',
            email: user.email,
            employeeId: user.employeeId,
            createdAt: user.createdAt
          })),
          payslips: data.payslips
        }))
      };
      
      alert('詳細データ解析が完了しました。コンソールログを確認してください。');
      return analysisResult;
      
    } catch (error) {
      console.error('詳細解析エラー:', error);
      alert('詳細解析中にエラーが発生しました: ' + error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 詳細データ解析の結果を分析データとして保存
  const performDetailedAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = await analyzeDataStructure();
      setAnalysisData(result);
    } catch (error) {
      console.error('詳細解析実行エラー:', error);
      setAnalysisData(null);
    } finally {
      setAnalyzing(false);
    }
  };

  // 自動修正の実行
  const executeRecommendedFixes = async () => {
    setFixing(true);
    setFixResults([]);
    
    try {
      console.log('=== 推奨修正の実行開始 ===');
      
             // まず最新のデータを再取得
       await performDetailedAnalysis();
       
       const analysisResults = analysisData?.employeeIdAnalysis || [];
       const employeeId4Users = analysisResults.find(emp => emp.employeeId === '4')?.users || [];
      
      if (employeeId4Users.length === 0) {
        setFixResults([{ type: 'error', message: 'employeeId "4" の重複ユーザーが見つかりません' }]);
        return;
      }
      
      console.log('修正対象ユーザー数:', employeeId4Users.length);
      
      let successCount = 0;
      let errorCount = 0;
      const results = [];
      
      for (const user of employeeId4Users) {
        try {
          // マスターデータとの照合
          const masterEmployee = masterData.find(emp => 
            emp.name === user.displayName || emp.name.replace(/\s+/g, '') === user.displayName.replace(/\s+/g, '')
          );
          
          if (!masterEmployee) {
            results.push({
              type: 'warning',
              message: `${user.displayName}: マスターデータに一致なし（手動対応が必要）`
            });
            continue;
          }
          
          // 既に正しいemployeeIdの場合はスキップ
          if (user.employeeId === masterEmployee.employeeId) {
            results.push({
              type: 'info',
              message: `${user.displayName}: 既に正しいemployeeId（${masterEmployee.employeeId}）`
            });
            continue;
          }
          
          // Firestoreでユーザーデータを更新
          await updateDoc(doc(db, 'users', user.id), {
            employeeId: masterEmployee.employeeId,
            updatedAt: serverTimestamp(),
            lastIntegrityFix: serverTimestamp(),
            previousEmployeeId: user.employeeId // バックアップ用
          });
          
          successCount++;
          results.push({
            type: 'success',
            message: `${user.displayName}: employeeId "${user.employeeId}" → "${masterEmployee.employeeId}" に修正完了`
          });
          
          console.log(`修正完了: ${user.displayName} (${user.id})`);
          
        } catch (error) {
          errorCount++;
          results.push({
            type: 'error',
            message: `${user.displayName}: 修正エラー - ${error.message}`
          });
          console.error(`修正エラー (${user.displayName}):`, error);
        }
      }
      
      setFixResults(results);
      
      console.log('=== 推奨修正の実行完了 ===');
      console.log(`成功: ${successCount}件, エラー: ${errorCount}件`);
      
      // 修正後に再分析を実行
      if (successCount > 0) {
        setTimeout(() => {
          performDetailedAnalysis();
        }, 1000);
      }
      
    } catch (error) {
      console.error('修正実行エラー:', error);
      setFixResults([{
        type: 'error',
        message: `修正実行中にエラーが発生しました: ${error.message}`
      }]);
    } finally {
      setFixing(false);
    }
  };

  // userId統一設計への移行
  const migrateToUserIdUnified = async () => {
    setFixing(true);
    setFixResults([]);
    
    try {
      console.log('=== userId統一設計への移行開始 ===');
      
      // ステップ1: usersコレクションにemployees情報を統合
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      
      // employeesデータをMap化（効率的な検索のため）
      const employeesMap = new Map();
      employeesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.companyId === userDetails.companyId) {
          employeesMap.set(data.employeeId, {
            id: doc.id,
            ...data
          });
        }
      });
      
      console.log('対象従業員数:', employeesMap.size);
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      // ユーザーごとに統合処理
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        
        // 同じ会社のユーザーのみ処理
        if (userData.companyId !== userDetails.companyId) continue;
        
        try {
          const userId = userDoc.id;
          const currentEmployeeId = userData.employeeId;
          
          // マスターデータから正しい従業員情報を検索
          let correctEmployee = null;
          
          // 1. 名前で完全一致検索
          for (const [empId, empData] of employeesMap) {
            if (empData.name === userData.displayName || 
                empData.name.replace(/\s+/g, '') === userData.displayName.replace(/\s+/g, '')) {
              correctEmployee = empData;
              break;
            }
          }
          
          // 2. 現在のemployeeIdで検索（バックアップ）
          if (!correctEmployee && currentEmployeeId) {
            correctEmployee = employeesMap.get(currentEmployeeId);
          }
          
          // 統合データを作成
          const updatedUserData = {
            // 既存のusersデータ
            email: userData.email,
            displayName: userData.displayName,
            userType: userData.userType,
            companyId: userData.companyId,
            phone: userData.phone || '',
            
            // employeesデータから統合
            employeeNumber: correctEmployee?.employeeId || currentEmployeeId || '',
            department: correctEmployee?.departmentId || userData.departmentId || '',
            position: correctEmployee?.position || userData.position || '',
            jobType: correctEmployee?.jobType || '',
            contractType: correctEmployee?.contractType || '',
            gender: correctEmployee?.gender || null,
            birthDate: correctEmployee?.birthDate || '',
            hireDate: correctEmployee?.hireDate || '',
            
            // 管理フィールド
            updatedAt: serverTimestamp(),
            migratedAt: serverTimestamp(),
            
            // employeeIdフィールドを削除
            employeeId: deleteField()
          };
          
          // Firestoreでユーザーデータを更新
          await updateDoc(doc(db, 'users', userId), updatedUserData);
          
          successCount++;
          results.push({
            type: 'success',
            message: `${userData.displayName}: userId統一完了 (従業員番号: ${updatedUserData.employeeNumber})`
          });
          
          console.log(`統合完了: ${userData.displayName} (${userId})`);
          
        } catch (error) {
          errorCount++;
          results.push({
            type: 'error',
            message: `${userData.displayName}: 統合エラー - ${error.message}`
          });
          console.error(`統合エラー (${userData.displayName}):`, error);
        }
      }
      
      // ステップ2: payslipsコレクションからemployeeIdフィールドを削除
      console.log('\n=== payslipsのemployeeIdフィールド削除開始 ===');
      
      const payslipsSnapshot = await getDocs(collection(db, 'payslips'));
      let payslipUpdateCount = 0;
      
      for (const payslipDoc of payslipsSnapshot.docs) {
        const payslipData = payslipDoc.data();
        
        // 同じ会社の給与明細のみ処理
        if (payslipData.companyId === userDetails.companyId && payslipData.employeeId) {
          try {
            await updateDoc(doc(db, 'payslips', payslipDoc.id), {
              employeeId: deleteField(), // フィールドを削除
              updatedAt: serverTimestamp(),
              migratedAt: serverTimestamp()
            });
            payslipUpdateCount++;
          } catch (error) {
            console.error(`給与明細更新エラー (${payslipDoc.id}):`, error);
          }
        }
      }
      
      results.push({
        type: 'info',
        message: `給与明細のemployeeIdフィールドを削除: ${payslipUpdateCount}件`
      });
      
      setFixResults(results);
      
      console.log('=== userId統一設計への移行完了 ===');
      console.log(`ユーザー統合: 成功 ${successCount}件, エラー ${errorCount}件`);
      console.log(`給与明細更新: ${payslipUpdateCount}件`);
      
    } catch (error) {
      console.error('移行実行エラー:', error);
      setFixResults([{
        type: 'error',
        message: `移行実行中にエラーが発生しました: ${error.message}`
      }]);
    } finally {
      setFixing(false);
    }
  };

  // 既存の給与明細データに部門コードを追加する機能
  const addDepartmentCodeToPayslips = async () => {
    if (!window.confirm('既存の給与明細データに部門コード「KY02」を一括で追加しますか？\n※この操作は元に戻すことができません。')) {
      return;
    }

    try {
      setIsProcessing(true);
      console.log('給与明細データに部門コード追加開始');

      // 現在の会社の全給与明細を取得
      const payslipsSnapshot = await getDocs(
        query(collection(db, 'payslips'), where('companyId', '==', userDetails.companyId))
      );

      console.log(`対象給与明細数: ${payslipsSnapshot.size}`);

      let updatedCount = 0;
      const batch = writeBatch(db);

      payslipsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        // 部門コードが未設定の場合のみ追加
        if (!data.departmentCode) {
          batch.update(doc.ref, {
            departmentCode: 'KY02',
            updatedAt: serverTimestamp()
          });
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await batch.commit();
        console.log(`${updatedCount}件の給与明細に部門コードを追加しました`);
        alert(`✅ ${updatedCount}件の給与明細に部門コード「KY02」を追加しました！`);
      } else {
        alert('対象となる給与明細データが見つかりませんでした。');
      }

    } catch (error) {
      console.error('部門コード追加エラー:', error);
      alert('部門コードの追加中にエラーが発生しました: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // CSVマッピング設定を完全にリセットする機能
  const resetAllCSVMappings = async () => {
    if (!window.confirm('🚨 重要な操作 🚨\n\nCSVマッピング設定を完全にリセットしますか？\n\n【この操作により】\n✅ 複雑なマッピング構造を削除\n✅ シンプルな「CSVヘッダー名→日本語名」システムに変更\n✅ 給与明細表示の問題を解決\n\n※この操作は元に戻すことができません。')) {
      return;
    }

    try {
      setIsProcessing(true);
      console.log('CSVマッピング設定のリセット開始');

      // csvMappingsコレクションを削除
      const csvMappingRef = doc(db, 'csvMappings', userDetails.companyId);
      await deleteDoc(csvMappingRef);
      console.log('csvMappingsコレクションを削除しました');

      // csvSettingsコレクションも削除
      const csvSettingsRef = doc(db, 'csvSettings', userDetails.companyId);
      await deleteDoc(csvSettingsRef);
      console.log('csvSettingsコレクションを削除しました');

      // payrollItemsコレクションも削除（会社固有の項目）
      const payrollItemsQuery = query(
        collection(db, 'payrollItems'), 
        where('companyId', '==', userDetails.companyId)
      );
      const payrollItemsSnapshot = await getDocs(payrollItemsQuery);
      
      const batch = writeBatch(db);
      payrollItemsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      if (payrollItemsSnapshot.size > 0) {
        await batch.commit();
        console.log(`${payrollItemsSnapshot.size}件のpayrollItemsを削除しました`);
      }

      alert(`✅ CSVマッピング設定のリセットが完了しました！\n\n削除されたデータ：\n• csvMappings: 1件\n• csvSettings: 1件\n• payrollItems: ${payrollItemsSnapshot.size}件\n\n次回CSVアップロード時に、シンプルなマッピング設定を行ってください。`);

    } catch (error) {
      console.error('CSVマッピングリセットエラー:', error);
      alert('CSVマッピングリセット中にエラーが発生しました: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (userDetails?.companyId) {
      checkDuplicates();
    }
  }, [userDetails]);

  if (!userDetails || (userDetails.userType !== 'company' && userDetails.userType !== 'company_admin' && userDetails.role !== 'admin')) {
    return <div className="p-4">この機能は会社管理者のみ利用できます。</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">データ整合性チェック・修正</h1>
      
      <div className="mb-6 space-x-4">
        <button
          onClick={checkDuplicates}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '検査中...' : '重複データをチェック'}
        </button>
        
        <button
          onClick={syncWithMasterData}
          disabled={fixing || masterData.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {fixing ? '同期中...' : `マスターデータ同期 (${masterData.length}件)`}
        </button>
        
        <button
          onClick={analyzeDataStructure}
          disabled={loading}
          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
        >
          {loading ? '解析中...' : '詳細データ解析'}
        </button>
      </div>

      {masterData.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded border border-blue-200">
          <h3 className="text-lg font-semibold mb-2">📋 マスターデータ (employeesコレクション)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {masterData.slice(0, 10).map(emp => (
              <div key={emp.id} className="p-2 bg-white rounded border">
                <div className="font-medium">{emp.displayName || emp.name}</div>
                <div className="text-gray-600">ID: {emp.employeeId}</div>
              </div>
            ))}
            {masterData.length > 10 && (
              <div className="p-2 text-gray-500">... 他 {masterData.length - 10}件</div>
            )}
          </div>
        </div>
      )}

      {duplicates.length === 0 && !loading && (
        <div className="p-4 bg-green-100 text-green-800 rounded">
          ✅ 重複するemployeeIdは見つかりませんでした。
        </div>
      )}

      {duplicates.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-red-600">
            🚨 重複が検出されました ({duplicates.length}件)
          </h2>
          
          {duplicates.map((duplicate, index) => (
            <div key={duplicate.employeeId} className="border border-red-300 rounded-lg p-4 bg-red-50">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">
                  employeeId: {duplicate.employeeId} ({duplicate.count}人重複)
                </h3>
                <button
                  onClick={() => fixDuplicate(duplicate)}
                  disabled={fixing}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {fixing ? '修正中...' : '修正'}
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">ユーザー一覧:</h4>
                  {duplicate.users.map(user => (
                    <div key={user.id} className="p-2 bg-white rounded border mb-1">
                      <div className="font-medium">{user.displayName || user.name}</div>
                      <div className="text-sm text-gray-600">
                        ID: {user.id}<br/>
                        Email: {user.email}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">関連する給与明細:</h4>
                  {duplicate.payslips.length > 0 ? (
                    duplicate.payslips.map(payslip => (
                      <div key={payslip.id} className="p-2 bg-white rounded border mb-1">
                        <div className="text-sm">
                          明細ID: {payslip.id}<br/>
                          ユーザーID: {payslip.userId}<br/>
                          支払日: {payslip.paymentDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500">関連する給与明細なし</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 修正実行セクション */}
      {analysisData && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">🔧 自動修正の実行</h3>
          <p className="text-sm text-gray-600 mb-3">
            上記の推奨修正を自動で実行します。この操作は元に戻せませんので、慎重に実行してください。
          </p>
          
          <div className="flex space-x-3 mb-4">
            <button
              onClick={executeRecommendedFixes}
              disabled={fixing}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              {fixing ? '修正実行中...' : '推奨修正を実行'}
            </button>
            
            <button
              onClick={performDetailedAnalysis}
              disabled={analyzing || fixing}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {analyzing ? '再分析中...' : '再分析'}
            </button>
          </div>
          
          {/* 修正結果の表示 */}
          {fixResults.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">修正結果:</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {fixResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded text-sm ${
                      result.type === 'success' ? 'bg-green-100 text-green-800' :
                      result.type === 'error' ? 'bg-red-100 text-red-800' :
                      result.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {result.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* userId統一設計への移行セクション */}
      <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">🚀 根本解決: userId統一設計への移行</h3>
        <p className="text-sm text-gray-600 mb-3">
          employeeIdとuserIdの重複を根本的に解決します。usersコレクションに従業員情報を統合し、
          payslipsからemployeeIdフィールドを削除してuserIdのみで運用する設計に移行します。
        </p>
        
        <div className="bg-white p-3 rounded mb-3 text-xs">
          <strong>移行内容:</strong>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>usersコレクションにemployees情報を統合（従業員番号、部門、役職など）</li>
            <li>payslipsコレクションからemployeeIdフィールドを削除</li>
            <li>データの整合性を保ちながら、シンプルなuserIdベース設計に移行</li>
          </ul>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={migrateToUserIdUnified}
            disabled={fixing}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400"
          >
            {fixing ? '移行実行中...' : 'userId統一設計に移行'}
          </button>
        </div>
        
        {/* 移行結果の表示 */}
        {fixResults.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">移行結果:</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {fixResults.map((result, index) => (
                <div
                  key={index}
                  className={`p-2 rounded text-sm ${
                    result.type === 'success' ? 'bg-green-100 text-green-800' :
                    result.type === 'error' ? 'bg-red-100 text-red-800' :
                    result.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}
                >
                  {result.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 給与明細に部門コードを追加するボタン */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">🔄 給与明細に部門コードを追加</h3>
        <p className="text-sm text-gray-600 mb-3">
          既存の給与明細データに部門コード「KY02」を一括で追加します。
          これにより、給与明細データの整合性が向上します。
        </p>
        
        <div className="flex space-x-3">
          <button
            onClick={addDepartmentCodeToPayslips}
            disabled={isProcessing}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-400"
          >
            {isProcessing ? '追加中...' : '給与明細に部門コードを追加'}
          </button>
        </div>
      </div>

      {/* CSVマッピング設定を完全にリセットするボタン */}
      <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">🔄 CSVマッピング設定をリセット</h3>
        <p className="text-sm text-gray-600 mb-3">
          CSVマッピング設定を完全にリセットします。これにより、シンプルな「CSVヘッダー名→日本語名」システムに戻ります。
        </p>
        
        <div className="flex space-x-3">
          <button
            onClick={resetAllCSVMappings}
            disabled={isProcessing}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
          >
            {isProcessing ? 'リセット中...' : 'CSVマッピング設定をリセット'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataIntegrityCheck; 