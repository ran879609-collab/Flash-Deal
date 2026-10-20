import React, { useState } from 'react';
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
  Cloud,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onAuthSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'sync'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('电商运营部');
  const [role, setRole] = useState<UserRole>('manager');
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [copiedSyncCode, setCopiedSyncCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

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
        const res = ApiService.importAccountSyncCode(syncCodeInput);
        setInfoMsg(`同步成功！已恢复账户：${res.user.name} (${res.user.email})`);
        setTimeout(() => {
          onAuthSuccess(res.user);
          onClose();
        }, 1000);
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

  const handleCopyCurrentSyncCode = () => {
    const code = ApiService.exportAccountSyncCode();
    navigator.clipboard.writeText(code);
    setCopiedSyncCode(true);
    setTimeout(() => setCopiedSyncCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
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
                  : '跨浏览器 / 跨设备账户同步'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                CyclePro Pro 企业级访问控制与数据同步
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
          {/* Quick Demo Switcher */}
          {mode !== 'sync' && (
            <div className="p-3 bg-blue-50/60 border border-blue-200/70 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                快速切换内置角色账户:
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoSwitch('admin')}
                  className="py-1.5 px-2 bg-white text-slate-800 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-lg text-xs font-medium transition text-center shadow-2xs"
                >
                  管理员 (Admin)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoSwitch('manager')}
                  className="py-1.5 px-2 bg-white text-slate-800 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-lg text-xs font-medium transition text-center shadow-2xs"
                >
                  主管 (Manager)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoSwitch('analyst')}
                  className="py-1.5 px-2 bg-white text-slate-800 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-lg text-xs font-medium transition text-center shadow-2xs"
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
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs space-y-1">
                  <span className="font-semibold block flex items-center gap-1">
                    <Key className="w-3.5 h-3.5" />
                    跨浏览器 / 跨设备免密码快速同步：
                  </span>
                  <p className="text-[11px] leading-relaxed text-amber-700">
                    在已登录的原浏览器中点击下方「复制同步码」，然后粘贴至新浏览器中即可一键完成身份与权限同步！
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    粘贴跨设备账户同步码
                  </label>
                  <textarea
                    rows={4}
                    value={syncCodeInput}
                    onChange={(e) => setSyncCodeInput(e.target.value)}
                    placeholder="请在此粘贴从另一台浏览器复制的账户同步码..."
                    className="w-full p-2.5 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition"
                  ></textarea>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleCopyCurrentSyncCode}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedSyncCode ? '已复制同步码！' : '复制当前浏览器同步码'}
                  </button>
                </div>
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center justify-center gap-2 mt-2"
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
                '导入同步码并登录'
              )}
            </button>
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
                  }}
                  className="hover:underline font-medium"
                >
                  注册新成员
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('sync');
                    setErrorMsg(null);
                  }}
                  className="hover:underline font-medium flex items-center gap-1 text-slate-600"
                >
                  <Key className="w-3 h-3 text-amber-500" />
                  跨浏览器同步码
                </button>
              </>
            )}

            {mode === 'register' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                }}
                className="hover:underline font-medium"
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
                }}
                className="hover:underline font-medium"
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
