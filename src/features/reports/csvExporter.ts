import { MergedRow, ReportItem, WeekMeta } from '../../types';

/**
 * Escapes a cell for CSV:
 * 1. Sanitizes formula injection characters (=, +, -, @, \t, \r)
 * 2. Escapes double quotes with ""
 * 3. Wraps in quotes
 */
export function escapeCSVCell(value: any): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // CSV Formula Injection mitigation (prepend ' if cell starts with dangerous char)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Downloads a CSV string with UTF-8 BOM in the browser
 */
export function downloadCSV(csvContent: string, fileName: string): void {
  // \uFEFF is the UTF-8 Byte Order Mark for Excel
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export 1: Main Cycle Analysis Summary CSV
 */
export function exportMainCycleCSV(
  rows: MergedRow[],
  displayWeeks: WeekMeta[],
  customFileName?: string
): void {
  const headerCols = ['产品类型', 'SKU', '子ID'];
  displayWeeks.forEach((w) => headerCols.push(w.weekStr));
  headerCols.push('连续状态', '建议', '原因');

  const lines: string[] = [headerCols.map(escapeCSVCell).join(',')];

  rows.forEach((row) => {
    const lineCols: string[] = [
      escapeCSVCell(row.type || '—'),
      escapeCSVCell(row.sku),
      escapeCSVCell(row.subId || '—'),
    ];

    displayWeeks.forEach((w) => {
      const price = row.priceMap.get(w.weekStr);
      if (price !== undefined && price !== null && price !== '' && !isNaN(Number(price))) {
        lineCols.push(escapeCSVCell(Number(price).toFixed(2)));
      } else {
        lineCols.push('""');
      }
    });

    lineCols.push(escapeCSVCell(row.info.status));
    lineCols.push(escapeCSVCell(row.info.recommend ? '建议提报' : '暂缓'));
    lineCols.push(escapeCSVCell(row.info.reason));

    lines.push(lineCols.join(','));
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = customFileName || `活动产品周期汇总_SKU_${dateStr}.csv`;
  downloadCSV(lines.join('\r\n'), fileName);
}

/**
 * Export 2: Recommendable Report CSV (可提报表)
 */
export function exportRecommendableReportCSV(
  items: ReportItem[],
  customFileName?: string
): void {
  const headerCols = [
    'SKU',
    '子ID',
    '父ID',
    '平均单量(past 90 days)',
    '售价(past 90 days)',
    '活动期望单量',
    '活动价格',
    '提取周期',
    '备注标记',
  ];

  const lines: string[] = [headerCols.map(escapeCSVCell).join(',')];

  items.forEach((item) => {
    const priceStr =
      item.activityPrice !== '' && item.activityPrice !== null && !isNaN(Number(item.activityPrice))
        ? Number(item.activityPrice).toFixed(2)
        : '';

    const lineCols = [
      escapeCSVCell(item.sku),
      escapeCSVCell(item.subId),
      escapeCSVCell(item.parentId),
      escapeCSVCell(item.avgOrders),
      escapeCSVCell(item.sellingPrice),
      escapeCSVCell(item.expectedOrders),
      escapeCSVCell(priceStr),
      escapeCSVCell(item.lastWeek),
      escapeCSVCell(item.hasRemark ? '有备注' : ''),
    ];

    lines.push(lineCols.join(','));
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = customFileName || `CyclePro_可提报表_${dateStr}.csv`;
  downloadCSV(lines.join('\r\n'), fileName);
}

/**
 * Export 3: Consecutive Report CSV (可连续提报表)
 */
export function exportConsecutiveReportCSV(
  items: ReportItem[],
  customFileName?: string
): void {
  const headerCols = [
    'SKU',
    '子ID',
    '父ID',
    '平均单量(past 90 days)',
    '售价(past 90 days)',
    '活动期望单量',
    '活动价格',
    '提取周期',
    '提示',
    '备注标记',
  ];

  const lines: string[] = [headerCols.map(escapeCSVCell).join(',')];

  items.forEach((item) => {
    const priceStr =
      item.activityPrice !== '' && item.activityPrice !== null && !isNaN(Number(item.activityPrice))
        ? Number(item.activityPrice).toFixed(2)
        : '';

    const lineCols = [
      escapeCSVCell(item.sku),
      escapeCSVCell(item.subId),
      escapeCSVCell(item.parentId),
      escapeCSVCell(item.avgOrders),
      escapeCSVCell(item.sellingPrice),
      escapeCSVCell(item.expectedOrders),
      escapeCSVCell(priceStr),
      escapeCSVCell(item.lastWeek),
      escapeCSVCell('⚠️ 活动价格待修改'),
      escapeCSVCell(item.hasRemark ? '有备注' : ''),
    ];

    lines.push(lineCols.join(','));
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = customFileName || `CyclePro_可连续提报表_${dateStr}.csv`;
  downloadCSV(lines.join('\r\n'), fileName);
}
