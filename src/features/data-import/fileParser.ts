import * as XLSX from 'xlsx';
import { ProductRecord, ActivityRecord } from '../../types';

export interface ParseResult<T> {
  success: boolean;
  rows: T[];
  totalParsed: number;
  errorRows: Array<{ rowNumber: number; reason: string; raw: any }>;
  headersFound: string[];
  missingRequiredHeaders: string[];
}

/**
 * Standardizes header strings (lowercase, remove spaces, underscores, dashes)
 */
function normalizeHeader(h: string): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-（）\(\)]/g, '');
}

/**
 * Robust RFC-4180 CSV parser
 */
export function parseCSVToMatrix(text: string): string[][] {
  // Strip UTF-8 BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n of \r\n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses Product File (CSV, XLSX, XLS) or Raw Paste Text
 */
export async function parseProductInput(
  fileOrText: File | string
): Promise<ParseResult<Omit<ProductRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>> {
  let matrix: any[][] = [];

  if (typeof fileOrText === 'string') {
    matrix = parseCSVToMatrix(fileOrText);
  } else {
    const ext = fileOrText.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      const text = await fileOrText.text();
      matrix = parseCSVToMatrix(text);
    } else {
      const buffer = await fileOrText.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    }
  }

  if (!matrix || matrix.length < 2) {
    return {
      success: false,
      rows: [],
      totalParsed: 0,
      errorRows: [{ rowNumber: 1, reason: '文件无有效数据行（至少需要包含表头与1行数据）', raw: [] }],
      headersFound: [],
      missingRequiredHeaders: ['原始SKU 或 分裂SKU'],
    };
  }

  const rawHeaders = (matrix[0] || []).map((h) => String(h || '').trim());
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  // Column matching
  let idxOriginalSku = -1;
  let idxSplitSku = -1;
  let idxType = -1;
  let idxItemId = -1;

  normalizedHeaders.forEach((h, i) => {
    if (h.includes('原始sku') || h === 'originalsku' || h === '原sku') {
      idxOriginalSku = i;
    } else if (h.includes('分裂sku') || h === 'splitsku' || h === '子sku') {
      idxSplitSku = i;
    } else if (h.includes('类型') || h.includes('类目') || h === 'type' || h === 'category') {
      idxType = i;
    } else if (h.includes('itemid') || h.includes('商品id') || h.includes('产品id')) {
      idxItemId = i;
    } else if (idxOriginalSku === -1 && (h === 'sku' || h === 'skuno')) {
      idxOriginalSku = i;
    }
  });

  const missing: string[] = [];
  if (idxOriginalSku === -1 && idxSplitSku === -1) {
    missing.push('原始SKU 或 分裂SKU');
  }

  if (missing.length > 0) {
    return {
      success: false,
      rows: [],
      totalParsed: matrix.length - 1,
      errorRows: [{ rowNumber: 1, reason: `缺少必填列: ${missing.join(', ')}`, raw: rawHeaders }],
      headersFound: rawHeaders,
      missingRequiredHeaders: missing,
    };
  }

  const rows: Array<Omit<ProductRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = [];
  const errorRows: Array<{ rowNumber: number; reason: string; raw: any }> = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (!line || line.every((c: any) => c === null || c === undefined || String(c).trim() === '')) {
      continue; // Skip empty rows
    }

    const originalSku = idxOriginalSku >= 0 ? String(line[idxOriginalSku] || '').trim() : '';
    const splitSku = idxSplitSku >= 0 ? String(line[idxSplitSku] || '').trim() : '';
    const type = idxType >= 0 ? String(line[idxType] || '').trim() : '';
    const itemId = idxItemId >= 0 ? String(line[idxItemId] || '').trim() : '';

    const finalSku = originalSku || splitSku;
    if (!finalSku) {
      errorRows.push({
        rowNumber: r + 1,
        reason: '原始SKU与分裂SKU均为空',
        raw: line,
      });
      continue;
    }

    rows.push({
      originalSku: finalSku,
      splitSku,
      type,
      itemId,
    });
  }

  return {
    success: rows.length > 0,
    rows,
    totalParsed: matrix.length - 1,
    errorRows,
    headersFound: rawHeaders,
    missingRequiredHeaders: [],
  };
}

/**
 * Parses Activity File (CSV, XLSX, XLS) or Raw Paste Text
 */
export async function parseActivityInput(
  fileOrText: File | string
): Promise<ParseResult<Omit<ActivityRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>> {
  let matrix: any[][] = [];

  if (typeof fileOrText === 'string') {
    matrix = parseCSVToMatrix(fileOrText);
  } else {
    const ext = fileOrText.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      const text = await fileOrText.text();
      matrix = parseCSVToMatrix(text);
    } else {
      const buffer = await fileOrText.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    }
  }

  if (!matrix || matrix.length < 2) {
    return {
      success: false,
      rows: [],
      totalParsed: 0,
      errorRows: [{ rowNumber: 1, reason: '文件无有效数据行', raw: [] }],
      headersFound: [],
      missingRequiredHeaders: ['年', '周', 'SKU'],
    };
  }

  const rawHeaders = (matrix[0] || []).map((h) => String(h || '').trim());
  const normalizedHeaders = rawHeaders.map(normalizeHeader);

  let idxYear = -1;
  let idxWeek = -1;
  let idxSku = -1;
  let idxSubId = -1;
  let idxParentId = -1;
  let idxAvgOrders = -1;
  let idxSellingPrice = -1;
  let idxExpectedOrders = -1;
  let idxPrice = -1;
  let idxRemark = -1;

  normalizedHeaders.forEach((h, i) => {
    if (h === '年' || h.includes('年份') || h === 'year') {
      idxYear = i;
    } else if (h === '周' || h.includes('周次') || h === 'week' || h === '周期') {
      idxWeek = i;
    } else if (h === 'sku' || h.includes('sku')) {
      idxSku = i;
    } else if (h.includes('子id') || h.includes('subid') || h.includes('子item')) {
      idxSubId = i;
    } else if (h.includes('父id') || h.includes('parentid') || h.includes('父item')) {
      idxParentId = i;
    } else if (h.includes('平均单量') || h.includes('avgorders') || h.includes('日均单量')) {
      idxAvgOrders = i;
    } else if (h.includes('售价') || h.includes('sellingprice') || h.includes('原价')) {
      idxSellingPrice = i;
    } else if (h.includes('期望单量') || h.includes('expectedorders') || h.includes('预估单量')) {
      idxExpectedOrders = i;
    } else if (h.includes('活动价格') || h.includes('活动价') || h === '价格' || h === 'price') {
      idxPrice = i;
    } else if (h.includes('备注') || h.includes('remark') || h.includes('note')) {
      idxRemark = i;
    }
  });

  const missing: string[] = [];
  if (idxYear === -1) missing.push('年 (Year)');
  if (idxWeek === -1) missing.push('周 (Week)');
  if (idxSku === -1 && idxSubId === -1) missing.push('SKU 或 子ID');

  if (missing.length > 0) {
    return {
      success: false,
      rows: [],
      totalParsed: matrix.length - 1,
      errorRows: [{ rowNumber: 1, reason: `缺少必填列: ${missing.join(', ')}`, raw: rawHeaders }],
      headersFound: rawHeaders,
      missingRequiredHeaders: missing,
    };
  }

  const rows: Array<Omit<ActivityRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = [];
  const errorRows: Array<{ rowNumber: number; reason: string; raw: any }> = [];

  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (!line || line.every((c: any) => c === null || c === undefined || String(c).trim() === '')) {
      continue;
    }

    const rawYear = line[idxYear];
    const rawWeek = line[idxWeek];
    const rawSku = idxSku >= 0 ? line[idxSku] : '';
    const rawSubId = idxSubId >= 0 ? line[idxSubId] : '';

    const sku = String(rawSku || rawSubId || '').trim();
    if (!sku) {
      errorRows.push({
        rowNumber: r + 1,
        reason: 'SKU与子ID均为空',
        raw: line,
      });
      continue;
    }

    // Parse Year
    const year = parseInt(String(rawYear).trim(), 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      errorRows.push({
        rowNumber: r + 1,
        reason: `年份数值无效 (${rawYear})，应在 2000-2100 之间`,
        raw: line,
      });
      continue;
    }

    // Parse Week
    let weekNum = 0;
    const weekStrVal = String(rawWeek).trim();
    if (weekStrVal.includes('-W')) {
      const parts = weekStrVal.split('-W');
      weekNum = parseInt(parts[1], 10);
    } else if (weekStrVal.toLowerCase().startsWith('w')) {
      weekNum = parseInt(weekStrVal.slice(1), 10);
    } else {
      weekNum = parseInt(weekStrVal, 10);
    }

    if (isNaN(weekNum) || weekNum < 1 || weekNum > 53) {
      errorRows.push({
        rowNumber: r + 1,
        reason: `周次数值无效 (${rawWeek})，应在 1-53 之间`,
        raw: line,
      });
      continue;
    }

    const formattedWeek = `${year}-W${String(weekNum).padStart(2, '0')}`;

    // Activity Price
    let price: number | null = null;
    if (idxPrice >= 0 && line[idxPrice] !== undefined && line[idxPrice] !== null && String(line[idxPrice]).trim() !== '') {
      const cleanPrice = String(line[idxPrice]).replace(/[\$,¥\s]/g, '');
      const parsedPrice = parseFloat(cleanPrice);
      if (!isNaN(parsedPrice)) {
        price = parsedPrice;
      }
    }

    rows.push({
      year,
      week: formattedWeek,
      sku,
      subId: idxSubId >= 0 ? String(line[idxSubId] || '').trim() : '',
      parentId: idxParentId >= 0 ? String(line[idxParentId] || '').trim() : '',
      avgOrders: idxAvgOrders >= 0 ? String(line[idxAvgOrders] || '').trim() : '',
      sellingPrice: idxSellingPrice >= 0 ? String(line[idxSellingPrice] || '').trim() : '',
      expectedOrders: idxExpectedOrders >= 0 ? String(line[idxExpectedOrders] || '').trim() : '',
      price,
      remark: idxRemark >= 0 ? String(line[idxRemark] || '').trim() : '',
    });
  }

  return {
    success: rows.length > 0,
    rows,
    totalParsed: matrix.length - 1,
    errorRows,
    headersFound: rawHeaders,
    missingRequiredHeaders: [],
  };
}
