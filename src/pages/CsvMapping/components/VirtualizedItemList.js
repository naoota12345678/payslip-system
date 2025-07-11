// src/pages/CsvMapping/components/VirtualizedItemList.js
// 大量の項目を効率的に表示するための仮想スクロールコンポーネント

import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 仮想スクロールを使用した項目リスト
 * @param {Array} items - 表示する項目の配列
 * @param {number} itemHeight - 各項目の高さ（ピクセル）
 * @param {number} visibleHeight - 表示領域の高さ（ピクセル）
 * @param {Function} renderItem - 項目をレンダリングする関数
 * @param {number} overscan - 表示領域外にレンダリングする項目数
 */
export const VirtualizedItemList = ({ 
  items, 
  itemHeight = 50, 
  visibleHeight = 400,
  renderItem,
  overscan = 3
}) => {
  const containerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  
  // 表示範囲の計算
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + visibleHeight) / itemHeight) + overscan
  );
  
  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;
  
  // スクロールハンドラ
  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);
  
  // スクロール位置のリセット（項目が変更された場合）
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);
  
  // 項目が少ない場合は通常のレンダリング
  if (items.length <= 20) {
    return (
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id || index}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }
  
  // 仮想スクロールレンダリング
  return (
    <div 
      ref={containerRef}
      className="overflow-auto border rounded"
      style={{ height: `${visibleHeight}px` }}
      onScroll={handleScroll}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div 
              key={item.id || (startIndex + index)}
              style={{ height: `${itemHeight}px` }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VirtualizedItemList;
