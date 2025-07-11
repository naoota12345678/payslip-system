// src/pages/CsvMapping/hooks/useDebounce.js
// デバウンス処理を提供するカスタムフック

import { useEffect, useState } from 'react';

/**
 * 値の変更をデバウンスするカスタムフック
 * @param {any} value - デバウンスする値
 * @param {number} delay - 遅延時間（ミリ秒）
 * @returns {any} デバウンスされた値
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // 指定された遅延時間後に値を更新
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // クリーンアップ関数
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
