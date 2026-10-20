import { UserProfile, ProductRecord, ActivityRecord } from '../types';

const SUPABASE_CONFIG_KEY = 'cyclepro_supabase_config_v3';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

export class SupabaseService {
  public static getConfig(): SupabaseConfig | null {
    try {
      const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.url && parsed.anonKey && parsed.enabled) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    // Check if injected in env
    const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
    const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    if (envUrl && envKey) {
      return { url: envUrl, anonKey: envKey, enabled: true };
    }

    return null;
  }

  public static setConfig(config: SupabaseConfig | null): void {
    if (config && config.url && config.anonKey) {
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(SUPABASE_CONFIG_KEY);
    }
  }

  public static isConfigured(): boolean {
    const config = this.getConfig();
    return Boolean(config && config.enabled && config.url && config.anonKey);
  }

  private static getHeaders(config: SupabaseConfig) {
    return {
      'Content-Type': 'application/json',
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      Prefer: 'return=representation',
    };
  }

  // --- Auth: Find user by email in Supabase ---
  public static async findUserByEmail(email: string): Promise<any | null> {
    const config = this.getConfig();
    if (!config) return null;

    const cleanUrl = config.url.replace(/\/+$/, '');
    const res = await fetch(
      `${cleanUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(email.trim().toLowerCase())}`,
      {
        headers: this.getHeaders(config),
      }
    );

    if (!res.ok) return null;
    const users = await res.json();
    return Array.isArray(users) && users.length > 0 ? users[0] : null;
  }

  // --- Auth: Register user in Supabase ---
  public static async registerUser(userData: {
    email: string;
    passwordHash: string;
    name: string;
    role: string;
    department?: string;
  }): Promise<UserProfile | null> {
    const config = this.getConfig();
    if (!config) return null;

    const cleanUrl = config.url.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: this.getHeaders(config),
      body: JSON.stringify({
        email: userData.email.trim().toLowerCase(),
        password_hash: userData.passwordHash,
        name: userData.name.trim(),
        role: userData.role || 'manager',
        department: userData.department || '运营中心',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Supabase 注册写入失败 (${res.status})`);
    }

    const created = await res.json();
    const user = Array.isArray(created) ? created[0] : created;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    };
  }

  // --- Products: Fetch from Supabase ---
  public static async fetchProducts(userId: string): Promise<ProductRecord[] | null> {
    const config = this.getConfig();
    if (!config) return null;

    const cleanUrl = config.url.replace(/\/+$/, '');
    const res = await fetch(
      `${cleanUrl}/rest/v1/products?select=*&order=created_at.desc`,
      {
        headers: this.getHeaders(config),
      }
    );

    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;

    return rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id || userId,
      originalSku: r.original_sku,
      splitSku: r.split_sku || '',
      type: r.type || '',
      itemId: r.item_id || '',
    }));
  }

  // --- Activities: Fetch from Supabase ---
  public static async fetchActivities(userId: string): Promise<ActivityRecord[] | null> {
    const config = this.getConfig();
    if (!config) return null;

    const cleanUrl = config.url.replace(/\/+$/, '');
    const res = await fetch(
      `${cleanUrl}/rest/v1/activity_records?select=*&order=year.asc,week_num.asc`,
      {
        headers: this.getHeaders(config),
      }
    );

    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;

    return rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id || userId,
      year: r.year,
      week: r.week,
      sku: r.sku,
      subId: r.sub_id || '',
      parentId: r.parent_id || '',
      avgOrders: r.avg_orders ?? '',
      sellingPrice: r.selling_price ?? '',
      expectedOrders: r.expected_orders ?? '',
      price: r.price !== null && r.price !== undefined ? Number(r.price) : null,
      remark: r.remark || '',
    }));
  }
}
