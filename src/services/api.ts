import {
  UserProfile,
  ProductRecord,
  ActivityRecord,
  ImportJob,
  AuditLog,
  UserRole,
} from '../types';

const TOKEN_KEY = 'cyclepro_auth_token_v3';

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
    }
  }

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(`/api${endpoint}`, {
        ...options,
        headers,
      });

      if (!res.ok) {
        let errorMsg = `请求失败 (${res.status})`;
        try {
          const data = await res.json();
          if (data && data.error) {
            errorMsg = data.error;
          }
        } catch {
          // keep status error
        }
        throw new Error(errorMsg);
      }

      return (await res.json()) as T;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('网络连接异常或服务端未响应，请检查云端连接');
      }
      throw err;
    }
  }

  // --- Auth ---
  public static async login(
    email: string,
    password: string
  ): Promise<{ user: UserProfile; token: string }> {
    const res = await this.request<{ user: UserProfile; token: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }
    );
    this.setToken(res.token);
    return res;
  }

  public static async register(
    email: string,
    password: string,
    name: string,
    role: UserRole = 'manager',
    department: string = '运营部'
  ): Promise<{ user: UserProfile; token: string }> {
    const res = await this.request<{ user: UserProfile; token: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password, name, role, department }),
      }
    );
    this.setToken(res.token);
    return res;
  }

  public static async getCurrentUser(): Promise<UserProfile> {
    const res = await this.request<{ user: UserProfile }>('/auth/me');
    return res.user;
  }

  public static async switchDemo(
    role: UserRole
  ): Promise<{ user: UserProfile; token: string }> {
    const res = await this.request<{ user: UserProfile; token: string }>(
      '/auth/switch-demo',
      {
        method: 'POST',
        body: JSON.stringify({ role }),
      }
    );
    this.setToken(res.token);
    return res;
  }

  public static logout(): void {
    this.setToken(null);
  }

  // --- Data Sync ---
  public static async fetchDataOverview(): Promise<{
    products: ProductRecord[];
    activities: ActivityRecord[];
    serverTime: string;
  }> {
    return this.request<{
      products: ProductRecord[];
      activities: ActivityRecord[];
      serverTime: string;
    }>('/data/overview');
  }

  // --- Products Batch Import ---
  public static async importProductsBatch(
    items: Array<Omit<ProductRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
    mode: 'append' | 'replace' = 'append',
    fileName?: string
  ): Promise<{ success: boolean; successCount: number; replacedCount: number; job: ImportJob }> {
    return this.request('/products/batch', {
      method: 'POST',
      body: JSON.stringify({ items, mode, fileName }),
    });
  }

  // --- Activities Batch Import ---
  public static async importActivitiesBatch(
    items: Array<Omit<ActivityRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
    mode: 'append' | 'replace' = 'append',
    fileName?: string
  ): Promise<{ success: boolean; successCount: number; replacedCount: number; job: ImportJob }> {
    return this.request('/activities/batch', {
      method: 'POST',
      body: JSON.stringify({ items, mode, fileName }),
    });
  }

  // --- Danger Clear Storage ---
  public static async clearData(
    confirmText: string
  ): Promise<{ success: boolean; message: string; clearedProducts: number; clearedActivities: number }> {
    return this.request('/data/clear', {
      method: 'POST',
      body: JSON.stringify({ confirmText }),
    });
  }

  // --- Backup & Restore ---
  public static async getBackup(): Promise<any> {
    return this.request('/data/backup');
  }

  public static async restoreBackup(
    backupData: { products: any[]; activities: any[] },
    mode: 'append' | 'replace' = 'replace'
  ): Promise<{ success: boolean; message: string }> {
    return this.request('/data/restore', {
      method: 'POST',
      body: JSON.stringify({ ...backupData, mode }),
    });
  }

  // --- Logs & Jobs ---
  public static async getAuditLogs(): Promise<{ logs: AuditLog[] }> {
    return this.request('/audit-logs');
  }

  public static async getImportJobs(): Promise<{ jobs: ImportJob[] }> {
    return this.request('/import-jobs');
  }
}
