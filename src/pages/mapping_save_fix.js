// src/pages/CsvMapping/index.js の handleSave関数の修正

// 設定を保存
const handleSave = async () => {
  if (!userDetails?.companyId) {
    setError('会社情報が取得できませんでした');
    return;
  }
  
  // 必須フィールドの検証
  if (mappingConfig.mainFields.identificationCode.columnIndex === -1) {
    setError('識別コードのマッピングは必須です');
    return;
  }
  
  if (mappingConfig.mainFields.employeeCode.columnIndex === -1) {
    setError('従業員コードのマッピングは必須です');
    return;
  }
  
  try {
    setSaving(true);
    setError('');
    setSuccess('');
    
    // ヘッダー情報も設定に含める
    const configToSave = {
      ...mappingConfig,
      parsedHeaders: parsedHeaders // ヘッダー情報を追加
    };
    
    // Firestoreに設定を保存
    await setDoc(doc(db, 'csvMapping', userDetails.companyId), {
      csvMapping: configToSave,
      updatedAt: new Date(),
      updatedBy: userDetails.id || ''
    });
    
    setSuccess('マッピング設定を保存しました');
    
    // 少し待ってから成功メッセージをクリア
    setTimeout(() => setSuccess(''), 3000);
  } catch (err) {
    console.error('設定保存エラー:', err);
    setError('設定の保存中にエラーが発生しました: ' + (err.message || 'エラーが発生しました'));
  } finally {
    setSaving(false);
  }
};
