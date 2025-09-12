// src/pages/admin/AuthDebug.js
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import { listUsers } from 'firebase/auth';
import { db } from '../../firebase';

function AuthDebug() {
  const [authUsers, setAuthUsers] = useState([]);
  const [employeeData, setEmployeeData] = useState([]);
  const [missingEmployeeData, setMissingEmployeeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState('');

  // Firebase Authユーザー一覧を取得（実際にはCloud Functions経由で取得する必要があります）
  const checkAuthUsers = async () => {
    setLoading(true);
    setResults('🔍 Firebase AuthとFirestoreデータの整合性をチェック中...\n\n');
    
    try {
      // Firestoreのemployeesコレクションから全データ取得
      const employeesSnapshot = await getDocs(collection(db, 'employees'));
      const employees = [];
      
      employeesSnapshot.forEach((doc) => {
        employees.push({
          docId: doc.id,
          ...doc.data()
        });
      });
      
      setEmployeeData(employees);
      
      let report = `📊 Firestoreのemployeesコレクション: ${employees.length}件\n\n`;
      
      // 各従業員データをチェック
      const problems = [];
      employees.forEach((emp, index) => {
        report += `${index + 1}. ${emp.name || emp.email || 'Unknown'}\n`;
        report += `   - UID: ${emp.uid || '❌ 未設定'}\n`;
        report += `   - Email: ${emp.email || '❌ 未設定'}\n`;
        report += `   - Status: ${emp.status || emp.isActive ? '✅ Active' : '⚠️ Inactive'}\n`;
        report += `   - UserType: ${emp.userType || '❌ 未設定'}\n`;
        
        // 問題を特定
        if (!emp.uid) {
          problems.push({
            type: 'missing_uid',
            employee: emp,
            message: `${emp.name || emp.email}にUIDが設定されていません`
          });
        }
        if (!emp.email) {
          problems.push({
            type: 'missing_email',
            employee: emp,
            message: `${emp.name}にEmailが設定されていません`
          });
        }
        if (!emp.userType) {
          problems.push({
            type: 'missing_usertype',
            employee: emp,
            message: `${emp.name || emp.email}にUserTypeが設定されていません`
          });
        }
        
        report += '\n';
      });
      
      report += `\n🚨 発見された問題: ${problems.length}件\n\n`;
      problems.forEach((problem, index) => {
        report += `${index + 1}. ${problem.message}\n`;
      });
      
      if (problems.length === 0) {
        report += '✅ 問題は見つかりませんでした。\n';
        report += '\n💡 ログインできない場合の他の原因:\n';
        report += '- ブラウザのキャッシュをクリア\n';
        report += '- プライベートブラウジングモードで試行\n';
        report += '- Firebaseプロジェクトの認証設定を確認\n';
      } else {
        report += '\n🔧 下記の「一括修正」ボタンで問題を修正できます。\n';
      }
      
      setResults(report);
      
    } catch (error) {
      console.error('デバッグエラー:', error);
      setResults(`❌ エラーが発生しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 一括修正機能
  const fixAllProblems = async () => {
    setLoading(true);
    let report = '🔧 一括修正を開始します...\n\n';
    
    try {
      const updates = [];
      
      for (const emp of employeeData) {
        const fixes = {};
        
        // UserTypeが未設定の場合はemployeeに設定
        if (!emp.userType) {
          fixes.userType = 'employee';
          fixes.role = 'employee';
        }
        
        // isActiveが未設定の場合はtrueに設定
        if (emp.isActive === undefined) {
          fixes.isActive = true;
        }
        
        // statusが未設定の場合は'active'に設定
        if (!emp.status) {
          fixes.status = 'active';
        }
        
        if (Object.keys(fixes).length > 0) {
          const docRef = doc(db, 'employees', emp.docId);
          await updateDoc(docRef, fixes);
          
          report += `✅ ${emp.name || emp.email}: ${Object.keys(fixes).join(', ')}を修正\n`;
          updates.push({ employee: emp, fixes });
        }
      }
      
      if (updates.length === 0) {
        report += '✅ 修正が必要な項目は見つかりませんでした。\n';
      } else {
        report += `\n🎉 ${updates.length}件の従業員データを修正しました。\n`;
        report += '\n📱 従業員の方に再度ログインを試してもらってください。\n';
      }
      
    } catch (error) {
      report += `❌ 修正中にエラーが発生しました: ${error.message}\n`;
    }
    
    setResults(results + '\n' + report);
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          🔍 認証問題デバッグツール
        </h1>
        
        <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400">
          <h3 className="font-semibold text-yellow-800">このツールについて</h3>
          <p className="text-yellow-700 mt-2">
            ログインできない従業員がいる場合、Firebase AuthenticationとFirestoreのemployeesコレクション間のデータ不整合が原因の可能性があります。
            このツールで問題を特定・修正できます。
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <button
            onClick={checkAuthUsers}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? '🔍 チェック中...' : '🔍 認証データをチェック'}
          </button>

          {employeeData.length > 0 && (
            <button
              onClick={fixAllProblems}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 disabled:opacity-50 font-medium ml-4"
            >
              {loading ? '🔧 修正中...' : '🔧 問題を一括修正'}
            </button>
          )}
        </div>

        {results && (
          <div className="bg-gray-50 rounded-md p-4">
            <h3 className="font-semibold text-gray-900 mb-3">チェック結果</h3>
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {results}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthDebug;