// src/pages/CsvMapping/components/ItemTabs.js
// タブ式マッピングセクションコンポーネント

import React from 'react';
import ItemMappingTable from './ItemMappingTable';
import { TABS } from '../constants';

const ItemTabs = ({
  activeTab,
  setActiveTab,
  mappingConfig,
  parsedHeaders,
  onUpdateItemName,
  onUpdateItemVisibility,
  onUpdateItemZeroDisplay,
  onRemoveItem,
  onMoveItem,
  onAddItem
}) => {
  // 安全性を確保
  const safeMappingConfig = mappingConfig || {};
  const safeIncomeItems = safeMappingConfig.incomeItems || [];
  const safeDeductionItems = safeMappingConfig.deductionItems || [];
  const safeAttendanceItems = safeMappingConfig.attendanceItems || [];
  const safeTotalItems = safeMappingConfig.totalItems || [];  // 合計項目を追加
  const safeItemCodeItems = safeMappingConfig.itemCodeItems || [];
  
  return (
    <div className="mb-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex">
          <button
            className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm ${
              activeTab === TABS.INCOME 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab(TABS.INCOME)}
          >
            支給項目
          </button>
          <button
            className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm ${
              activeTab === TABS.DEDUCTION 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab(TABS.DEDUCTION)}
          >
            控除項目
          </button>
          <button
            className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm ${
              activeTab === TABS.ATTENDANCE 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab(TABS.ATTENDANCE)}
          >
            勤怠項目
          </button>
          <button
            className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm ${
              activeTab === TABS.TOTAL 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab(TABS.TOTAL)}
          >
            合計項目
          </button>
          <button
            className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm ${
              activeTab === TABS.KY 
                ? 'border-blue-500 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab(TABS.KY)}
          >
            項目コード
          </button>
        </nav>
      </div>
      
      {/* 支給項目タブ */}
      {activeTab === TABS.INCOME && (
        <ItemMappingTable
          title="支給項目のマッピング"
          items={safeIncomeItems}
          onUpdateItemName={onUpdateItemName}
          onUpdateItemVisibility={onUpdateItemVisibility}
          onUpdateItemZeroDisplay={onUpdateItemZeroDisplay}
          onRemoveItem={onRemoveItem}
          onMoveItem={onMoveItem}
          availableHeaders={parsedHeaders}
          onAddItem={onAddItem}
          category="incomeItems"
        />
      )}
      
      {/* 控除項目タブ */}
      {activeTab === TABS.DEDUCTION && (
        <ItemMappingTable
          title="控除項目のマッピング"
          items={safeDeductionItems}
          onUpdateItemName={onUpdateItemName}
          onUpdateItemVisibility={onUpdateItemVisibility}
          onUpdateItemZeroDisplay={onUpdateItemZeroDisplay}
          onRemoveItem={onRemoveItem}
          onMoveItem={onMoveItem}
          availableHeaders={parsedHeaders}
          onAddItem={onAddItem}
          category="deductionItems"
        />
      )}
      
      {/* 勤怠項目タブ */}
      {activeTab === TABS.ATTENDANCE && (
        <ItemMappingTable
          title="勤怠項目のマッピング"
          items={safeAttendanceItems}
          onUpdateItemName={onUpdateItemName}
          onUpdateItemVisibility={onUpdateItemVisibility}
          onUpdateItemZeroDisplay={onUpdateItemZeroDisplay}
          onRemoveItem={onRemoveItem}
          onMoveItem={onMoveItem}
          availableHeaders={parsedHeaders}
          onAddItem={onAddItem}
          category="attendanceItems"
        />
      )}
      
      {/* 合計項目タブ */}
      {activeTab === TABS.TOTAL && (
        <ItemMappingTable
          title="合計項目のマッピング"
          items={safeTotalItems}
          onUpdateItemName={onUpdateItemName}
          onUpdateItemVisibility={onUpdateItemVisibility}
          onUpdateItemZeroDisplay={onUpdateItemZeroDisplay}
          onRemoveItem={onRemoveItem}
          onMoveItem={onMoveItem}
          availableHeaders={parsedHeaders}
          onAddItem={onAddItem}
          category="totalItems"
        />
      )}
      
      {/* 項目コードタブ */}
      {activeTab === TABS.KY && (
        <ItemMappingTable
          title="項目コードのマッピング"
          items={safeItemCodeItems}
          onUpdateItemName={onUpdateItemName}
          onUpdateItemVisibility={onUpdateItemVisibility}
          onUpdateItemZeroDisplay={onUpdateItemZeroDisplay}
          onRemoveItem={onRemoveItem}
          onMoveItem={onMoveItem}
          availableHeaders={parsedHeaders}
          onAddItem={onAddItem}
          category="itemCodeItems"
        />
      )}
    </div>
  );
};

export default ItemTabs;
