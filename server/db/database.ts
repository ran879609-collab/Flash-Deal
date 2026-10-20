import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ProductRecord, ActivityRecord, UserProfile, ImportJob, AuditLog, UserRole } from '../../src/types';

export interface StoredUser extends UserProfile {
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseState {
  users: StoredUser[];
  products: ProductRecord[];
  activities: ActivityRecord[];
  importJobs: ImportJob[];
  auditLogs: AuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.resolve(DATA_DIR, 'cyclepro_db.json');

// Ensure storage directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_cyclepro_salt_2026').digest('hex');
}

export class PersistentDatabase {
  private state: DatabaseState = {
    users: [],
    products: [],
    activities: [],
    importJobs: [],
    auditLogs: [],
  };

  private writeScheduled = false;

  constructor() {
    this.loadFromDisk();
    if (this.state.users.length === 0) {
      this.seedDefaultData();
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.state = {
          users: parsed.users || [],
          products: parsed.products || [],
          activities: parsed.activities || [],
          importJobs: parsed.importJobs || [],
          auditLogs: parsed.auditLogs || [],
        };
      }
    } catch (err) {
      console.error('Failed to load database from disk, initializing fresh:', err);
    }
  }

  private persist(): void {
    if (this.writeScheduled) return;
    this.writeScheduled = true;
    setTimeout(() => {
      try {
        const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
        fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf-8');
        fs.renameSync(tempPath, DB_FILE);
      } catch (err) {
        console.error('Failed to write database to disk:', err);
      } finally {
        this.writeScheduled = false;
      }
    }, 100);
  }

  private seedDefaultData(): void {
    const adminId = 'u_admin_001';
    const managerId = 'u_manager_002';
    const analystId = 'u_analyst_003';

    const now = new Date().toISOString();

    const defaultUsers: StoredUser[] = [
      {
        id: adminId,
        email: 'admin@cyclepro.com',
        name: '张总 (系统管理员)',
        role: 'admin',
        department: '电商运营中心',
        passwordHash: hashPassword('admin123456'),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: managerId,
        email: 'manager@cyclepro.com',
        name: '李经理 (运营主管)',
        role: 'manager',
        department: '北美精品运营组',
        passwordHash: hashPassword('manager123456'),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: analystId,
        email: 'analyst@cyclepro.com',
        name: '王分析师 (数据分析)',
        role: 'analyst',
        department: '商业分析中心',
        passwordHash: hashPassword('analyst123456'),
        createdAt: now,
        updatedAt: now,
      },
    ];

    this.state.users = defaultUsers;

    // Seed Demo Products for all seeded users so they have live data immediately
    const demoProductsRaw = [
      { originalSku: 'TZ-P0211-BLUE', splitSku: '2in1', type: 'E-训狗器', itemId: '883281869' },
      { originalSku: 'TZ-P0211-GREEN', splitSku: '2in1', type: 'E-训狗器', itemId: '307878055' },
      { originalSku: 'PET1005-Black-XS', splitSku: 'PET1005', type: 'I-发光项圈', itemId: '5559267016' },
      { originalSku: 'PET1005-Black-S', splitSku: 'PET1005', type: 'I-发光项圈', itemId: '718219317' },
      { originalSku: 'PET1005-Blue-M', splitSku: 'PET1005', type: 'I-发光项圈', itemId: '510192494' },
      { originalSku: 'DC3200-Black-L', splitSku: 'DC3200', type: 'I-发光项圈', itemId: '2710278597' },
      { originalSku: 'PRO-SOLAR-001', splitSku: 'SOLAR-01', type: 'S-太阳能户外灯', itemId: '992182741' },
      { originalSku: 'AUTO-FEEDER-WIFI', splitSku: 'AF-WIFI', type: 'F-智能喂食器', itemId: '109283742' },
    ];

    const seededProducts: ProductRecord[] = [];
    [adminId, managerId, analystId].forEach((uid) => {
      demoProductsRaw.forEach((p, idx) => {
        seededProducts.push({
          id: `p_${uid}_${idx + 1}`,
          userId: uid,
          originalSku: p.originalSku,
          splitSku: p.splitSku,
          type: p.type,
          itemId: p.itemId,
          createdAt: now,
          updatedAt: now,
        });
      });
    });

    this.state.products = seededProducts;

    // Seed Demo Activities
    const seededActivities: ActivityRecord[] = [];
    const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    const skus = ['TZ-P0211-BLUE', 'TZ-P0211-GREEN', 'PET1005-Black-XS', 'PET1005-Black-S', 'PET1005-Blue-M', 'DC3200-Black-L'];

    [adminId, managerId, analystId].forEach((uid) => {
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

          seededActivities.push({
            id: `act_${uid}_${idx}_${w}`,
            userId: uid,
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
            createdAt: now,
            updatedAt: now,
          });
        });
      });
    });

    this.state.activities = seededActivities;
    this.persist();
  }

  // --- Users & Profiles ---
  public findUserByEmail(email: string): StoredUser | undefined {
    return this.state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  public findUserById(id: string): StoredUser | undefined {
    return this.state.users.find((u) => u.id === id);
  }

  public getAllUsers(): UserProfile[] {
    return this.state.users.map(({ passwordHash, ...user }) => user);
  }

  public createUser(userData: {
    email: string;
    name: string;
    password: string;
    role?: UserRole;
    department?: string;
  }): UserProfile {
    const existing = this.findUserByEmail(userData.email);
    if (existing) {
      throw new Error('该邮箱已注册');
    }

    const id = `u_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const newUser: StoredUser = {
      id,
      email: userData.email.toLowerCase().trim(),
      name: userData.name.trim(),
      role: userData.role || 'manager',
      department: userData.department || '运营部',
      passwordHash: hashPassword(userData.password),
      createdAt: now,
      updatedAt: now,
    };

    this.state.users.push(newUser);
    this.persist();

    const { passwordHash, ...safeProfile } = newUser;
    return safeProfile;
  }

  public verifyPassword(user: StoredUser, passwordInput: string): boolean {
    return user.passwordHash === hashPassword(passwordInput);
  }

  // --- Products ---
  public getProducts(userId: string): ProductRecord[] {
    return this.state.products.filter((p) => p.userId === userId);
  }

  public batchUpsertProducts(
    userId: string,
    items: Array<Omit<ProductRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
    mode: 'append' | 'replace' = 'append'
  ): { successCount: number; replacedCount: number } {
    const now = new Date().toISOString();
    let current = this.state.products.filter((p) => p.userId === userId);

    if (mode === 'replace') {
      // Remove all current products for this user
      this.state.products = this.state.products.filter((p) => p.userId !== userId);
      current = [];
    }

    const map = new Map<string, ProductRecord>();
    current.forEach((p) => map.set(p.originalSku, p));

    let replacedCount = 0;
    let newCount = 0;

    items.forEach((item) => {
      const sku = (item.originalSku || item.splitSku || '').trim();
      if (!sku) return;

      const existing = map.get(sku);
      if (existing) {
        existing.splitSku = item.splitSku || existing.splitSku;
        existing.type = item.type || existing.type;
        existing.itemId = item.itemId || existing.itemId;
        existing.updatedAt = now;
        replacedCount++;
      } else {
        const newRecord: ProductRecord = {
          id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          userId,
          originalSku: sku,
          splitSku: item.splitSku || '',
          type: item.type || '',
          itemId: item.itemId || '',
          createdAt: now,
          updatedAt: now,
        };
        map.set(sku, newRecord);
        newCount++;
      }
    });

    // Rebuild user products
    const otherProducts = this.state.products.filter((p) => p.userId !== userId);
    this.state.products = [...otherProducts, ...Array.from(map.values())];
    this.persist();

    return { successCount: newCount + replacedCount, replacedCount };
  }

  // --- Activities ---
  public getActivities(userId: string): ActivityRecord[] {
    return this.state.activities.filter((a) => a.userId === userId);
  }

  public batchUpsertActivities(
    userId: string,
    items: Array<Omit<ActivityRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
    mode: 'append' | 'replace' = 'append'
  ): { successCount: number; replacedCount: number } {
    const now = new Date().toISOString();
    let current = this.state.activities.filter((a) => a.userId === userId);

    if (mode === 'replace') {
      this.state.activities = this.state.activities.filter((a) => a.userId !== userId);
      current = [];
    }

    // Key by sku + week
    const map = new Map<string, ActivityRecord>();
    current.forEach((a) => map.set(`${a.sku}_${a.week}`, a));

    let replacedCount = 0;
    let newCount = 0;

    items.forEach((item) => {
      const sku = (item.sku || item.subId || '').trim();
      const week = (item.week || '').trim();
      if (!sku || !week) return;

      const key = `${sku}_${week}`;
      const existing = map.get(key);

      const priceNum =
        typeof item.price === 'number' && !isNaN(item.price)
          ? item.price
          : item.price !== undefined && item.price !== null && (item.price as unknown) !== ''
          ? parseFloat(String(item.price))
          : null;

      if (existing) {
        existing.subId = item.subId || existing.subId;
        existing.parentId = item.parentId || existing.parentId;
        existing.avgOrders = item.avgOrders !== undefined ? item.avgOrders : existing.avgOrders;
        existing.sellingPrice = item.sellingPrice !== undefined ? item.sellingPrice : existing.sellingPrice;
        existing.expectedOrders = item.expectedOrders !== undefined ? item.expectedOrders : existing.expectedOrders;
        existing.price = priceNum !== null && !isNaN(priceNum) ? priceNum : existing.price;
        existing.remark = item.remark !== undefined ? item.remark : existing.remark;
        existing.updatedAt = now;
        replacedCount++;
      } else {
        const newRecord: ActivityRecord = {
          id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          userId,
          year: item.year,
          week: item.week,
          sku,
          subId: item.subId || '',
          parentId: item.parentId || '',
          avgOrders: item.avgOrders ?? '',
          sellingPrice: item.sellingPrice ?? '',
          expectedOrders: item.expectedOrders ?? '',
          price: priceNum !== null && !isNaN(priceNum) ? priceNum : null,
          remark: item.remark || '',
          createdAt: now,
          updatedAt: now,
        };
        map.set(key, newRecord);
        newCount++;
      }
    });

    const otherActivities = this.state.activities.filter((a) => a.userId !== userId);
    this.state.activities = [...otherActivities, ...Array.from(map.values())];
    this.persist();

    return { successCount: newCount + replacedCount, replacedCount };
  }

  // --- Clear User Data ---
  public clearUserData(userId: string): { clearedProducts: number; clearedActivities: number } {
    const productCount = this.state.products.filter((p) => p.userId === userId).length;
    const activityCount = this.state.activities.filter((a) => a.userId === userId).length;

    this.state.products = this.state.products.filter((p) => p.userId !== userId);
    this.state.activities = this.state.activities.filter((a) => a.userId !== userId);
    this.persist();

    return { clearedProducts: productCount, clearedActivities: activityCount };
  }

  // --- Import Jobs & Audit Logs ---
  public createImportJob(job: Omit<ImportJob, 'id' | 'createdAt'>): ImportJob {
    const newJob: ImportJob = {
      ...job,
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    this.state.importJobs.unshift(newJob);
    if (this.state.importJobs.length > 200) {
      this.state.importJobs = this.state.importJobs.slice(0, 200);
    }
    this.persist();
    return newJob;
  }

  public getImportJobs(userId: string): ImportJob[] {
    return this.state.importJobs.filter((j) => j.userId === userId);
  }

  public createAuditLog(
    userId: string,
    action: string,
    entityType: string,
    details: Record<string, unknown>
  ): AuditLog {
    const user = this.findUserById(userId);
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      userEmail: user?.email || 'unknown',
      action,
      entityType,
      details,
      createdAt: new Date().toISOString(),
    };
    this.state.auditLogs.unshift(newLog);
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
    this.persist();
    return newLog;
  }

  public getAuditLogs(userId?: string): AuditLog[] {
    if (userId) {
      return this.state.auditLogs.filter((l) => l.userId === userId);
    }
    return this.state.auditLogs;
  }
}

export const db = new PersistentDatabase();
