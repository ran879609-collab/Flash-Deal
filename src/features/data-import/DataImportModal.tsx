import React, { useState, useRef } from 'react';
import { parseProductInput, parseActivityInput, ParseResult } from './fileParser';
import { ApiService } from '../../services/api';
import { downloadCSV, escapeCSVCell } from '../reports/csvExporter';
import {
  Upload,
  X,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  FileDown,
  Layers,
  RefreshCw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: 'product' | 'activity';
  onSuccess: () => void;
}

export const DataImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  type,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>(
    type === 'product' ? 'replace' : 'replace'
  );
  const [isParsing, setIsParsing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseResult, setParseResult] = useState<ParseResult<any> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const title = type === 'product' ? '导入产品数据表' : '导入活动周期表';
  const desc =
    type === 'product'
      ? '支持 .xlsx, .xls, .csv 格式。必填列：原始SKU（或分裂SKU），可选列：类型、Item ID'
      : '支持 .xlsx, .xls, .csv 格式。必填列：年、周、SKU（或子ID），数值列：价格、期望单量、平均单量、售价等';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMsg(null);
    setIsParsing(true);

    try {
      if (type === 'product') {
        const result = await parseProductInput(file);
        setParseResult(result);
        if (!result.success && result.missingRequiredHeaders.length > 0) {
          setErrorMsg(`表头缺少必要列: ${result.missingRequiredHeaders.join('、')}`);
        }
      } else {
        const result = await parseActivityInput(file);
        setParseResult(result);
        if (!result.success && result.missingRequiredHeaders.length > 0) {
          setErrorMsg(`表头缺少必要列: ${result.missingRequiredHeaders.join('、')}`);
        }
      }
    } catch (err: any) {
      setErrorMsg(`文件解析失败: ${err.message || '未知错误'}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDownloadErrors = () => {
    if (!parseResult || parseResult.errorRows.length === 0) return;

    const headers = ['行号', '失败原因', '原始数据'];
    const lines = [headers.map(escapeCSVCell).join(',')];

    parseResult.errorRows.forEach((item) => {
      lines.push(
        [
          escapeCSVCell(item.rowNumber),
          escapeCSVCell(item.reason),
          escapeCSVCell(JSON.stringify(item.raw)),
        ].join(',')
      );
    });

    downloadCSV(lines.join('\r\n'), `${type}_导入失败行明细.csv`);
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.rows.length === 0) return;

    setIsUploading(true);
    setUploadProgress(10);
    setErrorMsg(null);

    try {
      const CHUNK_SIZE = 3000;
      const totalItems = parseResult.rows.length;
      const chunks: any[][] = [];

      for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
        chunks.push(parseResult.rows.slice(i, i + CHUNK_SIZE));
      }

      for (let i = 0; i < chunks.length; i++) {
        const currentMode = i === 0 ? importMode : 'append';
        const chunk = chunks[i];

        if (type === 'product') {
          await ApiService.importProductsBatch(
            chunk,
            currentMode,
            selectedFile?.name
          );
        } else {
          await ApiService.importActivitiesBatch(
            chunk,
            currentMode,
            selectedFile?.name
          );
        }

        const progressPercent = Math.min(
          95,
          Math.round(((i + 1) / chunks.length) * 100)
        );
        setUploadProgress(progressPercent);
      }

      setUploadProgress(100);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(`云端保存失败: ${err.message || '网络异常'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Upload className="w-5 h-5" />
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

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Mode Switcher */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs font-semibold text-slate-900 block">
                写入模式
              </span>
              <span className="text-[11px] text-slate-500">
                {importMode === 'replace'
                  ? '替换模式：清空现有表数据后写入本次新数据'
                  : '追加模式：保留现有数据，按业务主键去重/更新'}
              </span>
            </div>
            <div className="inline-flex p-1 bg-slate-200/80 rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`px-3 py-1 rounded-md transition ${
                  importMode === 'replace'
                    ? 'bg-white text-blue-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全量替换
              </button>
              <button
                type="button"
                onClick={() => setImportMode('append')}
                className={`px-3 py-1 rounded-md transition ${
                  importMode === 'append'
                    ? 'bg-white text-blue-700 font-semibold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                增量追加
              </button>
            </div>
          </div>

          {/* File Picker Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-blue-50/30 transition duration-150"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="p-3 bg-white border border-slate-200 group-hover:border-blue-200 rounded-2xl shadow-2xs text-blue-600 transition">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {selectedFile ? selectedFile.name : '点击选择或拖放文件到此处'}
              </p>
              <p className="text-xs text-slate-400">
                支持 Excel (.xlsx, .xls) 和 CSV 文件，单次支持 50,000+ 条
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsing State */}
          {isParsing && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500 font-medium">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
              正在解析文件并进行数据校验...
            </div>
          )}

          {/* Parse Result Summary */}
          {parseResult && !isParsing && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <span className="text-[11px] text-slate-500 block">
                    解析总行数
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {parseResult.totalParsed}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[11px] text-emerald-700 block">
                    合规有效行
                  </span>
                  <span className="text-base font-bold text-emerald-700">
                    {parseResult.rows.length}
                  </span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                  <span className="text-[11px] text-rose-700 block">
                    异常错误行
                  </span>
                  <span className="text-base font-bold text-rose-700">
                    {parseResult.errorRows.length}
                  </span>
                </div>
              </div>

              {/* Error Rows action */}
              {parseResult.errorRows.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <span className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    存在 {parseResult.errorRows.length} 行数据格式异常已被跳过
                  </span>
                  <button
                    onClick={handleDownloadErrors}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-900 bg-white border border-amber-300 hover:bg-amber-100/50 rounded-lg transition"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    下载错误行明细
                  </button>
                </div>
              )}

              {/* Preview First 3 Rows */}
              {parseResult.rows.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-slate-700 block mb-1.5">
                    数据预览 (前 3 条):
                  </span>
                  <div className="rounded-xl border border-slate-200 overflow-hidden text-[11px]">
                    <div className="bg-slate-100 p-2 font-mono text-slate-600 truncate border-b border-slate-200">
                      匹配表头: {parseResult.headersFound.join(' | ')}
                    </div>
                    <div className="bg-white p-2.5 space-y-1 font-mono text-slate-800">
                      {parseResult.rows.slice(0, 3).map((r, i) => (
                        <div key={i} className="truncate text-slate-700">
                          {JSON.stringify(r)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-600 font-medium">
                <span>正在分批保存至云端数据库...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition"
          >
            取消
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={!parseResult || parseResult.rows.length === 0 || isUploading}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-xs transition"
          >
            {isUploading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                正在保存云端...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                确认并提交云端
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
