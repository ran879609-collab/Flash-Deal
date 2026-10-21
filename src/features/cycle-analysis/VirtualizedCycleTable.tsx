import React, { useRef, useState, useMemo } from 'react';
import { MergedRow, WeekMeta } from '../../types';
import { Sparkles, FileQuestion, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface Props {
  rows: MergedRow[];
  displayWeeks: WeekMeta[];
  isLoading?: boolean;
}

// Fixed column widths (in px) - strictly locked across thead and tbody
const COL_WIDTH_TYPE = 120;
const COL_WIDTH_SKU = 190;
const COL_WIDTH_SUB_ID = 110;
const COL_WIDTH_WEEK = 110;
const COL_WIDTH_STATUS = 130;
const COL_WIDTH_RECOMMEND = 170;

const ROW_HEIGHT = 44; // px per row

export const VirtualizedCycleTable: React.FC<Props> = ({
  rows,
  displayWeeks,
  isLoading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pagination state: default 100 rows per page for silky performance & zero layout corruption
  const [pageSize, setPageSize] = useState<number | 'all'>(100);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const totalRows = rows.length;
  const effectivePageSize = pageSize === 'all' ? Math.max(1, totalRows) : pageSize;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalRows / effectivePageSize));

  // Ensure currentPage is in bounds when rows or pageSize changes
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRows = useMemo(() => {
    if (pageSize === 'all') {
      return rows;
    }
    const start = (safeCurrentPage - 1) * effectivePageSize;
    return rows.slice(start, start + effectivePageSize);
  }, [rows, safeCurrentPage, effectivePageSize, pageSize]);

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

  // Exact table width calculation based on exact locked column widths
  const totalTableWidth =
    COL_WIDTH_TYPE +
    COL_WIDTH_SKU +
    COL_WIDTH_SUB_ID +
    displayWeeks.length * COL_WIDTH_WEEK +
    COL_WIDTH_STATUS +
    COL_WIDTH_RECOMMEND;

  const totalCols = displayWeeks.length + 5;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Scrollable Table Viewport */}
      <div
        ref={containerRef}
        className="relative overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
        style={{ maxHeight: '600px', minHeight: '380px' }}
      >
        <table
          className="border-separate border-spacing-0 text-left text-xs text-slate-700 table-fixed select-text"
          style={{
            width: `${totalTableWidth}px`,
            minWidth: `${totalTableWidth}px`,
          }}
        >
          {/* Strictly Locked Colgroup for Native Table Engine */}
          <colgroup>
            <col style={{ width: `${COL_WIDTH_TYPE}px` }} />
            <col style={{ width: `${COL_WIDTH_SKU}px` }} />
            <col style={{ width: `${COL_WIDTH_SUB_ID}px` }} />
            {displayWeeks.map((w) => (
              <col key={w.weekStr} style={{ width: `${COL_WIDTH_WEEK}px` }} />
            ))}
            <col style={{ width: `${COL_WIDTH_STATUS}px` }} />
            <col style={{ width: `${COL_WIDTH_RECOMMEND}px` }} />
          </colgroup>

          {/* Sticky Header */}
          <thead>
            <tr className="h-[44px]">
              {/* 1. Product Type */}
              <th
                style={{
                  width: `${COL_WIDTH_TYPE}px`,
                  minWidth: `${COL_WIDTH_TYPE}px`,
                  maxWidth: `${COL_WIDTH_TYPE}px`,
                  left: 0,
                }}
                className="py-3 px-3.5 pl-5 bg-slate-100 sticky top-0 z-30 border-b-2 border-r border-slate-200 text-slate-800 text-[11px] font-semibold uppercase tracking-wider"
              >
                产品类型
              </th>

              {/* 2. SKU - Sticky Left at exact 120px */}
              <th
                style={{
                  width: `${COL_WIDTH_SKU}px`,
                  minWidth: `${COL_WIDTH_SKU}px`,
                  maxWidth: `${COL_WIDTH_SKU}px`,
                  left: `${COL_WIDTH_TYPE}px`,
                }}
                className="py-3 px-3.5 bg-slate-100 sticky top-0 z-30 border-b-2 border-r border-slate-200 text-slate-800 text-[11px] font-semibold uppercase tracking-wider shadow-[2px_0_4px_rgba(0,0,0,0.03)]"
              >
                SKU
              </th>

              {/* 3. Sub ID */}
              <th
                style={{
                  width: `${COL_WIDTH_SUB_ID}px`,
                  minWidth: `${COL_WIDTH_SUB_ID}px`,
                  maxWidth: `${COL_WIDTH_SUB_ID}px`,
                }}
                className="py-3 px-3 text-center bg-slate-50 sticky top-0 z-20 border-b-2 border-r border-slate-200 text-slate-800 text-[11px] font-semibold uppercase tracking-wider"
              >
                子 ID
              </th>

              {/* 4. Dynamic Cycle Columns */}
              {displayWeeks.map((w) => (
                <th
                  key={w.weekStr}
                  style={{
                    width: `${COL_WIDTH_WEEK}px`,
                    minWidth: `${COL_WIDTH_WEEK}px`,
                    maxWidth: `${COL_WIDTH_WEEK}px`,
                  }}
                  className="py-3 px-2 text-center font-mono font-medium bg-slate-50 sticky top-0 z-20 border-b-2 border-r border-slate-200 text-slate-800 text-[11px] uppercase tracking-wider"
                >
                  <div className="flex flex-col items-center justify-center">
                    <span>{w.weekStr}</span>
                    <span className="text-[10px] text-slate-400 font-normal">周期价格</span>
                  </div>
                </th>
              ))}

              {/* 5. Consecutive Status */}
              <th
                style={{
                  width: `${COL_WIDTH_STATUS}px`,
                  minWidth: `${COL_WIDTH_STATUS}px`,
                  maxWidth: `${COL_WIDTH_STATUS}px`,
                }}
                className="py-3 px-3 text-center bg-slate-50 sticky top-0 z-20 border-b-2 border-r border-slate-200 text-slate-800 text-[11px] font-semibold uppercase tracking-wider"
              >
                连续状态
              </th>

              {/* 6. Recommendation */}
              <th
                style={{
                  width: `${COL_WIDTH_RECOMMEND}px`,
                  minWidth: `${COL_WIDTH_RECOMMEND}px`,
                  maxWidth: `${COL_WIDTH_RECOMMEND}px`,
                }}
                className="py-3 px-3.5 text-center bg-slate-50 sticky top-0 z-20 border-b-2 border-slate-200 text-slate-800 text-[11px] font-semibold uppercase tracking-wider"
              >
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

          {/* Data Rows - All cells strictly locked to the exact same column widths */}
          {!isLoading && paginatedRows.length > 0 && (
            <tbody>
              {paginatedRows.map((row) => {
                const isRecommend = row.info.recommend;
                const rowBg = isRecommend
                  ? 'bg-emerald-50/40 hover:bg-emerald-100/60'
                  : 'bg-white hover:bg-slate-50';
                const stickyBg = isRecommend ? 'bg-[#f3faf6]' : 'bg-white';

                return (
                  <tr
                    key={row.sku}
                    className={`h-[44px] transition-colors ${rowBg}`}
                    style={{ height: `${ROW_HEIGHT}px` }}
                  >
                    {/* 1. Product Type */}
                    <td
                      style={{
                        width: `${COL_WIDTH_TYPE}px`,
                        minWidth: `${COL_WIDTH_TYPE}px`,
                        maxWidth: `${COL_WIDTH_TYPE}px`,
                        left: 0,
                      }}
                      className={`px-3.5 pl-5 truncate sticky z-10 border-b border-r border-slate-100 ${stickyBg}`}
                    >
                      <span
                        title={row.type}
                        className="inline-block px-2 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-800 rounded-full truncate max-w-[95px] border border-blue-200/60"
                      >
                        {row.type}
                      </span>
                    </td>

                    {/* 2. SKU */}
                    <td
                      style={{
                        width: `${COL_WIDTH_SKU}px`,
                        minWidth: `${COL_WIDTH_SKU}px`,
                        maxWidth: `${COL_WIDTH_SKU}px`,
                        left: `${COL_WIDTH_TYPE}px`,
                      }}
                      className={`px-3.5 font-mono font-semibold text-slate-900 truncate sticky z-10 border-b border-r border-slate-100 ${stickyBg} shadow-[2px_0_4px_rgba(0,0,0,0.03)]`}
                    >
                      <span title={row.sku} className="cursor-default truncate block">
                        {row.sku}
                      </span>
                    </td>

                    {/* 3. Sub ID */}
                    <td
                      style={{
                        width: `${COL_WIDTH_SUB_ID}px`,
                        minWidth: `${COL_WIDTH_SUB_ID}px`,
                        maxWidth: `${COL_WIDTH_SUB_ID}px`,
                      }}
                      className="px-3 text-center font-mono text-slate-500 truncate border-b border-r border-slate-100"
                    >
                      {row.subId || '—'}
                    </td>

                    {/* 4. Dynamic Cycle Prices */}
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
                          style={{
                            width: `${COL_WIDTH_WEEK}px`,
                            minWidth: `${COL_WIDTH_WEEK}px`,
                            maxWidth: `${COL_WIDTH_WEEK}px`,
                          }}
                          className="px-2 text-center font-mono border-b border-r border-slate-100"
                        >
                          {isValidPrice ? (
                            <div className="flex items-center justify-center gap-1">
                              <span
                                className="font-semibold text-slate-900"
                                title={hasRemark ? `备注: ${cycle?.remark}` : undefined}
                              >
                                ${Number(price).toFixed(2)}
                              </span>
                              {hasRemark && (
                                <span
                                  className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-200 shrink-0 cursor-help"
                                  title={`备注: ${cycle?.remark}`}
                                >
                                  📌
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-normal select-none">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* 5. Consecutive Status */}
                    <td
                      style={{
                        width: `${COL_WIDTH_STATUS}px`,
                        minWidth: `${COL_WIDTH_STATUS}px`,
                        maxWidth: `${COL_WIDTH_STATUS}px`,
                      }}
                      className="px-3 text-center border-b border-r border-slate-100"
                    >
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getBadgeStyle(
                          row.info.badge
                        )}`}
                      >
                        {row.info.status}
                      </span>
                    </td>

                    {/* 6. Recommendation */}
                    <td
                      style={{
                        width: `${COL_WIDTH_RECOMMEND}px`,
                        minWidth: `${COL_WIDTH_RECOMMEND}px`,
                        maxWidth: `${COL_WIDTH_RECOMMEND}px`,
                      }}
                      className="px-3.5 text-center border-b border-slate-100"
                    >
                      {isRecommend ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          建议提报
                        </span>
                      ) : (
                        <span
                          className="text-slate-500 text-xs truncate max-w-[150px] inline-block"
                          title={row.info.reason}
                        >
                          {row.info.reason}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* Pagination & Status Footer Bar */}
      {!isLoading && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 shadow-2xs">
          {/* Summary */}
          <div className="flex items-center gap-2">
            <span>
              显示第{' '}
              <strong className="text-slate-900 font-mono">
                {pageSize === 'all'
                  ? 1
                  : (safeCurrentPage - 1) * effectivePageSize + 1}
              </strong>{' '}
              至{' '}
              <strong className="text-slate-900 font-mono">
                {pageSize === 'all'
                  ? totalRows
                  : Math.min(safeCurrentPage * effectivePageSize, totalRows)}
              </strong>{' '}
              条，共 <strong className="text-slate-900 font-mono">{totalRows}</strong> 条 SKU
            </span>
          </div>

          {/* Page Size & Navigation */}
          <div className="flex items-center gap-4 ml-auto">
            {/* Page Size Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">每页显示:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg outline-none font-mono cursor-pointer"
              >
                <option value={50}>50 条</option>
                <option value={100}>100 条</option>
                <option value={200}>200 条</option>
                <option value="all">显示全部</option>
              </select>
            </div>

            {/* Pagination Buttons (only shown if not 'all' and more than 1 page) */}
            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  title="第一页"
                  className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  title="上一页"
                  className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-2 text-xs font-mono text-slate-700">
                  <span className="font-semibold text-blue-700">{safeCurrentPage}</span> / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  title="下一页"
                  className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  title="最后一页"
                  className="p-1 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
