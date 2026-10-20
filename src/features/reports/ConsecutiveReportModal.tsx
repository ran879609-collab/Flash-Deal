import React from 'react';
import { ReportItem } from '../../types';
import { exportConsecutiveReportCSV } from './csvExporter';
import { Download, X, AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reportItems: ReportItem[];
}

export const ConsecutiveReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  reportItems,
}) => {
  if (!isOpen) return null;

  const handleExport = () => {
    exportConsecutiveReportCSV(reportItems);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-5xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-700 rounded-xl">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                🔄 可连续提报表
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                筛选规则：最新周期有提报 且 紧邻上一周期无提报的 SKU（注意：活动价格需做修改）
              </p>
            </div>
            <span className="ml-2 px-2.5 py-0.5 text-xs font-semibold bg-orange-50 text-orange-700 rounded-full border border-orange-200">
              共 {reportItems.length} 个 SKU
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={reportItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              导出 CSV
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto p-6">
          {reportItems.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <p className="text-sm font-medium text-slate-600">
                暂无可连续提报 SKU
              </p>
              <p className="text-xs text-slate-400 mt-1">
                当前暂无符合“最新周期有提报且上一周期无提报”条件的 SKU
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 font-mono">SKU</th>
                    <th className="py-2.5 px-3 font-mono">子 ID</th>
                    <th className="py-2.5 px-3 font-mono">父 ID</th>
                    <th className="py-2.5 px-3 text-right">
                      平均单量
                      <span className="block text-[10px] text-slate-400 font-normal">
                        (past 90 days)
                      </span>
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      售价
                      <span className="block text-[10px] text-slate-400 font-normal">
                        (past 90 days)
                      </span>
                    </th>
                    <th className="py-2.5 px-3 text-right">活动期望单量</th>
                    <th className="py-2.5 px-3 text-right">活动价格</th>
                    <th className="py-2.5 px-3 text-center">提取周期</th>
                    <th className="py-2.5 px-3 text-center">系统提醒</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportItems.map((item) => (
                    <tr
                      key={item.sku}
                      className="hover:bg-slate-50/80 transition"
                    >
                      <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                        {item.sku}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {item.subId}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {item.parentId}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">
                        {item.avgOrders || '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">
                        {item.sellingPrice
                          ? `$${Number(item.sellingPrice).toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">
                        {item.expectedOrders || '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-blue-700">
                        {item.activityPrice !== '' && item.activityPrice !== null
                          ? `$${Number(item.activityPrice).toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="py-2 px-3 text-center font-mono">
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {item.lastWeek}
                          {item.hasRemark && (
                            <span className="text-[10px] text-amber-700 bg-amber-100 px-1 rounded font-sans font-medium" title="该记录含有备注">
                              ⚠️有备注
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-rose-50 text-rose-700 rounded-full border border-rose-200">
                          <AlertCircle className="w-3 h-3" />
                          活动价格待修改
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
          <span>⚠️ 连报规则：连续提报时电商平台通常要求修改活动价格，请注意核验</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition"
          >
            关闭窗口
          </button>
        </div>
      </div>
    </div>
  );
};
