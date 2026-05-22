/**
 * ============================================================
 * GOOGLE APPS SCRIPT - Backend API for Medication Logbook
 * ============================================================
 * Features:
 * - Google Sheet database with auto-created sheets/columns
 * - HN stored as text format 07-XX-YYYYYY
 * - Staff ID validation before add medicine and dispense
 * - Exact dispense by MedicineID, so multiple HN / multiple medicines per HN are safe
 * - Department dropdown source from Departments sheet
 */

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const API_TOKEN = ''; // Optional. Example: 'CHANGE_THIS_SECRET'

const SHEET_MEDICINES = 'Medicines';
const SHEET_HISTORY = 'DispenseHistory';
const SHEET_STAFF = 'Staff';
const SHEET_DEPARTMENTS = 'Departments';

const MEDICINE_HEADERS = [
  'ID', 'HN', 'PatientName', 'DrugName', 'GenericName', 'Strength', 'Form',
  'TotalQty', 'RemainingQty', 'Unit', 'Storage', 'Hospital', 'PN',
  'EntryDate', 'ExpiryDate', 'AdministrationSchedule', 'FollowUpDate',
  'DepositLocation', 'DepartmentCode', 'DepartmentName',
  'ImageURL', 'OCRRawText', 'Notes', 'Status', 'CreatedAt', 'LastDispensed',
  'CreatedByStaffID', 'CreatedByName'
];

const HISTORY_HEADERS = [
  'DispenseID', 'MedicineID', 'HN', 'PatientName', 'DrugName',
  'DispenseQty', 'RemainingAfter', 'DispensedByStaffID', 'DispensedByName',
  'Receiver', 'Ward', 'DispenseDate', 'Notes'
];

const STAFF_HEADERS = [
  'StaffID', 'StaffName', 'Role', 'Active', 'CreatedAt', 'Notes'
];

const DEPARTMENT_HEADERS = [
  'DepartmentCode', 'DepartmentName', 'Active', 'CreatedAt', 'Notes'
];

const DEPOSIT_LOCATIONS = ['OPD Pharmacy', 'IPD Pharmacy'];
const SCHEMA_CACHE_KEY = 'MEDICATION_LOGBOOK_SCHEMA_OK_V2';
const SCHEMA_CACHE_SECONDS = 600;
const CACHE_ACTIVE_SECONDS = 20;
const CACHE_SEARCH_SECONDS = 20;
const CACHE_DEPARTMENTS_SECONDS = 21600;
const CACHE_STAFF_SECONDS = 300;
const CACHE_PREFIX = 'MEDLOG_V3:';

function setupDatabase() {
  ensureDatabase(true);
  clearMasterCache_();
  return 'Database setup completed';
}

function ensureDatabase(force) {
  /**
   * Performance stable version:
   * - ยังตรวจและสร้าง Sheet/Column ให้อัตโนมัติ
   * - แต่ใช้ CacheService ลดการตรวจ schema ซ้ำทุก request ซึ่งเป็นสาเหตุหลักที่ทำให้ระบบตอบสนองช้า
   * - setupDatabase() ใช้ force=true เพื่อตรวจเต็มทันที
   */
  const cache = CacheService.getScriptCache();
  if (!force && cache.get(SCHEMA_CACHE_KEY) === '1') return true;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    if (!force && cache.get(SCHEMA_CACHE_KEY) === '1') return true;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    ensureSheetColumns_(ss, SHEET_MEDICINES, MEDICINE_HEADERS, ['HN', 'PN', 'CreatedByStaffID']);
    ensureSheetColumns_(ss, SHEET_HISTORY, HISTORY_HEADERS, ['HN', 'DispensedByStaffID']);
    ensureSheetColumns_(ss, SHEET_STAFF, STAFF_HEADERS, ['StaffID']);
    ensureSheetColumns_(ss, SHEET_DEPARTMENTS, DEPARTMENT_HEADERS, ['DepartmentCode']);
    seedDefaultRows_(ss);
    cache.put(SCHEMA_CACHE_KEY, '1', SCHEMA_CACHE_SECONDS);
    return true;
  } finally {
    lock.releaseLock();
  }
}

function ensureSheetColumns_(ss, sheetName, requiredHeaders, textHeaders) {
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight('bold');
    applyTextColumnFormats_(sheet, requiredHeaders, textHeaders || []);
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
    applyTextColumnFormats_(sheet, requiredHeaders, textHeaders || []);
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
  applyTextColumnFormats_(sheet, requiredHeaders, textHeaders || []);
  return sheet;
}

function applyTextColumnFormats_(sheet, requiredHeaders, textHeaders) {
  if (!textHeaders || textHeaders.length === 0) return;

  const headerRow = sheet
    .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), requiredHeaders.length))
    .getValues()[0]
    .map(h => String(h || '').trim());

  textHeaders.forEach(header => {
    const index = headerRow.findIndex(h => normalizeHeader_(h) === normalizeHeader_(header));
    if (index >= 0) {
      sheet.getRange(1, index + 1, Math.max(sheet.getMaxRows(), 1), 1).setNumberFormat('@');
    }
  });
}

function seedDefaultRows_(ss) {
  /**
   * เติมข้อมูลเริ่มต้นเฉพาะชีตที่ยังว่าง เพื่อให้ dropdown ใช้งานได้ทันที
   * Staff ต้องเพิ่มเองตามหน่วยงานจริง จึงไม่ seed Staff ปลอมให้
   */
  const depSheet = ss.getSheetByName(SHEET_DEPARTMENTS);
  if (depSheet && depSheet.getLastRow() <= 1) {
    appendObjectRow_(depSheet, {
      DepartmentCode: 'OPD',
      DepartmentName: 'OPD',
      Active: true,
      CreatedAt: new Date(),
      Notes: 'Default department - edit as needed'
    }, ['DepartmentCode']);
    appendObjectRow_(depSheet, {
      DepartmentCode: 'IPD',
      DepartmentName: 'IPD',
      Active: true,
      CreatedAt: new Date(),
      Notes: 'Default department - edit as needed'
    }, ['DepartmentCode']);
  }
}

function normalizeHeader_(header) {
  return String(header || '').trim().toLowerCase().replace(/\s+/g, '');
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
    if (action === 'getDispensePageData') return getDispensePageData(params.id);
    if (action === 'getEmpty') return getEmpty();
    if (action === 'getDepartments') return getDepartments();
    if (action === 'getDepositLocations') return getDepositLocations();
    if (action === 'validateStaff') return validateStaffIdAction_(params.staffId);

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

  const wanted = normalizeHN_(hn);
  const cacheKey = CACHE_PREFIX + 'SEARCH_HN:' + wanted;
  const cached = getCachedJson_(cacheKey);
  if (cached) return jsonResponse(cached);

  const rows = readObjects_(SHEET_MEDICINES);
  const result = rows.filter(r =>
    normalizeHN_(r.HN) === wanted &&
    toNumber_(r.RemainingQty) > 0 &&
    String(r.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );

  const output = { success: true, count: result.length, data: result };
  putCachedJson_(cacheKey, output, CACHE_SEARCH_SECONDS);
  return jsonResponse(output);
}

function getAllActive() {
  const cacheKey = CACHE_PREFIX + 'ALL_ACTIVE';
  const cached = getCachedJson_(cacheKey);
  if (cached) return jsonResponse(cached);

  const rows = readObjects_(SHEET_MEDICINES);
  const result = rows.filter(r =>
    toNumber_(r.RemainingQty) > 0 &&
    String(r.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'
  );

  const output = { success: true, count: result.length, data: result };
  putCachedJson_(cacheKey, output, CACHE_ACTIVE_SECONDS);
  return jsonResponse(output);
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

function getDispensePageData(id) {
  /**
   * Batch endpoint สำหรับหน้าจ่ายยา
   * ลด API calls จาก getMedicineById + getDepartments เหลือครั้งเดียว
   */
  if (!id) return jsonResponse({ success: false, error: 'Medicine ID is required' });

  const rows = readObjects_(SHEET_MEDICINES);
  const item = rows.find(r => String(r.ID) === String(id));
  if (!item) return jsonResponse({ success: false, error: 'ไม่พบรายการยา' });
  if (toNumber_(item.RemainingQty) <= 0 || String(item.Status || '').toUpperCase() !== 'ACTIVE') {
    return jsonResponse({ success: false, error: 'รายการนี้ถูกจ่ายหมดหรือถูกซ่อนแล้ว' });
  }

  return jsonResponse({
    success: true,
    data: {
      medicine: item,
      departments: getDepartmentsArrayCached_(),
      depositLocations: DEPOSIT_LOCATIONS
    }
  });
}

function getHistory(hn) {
  if (!hn) return jsonResponse({ success: false, error: 'HN is required' });

  const wanted = normalizeHN_(hn);
  const rows = readObjects_(SHEET_HISTORY)
    .filter(r => normalizeHN_(r.HN) === wanted)
    .reverse();

  return jsonResponse({ success: true, count: rows.length, data: rows });
}

function getDepartments() {
  const rows = getDepartmentsArrayCached_();
  return jsonResponse({ success: true, count: rows.length, data: rows });
}

function getDepositLocations() {
  return jsonResponse({ success: true, data: DEPOSIT_LOCATIONS });
}

function validateStaffIdAction_(staffId) {
  const staff = getValidStaff_(staffId);
  if (!staff) {
    return jsonResponse({ success: false, error: 'Staff ID ไม่ถูกต้อง' });
  }
  return jsonResponse({ success: true, data: staff });
}

function addMedicine(data) {
  validateRequired_(data.hn, 'HN');
  validateRequired_(data.patientName, 'ชื่อผู้ป่วย');
  validateRequired_(data.drugName, 'ชื่อยา');
  validateRequired_(data.createdByStaffId, 'Staff ID ผู้บันทึก');
  validateRequired_(data.depositLocation, 'จุดรับฝากยา');
  validateRequired_(data.departmentName, 'หน่วยงานที่เอายามาฝาก');

  const staff = getValidStaff_(data.createdByStaffId);
  if (!staff) throw new Error('Staff ID ไม่ถูกต้อง');

  if (DEPOSIT_LOCATIONS.indexOf(cleanText_(data.depositLocation)) === -1) {
    throw new Error('จุดรับฝากยาไม่ถูกต้อง');
  }

  const totalQty = toNumber_(data.totalQty);
  if (totalQty <= 0) throw new Error('จำนวนรวมต้องมากกว่า 0');

  const now = new Date();
  const medicineSheet = getSheet_(SHEET_MEDICINES);
  const rowObj = {
    ID: Utilities.getUuid(),
    HN: formatHNForStorage_(data.hn),
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
    DepositLocation: cleanText_(data.depositLocation),
    DepartmentCode: cleanText_(data.departmentCode),
    DepartmentName: cleanText_(data.departmentName),
    ImageURL: cleanText_(data.imageUrl),
    OCRRawText: cleanText_(data.ocrRawText),
    Notes: cleanText_(data.notes),
    Status: 'ACTIVE',
    CreatedAt: now,
    LastDispensed: '',
    CreatedByStaffID: normalizeStaffId_(data.createdByStaffId),
    CreatedByName: staff.StaffName || ''
  };

  appendObjectRow_(medicineSheet, rowObj, ['HN', 'PN', 'CreatedByStaffID']);
  clearMedicineCacheForHN_(rowObj.HN);
  return jsonResponse({ success: true, message: 'เพิ่มยาฝากสำเร็จ', id: rowObj.ID, hn: rowObj.HN });
}

function dispenseMedicine(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    validateRequired_(data.medicineId, 'Medicine ID');
    validateRequired_(data.dispensedByStaffId, 'Staff ID ผู้จ่าย');

    const staff = getValidStaff_(data.dispensedByStaffId);
    if (!staff) throw new Error('Staff ID ไม่ถูกต้อง');

    const dispenseQty = toNumber_(data.dispenseQty);
    if (dispenseQty <= 0) throw new Error('จำนวนที่จ่ายต้องมากกว่า 0');

    const sheet = getSheet_(SHEET_MEDICINES);
    const range = sheet.getDataRange();
    const values = range.getValues();
    const displayValues = range.getDisplayValues();
    const headers = values[0].map(String);
    const idx = makeIndex_(headers);

    let sheetRow = -1;
    let row = null;
    let rowDisplay = null;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idx.ID]) === String(data.medicineId)) {
        sheetRow = i + 1;
        row = values[i];
        rowDisplay = displayValues[i];
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
      HN: safeFormatHN_(rowDisplay ? rowDisplay[idx.HN] : row[idx.HN]),
      PatientName: row[idx.PatientName] || '',
      DrugName: row[idx.DrugName] || '',
      DispenseQty: dispenseQty,
      RemainingAfter: newRemaining,
      DispensedByStaffID: normalizeStaffId_(data.dispensedByStaffId),
      DispensedByName: staff.StaffName || '',
      Receiver: cleanText_(data.receiver),
      Ward: cleanText_(data.ward),
      DispenseDate: now,
      Notes: cleanText_(data.notes)
    };
    appendObjectRow_(historySheet, historyRowObj, ['HN', 'DispensedByStaffID']);
    clearMedicineCacheForHN_(historyRowObj.HN);

    return jsonResponse({
      success: true,
      message: 'จ่ายยาสำเร็จ',
      remainingQty: newRemaining,
      isHidden: newRemaining <= 0,
      dispensedByName: staff.StaffName || ''
    });
  } finally {
    lock.releaseLock();
  }
}

function getValidStaff_(staffId) {
  const id = normalizeStaffId_(staffId);
  if (!id) return null;

  const rows = getActiveStaffRowsCached_();
  const staff = rows.find(r =>
    normalizeStaffId_(r.StaffID) === id
  );

  if (!staff) return null;
  return {
    StaffID: cleanText_(staff.StaffID),
    StaffName: cleanText_(staff.StaffName),
    Role: cleanText_(staff.Role)
  };
}

function getDepartmentsArrayCached_() {
  const cacheKey = CACHE_PREFIX + 'DEPARTMENTS';
  const cached = getCachedJson_(cacheKey);
  if (cached) return cached;

  const rows = readObjects_(SHEET_DEPARTMENTS)
    .filter(r => String(r.Active || 'TRUE').toUpperCase() !== 'FALSE')
    .map(r => ({
      DepartmentCode: cleanText_(r.DepartmentCode),
      DepartmentName: cleanText_(r.DepartmentName)
    }))
    .filter(r => r.DepartmentName);

  putCachedJson_(cacheKey, rows, CACHE_DEPARTMENTS_SECONDS);
  return rows;
}

function getActiveStaffRowsCached_() {
  const cacheKey = CACHE_PREFIX + 'ACTIVE_STAFF';
  const cached = getCachedJson_(cacheKey);
  if (cached) return cached;

  const rows = readObjects_(SHEET_STAFF)
    .filter(r => String(r.Active || 'TRUE').toUpperCase() !== 'FALSE');

  putCachedJson_(cacheKey, rows, CACHE_STAFF_SECONDS);
  return rows;
}

function getCachedJson_(key) {
  const text = CacheService.getScriptCache().get(key);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

function putCachedJson_(key, value, seconds) {
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(value), seconds);
  } catch (err) {
    // CacheService มีขนาดจำกัด ถ้า cache ไม่ได้ให้ข้ามไป ระบบยังทำงานได้ปกติ
  }
}

function clearMedicineCacheForHN_(hn) {
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_PREFIX + 'ALL_ACTIVE');
  const normalizedHN = normalizeHN_(hn);
  if (normalizedHN) cache.remove(CACHE_PREFIX + 'SEARCH_HN:' + normalizedHN);
}

function clearMasterCache_() {
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_PREFIX + 'DEPARTMENTS');
  cache.remove(CACHE_PREFIX + 'ACTIVE_STAFF');
  cache.remove(CACHE_PREFIX + 'ALL_ACTIVE');
}

function appendObjectRow_(sheet, obj, textHeaders) {
  const row = sheet.getLastRow() + 1;
  const values = objectToSheetRow_(sheet, obj);
  const headers = getSheetHeaders_(sheet);

  (textHeaders || []).forEach(header => {
    const colIndex = headers.findIndex(h => normalizeHeader_(h) === normalizeHeader_(header)) + 1;
    if (colIndex > 0) sheet.getRange(row, colIndex).setNumberFormat('@');
  });

  sheet.getRange(row, 1, 1, values.length).setValues([values]);
}

function getSheetHeaders_(sheet) {
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(h => String(h || '').trim());
}

function getSheet_(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  // fallback กรณีมีคนลบ sheet หลังจากเริ่ม request
  ensureDatabase(true);
  sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error('ไม่สามารถสร้าง Sheet: ' + name + ' ได้');
  return sheet;
}

function readObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayValues = range.getDisplayValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  const displayHeaders = displayValues[0].map(String);
  return values
    .slice(1)
    .filter(r => r.some(v => v !== ''))
    .map((row, i) => rowToObject_(headers, row, displayValues[i + 1], displayHeaders));
}

function rowToObject_(headers, row, displayRow) {
  const obj = {};
  headers.forEach((h, i) => {
    if (!h) return;
    const header = String(h).trim();
    const value = row[i];
    const displayValue = displayRow ? displayRow[i] : value;

    if (header === 'HN' || header === 'StaffID' || header === 'CreatedByStaffID' || header === 'DispensedByStaffID') {
      obj[header] = cleanText_(displayValue);
    } else if (value instanceof Date) {
      obj[header] = value.toISOString();
    } else {
      obj[header] = value === undefined ? '' : value;
    }
  });
  return obj;
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

function formatHNForStorage_(hn) {
  const digits = normalizeHN_(hn);

  if (!digits) return '';
  if (!digits.startsWith('07')) {
    throw new Error('รูปแบบ HN ต้องขึ้นต้นด้วย 07 และอยู่ในรูปแบบ 07-XX-YYYYYY');
  }
  if (digits.length < 5) {
    throw new Error('รูปแบบ HN ไม่ถูกต้อง ต้องเป็น 07-XX-YYYYYY');
  }

  const prefix = digits.slice(0, 2);
  const middle = digits.slice(2, 4);
  const running = digits.slice(4).padStart(6, '0').slice(-6);
  const formatted = `${prefix}-${middle}-${running}`;

  if (!/^07-\d{2}-\d{6}$/.test(formatted)) {
    throw new Error('รูปแบบ HN ไม่ถูกต้อง ต้องเป็น 07-XX-YYYYYY');
  }
  return formatted;
}

function safeFormatHN_(hn) {
  try {
    return formatHNForStorage_(hn);
  } catch (err) {
    return cleanText_(hn);
  }
}

function normalizeHN_(hn) {
  return String(hn || '').replace(/[^0-9]/g, '');
}

function normalizeStaffId_(staffId) {
  return String(staffId || '').trim().toUpperCase();
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
