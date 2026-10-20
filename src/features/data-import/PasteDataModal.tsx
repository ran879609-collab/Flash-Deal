import React, { useState } from 'react';
import { parseProductInput, parseActivityInput } from './fileParser';
import { ApiService } from '../../services/api';
import { Clipboard, X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: 'product' | 'activity';
  onSuccess: () => void;
}

export const PasteDataModal: React.FC<Props> = ({
  isOpen,
  onClose,
  type,
  onSuccess,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isProduct = type === 'product';
  const title = isProduct ? '📋 批量粘贴产品数据' : '📋 批量粘贴活动数据';
  const desc = isProduct
    ? '粘贴包含表头的 CSV 或表格复制内容。新数据将以「增量追加」模式写入云端数据库。'
    : '粘贴包含表头的 CSV 或表格复制内容。新数据将以「增量追加」模式写入云端数据库。';

  const placeholder = isProduct
    ? '原始SKU,分裂SKU,类型,Item ID\nTZ-P0211-BLUE,2in1,E-训狗器,883281869\nPET1005-Black-XS,PET1005,I-发光项圈,5559267016'
    : '年,周,SKU,子ID,父ID,平均单量,售价,活动期望单量,活动价格,备注\n2025,1,TZ-P0211-BLUE,883281869,883281869,12.99,10.79,15,8.99,大促\n2025,2,TZ-P0211-BLUE,883281869,883281869,14.50,10.79,20,9.50,';

  const handleConfirm = async () => {
    const raw = pasteText.trim();
    if (!raw) {
      setErrorMsg('请先粘贴数据内容');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isProduct) {
        const parsed = await parseProductInput(raw);
        if (!parsed.success || parsed.rows.length === 0) {
          setErrorMsg(
            `解析失败: ${
              parsed.missingRequiredHeaders.length > 0
                ? `缺少表头列: ${parsed.missingRequiredHeaders.join('、')}`
                : '未能提取到有效数据行'
            }`
          );
          setIsSubmitting(false);
          return;
        }

        await ApiService.importProductsBatch(parsed.rows, 'append', '批量文本粘贴导入');
      } else {
        const parsed = await parseActivityInput(raw);
        if (!parsed.success || parsed.rows.length === 0) {
          setErrorMsg(
            `解析失败: ${
              parsed.missingRequiredHeaders.length > 0
                ? `缺少表头列: ${parsed.missingRequiredHeaders.join('、')}`
                : '未能提取到有效数据行'
            }`
          );
          setIsSubmitting(false);
          return;
        }

        await ApiService.importActivitiesBatch(parsed.rows, 'append', '批量文本粘贴导入');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(`保存失败: ${err.message || '未知错误'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Clipboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
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
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={placeholder}
            rows={10}
            className="w-full font-mono text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-3 focus:ring-blue-100 outline-none transition"
          ></textarea>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={!pasteText.trim() || isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-xs transition"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                正在保存云端...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                确认导入
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
