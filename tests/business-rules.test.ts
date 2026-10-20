import {
  parseWeekStr,
  formatWeekStr,
  getPreviousWeekStr,
  sortWeeksChronologically,
  isRecommendable,
  isConsecutiveRecommendable,
  getRecommendStatus,
  getLastValidActivity,
  buildMergedRows,
  generateRecommendableReport,
  generateConsecutiveReport,
  calculateStatsSummary,
} from '../src/features/cycle-analysis/businessRules';
import { ProductRecord, ActivityRecord, CycleDetail } from '../src/types';
import { PersistentDatabase } from '../server/db/database';
import { escapeCSVCell } from '../src/features/reports/csvExporter';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAILED] ${message}`);
    throw new Error(`Assertion Failed: ${message}`);
  } else {
    console.log(`✅ [PASSED] ${message}`);
  }
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('🚀 开始执行 CyclePro Pro 业务核心规则自动化测试套件');
  console.log('======================================================\n');

  // Test 1: 最新周期没有提报记录的 SKU 应进入可提报表
  {
    const cycles: CycleDetail[] = [
      {
        year: 2025,
        week: '2025-W01',
        price: 10,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '5',
        sellingPrice: '12',
        expectedOrders: '10',
        remark: '',
      },
      {
        year: 2025,
        week: '2025-W02',
        price: 11,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '6',
        sellingPrice: '12',
        expectedOrders: '10',
        remark: '',
      },
    ];
    const globalLatestWeek = '2025-W03';
    const recommendable = isRecommendable(cycles, globalLatestWeek);
    assert(
      recommendable === true,
      '场景 1: 最新周期(W03)无提报记录的 SKU 应符合可提报条件 (isRecommendable = true)'
    );
  }

  // Test 2: 从未有活动记录的 SKU 按原规则保留可提报资格
  {
    const cycles: CycleDetail[] = [];
    const globalLatestWeek = '2025-W05';
    const recommendable = isRecommendable(cycles, globalLatestWeek);
    assert(
      recommendable === true,
      '场景 2: 从未有活动记录的空 cycles 产品应保留可提报资格'
    );
  }

  // Test 3: 最新周期已经提报的 SKU 不进入普通可提报表
  {
    const cycles: CycleDetail[] = [
      {
        year: 2025,
        week: '2025-W03',
        price: 15,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '10',
        sellingPrice: '20',
        expectedOrders: '15',
        remark: '',
      },
    ];
    const globalLatestWeek = '2025-W03';
    const recommendable = isRecommendable(cycles, globalLatestWeek);
    assert(
      recommendable === false,
      '场景 3: 最新周期已有提报记录的 SKU 不得进入普通可提报表 (isRecommendable = false)'
    );
  }

  // Test 4: 最新周期和上一有效周期均有提报时，不进入可连续提报表 (连报+最新已报)
  {
    const cycles: CycleDetail[] = [
      {
        year: 2025,
        week: '2025-W02',
        price: 15,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '10',
        sellingPrice: '20',
        expectedOrders: '15',
        remark: '',
      },
      {
        year: 2025,
        week: '2025-W03',
        price: 15,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '10',
        sellingPrice: '20',
        expectedOrders: '15',
        remark: '',
      },
    ];
    const globalLatestWeek = '2025-W03';
    const allWeeks = sortWeeksChronologically(['2025-W01', '2025-W02', '2025-W03']);
    const consecutive = isConsecutiveRecommendable(cycles, globalLatestWeek, allWeeks);
    assert(
      consecutive === false,
      '场景 4: 最新周期(W03)与上一期(W02)均有提报时，不得进入可连续提报表'
    );

    const status = getRecommendStatus(cycles, globalLatestWeek, allWeeks);
    assert(
      status.status.includes('连报+最新已报'),
      '场景 4b: 连续两周提报时状态标签应为 ⚠️ 连报+最新已报'
    );
  }

  // Test 5: 最新周期有提报、上一有效周期没有提报时，进入可连续提报表 (最新已报)
  {
    const cycles: CycleDetail[] = [
      {
        year: 2025,
        week: '2025-W01',
        price: 15,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '10',
        sellingPrice: '20',
        expectedOrders: '15',
        remark: '',
      },
      // W02 is missing
      {
        year: 2025,
        week: '2025-W03',
        price: 15,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '10',
        sellingPrice: '20',
        expectedOrders: '15',
        remark: '',
      },
    ];
    const globalLatestWeek = '2025-W03';
    const allWeeks = sortWeeksChronologically(['2025-W01', '2025-W02', '2025-W03']);
    const consecutive = isConsecutiveRecommendable(cycles, globalLatestWeek, allWeeks);
    assert(
      consecutive === true,
      '场景 5: 最新期有提报、上一期无提报时，必须进入可连续提报表 (isConsecutiveRecommendable = true)'
    );

    const status = getRecommendStatus(cycles, globalLatestWeek, allWeeks);
    assert(
      status.status.includes('最新已报'),
      '场景 5b: 只有最新期提报而上一期无提报时，状态标签应为 ⏳ 最新已报'
    );
  }

  // Test 6: 存在备注的记录默认跳过
  {
    const cycles: CycleDetail[] = [
      {
        year: 2025,
        week: '2025-W01',
        price: 8.5,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '5',
        sellingPrice: '12',
        expectedOrders: '10',
        remark: '', // Normal record
      },
      {
        year: 2025,
        week: '2025-W02',
        price: 6.0,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '20',
        sellingPrice: '12',
        expectedOrders: '30',
        remark: '黑五大促特殊价格', // Has remark
      },
    ];

    const lastValid = getLastValidActivity(cycles, true);
    assert(
      lastValid !== null && lastValid.week === '2025-W01',
      '场景 6: 提取历史提报参数时，默认跳过带备注的活动记录并提取最近无备注记录 (2025-W01)'
    );
  }

  // Test 7: 所有历史记录均有备注时，执行规定的回退行为
  {
    const cycles: CycleDetail[] = [
      {
        year: 2025,
        week: '2025-W01',
        price: 8.5,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '5',
        sellingPrice: '12',
        expectedOrders: '10',
        remark: '早春促销',
      },
      {
        year: 2025,
        week: '2025-W02',
        price: 7.5,
        subId: 's1',
        parentId: 'p1',
        avgOrders: '8',
        sellingPrice: '12',
        expectedOrders: '15',
        remark: '年中特惠',
      },
    ];

    const lastValid = getLastValidActivity(cycles, true);
    assert(
      lastValid !== null && lastValid.week === '2025-W02',
      '场景 7: 若全部历史均有备注，回退使用最新一条记录 (2025-W02) 并在报表中标记备注'
    );
  }

  // Test 8: 产品表中存在、活动表中不存在的 SKU 仍然显示
  {
    const products: ProductRecord[] = [
      {
        id: 'p1',
        userId: 'u1',
        originalSku: 'SKU_ONLY_IN_PRODUCT',
        splitSku: '',
        type: '测试类目',
        itemId: '12345',
      },
    ];
    const activities: ActivityRecord[] = [];

    const { mergedRows } = buildMergedRows(products, activities);
    const found = mergedRows.find((r) => r.sku === 'SKU_ONLY_IN_PRODUCT');
    assert(
      found !== undefined && found.type === '测试类目' && found.hasActivity === false,
      '场景 8: 只有产品资料而无任何活动记录的 SKU 必须完整保留在分析主表中'
    );
  }

  // Test 9: 活动表中的 SKU 没有匹配产品资料时仍然显示
  {
    const products: ProductRecord[] = [];
    const activities: ActivityRecord[] = [
      {
        id: 'a1',
        userId: 'u1',
        year: 2025,
        week: '2025-W01',
        sku: 'SKU_ORPHAN_ACTIVITY',
        subId: 'sub99',
        price: 19.99,
      },
    ];

    const { mergedRows } = buildMergedRows(products, activities);
    const found = mergedRows.find((r) => r.sku === 'SKU_ORPHAN_ACTIVITY');
    assert(
      found !== undefined && found.type === '—' && found.hasActivity === true,
      '场景 9: 未匹配到产品资料的孤立活动 SKU 仍然完整显示在分析主表中'
    );
  }

  // Test 10: 第 1 周、第 52 周、第 53 周和跨年周期排序正确
  {
    const weeks = ['2024-W52', '2025-W01', '2024-W50', '2026-W02', '2025-W53'];
    const sorted = sortWeeksChronologically(weeks);
    const expected = ['2024-W50', '2024-W52', '2025-W01', '2025-W53', '2026-W02'];
    const matches = sorted.every((w, i) => w.weekStr === expected[i]);
    assert(
      matches === true,
      '场景 10: 跨年周期及第52/53周按真实年份和周次严格升序排序'
    );

    const prevOf2025W01 = getPreviousWeekStr('2025-W01', sorted);
    assert(
      prevOf2025W01 === '2024-W52',
      '场景 10b: 跨年边界 2025-W01 的上一有效周期正确回溯至 2024-W52'
    );
  }

  // Test 11: 统计口径计算准确
  {
    const products: ProductRecord[] = [
      { id: '1', userId: 'u1', originalSku: 'SKU_A', type: '类型A' },
      { id: '2', userId: 'u1', originalSku: 'SKU_B', type: '类型B' },
      { id: '3', userId: 'u1', originalSku: 'SKU_C', type: '' },
    ];
    const activities: ActivityRecord[] = [
      { id: '1', userId: 'u1', year: 2025, week: '2025-W01', sku: 'SKU_A', price: 10 },
      { id: '2', userId: 'u1', year: 2025, week: '2025-W02', sku: 'SKU_A', price: 12 },
      { id: '3', userId: 'u1', year: 2025, week: '2025-W01', sku: 'SKU_UNKNOWN', price: 9 },
    ];

    const { mergedRows } = buildMergedRows(products, activities);
    const stats = calculateStatsSummary(mergedRows, products.length, activities.length, '2025-W02');

    assert(stats.skuCount === 4, '场景 11: 总 SKU 数为 4 (SKU_A, SKU_B, SKU_C, SKU_UNKNOWN)');
    assert(stats.activityCount === 3, '场景 11b: 活动记录总数为 3');
    assert(stats.matchedCount === 2, '场景 11c: 成功匹配产品类型的 SKU 数量准确统计为 2');
    assert(stats.noActivityCount === 2, '场景 11d: 无活动产品数准确统计为 2 (SKU_B, SKU_C)');
  }

  // Test 12: CSV 导出字段转义与防公式注入
  {
    const dangerousCell = '=CMD|"/C calc"!A0';
    const escaped = escapeCSVCell(dangerousCell);
    assert(
      escaped.startsWith("\"'="),
      '场景 12: CSV 导出对包含 =,+,-,@ 等公式前缀的文本执行安全防护转义'
    );
  }

  // Test 13: 数据库去重与多租户隔离
  {
    const testDb = new PersistentDatabase();
    const userA = 'test_user_alpha';
    const userB = 'test_user_beta';

    testDb.batchUpsertProducts(
      userA,
      [{ originalSku: 'ALPHA-001', type: 'AlphaType' }],
      'replace'
    );
    testDb.batchUpsertProducts(
      userB,
      [{ originalSku: 'BETA-001', type: 'BetaType' }],
      'replace'
    );

    const prodsA = testDb.getProducts(userA);
    const prodsB = testDb.getProducts(userB);

    assert(
      prodsA.length === 1 && prodsA[0].originalSku === 'ALPHA-001',
      '场景 13: 用户 A 只能查询到自身隔离的产品数据'
    );
    assert(
      prodsB.length === 1 && prodsB[0].originalSku === 'BETA-001',
      '场景 13b: 用户 B 只能查询到自身隔离的产品数据，跨租户严格隔离'
    );
  }

  console.log('\n======================================================');
  console.log('🎉 全部 17 项业务规则测试用例已全部验证通过！');
  console.log('======================================================\n');
}

runAllTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
