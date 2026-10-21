import React, { useRef, useState, useEffect, useMemo } from 'react';
import { MergedRow, WeekMeta } from '../../types';
import { Sparkles, FileQuestion } from 'lucide-react';

interface Props {
  rows: MergedRow[];
  displayWeeks: WeekMeta[];
  isLoading?: boolean;
}

const ROW_HEIGHT = 44; // px per row
const OVERSCAN = 15;

export const VirtualizedCycleTable: React.FC<Props> = ({
  rows,
  displayWeeks,
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(580);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight || 580);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalRows = rows.length;
  const totalCols = displayWeeks.length + 5;

  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2;
    const end = Math.min(totalRows, start + visibleCount);
    return { startIndex: start, endIndex: end };
  }, [scrollTop, containerHeight, totalRows]);

  const visibleRows = useMemo(() => {
    return rows.slice(startIndex, endIndex);
  }, [rows, startIndex, endIndex]);

  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalRows - endIndex) * ROW_HEIGHT);

  const getBadgeStyle = (badge: string) => {
    switch (badge) {
      case 'success':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'danger':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'info':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  // Calculate minimum width to ensure horizontal scroll if needed
  const totalMinWidth = 120 + 180 + 110 + displayWeeks.length * 100 + 120 + 140;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="relative overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
      style={{ maxHeight: '620px', minHeight: '380px' }}
    >
      <table
        className="w-full border-separate border-spacing-0 text-left text-xs text-slate-700 table-fixed"
        style={{ minWidth: `${totalMinWidth}px` }}
      >
        {/* Explicit Column Sizing - Guarantees 100% Alignment between Header and Body */}
        <colgroup>
          <col style={{ width: '120px' }} />
          <col style={{ width: '180px' }} />
          <col style={{ width: '110px' }} />
          {displayWeeks.map((w) => (
            <col key={w.weekStr} style={{ width: '100px' }} />
          ))}
          <col style={{ width: '120px' }} />
          <col style={{ width: '140px' }} />
        </colgroup>

        {/* Sticky Header */}
        <thead className="sticky top-0 z-20 bg-slate-50 select-none shadow-[0_2px_4px_rgba(0,0,0,0.04)]">
          <tr className="h-[44px]">
            <th className="py-3 px-3.5 pl-5 bg-slate-50 sticky left-0 z-30 border-b-2 border-r border-slate-200 text-slate-800 text-[11px] font-semibold uppercase tracking-wider">
              产品类型
            </th>
            <th className="py-3 px-3.5 bg-slate-50 sticky left-[120px] z-30 border-b-2 border-r border-slate-200 text-slate-800 text-[11px] font-semibold uppercase tracking-wider">
              SKU
            </th>
            <th className="py-3 px-3 text-center bg-slate-50 border-b-2 border-r border-slate-200 text-slate-800 text-[11px] font-semibold uppercase tracking-wider">
              子 ID
            </th>

            {/* Dynamic Cycle Columns */}
            {displayWeeks.map((w) => (
              <th
                key={w.weekStr}
                className="py-3 px-2 text-center font-mono font-medium bg-slate-50 border-b-2 border-r border-slate-200 text-slate-800 text-[11px] uppercase tracking-wider"
              >
                {w.weekStr}
              </th>
            ))}

            <th className="py-3 px-3 text-center bg-slate-50 border-b-2 border-r border-slate-200 text-slate-800 text-[11px] font-semibold uppercase tracking-wider">
              连续状态
            </th>
            <th className="py-3 px-3.5 text-center bg-slate-50 border-b-2 border-slate-200 text-slate-800 text-[11px] font-semibold uppercase tracking-wider">
              提报建议
            </th>
          </tr>
        </thead>

        {/* Loading State */}
        {isLoading && (
          <tbody>
            <tr>
              <td
                colSpan={totalCols}
                className="py-20 text-center text-slate-500"
              >
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">
                    正在分析处理云端数据，请稍候...
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        )}

        {/* Empty State */}
        {!isLoading && rows.length === 0 && (
          <tbody>
            <tr>
              <td
                colSpan={totalCols}
                className="py-20 text-center text-slate-400"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileQuestion className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                  <span className="text-sm font-medium text-slate-600">
                    暂无符合筛选条件的数据
                  </span>
                  <span className="text-xs text-slate-400">
                    请尝试清除筛选条件，或在上方导入产品及活动数据
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        )}

        {/* Virtualized Body with Native Table Rows & Spacer Rows */}
        {!isLoading && rows.length > 0 && (
          <tbody>
            {/* Top Spacer Row */}
            {topSpacerHeight > 0 && (
              <tr style={{ height: `${topSpacerHeight}px` }}>
                <td
                  colSpan={totalCols}
                  style={{
                    height: `${topSpacerHeight}px`,
                    padding: 0,
                    border: 'none',
                    lineHeight: 0,
                  }}
                />
              </tr>
            )}

            {/* Rendered Visible Rows */}
            {visibleRows.map((row) => {
              const isRecommend = row.info.recommend;
              const rowBg = isRecommend
                ? 'bg-emerald-50/50 hover:bg-emerald-100/60'
                : 'bg-white hover:bg-slate-50';
              const stickyBg = isRecommend ? 'bg-emerald-50' : 'bg-white';

              return (
                <tr
                  key={row.sku}
                  className={`h-[44px] transition-colors ${rowBg}`}
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  {/* Type */}
                  <td
                    className={`px-3.5 pl-5 truncate sticky left-0 z-10 border-b border-r border-slate-100 ${stickyBg}`}
                  >
                    <span className="inline-block px-2 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-800 rounded-full truncate max-w-[95px] border border-blue-200/60">
                      {row.type}
                    </span>
                  </td>

                  {/* SKU */}
                  <td
                    className={`px-3.5 font-mono font-semibold text-slate-900 truncate sticky left-[120px] z-10 border-b border-r border-slate-100 ${stickyBg}`}
                  >
                    <span title={row.sku} className="cursor-default truncate block">
                      {row.sku}
                    </span>
                  </td>

                  {/* Sub ID */}
                  <td className="px-3 text-center font-mono text-slate-500 truncate border-b border-r border-slate-100">
                    {row.subId || '—'}
                  </td>

                  {/* Dynamic Cycle Prices */}
                  {displayWeeks.map((w) => {
                    const price = row.priceMap.get(w.weekStr);
                    const cycle = row.cycles.find((c) => c.week === w.weekStr);
                    const hasRemark = Boolean(
                      cycle && cycle.remark && cycle.remark.trim() !== ''
                    );
                    const isValidPrice =
                      price !== undefined &&
                      price !== null &&
                      price !== '' &&
                      !isNaN(Number(price));

                    return (
                      <td
                        key={w.weekStr}
                        className="px-2 text-center font-mono border-b border-r border-slate-100"
                      >
                        {isValidPrice ? (
                          <span
                            className="font-semibold text-slate-900 inline-flex items-center justify-center gap-1"
                            title={
                              hasRemark ? `备注: ${cycle?.remark}` : undefined
                            }
                          >
                            ${Number(price).toFixed(2)}
                            {hasRemark && (
                              <span
                                className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-200"
                                title={cycle?.remark}
                              >
                                📌
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal select-none">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Consecutive Status */}
                  <td className="px-3 text-center border-b border-r border-slate-100">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getBadgeStyle(
                        row.info.badge
                      )}`}
                    >
                      {row.info.status}
                    </span>
                  </td>

                  {/* Recommendation / Reason */}
                  <td className="px-3.5 text-center border-b border-slate-100">
                    {isRecommend ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        建议提报
                      </span>
                    ) : (
                      <span
                        className="text-slate-500 text-xs truncate max-w-[130px] inline-block"
                        title={row.info.reason}
                      >
                        {row.info.reason}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Bottom Spacer Row */}
            {bottomSpacerHeight > 0 && (
              <tr style={{ height: `${bottomSpacerHeight}px` }}>
                <td
                  colSpan={totalCols}
                  style={{
                    height: `${bottomSpacerHeight}px`,
                    padding: 0,
                    border: 'none',
                    lineHeight: 0,
                  }}
                />
              </tr>
            )}
          </tbody>
        )}
      </table>
    </div>
  );
};
