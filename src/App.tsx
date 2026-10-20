import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ProductRecord,
  ActivityRecord,
  FilterState,
  UserProfile,
  SyncStatus,
  ReportItem,
} from './types';
import {
  buildMergedRows,
  generateRecommendableReport,
  generateConsecutiveReport,
  calculateStatsSummary,
  getGlobalLatestWeek,
} from './features/cycle-analysis/businessRules';
import { VirtualizedCycleTable } from './features/cycle-analysis/VirtualizedCycleTable';
import { exportMainCycleCSV } from './features/reports/csvExporter';
import { ReportModal } from './features/reports/ReportModal';
import { ConsecutiveReportModal } from './features/reports/ConsecutiveReportModal';
import { DataImportModal } from './features/data-import/DataImportModal';
import { PasteDataModal } from './features/data-import/PasteDataModal';
import { DataManagementModal } from './features/data-management/DataManagementModal';
import { MigrationModal } from './features/data-management/MigrationModal';
import { AuthModal } from './features/auth/AuthModal';
import { ApiService } from './services/api';
import {
  BarChart3,
  Database,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  Upload,
  Clipboard,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Cloud,
  User,
  LogOut,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function App() {
  // --- User & Auth State ---
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // --- Data State ---
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'syncing',
    lastSyncTime: null,
  });

  // --- Filter State ---
  const [filters, setFilters] = useState<FilterState>({
    sku: '',
    type: '',
    suggest: '',
    activityStatus: '',
    year: '',
    startWeek: '',
    endWeek: '',
    periodCount: 4,
  });

  // --- Modals State ---
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isConsecutiveModalOpen, setIsConsecutiveModalOpen] = useState(false);
  const [importModalConfig, setImportModalConfig] = useState<{
    isOpen: boolean;
    type: 'product' | 'activity';
  }>({ isOpen: false, type: 'product' });
  const [pasteModalConfig, setPasteModalConfig] = useState<{
    isOpen: boolean;
    type: 'product' | 'activity';
  }>({ isOpen: false, type: 'product' });
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(false);
  const [isMigrationOpen, setIsMigrationOpen] = useState(false);

  // --- Report Cache ---
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [consecutiveItems, setConsecutiveItems] = useState<ReportItem[]>([]);

  // 1. Initial Load: Check Auth and Fetch Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setSyncStatus((prev) => ({ ...prev, state: 'syncing' }));

    try {
      // Check current user session
      let user = currentUser;
      if (!user) {
        try {
          user = await ApiService.getCurrentUser();
          setCurrentUser(user);
        } catch {
          // If no active token, fallback to demo manager
          try {
            const demoRes = await ApiService.switchDemo('manager');
            user = demoRes.user;
            setCurrentUser(user);
          } catch (e) {
            console.warn('Demo switch failed:', e);
          }
        }
      }

      const res = await ApiService.fetchDataOverview();
      setProducts(res.products || []);
      setActivities(res.activities || []);
      setSyncStatus({
        state: 'synced',
        lastSyncTime: new Date().toLocaleTimeString('zh-CN'),
      });
    } catch (err: any) {
      console.error('Failed to load data from server:', err);
      setSyncStatus({
        state: 'error',
        lastSyncTime: null,
        errorMessage: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Data Fusion & Rule Execution
  const { mergedRows, allWeeks } = useMemo(() => {
    return buildMergedRows(products, activities);
  }, [products, activities]);

  const globalLatestWeek = useMemo(() => {
    return getGlobalLatestWeek(allWeeks);
  }, [allWeeks]);

  // Initialize filter defaults when allWeeks load (default latest 4 cycles: e.g. 38 -> 35, 36, 37, 38)
  useEffect(() => {
    if (allWeeks.length > 0) {
      const latest = allWeeks[allWeeks.length - 1];
      const count = Number(filters.periodCount) || 4;
      const calculatedStart = Math.max(1, latest.week - (count - 1));
      setFilters((prev) => ({
        ...prev,
        year: prev.year || latest.year,
        endWeek: prev.endWeek || latest.week,
        startWeek: prev.startWeek || calculatedStart,
      }));
    }
  }, [allWeeks]);

  // Available options for filter dropdowns
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    allWeeks.forEach((w) => years.add(w.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [allWeeks]);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    mergedRows.forEach((r) => {
      if (r.type && r.type !== '—') {
        types.add(r.type);
      }
    });
    return Array.from(types).sort();
  }, [mergedRows]);

  // Display weeks slice based on year, start/end week, periodCount
  const displayWeeks = useMemo(() => {
    const year = Number(filters.year) || (availableYears[0] ?? 2025);
    const start = Number(filters.startWeek) || 1;
    const end = Number(filters.endWeek) || 53;
    const count = Number(filters.periodCount) || 6;

    let filtered = allWeeks.filter(
      (w) => w.year === year && w.week >= start && w.week <= end
    );

    filtered.sort((a, b) => a.week - b.week);
    if (filtered.length > count) {
      filtered = filtered.slice(filtered.length - count);
    }
    return filtered;
  }, [allWeeks, filters.year, filters.startWeek, filters.endWeek, filters.periodCount, availableYears]);

  // Filtered Rows for Virtualized Table
  const filteredRows = useMemo(() => {
    const skuQuery = filters.sku.trim().toLowerCase();
    const typeFilter = filters.type;
    const suggestFilter = filters.suggest;
    const activityStatusFilter = filters.activityStatus;

    return mergedRows.filter((row) => {
      if (skuQuery && !row.sku.toLowerCase().includes(skuQuery)) {
        return false;
      }
      if (typeFilter && row.type !== typeFilter) {
        return false;
      }
      if (suggestFilter === 'recommend' && !row.info.recommend) {
        return false;
      }
      if (activityStatusFilter === 'has' && !row.hasActivity) {
        return false;
      }
      if (activityStatusFilter === 'no' && row.hasActivity) {
        return false;
      }
      return true;
    });
  }, [mergedRows, filters.sku, filters.type, filters.suggest, filters.activityStatus]);

  // Stats Summary
  const stats = useMemo(() => {
    return calculateStatsSummary(
      mergedRows,
      products.length,
      activities.length,
      globalLatestWeek
    );
  }, [mergedRows, products.length, activities.length, globalLatestWeek]);

  // Handle Export Main CSV
  const handleExportMain = () => {
    exportMainCycleCSV(filteredRows, displayWeeks);
  };

  // Handle Open Report Modal
  const handleOpenReportModal = () => {
    const items = generateRecommendableReport(mergedRows, globalLatestWeek, true);
    setReportItems(items);
    setIsReportModalOpen(true);
  };

  // Handle Open Consecutive Report Modal
  const handleOpenConsecutiveModal = () => {
    const items = generateConsecutiveReport(mergedRows, globalLatestWeek, allWeeks, true);
    setConsecutiveItems(items);
    setIsConsecutiveModalOpen(true);
  };

  return (
    <div className="min-h-screen flex bg-[#f0f4f9] text-[#0b1e33] font-sans antialiased">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-linear-to-b from-[#0b1e33] to-[#132f4a] min-h-screen p-6 flex flex-col shrink-0 sticky top-0 h-screen border-r border-white/10 z-30 shadow-lg">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 pb-6 mb-4 border-b border-white/10">
          <div className="w-10 h-10 bg-linear-to-tr from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-white font-bold text-lg tracking-tight">
              Cycle<span className="text-blue-400">Pro</span>{' '}
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded-md font-mono font-medium">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-400">活动周期智能提报</div>
          </div>
        </div>

        {/* Current Tenant / User */}
        <div
          onClick={() => setIsAuthModalOpen(true)}
          className="mb-6 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs font-semibold">
              <User className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-xs font-medium text-white truncate">
                {currentUser ? currentUser.name : '未登录'}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-mono">
                {currentUser?.role || '访客'} · {currentUser?.department || '运营中心'}
              </div>
            </div>
          </div>
          <span className="text-[10px] text-blue-400 group-hover:text-blue-300 transition shrink-0">
            切换
          </span>
        </div>

        {/* Navigation Section */}
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
          核心导航
        </div>
        <nav className="space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium bg-blue-600/30 text-white border border-blue-500/30 shadow-xs">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span>周期分析大盘</span>
            <span className="ml-auto text-[10px] bg-blue-500/40 text-blue-200 px-1.5 py-0.5 rounded-full font-mono">
              Live
            </span>
          </button>

          <button
            onClick={() => setImportModalConfig({ isOpen: true, type: 'product' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition"
          >
            <Upload className="w-4 h-4 text-slate-400" />
            <span>导入产品资料</span>
          </button>

          <button
            onClick={() => setImportModalConfig({ isOpen: true, type: 'activity' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-400" />
            <span>导入活动周期</span>
          </button>

          <button
            onClick={() => setIsDataManagementOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition"
          >
            <Database className="w-4 h-4 text-slate-400" />
            <span>数据管理与审计</span>
          </button>

          <button
            onClick={() => setIsMigrationOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>旧版数据迁移</span>
          </button>
        </nav>

        {/* Cloud Sync Status Card */}
        <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              云端同步
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
                syncStatus.state === 'synced'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : syncStatus.state === 'syncing'
                  ? 'bg-blue-500/20 text-blue-300 animate-pulse'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
              {syncStatus.state === 'synced'
                ? '已同步'
                : syncStatus.state === 'syncing'
                ? '同步中'
                : '网络异常'}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 leading-relaxed font-mono">
            {syncStatus.lastSyncTime ? `上次更新: ${syncStatus.lastSyncTime}` : '正在建立连接...'}
            <br />
            ⚡ 企业级支持 50,000+ 条记录
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 min-w-0 max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#0b1e33]">
                活动产品周期
              </h1>
              <span className="text-xs font-medium px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                SKU 维度 · 最近 {filters.periodCount} 个周期
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              每个 SKU 一行 · 横向展示活动价格 · 智能连报判断 · 独立提报表与云端持久化
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportMain}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              导出汇总 CSV
            </button>
            <button
              onClick={handleOpenReportModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              📋 可提报表
            </button>
            <button
              onClick={handleOpenConsecutiveModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-xs transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              🔄 可连续提报表
            </button>
            <button
              onClick={() => setIsDataManagementOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition cursor-pointer"
            >
              <Database className="w-4 h-4 text-slate-500" />
              数据管理
            </button>
          </div>
        </header>

        {/* Data Upload Grid Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span>📂 数据导入与更新</span>
              <span className="text-xs font-normal text-slate-500">
                (上传一次后自动保存至云端，下次免重复上传)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                💾 云端持久化存储
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Product Data */}
            <div className="p-4 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                    📦 产品数据表
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-normal">
                      可选
                    </span>
                  </span>
                  <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    {products.length} 条
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  包含：原始SKU、分裂SKU、类型、Item ID（用于关联匹配产品类型）
                </p>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() =>
                    setImportModalConfig({ isOpen: true, type: 'product' })
                  }
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  上传/替换文件
                </button>
                <button
                  onClick={() =>
                    setPasteModalConfig({ isOpen: true, type: 'product' })
                  }
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  批量粘贴
                </button>
              </div>
            </div>

            {/* Box 2: Activity Data */}
            <div className="p-4 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20 transition flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                    📈 活动周期表
                    <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-normal">
                      核心必传
                    </span>
                  </span>
                  <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    {activities.length} 条
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  包含：年、周、SKU、子ID、父ID、平均单量、售价、活动期望单量、活动价格、备注
                </p>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() =>
                    setImportModalConfig({ isOpen: true, type: 'activity' })
                  }
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  上传/替换文件
                </button>
                <button
                  onClick={() =>
                    setPasteModalConfig({ isOpen: true, type: 'activity' })
                  }
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  批量粘贴
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              🔗 关联匹配规则：活动表 SKU → 产品表 原始SKU（获取类型，回退支持分裂SKU）
            </span>
            <span className="text-slate-400">
              数据隔离：租户模式隔离，多端即时同步
            </span>
          </div>
        </div>

        {/* Stats Summary Bar */}
        <div className="flex flex-wrap items-center gap-6 px-6 py-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs text-slate-700 shadow-2xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-slate-500">产品 SKU:</span>
            <span className="text-base font-bold text-slate-900 font-mono">
              {stats.skuCount}
            </span>
          </div>
          <div className="w-px h-4 bg-slate-300"></div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-slate-500">活动记录总数:</span>
            <span className="text-base font-bold text-blue-600 font-mono">
              {stats.activityCount}
            </span>
          </div>
          <div className="w-px h-4 bg-slate-300"></div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-slate-500">成功关联产品:</span>
            <span className="text-base font-bold text-emerald-600 font-mono">
              {stats.matchedCount}
            </span>
          </div>
          <div className="w-px h-4 bg-slate-300"></div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-slate-500">无活动产品数:</span>
            <span className="text-base font-bold text-slate-600 font-mono">
              {stats.noActivityCount}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2 text-slate-500">
            <span>📌 最新活动周期:</span>
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              {stats.latestCycleDisplay}
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs text-xs">
          {/* SKU Search */}
          <div className="relative min-w-[160px] flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={filters.sku}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, sku: e.target.value }))
              }
              placeholder="搜索 SKU..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] font-medium">类型:</span>
            <select
              value={filters.type}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, type: e.target.value }))
              }
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="">全部类型</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Suggestion Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] font-medium">建议:</span>
            <select
              value={filters.suggest}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  suggest: e.target.value as any,
                }))
              }
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="">全部</option>
              <option value="recommend">⭐ 可提报</option>
            </select>
          </div>

          {/* Activity Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] font-medium">活动状态:</span>
            <select
              value={filters.activityStatus}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  activityStatus: e.target.value as any,
                }))
              }
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="">全部</option>
              <option value="has">有活动记录</option>
              <option value="no">无活动记录</option>
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] font-medium">年份:</span>
            <select
              value={filters.year}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  year: Number(e.target.value),
                }))
              }
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 font-mono"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Start Week */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] font-medium">起始周:</span>
            <select
              value={filters.startWeek}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  startWeek: Number(e.target.value),
                }))
              }
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 font-mono"
            >
              {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* End Week */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px] font-medium">结束周:</span>
            <select
              value={filters.endWeek}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  endWeek: Number(e.target.value),
                }))
              }
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 font-mono"
            >
              {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* Period Count Filter */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-500 text-[11px] font-medium">显示:</span>
            <select
              value={filters.periodCount}
              onChange={(e) => {
                const newCount = Number(e.target.value);
                const currentEnd = Number(filters.endWeek) || 52;
                setFilters((prev) => ({
                  ...prev,
                  periodCount: newCount,
                  startWeek: Math.max(1, currentEnd - (newCount - 1)),
                }));
              }}
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-blue-500 font-mono font-medium text-blue-700"
            >
              <option value="4">4</option>
              <option value="6">6</option>
              <option value="8">8</option>
              <option value="12">12</option>
              <option value="24">24</option>
            </select>
            <span className="text-slate-400 text-[11px]">个周期</span>
          </div>
        </div>

        {/* Main Virtualized Table Card */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              📊 当前筛选匹配结果：<strong>{filteredRows.length}</strong> 个 SKU
            </span>
            <span>
              💡 连报判断规则：最新期已提报 或 最近两周连续提报 → 暂缓；否则 → 建议提报
            </span>
          </div>

          <VirtualizedCycleTable
            rows={filteredRows}
            displayWeeks={displayWeeks}
            isLoading={isLoading}
          />
        </div>

        {/* Footer info note */}
        <footer className="text-center text-xs text-slate-400 pt-4 pb-8 border-t border-slate-200/60">
          CyclePro Pro — 企业级活动产品周期分析与智能提报管理系统 · 支持高吞吐量云端写入与并发分析
        </footer>
      </main>

      {/* --- Modals --- */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        reportItems={reportItems}
      />

      <ConsecutiveReportModal
        isOpen={isConsecutiveModalOpen}
        onClose={() => setIsConsecutiveModalOpen(false)}
        reportItems={consecutiveItems}
      />

      <DataImportModal
        isOpen={importModalConfig.isOpen}
        onClose={() =>
          setImportModalConfig((prev) => ({ ...prev, isOpen: false }))
        }
        type={importModalConfig.type}
        onSuccess={loadData}
      />

      <PasteDataModal
        isOpen={pasteModalConfig.isOpen}
        onClose={() => setPasteModalConfig((prev) => ({ ...prev, isOpen: false }))}
        type={pasteModalConfig.type}
        onSuccess={loadData}
      />

      <DataManagementModal
        isOpen={isDataManagementOpen}
        onClose={() => setIsDataManagementOpen(false)}
        currentUser={currentUser}
        productCount={products.length}
        activityCount={activities.length}
        onDataReset={loadData}
      />

      <MigrationModal
        isOpen={isMigrationOpen}
        onClose={() => setIsMigrationOpen(false)}
        onSuccess={loadData}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          loadData();
        }}
      />
    </div>
  );
}
