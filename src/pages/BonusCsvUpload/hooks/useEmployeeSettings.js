// src/pages/CsvUpload/hooks/useEmployeeSettings.js

import { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

/**
 * 従業員情報更新設定に関するカスタムフック
 */
const useEmployeeSettings = (userDetails) => {
  const [updateEmployeeInfo, setUpdateEmployeeInfo] = useState(true);
  const [registerNewEmployees, setRegisterNewEmployees] = useState(false);
  const [employeeIdColumn, setEmployeeIdColumn] = useState('');
  const [departmentCodeColumn, setDepartmentCodeColumn] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugState, setDebugState] = useState(null);

  // 従業員情報更新設定をFirestoreから取得
  useEffect(() => {
    const fetchEmployeeSettings = async () => {
      if (!userDetails?.companyId) return;
      
      setIsLoading(true);
      try {
        // csvMappings から employeeMapping を取得
        const mappingDoc = await getDoc(doc(db, "csvMappings", userDetails.companyId));
        let settingsUpdated = false;
        
        if (mappingDoc.exists() && mappingDoc.data().employeeMapping) {
          const empMapping = mappingDoc.data().employeeMapping;
          setEmployeeIdColumn(empMapping.employeeIdColumn || '');
          setDepartmentCodeColumn(empMapping.departmentCodeColumn || '');
          
          // registerNewEmployeesプロパティがあれば取得
          if (typeof empMapping.registerNewEmployees !== 'undefined') {
            setRegisterNewEmployees(empMapping.registerNewEmployees);
            settingsUpdated = true;
          }
        }
        
        // 従業員CSV連携設定を取得（従来の設定）
        const settingsDoc = await getDoc(doc(db, "csvSettings", userDetails.companyId));
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          // 古い設定がある場合はそれを優先
          if (settings.employeeIdColumn) {
            setEmployeeIdColumn(settings.employeeIdColumn);
          }
          if (settings.departmentCodeColumn) {
            setDepartmentCodeColumn(settings.departmentCodeColumn);
          }
          // 新規従業員登録設定があれば読み込む
          if (typeof settings.registerNewEmployees !== 'undefined') {
            setRegisterNewEmployees(settings.registerNewEmployees);
            settingsUpdated = true;
          }
        }
        
        // デバッグ情報を設定
        setDebugState({
          settings: settingsDoc.exists() ? settingsDoc.data() : null,
          employeeMapping: mappingDoc.exists() ? mappingDoc.data().employeeMapping : null,
          settingsUpdated
        });
        
        // 最初のロード時に、設定が存在しない場合はデフォルト値をセットして保存
        if (!settingsUpdated) {
          saveEmployeeSettings(true, registerNewEmployees, employeeIdColumn, departmentCodeColumn);
        }
      } catch (err) {
        console.error("従業員設定の取得エラー:", err);
        setError("従業員設定の取得中にエラーが発生しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployeeSettings();
  }, [userDetails]);

  // 従業員情報更新設定の変更時にFirestoreに保存
  const saveEmployeeSettings = async (updateInfo, registerNew, empIdCol, deptCol) => {
    if (!userDetails?.companyId) return;
    
    try {
      // csvSettings コレクションに保存
      await setDoc(doc(db, "csvSettings", userDetails.companyId), {
        employeeIdColumn: empIdCol || '',
        departmentCodeColumn: deptCol || '',
        updateEmployeeInfo: updateInfo,
        registerNewEmployees: registerNew,
        updatedAt: new Date()
      }, { merge: true });
      
      // csvMappings コレクションのemployeeMappingフィールドに保存
      const mappingDoc = await getDoc(doc(db, "csvMappings", userDetails.companyId));
      if (mappingDoc.exists()) {
        const currentData = mappingDoc.data();
        await setDoc(doc(db, "csvMappings", userDetails.companyId), {
          ...currentData,
          employeeMapping: {
            ...(currentData.employeeMapping || {}),
            employeeIdColumn: empIdCol || '',
            departmentCodeColumn: deptCol || '',
            registerNewEmployees: registerNew
          },
          updatedAt: new Date()
        }, { merge: true });
      } else {
        // まだマッピングデータがない場合は新規作成
        await setDoc(doc(db, "csvMappings", userDetails.companyId), {
          employeeMapping: {
            employeeIdColumn: empIdCol || '',
            departmentCodeColumn: deptCol || '',
            registerNewEmployees: registerNew
          },
          mappings: {},
          updatedAt: new Date()
        });
      }
      
      console.log("従業員設定を保存しました:", {
        updateEmployeeInfo: updateInfo,
        registerNewEmployees: registerNew,
        employeeIdColumn: empIdCol,
        departmentCodeColumn: deptCol
      });
    } catch (err) {
      console.error("従業員設定の保存エラー:", err);
      setError("従業員設定の保存中にエラーが発生しました");
    }
  };

  // チェックボックスの状態変更ハンドラをラップして、変更時に保存する
  const handleUpdateEmployeeInfo = (value) => {
    setUpdateEmployeeInfo(value);
    saveEmployeeSettings(value, registerNewEmployees, employeeIdColumn, departmentCodeColumn);
  };

  const handleRegisterNewEmployees = (value) => {
    setRegisterNewEmployees(value);
    saveEmployeeSettings(updateEmployeeInfo, value, employeeIdColumn, departmentCodeColumn);
  };

  return {
    updateEmployeeInfo,
    setUpdateEmployeeInfo: handleUpdateEmployeeInfo,
    registerNewEmployees,
    setRegisterNewEmployees: handleRegisterNewEmployees,
    employeeIdColumn,
    setEmployeeIdColumn,
    departmentCodeColumn,
    setDepartmentCodeColumn,
    isLoading,
    error,
    debugState
  };
};

export default useEmployeeSettings;
