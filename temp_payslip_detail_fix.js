  // CSVマッピング設定とcsvSettingsを取得（同期版）
  const fetchMappingConfigSync = async (companyId) => {
    try {
      // csvMappingsとcsvSettingsの両方を取得
      const [mappingDoc, csvSettingsDoc] = await Promise.all([
        getDoc(doc(db, "csvMappings", companyId)),
        getDoc(doc(db, "csvSettings", companyId))
      ]);
      
      let mappingData = null;
      let csvSettingsData = null;
      
      if (mappingDoc.exists()) {
        mappingData = mappingDoc.data();
        console.log('🎯 CSVマッピング設定を取得:', mappingData);
      }
      
      if (csvSettingsDoc.exists()) {
        csvSettingsData = csvSettingsDoc.data();
        console.log('🎯 CSV設定を取得:', csvSettingsData);
        console.log('📋 parsedHeaders:', csvSettingsData.parsedHeaders);
      }
      
      // 統合された設定オブジェクトを作成
      const combinedConfig = {
        ...mappingData,
        csvSettings: csvSettingsData,
        parsedHeaders: csvSettingsData?.parsedHeaders || []
      };
      
      setMappingConfig(combinedConfig);
      return combinedConfig;
    } catch (err) {
      console.error('🚨 マッピング設定取得エラー:', err);
      setMappingConfig(null);
      return null;
    }
  };