/**
 * ============================================================
 * GOOGLE APPS SCRIPT - Backend API for Medication Logbook
 * ============================================================
 * วิธีใช้:
 * 1) เปิด Google Sheets → Extensions → Apps Script
 * 2) วางโค้ดนี้ทั้งหมด
 * 3) แก้ SPREADSHEET_ID
 * 4) Run function: setupDatabase() หนึ่งครั้ง หรือให้ระบบตรวจและสร้าง Column อัตโนมัติเมื่อ API ถูกเรียก
 * 5) Deploy → New deployment → Web app
 *    Execute as: Me
 *    Access: Anyone หรือ Anyone with the link
 * 6) คัดลอก Web App URL ไปใส่ใน js/config.js
 *
 * หมายเหตุ CORS:
 * - ไม่ใช้ setHeader / setHeaders เพราะ ContentService ไม่รองรับในหลาย runtime
 * - Front-end ส่ง POST แบบ simple request โดยไม่ใส่ Content-Type header
 */

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const API_TOKEN = ''; // ไม่บังคับ: ใส่รหัสลับถ้าต้องการ เช่น 'CHANGE_THIS_SECRET'

const SHEET_MEDICINES = 'Medicines';
const SHEET_HISTORY = 'DispenseHistory';

const MEDICINE_HEADERS = [
  'ID', 'HN', 'PatientName', 'DrugName', 'GenericName', 'Strength', 'Form',
  'TotalQty', 'RemainingQty', 'Unit', 'Storage', 'Hospital', 'PN',
  'EntryDate', 'ExpiryDate', 'AdministrationSchedule', 'FollowUpDate',
  'ImageURL', 'OCRRawText', 'Notes', 'Status', 'CreatedAt', 'LastDispensed', 'CreatedBy'
];

const HISTORY_HEADERS = [
  'DispenseID', 'MedicineID', 'HN', 'PatientName', 'DrugName',
  'DispenseQty', 'RemainingAfter', 'DispensedBy', 'Receiver', 'Ward',
  'DispenseDate', 'Notes'
];

/**
 * Run manually once after changing SPREADSHEET_ID.
 * ปลอดภัยกับข้อมูลเดิม: ถ้า Sheet/Column ไม่มี จะสร้างเพิ่มให้
 * แต่จะไม่ลบ ไม่ย้าย และไม่เขียนทับ header เดิมที่มีอยู่แล้ว
 */
function setupDatabase() {
  ensureDatabase();
  return 'Database setup completed';
}

/**
 * ตรวจสอบโครงสร้างฐานข้อมูลก่อนทุก API call
 * - ถ้าไม่มี Sheet จะสร้าง Sheet และ header ครบชุด
 * - ถ้ามี Sheet แล้ว แต่ขาด column จะเพิ่ม column ที่ขาดต่อท้าย
 * - ไม่ reorder column เดิม เพื่อไม่กระทบข้อมูลเก่า
 */
function ensureDatabase() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    ensureSheetColumns_(ss, SHEET_MEDICINES, MEDICINE_HEADERS);
    ensureSheetColumns_(ss, SHEET_HISTORY, HISTORY_HEADERS);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function ensureSheetColumns_(ss, sheetName, requiredHeaders) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight('bold');
    return sheet;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(h => String(h || '').trim());

  const isHeaderEmpty = existingHeaders.every(h => h === '');

  if (isHeaderEmpty) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight('bold');
    return sheet;
  }

  const normalizedExisting = existingHeaders.map(normalizeHeader_);
  const missingHeaders = requiredHeaders.filter(header =>
    !normalizedExisting.includes(normalizeHeader_(header))
  );

  if (missingHeaders.length > 0) {
    const startColumn = sheet.getLastColumn() + 1;
    sheet.getRange(1, startColumn, 1, missingHeaders.length).setValues([missingHeaders]);
    sheet.getRange(1, startColumn, 1, missingHeaders.length).setFontWeight('bold');
  }

  sheet.setFrozenRows(1);
  return sheet;
}

function normalizeHeader_(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Medication Logbook')
    .addItem('ตรวจสอบ / สร้าง Columns', 'setupDatabase')
    .addToUi();
}

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    if (!isAuthorized_(params)) return jsonResponse({ success: false, error: 'Unauthorized' });
    ensureDatabase();

    const action = params.action;
    if (action === 'searchByHN') return searchByHN(params.hn);
    if (action === 'getAllActive') return getAllActive();
    if (action === 'getHistory') return getHistory(params.hn);
    if (action === 'getMedicineById') return getMedicineById(params.id);
    if (action === 'getEmpty') return getEmpty();

    return jsonResponse({ success: false, error: 'Invalid action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    if (!isAuthorized_(body)) return jsonResponse({ success: false, error: 'Unauthorized' });
    ensureDatabase();

    if (body.action === 'addMedicine') return addMedicine(body);
    if (body.action === 'dispense') return dispenseMedicine(body);

    return jsonResponse({ success: false, error: 'Invalid action' });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function isAuthorized_(data) {
  if (!API_TOKEN) return true;
  return data && String(data.token || '') === String(API_TOKEN);
}

function searchByHN(hn) {
  if (!hn) return jsonResponse({ success: false, error: 'HN is required' });

  const rows = readObjects_(SHEET_MEDICINES);
  const wanted = normalizeHN_(hn);
  const result = rows.filter(r =>
    normalizeHN_(r.HN) === wanted &&
    toNumber_(r.RemainingQty) > 0 &&
    String(r.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );

  return jsonResponse({ success: true, count: result.length, data: result });
}

function getAllActive() {
  const rows = readObjects_(SHEET_MEDICINES);
  const result = rows.filter(r =>
    toNumber_(r.RemainingQty) > 0 &&
    String(r.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );
  return jsonResponse({ success: true, count: result.length, data: result });
}

function getEmpty() {
  const rows = readObjects_(SHEET_MEDICINES);
  const result = rows.filter(r =>
    toNumber_(r.RemainingQty) <= 0 ||
    String(r.Status || '').toUpperCase() === 'HIDDEN'
  );
  return jsonResponse({ success: true, count: result.length, data: result });
}

function getMedicineById(id) {
  if (!id) return jsonResponse({ success: false, error: 'Medicine ID is required' });
  const rows = readObjects_(SHEET_MEDICINES);
  const item = rows.find(r => String(r.ID) === String(id));
  if (!item) return jsonResponse({ success: false, error: 'ไม่พบรายการยา' });
  if (toNumber_(item.RemainingQty) <= 0 || String(item.Status || '').toUpperCase() !== 'ACTIVE') {
    return jsonResponse({ success: false, error: 'รายการนี้ถูกจ่ายหมดหรือถูกซ่อนแล้ว' });
  }
  return jsonResponse({ success: true, data: item });
}

function getHistory(hn) {
  if (!hn) return jsonResponse({ success: false, error: 'HN is required' });

  const wanted = normalizeHN_(hn);
  const rows = readObjects_(SHEET_HISTORY)
    .filter(r => normalizeHN_(r.HN) === wanted)
    .reverse();

  return jsonResponse({ success: true, count: rows.length, data: rows });
}

function addMedicine(data) {
  validateRequired_(data.hn, 'HN');
  validateRequired_(data.patientName, 'ชื่อผู้ป่วย');
  validateRequired_(data.drugName, 'ชื่อยา');

  const totalQty = toNumber_(data.totalQty);
  if (totalQty <= 0) throw new Error('จำนวนรวมต้องมากกว่า 0');

  const now = new Date();
  const medicineSheet = getSheet_(SHEET_MEDICINES);
  const rowObj = {
    ID: Utilities.getUuid(),
    HN: cleanText_(data.hn),
    PatientName: cleanText_(data.patientName),
    DrugName: cleanText_(data.drugName),
    GenericName: cleanText_(data.genericName),
    Strength: cleanText_(data.strength),
    Form: cleanText_(data.form || 'Vial'),
    TotalQty: totalQty,
    RemainingQty: totalQty,
    Unit: cleanText_(data.unit || 'Vial'),
    Storage: cleanText_(data.storage),
    Hospital: cleanText_(data.hospital),
    PN: cleanText_(data.pn),
    EntryDate: cleanText_(data.entryDate),
    ExpiryDate: cleanText_(data.expiryDate),
    AdministrationSchedule: cleanText_(data.administrationSchedule),
    FollowUpDate: cleanText_(data.followUpDate),
    ImageURL: cleanText_(data.imageUrl),
    OCRRawText: cleanText_(data.ocrRawText),
    Notes: cleanText_(data.notes),
    Status: 'ACTIVE',
    CreatedAt: now,
    LastDispensed: '',
    CreatedBy: cleanText_(data.createdBy)
  };

  medicineSheet.appendRow(objectToSheetRow_(medicineSheet, rowObj));
  return jsonResponse({ success: true, message: 'เพิ่มยาฝากสำเร็จ', id: rowObj.ID });
}

function dispenseMedicine(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    validateRequired_(data.medicineId, 'Medicine ID');
    validateRequired_(data.dispensedBy, 'ผู้จ่าย');

    const dispenseQty = toNumber_(data.dispenseQty);
    if (dispenseQty <= 0) throw new Error('จำนวนที่จ่ายต้องมากกว่า 0');

    const sheet = getSheet_(SHEET_MEDICINES);
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const idx = makeIndex_(headers);

    let sheetRow = -1;
    let row = null;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idx.ID]) === String(data.medicineId)) {
        sheetRow = i + 1;
        row = values[i];
        break;
      }
    }

    if (sheetRow === -1 || !row) throw new Error('ไม่พบรายการยา');

    const currentQty = toNumber_(row[idx.RemainingQty]);
    if (currentQty <= 0) throw new Error('รายการนี้ไม่มีจำนวนคงเหลือแล้ว');
    if (dispenseQty > currentQty) {
      throw new Error('จำนวนที่จ่ายมากกว่าจำนวนคงเหลือ เหลืออยู่ ' + currentQty);
    }

    const newRemaining = currentQty - dispenseQty;
    const now = new Date();
    const newStatus = newRemaining <= 0 ? 'HIDDEN' : 'ACTIVE';

    sheet.getRange(sheetRow, idx.RemainingQty + 1).setValue(newRemaining);
    sheet.getRange(sheetRow, idx.LastDispensed + 1).setValue(now);
    sheet.getRange(sheetRow, idx.Status + 1).setValue(newStatus);

    const historySheet = getSheet_(SHEET_HISTORY);
    const historyRowObj = {
      DispenseID: Utilities.getUuid(),
      MedicineID: data.medicineId,
      HN: row[idx.HN] || '',
      PatientName: row[idx.PatientName] || '',
      DrugName: row[idx.DrugName] || '',
      DispenseQty: dispenseQty,
      RemainingAfter: newRemaining,
      DispensedBy: cleanText_(data.dispensedBy),
      Receiver: cleanText_(data.receiver),
      Ward: cleanText_(data.ward),
      DispenseDate: now,
      Notes: cleanText_(data.notes)
    };
    historySheet.appendRow(objectToSheetRow_(historySheet, historyRowObj));

    return jsonResponse({
      success: true,
      message: 'จ่ายยาสำเร็จ',
      remainingQty: newRemaining,
      isHidden: newRemaining <= 0
    });
  } finally {
    lock.releaseLock();
  }
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('ไม่พบ Sheet: ' + name + ' กรุณา run setupDatabase() ก่อน');
  return sheet;
}

function readObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  return values.slice(1).filter(r => r.some(v => v !== '')).map(row => rowToObject_(headers, row));
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    if (!h) return;
    const value = row[i];
    obj[h] = value instanceof Date ? value.toISOString() : (value === undefined ? '' : value);
  });
  return obj;
}

function objectToRow_(headers, obj) {
  return headers.map(h => obj[h] === undefined ? '' : obj[h]);
}

function objectToSheetRow_(sheet, obj) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(h => String(h || '').trim());

  return headers.map(h => h ? (obj[h] === undefined ? '' : obj[h]) : '');
}

function makeIndex_(headers) {
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);
  return idx;
}

function normalizeHN_(hn) {
  return String(hn || '').replace(/[^0-9]/g, '');
}

function toNumber_(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function validateRequired_(value, label) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new Error('กรุณากรอก ' + label);
  }
}

function cleanText_(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
