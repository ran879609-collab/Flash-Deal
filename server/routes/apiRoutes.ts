import { Router, Response } from 'express';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest, generateToken, requireRole } from '../auth';
import { ProductRecord, ActivityRecord, UserRole } from '../../src/types';

export const apiRouter = Router();

// ==========================================
// 1. Authentication Routes
// ==========================================
apiRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '请输入邮箱和密码' });
  }

  const user = db.findUserByEmail(email);
  if (!user || !db.verifyPassword(user, password)) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }

  const { passwordHash, ...profile } = user;
  const token = generateToken(profile);

  db.createAuditLog(profile.id, 'USER_LOGIN', 'auth', { email: profile.email });

  return res.json({ user: profile, token });
});

apiRouter.post('/auth/register', (req, res) => {
  const { email, password, name, role, department } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: '请完整填写注册信息（邮箱、密码、姓名）' });
  }

  try {
    const profile = db.createUser({
      email,
      password,
      name,
      role: role || 'manager',
      department: department || '运营中心',
    });
    const token = generateToken(profile);

    db.createAuditLog(profile.id, 'USER_REGISTER', 'auth', { email: profile.email, role: profile.role });

    return res.json({ user: profile, token });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || '注册失败' });
  }
});

apiRouter.get('/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  return res.json({ user: req.user });
});

apiRouter.get('/auth/users', (req, res) => {
  const users = db.getAllUsers();
  return res.json({ users });
});

apiRouter.post('/auth/switch-demo', (req, res) => {
  const { role } = req.body as { role: UserRole };
  const targetEmail =
    role === 'admin'
      ? 'admin@cyclepro.com'
      : role === 'analyst'
      ? 'analyst@cyclepro.com'
      : 'manager@cyclepro.com';

  const user = db.findUserByEmail(targetEmail);
  if (!user) {
    return res.status(404).json({ error: '预设演示账户不存在' });
  }

  const { passwordHash, ...profile } = user;
  const token = generateToken(profile);

  return res.json({ user: profile, token });
});

// ==========================================
// 2. Data Overview & Combined Sync
// ==========================================
apiRouter.get('/data/overview', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const products = db.getProducts(userId);
  const activities = db.getActivities(userId);

  return res.json({
    products,
    activities,
    serverTime: new Date().toISOString(),
  });
});

// ==========================================
// 3. Products Endpoints
// ==========================================
apiRouter.get('/products', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const products = db.getProducts(userId);
  return res.json({ products, total: products.length });
});

apiRouter.post(
  '/products/batch',
  authenticate,
  requireRole(['admin', 'manager']),
  (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { items, mode, fileName } = req.body as {
      items: Array<Omit<ProductRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;
      mode?: 'append' | 'replace';
      fileName?: string;
    };

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: '数据格式有误，必须为数组' });
    }

    try {
      const result = db.batchUpsertProducts(userId, items, mode || 'append');

      const job = db.createImportJob({
        userId,
        fileName: fileName || (mode === 'replace' ? '批量替换产品表' : '批量追加产品表'),
        fileType: 'product',
        mode: mode || 'append',
        totalRows: items.length,
        successRows: result.successCount,
        errorRows: 0,
        status: 'completed',
        errorSummary: `成功导入 ${result.successCount} 条产品数据（其中更新覆盖 ${result.replacedCount} 条）`,
      });

      db.createAuditLog(userId, mode === 'replace' ? 'PRODUCT_REPLACE' : 'PRODUCT_APPEND', 'product', {
        rowCount: items.length,
        result,
        jobId: job.id,
      });

      return res.json({
        success: true,
        successCount: result.successCount,
        replacedCount: result.replacedCount,
        job,
      });
    } catch (err: any) {
      return res.status(500).json({ error: `产品数据导入失败: ${err.message}` });
    }
  }
);

// ==========================================
// 4. Activity Records Endpoints
// ==========================================
apiRouter.get('/activities', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const activities = db.getActivities(userId);
  return res.json({ activities, total: activities.length });
});

apiRouter.post(
  '/activities/batch',
  authenticate,
  requireRole(['admin', 'manager']),
  (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { items, mode, fileName } = req.body as {
      items: Array<Omit<ActivityRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>;
      mode?: 'append' | 'replace';
      fileName?: string;
    };

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: '数据格式有误，必须为数组' });
    }

    try {
      const result = db.batchUpsertActivities(userId, items, mode || 'append');

      const job = db.createImportJob({
        userId,
        fileName: fileName || (mode === 'replace' ? '批量替换活动表' : '批量追加活动表'),
        fileType: 'activity',
        mode: mode || 'append',
        totalRows: items.length,
        successRows: result.successCount,
        errorRows: 0,
        status: 'completed',
        errorSummary: `成功导入 ${result.successCount} 条活动记录（其中更新覆盖 ${result.replacedCount} 条）`,
      });

      db.createAuditLog(userId, mode === 'replace' ? 'ACTIVITY_REPLACE' : 'ACTIVITY_APPEND', 'activity', {
        rowCount: items.length,
        result,
        jobId: job.id,
      });

      return res.json({
        success: true,
        successCount: result.successCount,
        replacedCount: result.replacedCount,
        job,
      });
    } catch (err: any) {
      return res.status(500).json({ error: `活动数据导入失败: ${err.message}` });
    }
  }
);

// ==========================================
// 5. Danger: Clear Storage with Second Confirmation
// ==========================================
apiRouter.post(
  '/data/clear',
  authenticate,
  requireRole(['admin']),
  (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { confirmText } = req.body;

    if (confirmText !== 'CONFIRM_CLEAR_ALL') {
      return res.status(400).json({
        error: '安全校验未通过：请输入 CONFIRM_CLEAR_ALL 以确认彻底清空云端存储',
      });
    }

    const { clearedProducts, clearedActivities } = db.clearUserData(userId);

    db.createAuditLog(userId, 'DATA_PURGE_CLEAR', 'database', {
      clearedProducts,
      clearedActivities,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: `已成功清空云端存储！共移除 ${clearedProducts} 条产品资料及 ${clearedActivities} 条活动记录`,
      clearedProducts,
      clearedActivities,
    });
  }
);

// ==========================================
// 6. Backup & Restore
// ==========================================
apiRouter.get('/data/backup', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const products = db.getProducts(userId);
  const activities = db.getActivities(userId);

  db.createAuditLog(userId, 'DATA_BACKUP_EXPORT', 'backup', {
    productCount: products.length,
    activityCount: activities.length,
  });

  return res.json({
    version: 'CyclePro-Pro-v3.0',
    exportTime: new Date().toISOString(),
    user: req.user,
    data: {
      products,
      activities,
    },
  });
});

apiRouter.post(
  '/data/restore',
  authenticate,
  requireRole(['admin', 'manager']),
  (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { products, activities, mode } = req.body;

    let prodCount = 0;
    let actCount = 0;

    if (Array.isArray(products) && products.length > 0) {
      const resP = db.batchUpsertProducts(userId, products, mode || 'replace');
      prodCount = resP.successCount;
    }

    if (Array.isArray(activities) && activities.length > 0) {
      const resA = db.batchUpsertActivities(userId, activities, mode || 'replace');
      actCount = resA.successCount;
    }

    db.createAuditLog(userId, 'DATA_RESTORE_IMPORT', 'backup', {
      restoredProducts: prodCount,
      restoredActivities: actCount,
      mode: mode || 'replace',
    });

    return res.json({
      success: true,
      message: `恢复完成！导入产品 ${prodCount} 条，活动记录 ${actCount} 条`,
      prodCount,
      actCount,
    });
  }
);

// ==========================================
// 7. Audit Logs & Import Jobs
// ==========================================
apiRouter.get('/audit-logs', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.role === 'admin' ? undefined : req.user!.id;
  const logs = db.getAuditLogs(userId);
  return res.json({ logs });
});

apiRouter.get('/import-jobs', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const jobs = db.getImportJobs(userId);
  return res.json({ jobs });
});
