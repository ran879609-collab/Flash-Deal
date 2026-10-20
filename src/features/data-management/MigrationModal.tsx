import React, { useState, useEffect } from 'react';
import { ApiService } from '../../services/api';
import { Database, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw, X, Sparkles, Upload } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MigrationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [legacyProductCount, setLegacyProductCount] = useState(0);
  const [legacyActivityCount, setLegacyActivityCount] = useState(0);
  const [legacyProducts, setLegacyProducts] = useState<any[]>([]);
  const [legacyActivities, setLegacyActivities] = useState<any[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Scan localStorage
    try {
      const prodRaw = localStorage.getItem('cyclepro_product_data_v3');
      const actRaw = localStorage.getItem('cyclepro_activity_data_v3');

      const parsedProd = prodRaw ? JSON.parse(prodRaw) : [];
      const parsedAct = actRaw ? JSON.parse(actRaw) : [];

      setLegacyProductCount(Array.isArray(parsedProd) ? parsedProd.length : 0);
      setLegacyActivityCount(Array.isArray(parsedAct) ? parsedAct.length : 0);
      setLegacyProducts(Array.isArray(parsedProd) ? parsedProd : []);
      setLegacyActivities(Array.isArray(parsedAct) ? parsedAct : []);
    } catch (err: any) {
      setErrorMsg(`读取本地旧版数据失败: ${err.message}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartMigration = async () => {
    if (legacyProducts.length === 0 && legacyActivities.length === 0) {
      setErrorMsg('未检测到可迁移的旧版本地数据');
      return;
    }

    setIsMigrating(true);
    setErrorMsg(null);
    setMigrationStatus('正在将产品与活动数据校验并上传至云端数据库...');

    try {
      if (legacyProducts.length > 0) {
        await ApiService.importProductsBatch(
          legacyProducts,
          'append',
          '旧版localStorage数据自动迁移'
        );
      }

      if (legacyActivities.length > 0) {
        await ApiService.importActivitiesBatch(
          legacyActivities,
          'append',
          '旧版localStorage数据自动迁移'
        );
      }

      setMigrationStatus(
        `🎉 迁移成功！已同步 ${legacyProducts.length} 条产品与 ${legacyActivities.length} 条活动数据到云端。`
      );
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(`迁移失败: ${err.message || '网络连接异常'}`);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleImportLegacyJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const prods = json.products || json.data?.products || [];
        const acts = json.activities || json.data?.activities || [];

        setLegacyProducts(prods);
        setLegacyActivities(acts);
        setLegacyProductCount(prods.length);
        setLegacyActivityCount(acts.length);
        setMigrationStatus(`已加载外部备份文件：${prods.length} 条产品，${acts.length} 条活动`);
      } catch (err: any) {
        setErrorMsg('文件格式非合规 JSON 备份');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                旧版本地数据云端迁移向导
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                支持从浏览器 localStorage (v3) 或跨设备备份一键迁移至云端数据库
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-slate-700 block">
              当前浏览器 localStorage 检测结果:
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[11px] block">
                  旧版产品数据 (v3)
                </span>
                <span className="text-base font-bold text-slate-900">
                  {legacyProductCount} 条
                </span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[11px] block">
                  旧版活动记录 (v3)
                </span>
                <span className="text-base font-bold text-blue-700">
                  {legacyActivityCount} 条
                </span>
              </div>
            </div>
          </div>

          {/* Cross device upload alternative */}
          <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-900">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>跨设备迁移？可直接导入旧版 JSON 备份文件</span>
            </div>
            <label className="cursor-pointer px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              选择 JSON
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportLegacyJSON}
              />
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {migrationStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{migrationStatus}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            取消
          </button>
          <button
            onClick={handleStartMigration}
            disabled={
              (legacyProductCount === 0 && legacyActivityCount === 0) ||
              isMigrating
            }
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-xs transition"
          >
            {isMigrating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                正在迁移数据...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                开始迁移到云端
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
