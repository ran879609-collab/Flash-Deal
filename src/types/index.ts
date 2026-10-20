export type UserRole = 'admin' | 'manager' | 'analyst';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  avatarUrl?: string;
  token?: string;
}

export interface ProductRecord {
  id: string;
  userId: string;
  originalSku: string;
  splitSku?: string;
  type?: string;
  itemId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActivityRecord {
  id: string;
  userId: string;
  year: number;
  week: string; // e.g. "2025-W01"
  sku: string;
  subId?: string;
  parentId?: string;
  avgOrders?: string | number | null;
  sellingPrice?: string | number | null;
  expectedOrders?: string | number | null;
  price?: number | null;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CycleDetail {
  year: number;
  week: string; // e.g. "2025-W01"
  price: number | '' | null;
  subId: string;
  parentId: string;
  avgOrders: string | number;
  sellingPrice: string | number;
  expectedOrders: string | number;
  remark: string;
}

export interface WeekMeta {
  year: number;
  week: number;
  weekStr: string;
}

export interface RecommendStatus {
  status: string;
  recommend: boolean;
  reason: string;
  badge: 'success' | 'warning' | 'danger' | 'info' | 'muted';
  hasLatest?: boolean;
  isConsecutive?: boolean;
}

export interface MergedRow {
  sku: string;
  type: string;
  subId: string;
  itemId: string;
  cycles: CycleDetail[];
  priceMap: Map<string, number | '' | null>;
  info: RecommendStatus;
  hasActivity: boolean;
}

export interface ReportItem {
  sku: string;
  subId: string;
  parentId: string;
  avgOrders: string | number;
  sellingPrice: string | number;
  expectedOrders: string | number;
  activityPrice: number | '';
  lastWeek: string;
  hasRemark: boolean;
  priceWarning?: boolean;
}

export interface ImportJob {
  id: string;
  userId: string;
  fileName: string;
  fileType: 'product' | 'activity';
  mode: 'append' | 'replace';
  totalRows: number;
  successRows: number;
  errorRows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorSummary?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  entityType: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface FilterState {
  sku: string;
  type: string;
  suggest: '' | 'recommend';
  activityStatus: '' | 'has' | 'no';
  year: number | '';
  startWeek: number | '';
  endWeek: number | '';
  periodCount: number; // 4, 6, 8, 12, 24
}

export interface SyncStatus {
  state: 'synced' | 'syncing' | 'offline' | 'error';
  lastSyncTime: string | null;
  errorMessage?: string;
}

export interface StatsSummary {
  skuCount: number;
  activityCount: number;
  matchedCount: number;
  noActivityCount: number;
  latestCycleDisplay: string;
  lastUpdated: string;
}
