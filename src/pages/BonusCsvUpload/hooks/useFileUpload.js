// src/pages/CsvUpload/hooks/useFileUpload.js

import { useState } from 'react';
import { storage, db, functions } from '../../../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { parseCSVHeaders } from '../utils/fileHelpers';
import { buildColumnMappings, buildUploadInfo } from '../utils/csvProcessor';
import { PROGRESS_STAGES } from '../constants';

/**
 * ファイルアップロードと処理に関するカスタムフック
 */
const useFileUpload = (userDetails, currentUser) => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [paymentDate, setPaymentDate] = useState('');
  const [sendEmailDate, setSendEmailDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadId, setUploadId] = useState(null);

  /**
   * ファイル選択時の処理
   */
  const handleFileChange = async (e, debugMode = false) => {
    if (!e.target.files[0]) return;
    
    const selectedFile = e.target.files[0];
    
    if (debugMode) {
      console.log('[Debug] 選択されたファイル情報:', {
        name: selectedFile.name, 
        size: selectedFile.size, 
        type: selectedFile.type,
        lastModified: new Date(selectedFile.lastModified).toISOString()
      });
    }
    
    // CSVファイルかどうかチェック
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      setError('CSVファイルを選択してください');
      return;
    }
    
    setFile(selectedFile);
    setFileName(selectedFile.name);
    setError('');
    
    try {
      // CSVのヘッダー情報を解析
      const headers = await parseCSVHeaders(selectedFile, debugMode);
      setCsvHeaders(headers);
    } catch (err) {
      console.error('CSVヘッダー解析エラー:', err);
      setError('CSVファイルの解析に失敗しました: ' + err.message);
    }
  };

  /**
   * CSVファイルのアップロードと処理
   */
  const handleUpload = async (params) => {
    const {
      payrollItems,
      employeeIdColumn,
      departmentCodeColumn,
      updateEmployeeInfo,
      registerNewEmployees = false,
      debugMode = false
    } = params;

    if (!file) {
      setError('ファイルを選択してください');
      return;
    }

    if (!paymentDate) {
      setError('給与支払日を入力してください');
      return;
    }

    // 従業員情報の自動登録設定で、従業員番号カラムが設定されていなければエラー
    if (updateEmployeeInfo && registerNewEmployees && !employeeIdColumn) {
      setError('従業員の自動登録には従業員番号カラムの設定が必要です');
      return;
    }

    // 給与項目のCSVマッピングをチェック
    const hasMappedItems = payrollItems.some(item => item.csvColumn);
    if (!hasMappedItems) {
      // ユーザーに確認を求める
      if (!window.confirm('給与項目とCSVカラムのマッピングが設定されていないようです。このまま続行しますか？')) {
        setError('給与項目とCSVカラムのマッピングが設定されていません。CSVマッピング設定画面でマッピングを行ってください。');
        return;
      }
      
      // 続行する場合は警告をクリア
      setError('');
    }

    if (debugMode) {
      console.log('[Debug] アップロード開始:', {
        fileName,
        fileSize: file.size,
        fileType: file.type,
        paymentDate,
        sendEmailDate,
        employeeIdColumn,
        departmentCodeColumn,
        updateEmployeeInfo,
        registerNewEmployees
      });
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setUploadProgress(0);

    try {
      // アップロードIDを生成（デバッグ追跡用）
      const uploadId = `upload-${new Date().getTime()}-${Math.random().toString(36).substring(2, 9)}`;
      if (debugMode) {
        console.log('[Debug] 生成したアップロードID:', uploadId);
      }
      
      // ファイル名をタイムスタンプ付きでユニークに
      const timestamp = new Date().getTime();
      const uniqueFileName = `${userDetails.companyId}_${timestamp}_${fileName}`;
      if (debugMode) {
        console.log('[Debug] 保存ファイル名:', uniqueFileName);
      }
      
      // Cloud Storageにアップロード（進捗状況追跡付き）
      const storageRef = ref(storage, `bonusPayslips/${userDetails.companyId}/${uniqueFileName}`);
      if (debugMode) {
        console.log('[Debug] ストレージ参照パス:', `bonusPayslips/${userDetails.companyId}/${uniqueFileName}`);
      }
      
      // メタデータを設定
      const metadata = {
        contentType: 'text/csv',
        customMetadata: {
          'uploadId': uploadId,
          'companyId': userDetails.companyId,
          'uploadedBy': currentUser.uid
        }
      };
      
      // uploadBytes の代わりに uploadBytesResumable を使用して進捗状況を追跡
      const uploadTask = uploadBytesResumable(storageRef, file, metadata);
      
      // アップロード進捗状況の監視
      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (debugMode) {
            console.log('[Debug] アップロード進捗:', progress.toFixed(2) + '%');
          }
          setUploadProgress(Math.round(progress * PROGRESS_STAGES.FILE_UPLOAD / 100)); // 40%をファイルアップロードに割り当て
        },
        (uploadError) => {
          // アップロードエラー処理
          console.error('[エラー] ファイルアップロードエラー:', uploadError);
          if (debugMode) {
            console.error('[Debug] エラーコード:', uploadError.code);
            console.error('[Debug] エラーメッセージ:', uploadError.message);
          }
          setError(`ファイルのアップロードに失敗しました: ${uploadError.message}`);
          setIsLoading(false);
        },
        async () => {
          // アップロード完了後の処理
          if (debugMode) {
            console.log('[Debug] ファイルアップロード完了');
          }
          
          try {
            // アップロードしたファイルのURLを取得
            const downloadURL = await getDownloadURL(storageRef);
            if (debugMode) {
              console.log('[Debug] 取得したダウンロードURL:', downloadURL);
            }
            
            // マッピング情報を構築
            const columnMappings = buildColumnMappings(payrollItems);
            if (debugMode) {
              console.log('[Debug] 構築したマッピング情報:', columnMappings);
            }
            
            // アップロード情報を構築
            const uploadInfo = buildUploadInfo({
              uploadId,
              fileName,
              userId: currentUser.uid,
              companyId: userDetails.companyId,
              paymentDate,
              sendEmailDate,
              fileUrl: downloadURL,
              updateEmployeeInfo,
              registerNewEmployees,
              employeeIdColumn,
              departmentCodeColumn,
              columnMappings
            });
            
            if (debugMode) {
              console.log('[Debug] Firestoreに保存するアップロード情報:', uploadInfo);
            }
            
            try {
              // Firestoreにアップロード情報を保存
              const uploadRef = await addDoc(collection(db, "csvUploads"), uploadInfo);
              if (debugMode) {
                console.log('[Debug] Firestoreへの保存成功:', uploadRef.id);
              }
              setUploadId(uploadRef.id); // アップロードIDを状態に保存
              setUploadProgress(PROGRESS_STAGES.DATA_PROCESSING);
              
                          // CSVマッピング設定を取得
            let mappingConfig = null;
            try {
              const mappingDoc = await getDoc(doc(db, 'csvMappingsBonus', userDetails.companyId));
              if (mappingDoc.exists()) {
                mappingConfig = mappingDoc.data();
                console.log('[Debug] CSVマッピング設定を取得:', mappingConfig);
              }
            } catch (mappingError) {
              console.warn('[Warning] CSVマッピング設定の取得に失敗:', mappingError);
            }

            // Cloud Functionsを呼び出してCSV処理
            const processCSV = httpsCallable(functions, 'processCSV');
            
            // 送信パラメータを構築
            const processData = {
              uploadId: uploadRef.id,
              fileUrl: downloadURL,
              companyId: userDetails.companyId,
              updateEmployeeInfo,
              registerNewEmployees,
              employeeIdColumn,
              departmentCodeColumn,
              columnMappings,
              mappingConfig: mappingConfig // CSVマッピング設定を追加
            };
              
              // 各パラメータを個別に検証（デバッグ用）
              console.log('[強制Debug] Cloud Functionに送信するデータ:', processData);
              console.log('[強制Debug] 送信パラメータの詳細検証:');
              console.log('- uploadId:', processData.uploadId, typeof processData.uploadId);
              console.log('- uploadRef.id:', uploadRef.id, typeof uploadRef.id);
              console.log('- fileUrl:', processData.fileUrl ? '(URL設定済み)' : '(URL未設定)', typeof processData.fileUrl);
              console.log('- companyId:', processData.companyId, typeof processData.companyId);
              console.log('- updateEmployeeInfo:', processData.updateEmployeeInfo, typeof processData.updateEmployeeInfo);
              console.log('- registerNewEmployees:', processData.registerNewEmployees, typeof processData.registerNewEmployees);
              console.log('- columnMappings:', Object.keys(processData.columnMappings).length, '項目', typeof processData.columnMappings);
              console.log('[強制Debug] パラメータJSON:', JSON.stringify(processData, null, 2));
              
              if (debugMode) {
                console.log('[Debug] 詳細なデバッグ情報');
              }
              
              // Cloud Functions呼び出し
              console.log('[強制Debug] Cloud Function呼び出し直前');
              try {
                const result = await processCSV(processData);
                console.log('[強制Debug] Cloud Function実行成功:', result.data);
                
                if (debugMode) {
                  console.log('[Debug] Cloud Function実行結果:', result.data);
                }
                
                setUploadProgress(100);
                
                // 処理結果を表示
                if (result.data) {
                  let successMessage = '';
                  
                  if (result.data.processedCount) {
                    successMessage += `${result.data.processedCount}件の給与データを処理しました。`;
                  }
                  
                  if (result.data.employeesUpdated) {
                    successMessage += ` ${result.data.employeesUpdated}件の従業員情報を更新しました。`;
                  }
                  
                  if (result.data.employeesCreated) {
                    successMessage += ` ${result.data.employeesCreated}件の新規従業員を登録しました。`;
                  }
                  
                  if (successMessage) {
                    setSuccess(successMessage);
                  } else {
                    setSuccess('CSVファイルのアップロードと処理が完了しました');
                  }
                } else {
                  setSuccess('CSVファイルのアップロードと処理が完了しました');
                }
              } catch (functionError) {
                console.error('[強制Debug] Cloud Function実行エラー:', functionError);
                console.error('[強制Debug] エラーコード:', functionError.code);
                console.error('[強制Debug] エラーメッセージ:', functionError.message);
                console.error('[強制Debug] エラー詳細:', functionError.details);
                throw functionError; // エラーを再発生させる
              }
            } catch (firestoreError) {
              console.error('[エラー] Firestoreへの保存エラー:', firestoreError);
              setError(`アップロード情報の保存に失敗しました: ${firestoreError.message}`);
            }
          } catch (downloadError) {
            console.error('[エラー] ダウンロードURL取得エラー:', downloadError);
            setError(`ファイルURLの取得に失敗しました: ${downloadError.message}`);
          }
          
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.error("[エラー] アップロード全体エラー:", err);
      if (debugMode) {
        if (err.code) {
          console.error('[Debug] エラーコード:', err.code);
        }
        if (err.message) {
          console.error('[Debug] エラーメッセージ:', err.message);
        }
        if (err.stack) {
          console.error('[Debug] スタックトレース:', err.stack);
        }
      }
      setError('ファイルのアップロードまたは処理中にエラーが発生しました: ' + err.message);
      setIsLoading(false);
    }
  };

  /**
   * メール通知を送信する
   */
  const sendEmailNotification = async (uploadId, isTest = true, debugMode = false) => {
    try {
      setIsLoading(true);
      setError('');
      
      // Cloud Functionsを呼び出してメール通知を送信
      const sendNotification = httpsCallable(functions, 'sendPayslipNotificationManual');
      
      const result = await sendNotification({
        uploadId: uploadId,
        testMode: isTest
      });
      
      if (debugMode) {
        console.log('[メール通知テスト結果]:', result.data);
      }
      
      setSuccess(result.data.message || 'メール通知が送信されました');
    } catch (err) {
      console.error('通知送信エラー:', err);
      setError(`通知の送信に失敗しました: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    file,
    fileName,
    csvHeaders,
    paymentDate,
    sendEmailDate,
    isLoading,
    error,
    success,
    uploadProgress,
    uploadId,
    handleFileChange,
    handleUpload,
    setPaymentDate,
    setSendEmailDate,
    sendEmailNotification,
    setError,
    setSuccess
  };
};

export default useFileUpload;
