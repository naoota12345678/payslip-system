// 従業員設定の保存機能を追加

// saveEmployeeSettings 関数を CsvUpload.js に追加
const saveEmployeeSettings = async () => {
  if (updateEmployeeInfo && !employeeIdColumn) {
    setError('従業員番号カラムを選択してください');
    return;
  }
  
  try {
    setIsLoading(true);
    setError('');
    
    // 従業員CSV連携設定を保存
    await setDoc(doc(db, "csvSettings", userDetails.companyId), {
      employeeIdColumn,
      departmentCodeColumn,
      updateEmployeeInfo,
      updatedAt: new Date(),
      updatedBy: userDetails.id || ''
    });
    
    // csvMappings コレクションにも同じ情報を保存（互換性のため）
    try {
      const mappingDoc = await getDoc(doc(db, "csvMappings", userDetails.companyId));
      const existingData = mappingDoc.exists() ? mappingDoc.data() : {};
      
      await setDoc(doc(db, "csvMappings", userDetails.companyId), {
        ...existingData,
        employeeMapping: {
          employeeIdColumn,
          departmentCodeColumn,
          updateEmployeeInfo
        },
        updatedAt: new Date(),
        updatedBy: userDetails.id || ''
      });
    } catch (err) {
      console.warn('csvMappingsコレクションへの保存に失敗:', err);
      // この失敗はメイン処理に影響しないのでエラーは表示しない
    }
    
    setSuccess('従業員情報更新設定を保存しました');
    setTimeout(() => setSuccess(''), 3000);
  } catch (err) {
    console.error('従業員設定保存エラー:', err);
    setError('設定の保存中にエラーが発生しました: ' + (err.message || 'エラーが発生しました'));
  } finally {
    setIsLoading(false);
  }
};
