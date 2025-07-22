// ブラウザのDevToolsで実行するデータベースリセットコード
// CSVマッピング設定画面でF12を押してConsoleタブで実行してください

const resetCSVData = async () => {
  try {
    // Firebase関連の確認
    if (typeof db === 'undefined') {
      console.error('❌ Firebaseデータベースにアクセスできません。CSVマッピング設定画面でF12を押して実行してください。');
      return;
    }

    // import文をdynamic importに変更
    const { doc, deleteDoc, collection, getDocs, query, where } = await import('firebase/firestore');
    
    // ログインユーザーの会社IDを取得
    const userDetails = JSON.parse(localStorage.getItem('userDetails') || '{}');
    const companyId = userDetails.companyId;
    
    if (!companyId) {
      console.error('❌ 会社IDが取得できません。ログインしていることを確認してください。');
      return;
    }
    
    console.log(`🔄 会社ID: ${companyId} のCSV関連データをリセット中...`);
    
    // 削除対象コレクション
    const collectionsToReset = [
      'csvMapping',
      'csvMappings', 
      'csvUpload',
      'csvSettings'
    ];
    
    // 各コレクションからcompanyIdのドキュメントを削除
    for (const collectionName of collectionsToReset) {
      try {
        await deleteDoc(doc(db, collectionName, companyId));
        console.log(`✅ ${collectionName} コレクションをリセット`);
      } catch (error) {
        console.log(`ℹ️ ${collectionName} コレクションは存在しないかアクセス権限がありません`);
      }
    }
    
    // payrollItemsコレクションからcompanyIdに関連するデータを削除
    try {
      const payrollQuery = query(
        collection(db, 'payrollItems'),
        where('companyId', '==', companyId)
      );
      const payrollSnapshot = await getDocs(payrollQuery);
      
      for (const docSnap of payrollSnapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
      console.log(`✅ payrollItems コレクションをリセット（${payrollSnapshot.size}件削除）`);
    } catch (error) {
      console.log('ℹ️ payrollItems コレクションの削除でエラー:', error.message);
    }
    
    console.log('🎉 データベースリセット完了！');
    console.log('ページを再読み込みしてください。');
    
    // ページを自動的に再読み込み
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('❌ リセットエラー:', error);
  }
};

// リセット実行
console.log('📋 データベースリセットを実行します...');
resetCSVData(); 