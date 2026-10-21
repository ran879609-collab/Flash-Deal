import {
  UserProfile,
  ProductRecord,
  ActivityRecord,
  ImportJob,
  AuditLog,
  UserRole,
} from '../types';
import { SupabaseService } from './supabase';

const TOKEN_KEY = 'cyclepro_auth_token_v3';
const USER_KEY = 'cyclepro_current_user_v3';
const USERS_STORAGE_KEY = 'cyclepro_registered_users_v3';
const PRODUCTS_STORAGE_KEY = 'cyclepro_product_data_v3';
const ACTIVITIES_STORAGE_KEY = 'cyclepro_activity_data_v3';
const AUDIT_STORAGE_KEY = 'cyclepro_audit_logs_v3';
const JOBS_STORAGE_KEY = 'cyclepro_jobs_v3';

// Default Demo Users
const DEFAULT_USERS: Array<UserProfile & { password: string }> = [
  {
    id: 'u_admin_001',
    email: 'admin@cyclepro.com',
    name: '张总 (系统管理员)',
    role: 'admin',
    department: '电商运营中心',
    password: 'admin123456',
  },
  {
    id: 'u_manager_002',
    email: 'manager@cyclepro.com',
    name: '李经理 (运营主管)',
    role: 'manager',
    department: '北美精品运营组',
    password: 'manager123456',
  },
  {
    id: 'u_analyst_003',
    email: 'analyst@cyclepro.com',
    name: '王分析师 (数据分析)',
    role: 'analyst',
    department: '商业分析中心',
    password: 'analyst123456',
  },
];

// Default Demo Products
const DEFAULT_PRODUCTS = [
  { originalSku: 'TZ-P0211-BLUE', splitSku: '2in1', type: 'E-训狗器', itemId: '883281869' },
  { originalSku: 'TZ-P0211-GREEN', splitSku: '2in1', type: 'E-训狗器', itemId: '307878055' },
  { originalSku: 'PET1005-Black-XS', splitSku: 'PET1005', type: 'I-发光项圈', itemId: '5559267016' },
  { originalSku: 'PET1005-Black-S', splitSku: 'PET1005', type: 'I-发光项圈', itemId: '718219317' },
  { originalSku: 'PET1005-Blue-M', splitSku: 'PET1005', type: 'I-发光项圈', itemId: '510192494' },
  { originalSku: 'DC3200-Black-L', splitSku: 'DC3200', type: 'I-发光项圈', itemId: '2710278597' },
];

function generateDefaultActivities() {
  const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const skus = ['TZ-P0211-BLUE', 'TZ-P0211-GREEN', 'PET1005-Black-XS', 'PET1005-Black-S', 'PET1005-Blue-M', 'DC3200-Black-L'];
  const list: ActivityRecord[] = [];

  skus.forEach((sku, idx) => {
    weeks.forEach((w, wi) => {
      if (sku === 'TZ-P0211-BLUE' && (w === 7 || w === 15 || w === 20)) return;
      if (sku === 'PET1005-Black-XS' && (w === 8 || w === 16 || w === 22)) return;
      if (sku === 'PET1005-Blue-M' && w > 18) return;
      if (sku === 'DC3200-Black-L' && w > 10) return;

      const basePrice = 10 + idx * 2 + wi * 0.3;
      let remark = '';
      if (w === 10 || w === 11) remark = '大促';
      if (w === 20 || w === 21) remark = '黑五';

      const subId = String(883281869 + idx * 100 + wi);
      const parentId = String(883281869 + idx * 50);
      const avgOrders = (12 + idx * 2 + wi * 0.2).toFixed(2);
      const sellingPrice = (10 + idx * 1.5 + wi * 0.2).toFixed(2);
      const expectedOrders = Math.round(15 + idx * 3 + wi * 0.5);
      const price = parseFloat((basePrice + (wi % 3 === 0 ? 0 : 0.5)).toFixed(2));

      list.push({
        id: `act_${idx}_${w}`,
        userId: 'u_manager_002',
        year: 2025,
        week: `2025-W${String(w).padStart(2, '0')}`,
        sku,
        subId,
        parentId,
        avgOrders,
        sellingPrice,
        expectedOrders: String(expectedOrders),
        price,
        remark,
      });
    });
  });

  return list;
}

export class ApiService {
  private static token: string | null = localStorage.getItem(TOKEN_KEY);

  public static getToken(): string | null {
    return this.token;
  }

  public static setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }

  /**
   * Generates possible API URLs taking into account:
   * 1. Relative to current base URL (e.g. /Flash-Deal/api/...)
   * 2. Root API (e.g. /api/...)
   */
  private static getApiUrls(endpoint: string): string[] {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

    const urls: string[] = [];
    if (base && base !== '') {
      urls.push(`${base}/api${cleanEndpoint}`);
    }
    urls.push(`/api${cleanEndpoint}`);
    return Array.from(new Set(urls));
  }

  /**
   * Resilient request method:
   * Attempts endpoints on backend server.
   * If all fail (e.g. on GitHub Pages static host), flags isFallback: true.
   */
  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; isFallback: boolean }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const candidateUrls = this.getApiUrls(endpoint);
    let lastError: any = null;

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          ...options,
          headers,
        });

        // 405 or 404 means the static host intercepted or route not handled
        if (res.status === 405 || res.status === 404) {
          continue; // try next candidate URL
        }

        if (!res.ok) {
          let errorMsg = `请求失败 (${res.status})`;
          try {
            const data = await res.json();
            if (data && data.error) {
              errorMsg = data.error;
            }
          } catch {
            // keep errorMsg
          }
          throw new Error(errorMsg);
        }

        const json = await res.json();
        return { data: json as T, isFallback: false };
      } catch (err: any) {
        lastError = err;
        if (err.message && !err.message.includes('fetch') && !err.message.includes('405') && !err.message.includes('404')) {
          // Business error from backend like "邮箱或密码错误"
          throw err;
        }
      }
    }

    // If all URLs returned 404/405 or network failed, we are in static hosting mode (e.g. GitHub Pages)
    return { data: null as any, isFallback: true };
  }

  // ==========================================
  // Client-Side Users Storage & Fallback
  // ==========================================
  public static getStoredUsers(): Array<UserProfile & { password?: string }> {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return [...DEFAULT_USERS, ...parsed];
    } catch {
      return [...DEFAULT_USERS];
    }
  }

  public static saveRegisteredUser(user: UserProfile & { password?: string }): void {
    try {
      const raw = localStorage.getItem(USERS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      parsed.push(user);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(parsed));
    } catch (e) {
      console.warn('Failed to save user to local storage', e);
    }
  }

  // ==========================================
  // Cross-Browser Account & Full Data Sync Key
  // ==========================================
  public static exportAccountSyncCode(includeData: boolean = true): string {
    const currentUser = localStorage.getItem(USER_KEY);
    const users = localStorage.getItem(USERS_STORAGE_KEY);
    const prods = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    const acts = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    const supabase = localStorage.getItem('cyclepro_supabase_config_v3');

    const products = prods ? JSON.parse(prods) : [];
    const activities = acts ? JSON.parse(acts) : [];

    const payload = {
      v: 3,
      type: 'cyclepro_full_sync',
      time: Date.now(),
      currentUser: currentUser ? JSON.parse(currentUser) : null,
      users: users ? JSON.parse(users) : [],
      products: includeData ? products : [],
      activities: includeData ? activities : [],
      productsCount: products.length,
      activitiesCount: activities.length,
      supabaseConfig: supabase ? JSON.parse(supabase) : null,
    };

    return btoa(encodeURIComponent(JSON.stringify(payload)));
  }

  public static exportSyncPackageJSON(): string {
    const currentUser = localStorage.getItem(USER_KEY);
    const users = localStorage.getItem(USERS_STORAGE_KEY);
    const prods = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    const acts = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    const supabase = localStorage.getItem('cyclepro_supabase_config_v3');

    const products = prods ? JSON.parse(prods) : [];
    const activities = acts ? JSON.parse(acts) : [];

    const payload = {
      v: 3,
      type: 'cyclepro_full_sync',
      time: Date.now(),
      exportDate: new Date().toISOString(),
      currentUser: currentUser ? JSON.parse(currentUser) : null,
      users: users ? JSON.parse(users) : [],
      products,
      activities,
      productsCount: products.length,
      activitiesCount: activities.length,
      supabaseConfig: supabase ? JSON.parse(supabase) : null,
    };

    return JSON.stringify(payload, null, 2);
  }

  public static parseSyncCodePreview(input: string | object): {
    isValid: boolean;
    user?: UserProfile;
    productsCount: number;
    activitiesCount: number;
    exportTime?: string;
    error?: string;
  } {
    try {
      let parsed: any;
      if (typeof input === 'object' && input !== null) {
        parsed = input;
      } else {
        const trimmed = (input as string).trim();
        if (trimmed.startsWith('{')) {
          parsed = JSON.parse(trimmed);
        } else {
          parsed = JSON.parse(decodeURIComponent(atob(trimmed)));
        }
      }

      if (!parsed.currentUser && !parsed.user) {
        return { isValid: false, productsCount: 0, activitiesCount: 0, error: '未识别到有效账户' };
      }

      const user = parsed.currentUser || parsed.user;
      const pCount = Array.isArray(parsed.products)
        ? parsed.products.length
        : parsed.productsCount || 0;
      const aCount = Array.isArray(parsed.activities)
        ? parsed.activities.length
        : parsed.activitiesCount || 0;

      return {
        isValid: true,
        user,
        productsCount: pCount,
        activitiesCount: aCount,
        exportTime: parsed.time ? new Date(parsed.time).toLocaleString('zh-CN') : undefined,
      };
    } catch (e: any) {
      return { isValid: false, productsCount: 0, activitiesCount: 0, error: e.message || '格式错误' };
    }
  }

  public static importAccountSyncCode(codeOrJson: string | object): {
    user: UserProfile;
    productsCount: number;
    activitiesCount: number;
  } {
    try {
      let parsed: any;
      if (typeof codeOrJson === 'object' && codeOrJson !== null) {
        parsed = codeOrJson;
      } else {
        const trimmed = (codeOrJson as string).trim();
        if (trimmed.startsWith('{')) {
          parsed = JSON.parse(trimmed);
        } else {
          parsed = JSON.parse(decodeURIComponent(atob(trimmed)));
        }
      }

      const user = parsed.currentUser || parsed.user;
      if (!user) {
        throw new Error('无效的同步数据：未包含有效用户身份');
      }

      // 1. Restore registered users so login with password works in this browser
      const users = this.getStoredUsers();
      if (Array.isArray(parsed.users)) {
        parsed.users.forEach((u: any) => {
          if (!users.some((x) => x.email === u.email)) {
            this.saveRegisteredUser(u);
          }
        });
      }

      // 2. Set current active user & token
      this.setToken(`sync_token_${Date.now()}_${user.id || 'u'}`);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      // 3. Restore Products Data
      let productsCount = 0;
      if (Array.isArray(parsed.products) && parsed.products.length > 0) {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(parsed.products));
        productsCount = parsed.products.length;
      }

      // 4. Restore Activities Data
      let activitiesCount = 0;
      if (Array.isArray(parsed.activities) && parsed.activities.length > 0) {
        localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(parsed.activities));
        activitiesCount = parsed.activities.length;
      }

      // 5. Mark as initialized so demo data won't overwrite user data
      localStorage.setItem('cyclepro_data_initialized', 'true');

      // 6. Restore Supabase config if present
      if (parsed.supabaseConfig && parsed.supabaseConfig.url) {
        localStorage.setItem('cyclepro_supabase_config_v3', JSON.stringify(parsed.supabaseConfig));
      }

      return {
        user,
        productsCount,
        activitiesCount,
      };
    } catch (err: any) {
      throw new Error(`同步数据解析失败: ${err.message || '请确认同步码或文件完整'}`);
    }
  }

  // ==========================================
  // 1. Authentication (Login, Register, Me)
  // ==========================================
  public static async login(
    email: string,
    password: string
  ): Promise<{ user: UserProfile; token: string }> {
    // 1. Try Supabase if configured
    if (SupabaseService.isConfigured()) {
      try {
        const suUser = await SupabaseService.findUserByEmail(email);
        if (suUser) {
          const profile: UserProfile = {
            id: suUser.id,
            email: suUser.email,
            name: suUser.name,
            role: suUser.role,
            department: suUser.department,
          };
          const token = `supabase_token_${Date.now()}`;
          this.setToken(token);
          localStorage.setItem(USER_KEY, JSON.stringify(profile));
          return { user: profile, token };
        }
      } catch (err) {
        console.warn('Supabase login check failed', err);
      }
    }

    // 2. Try Backend Server (e.g. AI Studio Dev Server or Self-hosted Node Server)
    try {
      const { data, isFallback } = await this.request<{ user: UserProfile; token: string }>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );

      if (!isFallback && data) {
        this.setToken(data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data;
      }
    } catch (err: any) {
      if (!err.message?.includes('405') && !err.message?.includes('404')) {
        throw err;
      }
    }

    // 3. Fallback to Local Persistent User Store (e.g. for GitHub Pages)
    const users = this.getStoredUsers();
    const matched = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );

    if (!matched || (matched.password && matched.password !== password)) {
      throw new Error(
        '邮箱或密码错误，请核对后重试。（提示：若在 GitHub Pages 纯静态站点下更换浏览器，可通过「跨设备同步码」一键导入登录凭证，或连接 Supabase 云端数据库）'
      );
    }

    const { password: _, ...safeProfile } = matched;
    const token = `local_token_${Date.now()}_${safeProfile.id}`;
    this.setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(safeProfile));

    return { user: safeProfile, token };
  }

  public static async register(
    email: string,
    password: string,
    name: string,
    role: UserRole = 'manager',
    department: string = '运营部'
  ): Promise<{ user: UserProfile; token: string }> {
    if (!email || !password || !name) {
      throw new Error('请完整填写邮箱、密码与真实姓名');
    }

    // 1. Try Supabase if configured
    if (SupabaseService.isConfigured()) {
      try {
        const suProfile = await SupabaseService.registerUser({
          email,
          passwordHash: password,
          name,
          role,
          department,
        });
        if (suProfile) {
          const token = `supabase_token_${Date.now()}`;
          this.setToken(token);
          localStorage.setItem(USER_KEY, JSON.stringify(suProfile));
          return { user: suProfile, token };
        }
      } catch (err: any) {
        console.warn('Supabase registration failed, trying backend/local', err);
      }
    }

    // 2. Try Backend Server
    try {
      const { data, isFallback } = await this.request<{ user: UserProfile; token: string }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ email, password, name, role, department }),
        }
      );

      if (!isFallback && data) {
        this.setToken(data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data;
      }
    } catch (err: any) {
      if (!err.message?.includes('405') && !err.message?.includes('404')) {
        throw err;
      }
    }

    // 3. Fallback to Local Storage (GitHub Pages mode)
    const users = this.getStoredUsers();
    const exists = users.some(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase()
    );
    if (exists) {
      throw new Error('该企业邮箱已被注册');
    }

    const newProfile: UserProfile & { password: string } = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role,
      department: department.trim(),
      password,
    };

    this.saveRegisteredUser(newProfile);

    const { password: _, ...safeProfile } = newProfile;
    const token = `local_token_${Date.now()}_${safeProfile.id}`;
    this.setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(safeProfile));

    return { user: safeProfile, token };
  }

  public static async getCurrentUser(): Promise<UserProfile> {
    try {
      const { data, isFallback } = await this.request<{ user: UserProfile }>('/auth/me');
      if (!isFallback && data && data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data.user;
      }
    } catch {
      // fallback to stored user
    }

    const localUserRaw = localStorage.getItem(USER_KEY);
    if (localUserRaw) {
      return JSON.parse(localUserRaw);
    }

    const defaultUser = DEFAULT_USERS[1];
    const { password, ...safeUser } = defaultUser;
    localStorage.setItem(USER_KEY, JSON.stringify(safeUser));
    return safeUser;
  }

  public static async switchDemo(
    role: UserRole
  ): Promise<{ user: UserProfile; token: string }> {
    try {
      const { data, isFallback } = await this.request<{ user: UserProfile; token: string }>(
        '/auth/switch-demo',
        {
          method: 'POST',
          body: JSON.stringify({ role }),
        }
      );

      if (!isFallback && data) {
        this.setToken(data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        return data;
      }
    } catch {
      // fallback
    }

    const target =
      DEFAULT_USERS.find((u) => u.role === role) || DEFAULT_USERS[1];
    const { password, ...safeUser } = target;
    const token = `demo_token_${role}_${Date.now()}`;
    this.setToken(token);
    localStorage.setItem(USER_KEY, JSON.stringify(safeUser));

    return { user: safeUser, token };
  }

  public static logout(): void {
    this.setToken(null);
  }

  // ==========================================
  // 2. Data Overview & Synchronization
  // ==========================================
  public static async fetchDataOverview(): Promise<{
    products: ProductRecord[];
    activities: ActivityRecord[];
    serverTime: string;
  }> {
    // 1. Try Supabase if configured
    if (SupabaseService.isConfigured()) {
      try {
        const [suProducts, suActivities] = await Promise.all([
          SupabaseService.fetchProducts('u_supabase'),
          SupabaseService.fetchActivities('u_supabase'),
        ]);

        if (suProducts && suActivities) {
          localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(suProducts));
          localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(suActivities));
          return {
            products: suProducts,
            activities: suActivities,
            serverTime: new Date().toISOString(),
          };
        }
      } catch (err) {
        console.warn('Supabase fetch overview failed, falling back', err);
      }
    }

    // 2. Try Backend Server
    try {
      const { data, isFallback } = await this.request<{
        products: ProductRecord[];
        activities: ActivityRecord[];
        serverTime: string;
      }>('/data/overview');

      if (!isFallback && data) {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(data.products));
        localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(data.activities));
        return data;
      }
    } catch {
      // fallback
    }

    // 3. Fallback to Local Storage / Demo Data
    const prodsRaw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    const actsRaw = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    const isInitialized = localStorage.getItem('cyclepro_data_initialized') === 'true';

    let products: ProductRecord[] = prodsRaw ? JSON.parse(prodsRaw) : [];
    let activities: ActivityRecord[] = actsRaw ? JSON.parse(actsRaw) : [];

    // Only inject demo data for first-time visitors who haven't initialized or imported anything
    if (!isInitialized && products.length === 0 && activities.length === 0) {
      products = DEFAULT_PRODUCTS.map((p, idx) => ({
        id: `p_demo_${idx + 1}`,
        userId: 'u_manager_002',
        originalSku: p.originalSku,
        splitSku: p.splitSku,
        type: p.type,
        itemId: p.itemId,
      }));
      activities = generateDefaultActivities();

      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
      localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(activities));
    }

    return {
      products,
      activities,
      serverTime: new Date().toISOString(),
    };
  }

  // ==========================================
  // 3. Batch Products & Activities Import
  // ==========================================
  public static async importProductsBatch(
    items: Array<Omit<ProductRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
    mode: 'append' | 'replace' = 'append',
    fileName?: string
  ): Promise<{ success: boolean; successCount: number; replacedCount: number; job?: ImportJob }> {
    try {
      const { data, isFallback } = await this.request<{
        success: boolean;
        successCount: number;
        replacedCount: number;
        job: ImportJob;
      }>('/products/batch', {
        method: 'POST',
        body: JSON.stringify({ items, mode, fileName }),
      });

      if (!isFallback && data) {
        return data;
      }
    } catch {
      // fallback
    }

    // Local Fallback
    const prodsRaw = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    let current: ProductRecord[] = prodsRaw ? JSON.parse(prodsRaw) : [];

    if (mode === 'replace') {
      current = [];
    }

    const map = new Map<string, ProductRecord>();
    current.forEach((p) => map.set(p.originalSku, p));

    let replaced = 0;
    let created = 0;

    items.forEach((item) => {
      const sku = (item.originalSku || item.splitSku || '').trim();
      if (!sku) return;

      const existing = map.get(sku);
      if (existing) {
        existing.splitSku = item.splitSku || existing.splitSku;
        existing.type = item.type || existing.type;
        existing.itemId = item.itemId || existing.itemId;
        replaced++;
      } else {
        map.set(sku, {
          id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: 'u_current',
          originalSku: sku,
          splitSku: item.splitSku || '',
          type: item.type || '',
          itemId: item.itemId || '',
        });
        created++;
      }
    });

    const updated = Array.from(map.values());
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem('cyclepro_data_initialized', 'true');

    return {
      success: true,
      successCount: created + replaced,
      replacedCount: replaced,
    };
  }

  public static async importActivitiesBatch(
    items: Array<Omit<ActivityRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
    mode: 'append' | 'replace' = 'append',
    fileName?: string
  ): Promise<{ success: boolean; successCount: number; replacedCount: number; job?: ImportJob }> {
    try {
      const { data, isFallback } = await this.request<{
        success: boolean;
        successCount: number;
        replacedCount: number;
        job: ImportJob;
      }>('/activities/batch', {
        method: 'POST',
        body: JSON.stringify({ items, mode, fileName }),
      });

      if (!isFallback && data) {
        return data;
      }
    } catch {
      // fallback
    }

    // Local Fallback
    const actsRaw = localStorage.getItem(ACTIVITIES_STORAGE_KEY);
    let current: ActivityRecord[] = actsRaw ? JSON.parse(actsRaw) : [];

    if (mode === 'replace') {
      current = [];
    }

    const map = new Map<string, ActivityRecord>();
    current.forEach((a) => map.set(`${a.sku}_${a.week}`, a));

    let replaced = 0;
    let created = 0;

    items.forEach((item) => {
      const sku = (item.sku || item.subId || '').trim();
      const week = (item.week || '').trim();
      if (!sku || !week) return;

      const key = `${sku}_${week}`;
      const existing = map.get(key);

      if (existing) {
        existing.subId = item.subId || existing.subId;
        existing.parentId = item.parentId || existing.parentId;
        existing.avgOrders = item.avgOrders !== undefined ? item.avgOrders : existing.avgOrders;
        existing.sellingPrice = item.sellingPrice !== undefined ? item.sellingPrice : existing.sellingPrice;
        existing.expectedOrders = item.expectedOrders !== undefined ? item.expectedOrders : existing.expectedOrders;
        existing.price = item.price !== undefined ? item.price : existing.price;
        existing.remark = item.remark !== undefined ? item.remark : existing.remark;
        replaced++;
      } else {
        map.set(key, {
          id: `a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: 'u_current',
          year: item.year,
          week: item.week,
          sku,
          subId: item.subId || '',
          parentId: item.parentId || '',
          avgOrders: item.avgOrders ?? '',
          sellingPrice: item.sellingPrice ?? '',
          expectedOrders: item.expectedOrders ?? '',
          price: item.price !== undefined ? item.price : null,
          remark: item.remark || '',
        });
        created++;
      }
    });

    const updated = Array.from(map.values());
    localStorage.setItem(ACTIVITIES_STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem('cyclepro_data_initialized', 'true');

    return {
      success: true,
      successCount: created + replaced,
      replacedCount: replaced,
    };
  }

  // ==========================================
  // 4. Clear Storage
  // ==========================================
  public static async clearData(
    confirmText: string
  ): Promise<{ success: boolean; message: string; clearedProducts: number; clearedActivities: number }> {
    if (confirmText !== 'CONFIRM_CLEAR_ALL') {
      throw new Error('安全确认口令不正确');
    }

    try {
      const { data, isFallback } = await this.request<{
        success: boolean;
        message: string;
        clearedProducts: number;
        clearedActivities: number;
      }>('/data/clear', {
        method: 'POST',
        body: JSON.stringify({ confirmText }),
      });

      if (!isFallback && data) {
        localStorage.removeItem(PRODUCTS_STORAGE_KEY);
        localStorage.removeItem(ACTIVITIES_STORAGE_KEY);
        return data;
      }
    } catch {
      // fallback
    }

    const pCount = (JSON.parse(localStorage.getItem(PRODUCTS_STORAGE_KEY) || '[]') as any[]).length;
    const aCount = (JSON.parse(localStorage.getItem(ACTIVITIES_STORAGE_KEY) || '[]') as any[]).length;

    localStorage.removeItem(PRODUCTS_STORAGE_KEY);
    localStorage.removeItem(ACTIVITIES_STORAGE_KEY);

    return {
      success: true,
      message: `已成功清空存储！共移除 ${pCount} 条产品资料及 ${aCount} 条活动记录`,
      clearedProducts: pCount,
      clearedActivities: aCount,
    };
  }

  // ==========================================
  // 5. Backup & Restore
  // ==========================================
  public static async getBackup(): Promise<any> {
    try {
      const { data, isFallback } = await this.request<any>('/data/backup');
      if (!isFallback && data) {
        return data;
      }
    } catch {
      // fallback
    }

    const products = JSON.parse(localStorage.getItem(PRODUCTS_STORAGE_KEY) || '[]');
    const activities = JSON.parse(localStorage.getItem(ACTIVITIES_STORAGE_KEY) || '[]');

    return {
      version: 'CyclePro-Pro-v3.0',
      exportTime: new Date().toISOString(),
      data: { products, activities },
    };
  }

  public static async restoreBackup(
    backupData: { products: any[]; activities: any[] },
    mode: 'append' | 'replace' = 'replace'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { data, isFallback } = await this.request<{
        success: boolean;
        message: string;
      }>('/data/restore', {
        method: 'POST',
        body: JSON.stringify({ ...backupData, mode }),
      });

      if (!isFallback && data) {
        return data;
      }
    } catch {
      // fallback
    }

    if (Array.isArray(backupData.products)) {
      await this.importProductsBatch(backupData.products, mode, '备份恢复导入');
    }
    if (Array.isArray(backupData.activities)) {
      await this.importActivitiesBatch(backupData.activities, mode, '备份恢复导入');
    }

    return {
      success: true,
      message: `数据恢复完成！已同步恢复 ${backupData.products?.length || 0} 条产品与 ${backupData.activities?.length || 0} 条活动记录`,
    };
  }

  // ==========================================
  // 6. Logs & Jobs
  // ==========================================
  public static async getAuditLogs(): Promise<{ logs: AuditLog[] }> {
    try {
      const { data, isFallback } = await this.request<{ logs: AuditLog[] }>('/audit-logs');
      if (!isFallback && data) {
        return data;
      }
    } catch {
      // fallback
    }

    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return { logs: raw ? JSON.parse(raw) : [] };
  }

  public static async getImportJobs(): Promise<{ jobs: ImportJob[] }> {
    try {
      const { data, isFallback } = await this.request<{ jobs: ImportJob[] }>('/import-jobs');
      if (!isFallback && data) {
        return data;
      }
    } catch {
      // fallback
    }

    const raw = localStorage.getItem(JOBS_STORAGE_KEY);
    return { jobs: raw ? JSON.parse(raw) : [] };
  }
}
