// src/pages/CsvMapping/index.js の useEffect部分の修正

// 既存の設定を読み込む
useEffect(() => {
  const fetchMappingConfig = async () => {
    if (!userDetails?.companyId) {
      setError('会社情報が取得できませんでした');
      setLoading(false);
      return;
    }
    
    try {
      console.log('設定を読み込み中...');
      setLoading(true);
      
      // 新形式のマッピング設定を取得
      const mappingDoc = await getDoc(doc(db, "csvMapping", userDetails.companyId));
      
      if (mappingDoc.exists()) {
        const data = mappingDoc.data();
        if (data.csvMapping) {
          console.log('既存のマッピング設定を読み込みました');
          setMappingConfig(data.csvMapping);
          
          // 存在するヘッダーがあれば、それも設定
          if (data.csvMapping.parsedHeaders && data.csvMapping.parsedHeaders.length > 0) {
            console.log('保存済みヘッダーを読み込みました:', data.csvMapping.parsedHeaders.length);
            setParsedHeaders(data.csvMapping.parsedHeaders);
          }
        }
      } else {
        console.log('既存のマッピング設定がありません');
      }
      
      setLoading(false);
    } catch (err) {
      console.error('マッピング設定取得エラー:', err);
      setError('設定の取得中にエラーが発生しました');
      setLoading(false);
    }
  };
  
  fetchMappingConfig();
}, [userDetails]);
