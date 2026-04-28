import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const WALLS_2026 = [
  {
    amount: 1100000,
    label: '110万円',
    tags: ['tax'],
    description: '本人の住民税が発生するライン。自治体により93〜110万円と差があります。',
    note: '前年所得に対して翌年度から課税。'
  },
  {
    amount: 1230000,
    label: '123万円',
    tags: ['tax'],
    description: '配偶者控除・扶養控除のライン。超えると、あなたを扶養する人（配偶者・親など）の税負担が増えます。',
    note: '2025年に103→123万円に引上げ。'
  },
  {
    amount: 1300000,
    label: '130万円',
    tags: ['social'],
    description: '配偶者などの社会保険の扶養から外れるライン。超えると自分で健康保険・年金に加入が必要です。',
    note: '2026年4月〜は労働契約書の年収で判定（残業代の一時超過は救済あり）。'
  },
  {
    amount: 1500000,
    label: '150万円',
    tags: ['social', 'tax'],
    description: '19歳以上23歳未満の方の特例。社会保険の扶養限度が150万円まで拡大されます。税では「特定親族特別控除」の対象。',
    note: '2025年10月から適用。'
  },
  {
    amount: 1780000,
    label: '178万円',
    tags: ['tax'],
    description: '本人の所得税が発生するライン（2026年分から）。月次給与の手取りには反映されず、年末調整で精算されます。',
    note: '源泉徴収への反映は2027年1月以降。'
  },
  {
    amount: 2010000,
    label: '201万円',
    tags: ['tax'],
    description: '配偶者特別控除が完全になくなるライン。超えると、あなたを配偶者として扶養する人の税優遇がゼロになります。',
    note: null
  }
];

const TAG_STYLES = {
  tax: { bg: '#E6F1FB', color: '#0C447C', label: '税' },
  social: { bg: '#EEEDFE', color: '#3C3489', label: '社保' }
};

const STATUS_COLORS = {
  over: '#E24B4A',
  near: '#EF9F27',
  safe: '#888780'
};

function getWallStatus(cumulative, wallAmount) {
  if (cumulative >= wallAmount) return 'over';
  if (cumulative >= wallAmount * 0.85) return 'near';
  return 'safe';
}

function getStatusLabel(status, cumulative, wallAmount) {
  if (cumulative >= wallAmount) return '超過';
  const remaining = wallAmount - cumulative;
  if (remaining >= 10000) {
    return `あと${Math.round(remaining / 10000)}万円`;
  }
  return `あと${remaining.toLocaleString()}円`;
}

function NenshuKabeStatus({ userId, employeeId, companyId }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [openCards, setOpenCards] = useState({});

  const fetchAnnualData = async () => {
    if (data) return; // already loaded
    setLoading(true);
    try {
      const now = new Date();
      const fiscalYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Fetch current year's payslips
      const payslipsQuery = query(
        collection(db, 'payslips'),
        where('userId', '==', userId),
        where('employeeId', '==', employeeId)
      );
      const payslipsSnapshot = await getDocs(payslipsQuery);

      // Fetch bonus payslips too
      const bonusQuery = query(
        collection(db, 'bonusPayslips'),
        where('userId', '==', userId),
        where('employeeId', '==', employeeId)
      );
      const bonusSnapshot = await getDocs(bonusQuery);

      // Fetch mapping config for commuter allowance identification
      let mappingConfig = null;
      if (companyId) {
        const { doc: docRef, getDoc } = await import('firebase/firestore');
        const mappingDoc = await getDoc(docRef(db, 'csvMappings', companyId));
        if (mappingDoc.exists()) {
          mappingConfig = mappingDoc.data();
        }
      }

      // Build set of commuter allowance header names
      const commuterHeaders = new Set();
      if (mappingConfig?.incomeItems) {
        mappingConfig.incomeItems.forEach(item => {
          if (item.isCommuterAllowance) {
            commuterHeaders.add(item.headerName);
          }
        });
      }

      let totalGross = 0;
      let totalCommuter = 0;
      let monthsWithPayslips = new Set();

      // isGrossTotal and isCommuterAllowance flags from current mapping config (not originalMapping)
      const grossTotalItem = (mappingConfig?.totalItems || []).find(item => item.isGrossTotal);
      const currentCommuterHeaders = new Set();
      if (mappingConfig?.incomeItems) {
        mappingConfig.incomeItems.forEach(item => {
          if (item.isCommuterAllowance) {
            currentCommuterHeaders.add(item.headerName);
          }
        });
      }

      // Process a single payslip document
      const processPayslip = (doc) => {
        const d = doc.data();
        const payDate = d.paymentDate?.toDate?.() || new Date(d.paymentDate);
        if (payDate.getFullYear() !== fiscalYear) return;
        if (!d.items) return;

        const month = payDate.getMonth() + 1;

        // Find gross total using current mapping's isGrossTotal flag
        if (grossTotalItem) {
          const val = parseFloat(d.items[grossTotalItem.headerName]);
          if (!isNaN(val) && val > 0) {
            totalGross += val;
            monthsWithPayslips.add(month);
          }
        }

        // Sum commuter allowance using current mapping's flags
        currentCommuterHeaders.forEach(headerName => {
          const val = parseFloat(d.items[headerName]);
          if (!isNaN(val)) {
            totalCommuter += val;
          }
        });
      };

      payslipsSnapshot.docs.forEach(processPayslip);
      bonusSnapshot.docs.forEach(processPayslip);

      const monthsElapsed = monthsWithPayslips.size || currentMonth;
      const annualEstimateGross = Math.round((totalGross / monthsElapsed) * 12);
      const annualEstimateCommuter = Math.round((totalCommuter / monthsElapsed) * 12);
      const annualEstimateTax = annualEstimateGross - annualEstimateCommuter;

      setData({
        fiscalYear,
        currentMonth,
        cumulativeGross: totalGross,
        cumulativeCommuter: totalCommuter,
        cumulativeTax: totalGross - totalCommuter,
        annualEstimateGross,
        annualEstimateTax,
        monthsElapsed,
        hasCommuterMapping: commuterHeaders.size > 0
      });
    } catch (err) {
      console.error('年収の壁データ取得エラー:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = () => {
    if (!expanded) {
      fetchAnnualData();
    }
    setExpanded(!expanded);
  };

  const toggleCard = (index) => {
    setOpenCards(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(amount);
  };

  const getEstimateForWall = (wall) => {
    if (!data) return 0;
    const isTaxOnly = wall.tags.length === 1 && wall.tags[0] === 'tax';
    return isTaxOnly ? data.annualEstimateTax : data.annualEstimateGross;
  };

  const getCumulativeForWall = (wall) => {
    if (!data) return 0;
    const isTaxOnly = wall.tags.length === 1 && wall.tags[0] === 'tax';
    return isTaxOnly ? data.cumulativeTax : data.cumulativeGross;
  };

  return (
    <div className="mt-6 print:hidden">
      <button
        onClick={handleToggleExpand}
        className="w-full text-left px-5 py-4 rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow flex justify-between items-center"
      >
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="text-lg font-medium" style={{ color: '#0D2137' }}>
            年収の壁
          </span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#E6F1FB', color: '#0C447C' }}>税</span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#EEEDFE', color: '#3C3489' }}>社保</span>
        </div>
        <span className="text-gray-400 text-xl">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading && (
            <div className="px-5 py-8 text-center text-gray-500">読み込み中...</div>
          )}

          {!loading && data && (
            <>
              {/* Header */}
              <div className="px-5 py-3 flex justify-between items-center border-b border-gray-100">
                <span className="text-sm font-medium" style={{ color: '#0D2137' }}>
                  {data.fiscalYear}年 年収の壁
                </span>
                <span className="text-xs text-gray-500">{data.currentMonth}月時点</span>
              </div>

              {/* Summary Cards */}
              <div className="px-5 py-4 flex gap-3">
                <div className="flex-1 rounded-lg border border-gray-200 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-1">年初〜今月累計</p>
                  <p className="text-lg font-semibold" style={{ color: '#0D2137' }}>
                    {formatCurrency(data.cumulativeGross)}
                  </p>
                </div>
                <div className="flex-1 rounded-lg border border-gray-200 px-4 py-3">
                  <p className="text-xs text-gray-500 mb-1">年間着地見込み</p>
                  <p className="text-lg font-semibold" style={{ color: '#0D2137' }}>
                    {formatCurrency(data.annualEstimateGross)}
                  </p>
                </div>
              </div>

              {/* Note about commuter allowance */}
              <div className="px-5 pb-2">
                {data.hasCommuterMapping ? (
                  <p className="text-xs text-gray-400">
                    ※ 税の壁は通勤手当を除外して計算。社会保険の壁は通勤手当を含めて計算しています。
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">
                    ※ 通勤手当を含む総支給額で計算しています（概算）。
                  </p>
                )}
              </div>

              {/* Wall Cards */}
              <div className="px-5 pb-4">
                {WALLS_2026.map((wall, index) => {
                  const cumulative = getCumulativeForWall(wall);
                  const status = getWallStatus(cumulative, wall.amount);
                  const statusLabel = getStatusLabel(status, cumulative, wall.amount);
                  const progressWidth = Math.min(cumulative / wall.amount, 1.0) * 100;
                  const isOpen = openCards[index] || false;

                  return (
                    <div key={index} className={index < WALLS_2026.length - 1 ? 'border-b border-gray-100' : ''}>
                      <button
                        onClick={() => toggleCard(index)}
                        className="w-full text-left py-3"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: '#0D2137' }}>
                              {wall.label}
                            </span>
                            {wall.tags.map(tag => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.5 rounded"
                                style={{ background: TAG_STYLES[tag].bg, color: TAG_STYLES[tag].color }}
                              >
                                {TAG_STYLES[tag].label}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap"
                              style={{
                                color: STATUS_COLORS[status],
                                background: status === 'over' ? '#FEE2E2' : status === 'near' ? '#FEF3C7' : '#F3F4F6'
                              }}
                            >
                              {statusLabel}
                            </span>
                            <span className="text-sm text-gray-400 w-4 text-center">
                              {isOpen ? '−' : '+'}
                            </span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progressWidth}%`,
                              backgroundColor: STATUS_COLORS[status]
                            }}
                          />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="pb-3 text-xs text-gray-600 leading-relaxed">
                          <p>{wall.description}</p>
                          {wall.note && (
                            <p className="mt-1 text-gray-400">※ {wall.note}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer note */}
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  年間見込みは月平均 x 12の概算です。実際の判定は個人の状況（扶養関係・年齢等）により異なります。詳しくは勤務先や専門家にご確認ください。
                </p>
              </div>
            </>
          )}

          {!loading && !data && (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">
              データを取得できませんでした
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NenshuKabeStatus;
