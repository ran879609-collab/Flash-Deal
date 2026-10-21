import React, { useState, useEffect } from 'react';
import { ApiService } from '../../services/api';
import { SupabaseService } from '../../services/supabase';
import { UserProfile, UserRole } from '../../types';
import {
  User,
  Lock,
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Users,
  Key,
  Copy,
  Download,
  Upload,
  Cloud,
  FileText,
  Database,
  ArrowRight,
  Info,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  productCount?: number;
  activityCount?: number;
  onAuthSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  productCount = 0,
  activityCount = 0,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'sync'>('login');
  const [syncTab, setSyncTab] = useState<'export' | 'import'>('import');

  // Login & Register Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('电商运营部');
  const [role, setRole] = useState<UserRole>('manager');

  // Sync State
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [parsedPreview, setParsedPreview] = useState<{
    isValid: boolean;
    user?: UserProfile;
    productsCount: number;
    activitiesCount: number;
    exportTime?: string;
    error?: string;
  } | null>(null);
  const [copiedSyncCode, setCopiedSyncCode] = useState(false);

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Live parse sync code preview as user types or pastes
  useEffect(() => {
    if (syncCodeInput.trim().length > 10) {
      const preview = ApiService.parseSyncCodePreview(syncCodeInput.trim());
      setParsedPreview(preview);
    } else {
      setParsedPreview(null);
    }
  }, [syncCodeInput]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (mode === 'login') {
        const res = await ApiService.login(email, password);
        onAuthSuccess(res.user);
        onClose();
      } else if (mode === 'register') {
        const res = await ApiService.register(
          email,
          password,
          name,
          role,
          department
        );
        onAuthSuccess(res.user);
        onClose();
      } else {
        // Import Sync Code
        if (!syncCodeInput.trim()) {
          throw new Error('请先粘贴同步码或上传同步包文件');
        }
        const res = ApiService.importAccountSyncCode(syncCodeInput.trim());
        setInfoMsg(
          `🎉 同步成功！已恢复账户：${res.user.name} (${res.user.email})，同时恢复 ${res.productsCount} 条产品资料与 ${res.activitiesCount} 条活动记录！`
        );
        setTimeout(() => {
          onAuthSuccess(res.user);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '操作失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoSwitch = async (targetRole: UserRole) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await ApiService.switchDemo(targetRole);
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || '切换演示账户失败');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy Full Sync Code
  const handleCopyCurrentSyncCode = () => {
    try {
      const code = ApiService.exportAccountSyncCode(true);
      navigator.clipboard.writeText(code);
      setCopiedSyncCode(true);
      setInfoMsg(
        `✅ 全量同步码已复制到剪贴板！（包含当前账户、${productCount} 条产品及 ${activityCount} 条活动数据）`
      );
      setTimeout(() => setCopiedSyncCode(false), 3000);
    } catch (err: any) {
      setErrorMsg(`复制失败: ${err.message}`);
    }
  };

  // Download Full Sync File (.json)
  const handleDownloadSyncFile = () => {
    try {
      const json = ApiService.exportSyncPackageJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CyclePro_跨浏览器全量同步包_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setInfoMsg('✅ 已下载全量同步包文件！在新浏览器中上传此文件即可一键恢复。');
    } catch (err: any) {
      setErrorMsg(`下载失败: ${err.message}`);
    }
  };

  // Upload Sync File (.json)
  const handleSyncFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        setSyncCodeInput(text);
        const preview = ApiService.parseSyncCodePreview(text);
        setParsedPreview(preview);
        if (preview.isValid) {
          setInfoMsg(`已识别同步文件：包含 ${preview.productsCount} 条产品与 ${preview.activitiesCount} 条活动记录`);
        } else {
          setErrorMsg(preview.error || '文件格式不正确');
        }
      } catch (err: any) {
        setErrorMsg(`解析文件失败: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {mode === 'login'
                  ? '系统登录与身份验证'
                  : mode === 'register'
                  ? '注册新成员账户'
                  : '跨浏览器 / 跨设备数据与账户同步'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                CyclePro Pro 企业级访问控制与数据同步
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Quick Demo Switcher (Only in Login Mode) */}
          {mode === 'login' && (
            <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                快速切换内置角色账户:
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoSwitch('admin')}
                  className="py-1.5 px-2 bg-white text-slate-800 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-lg text-xs font-medium transition text-center shadow-2xs cursor-pointer"
                >
                  管理员 (Admin)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoSwitch('manager')}
                  className="py-1.5 px-2 bg-white text-slate-800 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-lg text-xs font-medium transition text-center shadow-2xs cursor-pointer"
                >
                  主管 (Manager)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoSwitch('analyst')}
                  className="py-1.5 px-2 bg-white text-slate-800 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-lg text-xs font-medium transition text-center shadow-2xs cursor-pointer"
                >
                  分析师 (Analyst)
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    真实姓名
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="例如：张建国"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      所属部门
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="例如：跨境运营部"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      分配角色
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500"
                    >
                      <option value="manager">运营主管 (Manager)</option>
                      <option value="analyst">分析师 (Analyst)</option>
                      <option value="admin">超级管理员 (Admin)</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {mode !== 'sync' ? (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    企业邮箱
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="例如：admin@cyclepro.com"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    登录密码
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请输入密码"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {/* Explanation Banner */}
                <div className="p-3 bg-amber-50/90 border border-amber-200/80 text-amber-900 rounded-xl text-xs space-y-1.5">
                  <span className="font-semibold flex items-center gap-1.5 text-amber-800">
                    <Info className="w-4 h-4 text-amber-600 shrink-0" />
                    为什么新浏览器没有原浏览器上传的数据？
                  </span>
                  <p className="text-[11px] leading-relaxed text-amber-800/90">
                    在纯静态或离线沙箱环境中，每个浏览器（Chrome、Edge 等）的数据保存在各自的本地存储中。原同步码仅包含账户凭证，现已升级为<strong>「全量数据同步」</strong>，可将原浏览器中的<strong>所有产品资料和活动记录</strong> 100% 同步过来！
                  </p>
                </div>

                {/* Sub Tab Switcher */}
                <div className="flex border-b border-slate-200 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setSyncTab('import')}
                    className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                      syncTab === 'import'
                        ? 'border-blue-600 text-blue-600 font-semibold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    当前是新浏览器 (导入数据)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncTab('export')}
                    className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                      syncTab === 'export'
                        ? 'border-blue-600 text-blue-600 font-semibold'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    当前是原浏览器 (导出数据)
                  </button>
                </div>

                {/* Tab: IMPORT */}
                {syncTab === 'import' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-700 block mb-1">
                        方式一：粘贴跨设备全量同步码
                      </label>
                      <textarea
                        rows={3}
                        value={syncCodeInput}
                        onChange={(e) => setSyncCodeInput(e.target.value)}
                        placeholder="请在此粘贴从原浏览器复制的全量同步码..."
                        className="w-full p-2.5 font-mono text-[11px] bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition"
                      ></textarea>
                    </div>

                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-700">方式二：直接上传全量同步包 (.json)</span>
                        <span className="text-[10px] text-slate-400">适合大规模数据</span>
                      </div>
                      <label className="mt-1.5 flex items-center justify-center gap-2 p-2.5 border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/30 rounded-xl text-xs text-slate-600 cursor-pointer transition">
                        <Upload className="w-4 h-4 text-blue-600" />
                        <span>点击选择或拖入同步包文件 (.json)</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleSyncFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Live Preview of parsed sync package */}
                    {parsedPreview && (
                      <div
                        className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                          parsedPreview.isValid
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        {parsedPreview.isValid ? (
                          <>
                            <div className="font-semibold flex items-center gap-1.5 text-emerald-800">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              已检测到有效同步数据包：
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                              <div>👤 账户: <span className="font-semibold">{parsedPreview.user?.name}</span></div>
                              <div>🏢 角色: <span className="font-semibold">{parsedPreview.user?.role}</span></div>
                              <div>📦 产品资料: <span className="font-semibold">{parsedPreview.productsCount} 条</span></div>
                              <div>📊 活动记录: <span className="font-semibold">{parsedPreview.activitiesCount} 条</span></div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            <span>{parsedPreview.error || '无法识别该同步码'}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: EXPORT */}
                {syncTab === 'export' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <span className="text-xs font-semibold text-slate-800 block">
                        当前浏览器持有的业务数据统计：
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-center pt-1">
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">当前登录身份</span>
                          <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">
                            {currentUser?.name || '未登录'}
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">产品资料</span>
                          <span className="text-xs font-bold text-blue-600 block mt-0.5">
                            {productCount} 条
                          </span>
                        </div>
                        <div className="p-2 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">活动周期记录</span>
                          <span className="text-xs font-bold text-emerald-600 block mt-0.5">
                            {activityCount} 条
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCopyCurrentSyncCode}
                        className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Copy className="w-4 h-4" />
                        {copiedSyncCode ? '已复制全量同步码！' : '复制全量同步码 (含账户与业务数据)'}
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadSyncFile}
                        className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-slate-500" />
                        下载全量数据同步包 (.json)
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed text-center">
                      复制或下载后，在另一个浏览器打开本系统，选择「跨浏览器同步」并导入即可！
                    </p>
                  </div>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{infoMsg}</span>
              </div>
            )}

            {/* Action Submit Button */}
            {(mode !== 'sync' || syncTab === 'import') && (
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center justify-center gap-2 mt-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    正在处理...
                  </>
                ) : mode === 'login' ? (
                  '登录系统'
                ) : mode === 'register' ? (
                  '立即创建账户并进入'
                ) : (
                  '🚀 立即同步全量数据并进入系统'
                )}
              </button>
            )}
          </form>

          {/* Mode Switch Navigation */}
          <div className="flex items-center justify-between text-xs text-blue-600 pt-2 border-t border-slate-100">
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="hover:underline font-medium cursor-pointer"
                >
                  注册新成员
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('sync');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="hover:underline font-medium flex items-center gap-1 text-slate-700 hover:text-blue-600 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  跨浏览器数据与账户同步
                </button>
              </>
            )}

            {mode === 'register' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="hover:underline font-medium cursor-pointer"
              >
                已有企业账户？返回登录
              </button>
            )}

            {mode === 'sync' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="hover:underline font-medium cursor-pointer"
              >
                返回标准账号密码登录
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
