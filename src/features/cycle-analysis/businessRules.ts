import {
  ActivityRecord,
  CycleDetail,
  MergedRow,
  ProductRecord,
  RecommendStatus,
  ReportItem,
  StatsSummary,
  WeekMeta,
} from '../../types';

/**
 * Parses a week string like "2025-W05" into year and week numbers.
 */
export function parseWeekStr(weekStr: string): { year: number; week: number } {
  if (!weekStr) return { year: 0, week: 0 };
  const parts = weekStr.split('-W');
  if (parts.length === 2) {
    return {
      year: parseInt(parts[0], 10) || 0,
      week: parseInt(parts[1], 10) || 0,
    };
  }
  return { year: 0, week: 0 };
}

/**
 * Formats year and week number into standardized "YYYY-Www" format.
 */
export function formatWeekStr(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Calculates the chronological previous week string given a week string.
 * Handles year boundary correctly: e.g. 2026-W01 -> 2025-W52.
 * Also checks if historical cycle sequence provides a preceding active cycle.
 */
export function getPreviousWeekStr(weekStr: string, allWeeks?: WeekMeta[]): string {
  if (!weekStr) return '';

  // If active allWeeks provided, check if the cycle right before exists in the dataset
  if (allWeeks && allWeeks.length > 0) {
    const idx = allWeeks.findIndex((w) => w.weekStr === weekStr);
    if (idx > 0) {
      return allWeeks[idx - 1].weekStr;
    }
  }

  // Fallback to ISO calendar calculation
  const { year, week } = parseWeekStr(weekStr);
  if (week > 1) {
    return formatWeekStr(year, week - 1);
  }
  return formatWeekStr(year - 1, 52);
}

/**
 * Sorts week list chronologically (by year ascending, then week ascending).
 */
export function sortWeeksChronologically(weeks: string[]): WeekMeta[] {
  const metaList: WeekMeta[] = weeks.map((w) => {
    const { year, week } = parseWeekStr(w);
    return { year, week, weekStr: w };
  });

  metaList.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.week - b.week;
  });

  return metaList;
}

/**
 * Rule A: Global Latest Cycle
 */
export function getGlobalLatestWeek(allWeeks: WeekMeta[]): string | null {
  if (!allWeeks || allWeeks.length === 0) return null;
  return allWeeks[allWeeks.length - 1].weekStr;
}

/**
 * Rule B: Recommendable Check (可提报判断)
 * - If SKU has no activity records -> Recommendable (true).
 * - If SKU has NO activity in the global latest cycle -> Recommendable (true).
 * - If SKU reported in the global latest cycle -> Not recommendable (false).
 */
export function isRecommendable(
  cycles: CycleDetail[] | undefined,
  globalLatestWeekStr: string | null
): boolean {
  if (!cycles || cycles.length === 0) return true;
  if (!globalLatestWeekStr) return true;
  return !cycles.some((c) => c.week === globalLatestWeekStr);
}

/**
 * Rule C: Consecutive Recommendable Check (可连续提报判断)
 * - Returns true ONLY if:
 *   1. Reported in latest cycle (hasLatest === true)
 *   2. NOT reported in immediately preceding active cycle (!hasPrev === true)
 * - If both reported (consecutive) or neither, returns false.
 */
export function isConsecutiveRecommendable(
  cycles: CycleDetail[] | undefined,
  globalLatestWeekStr: string | null,
  allWeeks?: WeekMeta[]
): boolean {
  if (!cycles || cycles.length === 0) return false;
  if (!globalLatestWeekStr) return false;

  const hasLatest = cycles.some((c) => c.week === globalLatestWeekStr);
  if (!hasLatest) return false;

  const prevWeekStr = getPreviousWeekStr(globalLatestWeekStr, allWeeks);
  const hasPrev = prevWeekStr ? cycles.some((c) => c.week === prevWeekStr) : false;

  // "最新已报" 且上一期未报
  return hasLatest && !hasPrev;
}

/**
 * Rule D: Recommendation Status & Badge
 */
export function getRecommendStatus(
  cycles: CycleDetail[] | undefined,
  globalLatestWeekStr: string | null,
  allWeeks?: WeekMeta[]
): RecommendStatus {
  if (!cycles || cycles.length === 0) {
    return {
      status: '⏳ 无活动',
      recommend: true, // Retains recommendable status in reports
      reason: '无活动记录',
      badge: 'muted',
      hasLatest: false,
      isConsecutive: false,
    };
  }

  if (!globalLatestWeekStr) {
    return {
      status: '⏳ 无数据',
      recommend: false,
      reason: '无活动周期',
      badge: 'info',
    };
  }

  const hasLatest = cycles.some((c) => c.week === globalLatestWeekStr);
  let isConsecutive = false;

  if (globalLatestWeekStr) {
    const prevWeekStr = getPreviousWeekStr(globalLatestWeekStr, allWeeks);
    if (prevWeekStr) {
      const hasPrev = cycles.some((c) => c.week === prevWeekStr);
      if (hasLatest && hasPrev) {
        isConsecutive = true;
      }
    }
  }

  if (hasLatest && isConsecutive) {
    return {
      status: '⚠️ 连报+最新已报',
      recommend: false,
      reason: `最新期 ${globalLatestWeekStr} 已提报，且与上一期连续`,
      badge: 'danger',
      hasLatest: true,
      isConsecutive: true,
    };
  } else if (hasLatest) {
    return {
      status: '⏳ 最新已报',
      recommend: false,
      reason: `最新期 ${globalLatestWeekStr} 已提报，下一期暂缓`,
      badge: 'warning',
      hasLatest: true,
      isConsecutive: false,
    };
  } else {
    return {
      status: '✅ 可提报',
      recommend: true,
      reason: `最新期 ${globalLatestWeekStr} 无活动，可提报`,
      badge: 'success',
      hasLatest: false,
      isConsecutive: false,
    };
  }
}

/**
 * Rule E: Report Data Extraction
 * Look backwards from the latest cycle:
 * 1. Skip records with non-empty remarks by default.
 * 2. If all have remarks, fallback to latest record with hasRemark: true.
 * 3. If no activity records, return blank placeholders.
 */
export function getLastValidActivity(
  cycles: CycleDetail[] | undefined,
  skipRemark: boolean = true
): CycleDetail | null {
  if (!cycles || cycles.length === 0) return null;

  // Sort descending by week
  const sorted = cycles.slice().sort((a, b) => {
    const wa = parseWeekStr(a.week);
    const wb = parseWeekStr(b.week);
    if (wa.year !== wb.year) return wb.year - wa.year;
    return wb.week - wa.week;
  });

  for (const cycle of sorted) {
    if (skipRemark && cycle.remark && cycle.remark.trim() !== '') {
      continue;
    }
    return cycle;
  }

  // Fallback to latest record even if it has a remark
  return sorted[0] || null;
}

/**
 * Rule F & Data Fusion
 * Merges Product records and Activity records into unified SKU rows.
 */
export function buildMergedRows(
  products: ProductRecord[],
  activities: ActivityRecord[]
): {
  mergedRows: MergedRow[];
  allWeeks: WeekMeta[];
  productSkuSet: Set<string>;
} {
  const productSkuSet = new Set<string>();
  const productMap = new Map<
    string,
    { type: string; itemId: string; splitSku: string }
  >();

  // 1. Index products by originalSku and splitSku
  products.forEach((p) => {
    const sku = (p.originalSku || p.splitSku || '').trim();
    if (!sku) return;
    productSkuSet.add(sku);
    const info = {
      type: p.type || '',
      itemId: p.itemId || '',
      splitSku: p.splitSku || '',
    };
    productMap.set(sku, info);
    if (p.splitSku && p.splitSku.trim() !== sku) {
      productMap.set(p.splitSku.trim(), info);
    }
  });

  // 2. Index activities by SKU
  const actMap = new Map<string, CycleDetail[]>();
  const rawWeekSet = new Set<string>();

  activities.forEach((item) => {
    const key = (item.sku || item.subId || '').trim();
    if (!key) return;

    if (!actMap.has(key)) {
      actMap.set(key, []);
    }

    const priceNum =
      typeof item.price === 'number' && !isNaN(item.price)
        ? item.price
        : item.price !== undefined && item.price !== null && (item.price as unknown) !== ''
        ? parseFloat(String(item.price))
        : null;

    actMap.get(key)!.push({
      year: item.year,
      week: item.week,
      price: priceNum !== null && !isNaN(priceNum) ? priceNum : '',
      subId: item.subId || '',
      parentId: item.parentId || '',
      avgOrders: item.avgOrders ?? '',
      sellingPrice: item.sellingPrice ?? '',
      expectedOrders: item.expectedOrders ?? '',
      remark: item.remark || '',
    });

    if (item.week) {
      rawWeekSet.add(item.week);
    }
  });

  const allWeeks = sortWeeksChronologically(Array.from(rawWeekSet));
  const globalLatestWeek = getGlobalLatestWeek(allWeeks);

  const mergedRows: MergedRow[] = [];
  const processedSkus = new Set<string>();

  // 3. Process SKUs with activities
  for (const [sku, cycles] of actMap.entries()) {
    processedSkus.add(sku);
    const prodInfo = productMap.get(sku) || { type: '', itemId: '', splitSku: '' };

    // Sort cycles ascending
    const sortedCycles = cycles.slice().sort((a, b) => {
      const wa = parseWeekStr(a.week);
      const wb = parseWeekStr(b.week);
      if (wa.year !== wb.year) return wa.year - wb.year;
      return wa.week - wb.week;
    });

    const priceMap = new Map<string, number | '' | null>();
    sortedCycles.forEach((c) => {
      priceMap.set(c.week, c.price);
    });

    const info = getRecommendStatus(sortedCycles, globalLatestWeek, allWeeks);
    const latestCycle = sortedCycles[sortedCycles.length - 1];

    mergedRows.push({
      sku,
      type: prodInfo.type || '—',
      subId: latestCycle?.subId || '—',
      itemId: prodInfo.itemId || '—',
      cycles: sortedCycles,
      priceMap,
      info,
      hasActivity: sortedCycles.length > 0,
    });
  }

  // 4. Add product SKUs that don't have activity records
  for (const sku of productSkuSet) {
    if (!processedSkus.has(sku)) {
      const prodInfo = productMap.get(sku) || { type: '', itemId: '', splitSku: '' };
      const info = getRecommendStatus([], globalLatestWeek, allWeeks);

      mergedRows.push({
        sku,
        type: prodInfo.type || '—',
        subId: '—',
        itemId: prodInfo.itemId || '—',
        cycles: [],
        priceMap: new Map(),
        info,
        hasActivity: false,
      });
    }
  }

  // 5. Default sort: SKUs with activities first (by latest cycle descending), then SKUs without
  mergedRows.sort((a, b) => {
    if (a.hasActivity && !b.hasActivity) return -1;
    if (!a.hasActivity && b.hasActivity) return 1;
    const aLast = a.cycles.length ? a.cycles[a.cycles.length - 1].week : '';
    const bLast = b.cycles.length ? b.cycles[b.cycles.length - 1].week : '';
    return bLast.localeCompare(aLast);
  });

  return { mergedRows, allWeeks, productSkuSet };
}

/**
 * Generate Report Items for "可提报表"
 */
export function generateRecommendableReport(
  mergedRows: MergedRow[],
  globalLatestWeek: string | null,
  skipRemark: boolean = true
): ReportItem[] {
  if (!globalLatestWeek) return [];

  const list: ReportItem[] = [];

  for (const row of mergedRows) {
    if (!isRecommendable(row.cycles, globalLatestWeek)) continue;

    const lastValid = getLastValidActivity(row.cycles, skipRemark);
    if (!lastValid) {
      list.push({
        sku: row.sku,
        subId: '—',
        parentId: '—',
        avgOrders: '',
        sellingPrice: '',
        expectedOrders: '',
        activityPrice: '',
        lastWeek: '无有效记录',
        hasRemark: false,
      });
    } else {
      list.push({
        sku: row.sku,
        subId: lastValid.subId || '—',
        parentId: lastValid.parentId || '—',
        avgOrders: lastValid.avgOrders || '',
        sellingPrice: lastValid.sellingPrice || '',
        expectedOrders: lastValid.expectedOrders || '',
        activityPrice:
          lastValid.price !== '' && lastValid.price !== null
            ? lastValid.price
            : '',
        lastWeek: lastValid.week || '',
        hasRemark: Boolean(lastValid.remark && lastValid.remark.trim() !== ''),
      });
    }
  }

  list.sort((a, b) => a.sku.localeCompare(b.sku));
  return list;
}

/**
 * Generate Report Items for "可连续提报表"
 */
export function generateConsecutiveReport(
  mergedRows: MergedRow[],
  globalLatestWeek: string | null,
  allWeeks: WeekMeta[],
  skipRemark: boolean = true
): ReportItem[] {
  if (!globalLatestWeek) return [];

  const list: ReportItem[] = [];

  for (const row of mergedRows) {
    if (!isConsecutiveRecommendable(row.cycles, globalLatestWeek, allWeeks)) {
      continue;
    }

    const lastValid = getLastValidActivity(row.cycles, skipRemark);
    if (!lastValid) {
      list.push({
        sku: row.sku,
        subId: '—',
        parentId: '—',
        avgOrders: '',
        sellingPrice: '',
        expectedOrders: '',
        activityPrice: '',
        lastWeek: '无有效记录',
        hasRemark: false,
        priceWarning: true,
      });
    } else {
      list.push({
        sku: row.sku,
        subId: lastValid.subId || '—',
        parentId: lastValid.parentId || '—',
        avgOrders: lastValid.avgOrders || '',
        sellingPrice: lastValid.sellingPrice || '',
        expectedOrders: lastValid.expectedOrders || '',
        activityPrice:
          lastValid.price !== '' && lastValid.price !== null
            ? lastValid.price
            : '',
        lastWeek: lastValid.week || '',
        hasRemark: Boolean(lastValid.remark && lastValid.remark.trim() !== ''),
        priceWarning: true,
      });
    }
  }

  list.sort((a, b) => a.sku.localeCompare(b.sku));
  return list;
}

/**
 * Rule G: Statistics Calculation
 */
export function calculateStatsSummary(
  mergedRows: MergedRow[],
  productsCount: number,
  activitiesCount: number,
  globalLatestWeek: string | null
): StatsSummary {
  const totalSkus = mergedRows.length;
  let matchedCount = 0;
  let noActivityCount = 0;

  mergedRows.forEach((r) => {
    if (r.type && r.type !== '—') {
      matchedCount++;
    }
    if (!r.hasActivity) {
      noActivityCount++;
    }
  });

  return {
    skuCount: totalSkus,
    activityCount: activitiesCount,
    matchedCount,
    noActivityCount,
    latestCycleDisplay: globalLatestWeek || '—',
    lastUpdated: new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };
}
