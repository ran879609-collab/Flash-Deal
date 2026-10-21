import React, { useState, useEffect } from 'react';
import { ApiService } from '../../services/api';
import { SupabaseService } from '../../services/supabase';
import { AuditLog, ImportJob, UserProfile } from '../../types';
import {
  Database,
  X,
  History,
  FileText,
  AlertOctagon,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Cloud,
  Key,
  Copy,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  productCount: number;
  activityCount: number;
  onDataReset: () => void;
}

export const DataManagementModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  productCount,
  activityCount,
  onDataReset,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'supabase' | 'jobs' | 'audit' | 'danger'>('overview');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Supabase Cloud Config State
  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    return localStorage.getItem('cyclepro_supabase_config_v3')
      ? JSON.parse(localStorage.getItem('cyclepro_supabase_config_v3') || '{}').url || ''
      : '';
  });
  const [supabaseKey, setSupabaseKey] = useState(() => {
    return localStorage.getItem('cyclepro_supabase_config_v3')
      ? JSON.parse(localStorage.getItem('cyclepro_supabase_config_v3') || '{}').anonKey || ''
      : '';
  });
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState(() => {
    return localStorage.getItem('cyclepro_supabase_config_v3')
      ? JSON.parse(localStorage.getItem('cyclepro_supabase_config_v3') || '{}').enabled || false
      : false;
  });
  const [supabaseSavedMsg, setSupabaseSavedMsg] = useState<string | null>(null);

  // Danger clear state
  const [confirmInput, setConfirmInput] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearSuccess, setClearSuccess] = useState<string | null>(null);

  // Restore state
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);

  // Quick Cross-Browser Sync State
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [copiedSyncCode, setCopiedSyncCode] = useState(false);
  const [showSyncInput, setShowSyncInput] = useState(false);
  const [syncCodeStatus, setSyncCodeStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const [logsRes, jobsRes] = await Promise.all([
          ApiService.getAuditLogs(),
          ApiService.getImportJobs(),
        ]);
        setAuditLogs(logsRes.logs || []);
        setImportJobs(jobsRes.jobs || []);
      } catch (err) {
        console.error('Failed to load logs', err);
      } finally {
        setIsLoadingLogs(false);
      }
    };

    loadLogs();
  }, [isOpen]);

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'admin';

  // Backup Export
  const handleExportBackup = async () => {
    try {
      const backup = await ApiService.getBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CyclePro_云端备份_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`导出备份失败: ${err.message}`);
    }
  };

  // Restore Backup
  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsRestoring(true);
        setRestoreMsg(null);
        const json = JSON.parse(event.target?.result as string);
        
        // If it's a full sync package:
        if (json.version?.includes('CyclePro-Full-Sync') || (json.user && json.products)) {
          const res = ApiService.importAccountSyncCode(JSON.stringify(json));
          setRestoreMsg(
            `✅ 跨设备完整同步包导入成功！已恢复账户 ${res.user?.name || res.user?.email || ''} 及 ${res.productsCount} 条产品与 ${res.activitiesCount} 条活动数据`
          );
          onDataReset();
          return;
        }

        const data = json.data || json;
        const res = await ApiService.restoreBackup(data, 'replace');
        setRestoreMsg(res.message);
        onDataReset();
      } catch (err: any) {
        setRestoreMsg(`恢复失败: ${err.message || '文件非有效备份'}`);
      } finally {
        setIsRestoring(false);
      }
    };
    reader.readAsText(file);
  };

  // Cross-Browser Sync handlers
  const handleCopySyncCode = () => {
    try {
      const code = ApiService.exportAccountSyncCode(true);
      navigator.clipboard.writeText(code);
      setCopiedSyncCode(true);
      setSyncCodeStatus('✅ 跨设备完整数据同步码已复制到剪贴板！可前往新浏览器无缝还原全部账户与数据。');
      setTimeout(() => setCopiedSyncCode(false), 3500);
    } catch (err: any) {
      setSyncCodeStatus(`❌ 导出失败: ${err.message}`);
    }
  };

  const handleDownloadSyncFile = () => {
    try {
      const jsonStr = ApiService.exportSyncPackageJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CyclePro_完整同步包_${currentUser?.name || currentUser?.email || 'user'}_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setSyncCodeStatus('✅ 完整数据同步文件已生成并下载！在新浏览器上传该文件即可一键还原。');
    } catch (err: any) {
      setSyncCodeStatus(`❌ 导出失败: ${err.message}`);
    }
  };

  const handleApplySyncCode = () => {
    if (!syncCodeInput.trim()) {
      setSyncCodeStatus('⚠️ 请先粘贴同步码');
      return;
    }
    try {
      const result = ApiService.importAccountSyncCode(syncCodeInput.trim());
      setSyncCodeStatus(
        `🎉 同步成功！已导入账户【${result.user?.name || result.user?.email || ''}】以及 ${result.productsCount} 条产品、${result.activitiesCount} 条活动记录。`
      );
      setSyncCodeInput('');
      setShowSyncInput(false);
      onDataReset();
    } catch (err: any) {
      setSyncCodeStatus(`❌ 同步失败: ${err.message}`);
    }
  };

  // Save Supabase Configuration
  const handleSaveSupabase = () => {
    if (isSupabaseEnabled && (!supabaseUrl.trim() || !supabaseKey.trim())) {
      setSupabaseSavedMsg('⚠️ 请完整填写 Supabase Project URL 与 Anon Key');
      return;
    }

    SupabaseService.setConfig({
      url: supabaseUrl.trim(),
      anonKey: supabaseKey.trim(),
      enabled: isSupabaseEnabled,
    });

    setSupabaseSavedMsg(
      isSupabaseEnabled
        ? '✅ Supabase 云端数据库配置已保存！跨设备同步已开启。'
        : '已关闭 Supabase 云端同步，切换为本地存储模式。'
    );

    setTimeout(() => {
      onDataReset();
    }, 800);
  };

  // Clear Storage Execution
  const handleExecuteClear = async () => {
    if (confirmInput.trim() !== 'CONFIRM_CLEAR_ALL') {
      setClearError('请输入完全一致的确认口令: CONFIRM_CLEAR_ALL');
      return;
    }

    if (!isAdmin) {
      setClearError('权限不足：只有管理员账户具备清空存储权限');
      return;
    }

    setIsClearing(true);
    setClearError(null);
    setClearSuccess(null);

    try {
      const res = await ApiService.clearData('CONFIRM_CLEAR_ALL');
      setClearSuccess(res.message);
      setConfirmInput('');
      onDataReset();
    } catch (err: any) {
      setClearError(err.message || '清空操作失败');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                云端数据中心与权限管理
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                租户归属：{currentUser?.email} ({currentUser?.role.toUpperCase()})
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

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50 text-xs font-medium gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-700 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4" />
            存储概览与备份
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'supabase'
                ? 'border-blue-600 text-blue-700 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-4 h-4 text-sky-500" />
            云端数据库 (Supabase)
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'jobs'
                ? 'border-blue-600 text-blue-700 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            导入任务记录 ({importJobs.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-700 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            审计变更日志 ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={`py-3 px-3.5 border-b-2 transition flex items-center gap-1.5 ml-auto ${
              activeTab === 'danger'
                ? 'border-rose-600 text-rose-700 font-semibold'
                : 'border-transparent text-rose-600 hover:text-rose-800'
            }`}
          >
            <AlertOctagon className="w-4 h-4 text-rose-600" />
            危险操作区
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-slate-700">
          {/* TAB 1: OVERVIEW & BACKUP */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-slate-500 text-[11px] block">
                    云端产品资料库
                  </span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block">
                    {productCount} <span className="text-xs font-normal">条</span>
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    包含原始SKU、分裂SKU、类型及Item ID
                  </span>
                </div>
                <div className="p-4 bg-blue-50/50 border border-blue-200/80 rounded-xl">
                  <span className="text-blue-700 text-[11px] block">
                    云端活动周期记录
                  </span>
                  <span className="text-2xl font-bold text-blue-700 mt-1 block">
                    {activityCount} <span className="text-xs font-normal">条</span>
                  </span>
                  <span className="text-[11px] text-blue-600/70 mt-1 block">
                    支持按年份、周次及SKU多维索引
                  </span>
                </div>
              </div>

              {/* Backup & Restore section */}
              <div className="p-5 border border-slate-200 rounded-xl bg-white space-y-3">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  数据备份与恢复
                </h3>
                <p className="text-xs text-slate-500">
                  您可以随时导出完整的结构化 JSON 数据作为企业容灾备份，或将备份文件恢复至当前工作空间。
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleExportBackup}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    导出数据备份 JSON
                  </button>

                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
                    <Upload className="w-3.5 h-3.5" />
                    从备份文件恢复
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleRestoreFile}
                    />
                  </label>
                </div>

                {restoreMsg && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{restoreMsg}</span>
                  </div>
                )}
              </div>

              {/* Cross-Browser Full Sync Panel */}
              <div className="p-5 border border-indigo-200/90 rounded-xl bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/40 space-y-4 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                      <Key className="w-4 h-4 text-indigo-600" />
                      跨浏览器 / 跨设备数据无缝同步
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      💡 <strong>为什么换了浏览器数据不见了？</strong> 静态运行环境下，原浏览器上传的 Excel 数据存储在原浏览器的缓存中。
                      使用此功能可将当前浏览器中的<strong>全部账户、{productCount} 条产品与 {activityCount} 条活动记录</strong>一键打包传输至新浏览器！
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    onClick={handleCopySyncCode}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedSyncCode ? '已复制同步码！' : '一键复制全量同步码'}
                  </button>

                  <button
                    onClick={handleDownloadSyncFile}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-indigo-700 bg-indigo-100/80 hover:bg-indigo-200/80 rounded-xl transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    下载同步包文件 (.json)
                  </button>

                  <button
                    onClick={() => setShowSyncInput(!showSyncInput)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    {showSyncInput ? '收起导入框' : '在当前浏览器导入其他设备数据'}
                  </button>
                </div>

                {showSyncInput && (
                  <div className="p-4 bg-white border border-indigo-100 rounded-xl space-y-3 mt-3 animate-in fade-in duration-200">
                    <span className="text-xs font-semibold text-slate-800 block">
                      粘贴来自原浏览器的同步码：
                    </span>
                    <textarea
                      rows={3}
                      value={syncCodeInput}
                      onChange={(e) => setSyncCodeInput(e.target.value)}
                      placeholder="在此处粘贴从原浏览器复制的同步码..."
                      className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        导入后将自动合并并恢复账户及所有产品和活动记录。
                      </span>
                      <button
                        onClick={handleApplySyncCode}
                        className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
                      >
                        确认执行导入
                      </button>
                    </div>
                  </div>
                )}

                {syncCodeStatus && (
                  <div className="p-3 bg-indigo-50/90 border border-indigo-200 text-indigo-900 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{syncCodeStatus}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: SUPABASE CLOUD DATABASE */}
          {activeTab === 'supabase' && (
            <div className="space-y-5">
              <div className="p-4 bg-sky-50/70 border border-sky-200/80 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-sky-900 font-semibold text-sm">
                  <Cloud className="w-5 h-5 text-sky-600" />
                  Supabase 生产级关系型数据库连接
                </div>
                <p className="text-xs text-sky-800 leading-relaxed">
                  为什么换了浏览器或设备无法登录同一账户？因为当应用部署在 GitHub Pages 等静态托管环境时，数据默认仅保存在当前浏览器的 localStorage 中。
                  接入 <strong>Supabase (PostgreSQL)</strong> 后，系统将直接在云端验证账户与读写数据，支持跨电脑、跨浏览器秒级同步！
                </p>
              </div>

              <div className="p-5 border border-slate-200 rounded-xl bg-white space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="font-semibold text-slate-900 block text-xs">
                      启用 Supabase 跨设备云同步
                    </span>
                    <span className="text-[11px] text-slate-500">
                      开启后所有账户注册、登录与数据存取将直连 Supabase
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSupabaseEnabled}
                    onChange={(e) => setIsSupabaseEnabled(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Supabase Project URL
                    </label>
                    <input
                      type="text"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://xyzcompany.supabase.co"
                      disabled={!isSupabaseEnabled}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Supabase Project Anon Public Key (anon key)
                    </label>
                    <input
                      type="password"
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      disabled={!isSupabaseEnabled}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={handleSaveSupabase}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    保存配置并立即测试连接
                  </button>
                  <span className="text-[11px] text-slate-400">
                    建表脚本已位于：migrations/001_initial_schema.sql
                  </span>
                </div>

                {supabaseSavedMsg && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>{supabaseSavedMsg}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT JOBS */}
          {activeTab === 'jobs' && (
            <div>
              {importJobs.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  暂无导入任务历史记录
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-6 p-3 bg-slate-50 font-semibold text-slate-700 text-[11px]">
                    <span className="col-span-2">任务名称 / 文件</span>
                    <span>数据类型</span>
                    <span>导入模式</span>
                    <span>成功 / 错误</span>
                    <span className="text-right">执行时间</span>
                  </div>
                  {importJobs.map((j) => (
                    <div
                      key={j.id}
                      className="grid grid-cols-6 p-3 items-center hover:bg-slate-50 text-[11px]"
                    >
                      <div className="col-span-2 truncate pr-2">
                        <span className="font-semibold text-slate-900 block truncate">
                          {j.fileName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {j.errorSummary || '正常处理完成'}
                        </span>
                      </div>
                      <span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                          {j.fileType === 'product' ? '产品表' : '活动表'}
                        </span>
                      </span>
                      <span>
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">
                          {j.mode === 'replace' ? '全量替换' : '增量追加'}
                        </span>
                      </span>
                      <span className="font-mono text-emerald-700 font-semibold">
                        {j.successRows} / {j.errorRows}
                      </span>
                      <span className="text-right font-mono text-slate-400">
                        {new Date(j.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div>
              {auditLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  暂无审计变更日志
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden font-mono text-[11px]">
                  <div className="grid grid-cols-5 p-3 bg-slate-50 font-semibold text-slate-700 font-sans">
                    <span>时间戳</span>
                    <span>操作人员</span>
                    <span>操作行为</span>
                    <span className="col-span-2">变更摘要</span>
                  </div>
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="grid grid-cols-5 p-2.5 items-center hover:bg-slate-50"
                    >
                      <span className="text-slate-400 text-[10px]">
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
                      </span>
                      <span className="truncate pr-2 text-slate-600 font-sans">
                        {log.userEmail}
                      </span>
                      <span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold text-[10px]">
                          {log.action}
                        </span>
                      </span>
                      <span className="col-span-2 text-slate-600 truncate" title={JSON.stringify(log.details)}>
                        {JSON.stringify(log.details)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DANGER ZONE */}
          {activeTab === 'danger' && (
            <div className="space-y-5">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-rose-800 font-semibold text-sm">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  彻底清空云端存储（高危操作）
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  清空操作将永久删除当前用户工作空间下的所有{' '}
                  <strong>{productCount} 条产品资料</strong> 与{' '}
                  <strong>{activityCount} 条活动周期记录</strong>
                  。此操作将记录至企业安全审计日志，并且不可撤销。
                </p>
                {!isAdmin && (
                  <div className="mt-2 text-xs font-semibold text-rose-900 bg-rose-100 px-3 py-1.5 rounded-lg">
                    ⚠️ 您当前的角色为 [{currentUser?.role}]，只有系统管理员 (admin) 允许执行清空操作。
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <label className="text-xs font-semibold text-slate-800 block">
                  输入确认口令以解除保护：
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="请输入 CONFIRM_CLEAR_ALL"
                    disabled={!isAdmin || isClearing}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 transition"
                  />
                  <button
                    onClick={handleExecuteClear}
                    disabled={
                      !isAdmin ||
                      confirmInput.trim() !== 'CONFIRM_CLEAR_ALL' ||
                      isClearing
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-xs transition"
                  >
                    {isClearing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    确认并彻底清空
                  </button>
                </div>

                {clearError && (
                  <div className="p-2.5 bg-rose-100 border border-rose-300 text-rose-800 rounded-lg text-xs">
                    {clearError}
                  </div>
                )}

                {clearSuccess && (
                  <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    {clearSuccess}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
          <span>🔒 企业级云端数据防护 · 支持单表 50,000+ 条记录</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
