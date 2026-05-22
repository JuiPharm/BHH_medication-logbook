// ===== js/api.js =====
/**
 * ====================
 * API CLIENT
 * ====================
 * ใช้ simple request เพื่อให้เรียก Google Apps Script จาก GitHub Pages ได้ง่ายขึ้น
 */

class ApiClient {
  constructor() {
    this.baseUrl = CONFIG.API_URL;
  }

  async get(action, params = {}) {
    const url = new URL(this.baseUrl);
    url.searchParams.set('action', action);
    if (CONFIG.API_TOKEN) url.searchParams.set('token', CONFIG.API_TOKEN);

    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.set(key, params[key]);
      }
    });

    const response = await fetch(url.toString(), { method: 'GET' });
    return await this.parseResponse(response);
  }

  async post(data) {
    const payload = { ...data };
    if (CONFIG.API_TOKEN) payload.token = CONFIG.API_TOKEN;

    // ห้ามตั้ง Content-Type: application/json เพื่อหลีกเลี่ยง preflight CORS
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return await this.parseResponse(response);
  }

  async parseResponse(response) {
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new Error('API ไม่ได้ตอบกลับเป็น JSON: ' + text.slice(0, 200));
    }
    if (!response.ok) {
      throw new Error(json.error || `HTTP ${response.status}`);
    }
    return json;
  }
}

const api = new ApiClient();

async function apiGet(action, params) {
  return await api.get(action, params);
}

async function apiPost(data) {
  return await api.post(data);
}


// ===== js/ocr.js =====
/**
 * ====================
 * OCR MODULE (Tesseract.js)
 * ====================
 */

class OCRProcessor {
  constructor() {
    this.isProcessing = false;
  }

  async processImage(file) {
    if (this.isProcessing) {
      showToast('กำลังประมวลผลรูปภาพอื่นอยู่', 'warning');
      return null;
    }

    this.isProcessing = true;
    showOCRProgress(true);

    try {
      const result = await Tesseract.recognize(file, CONFIG.OCR.LANG, {
        logger: m => {
          if (m.status === 'recognizing text') updateProgress(m.progress * 100);
        }
      });

      const text = result.data.text || '';
      const confidence = result.data.confidence || 0;
      showOCRResult(text, confidence);
      autoFillFromOCR(text);
      showToast(`✅ OCR เสร็จสิ้น (ความแม่นยำประมาณ ${Math.round(confidence)}%)`, 'success');
      return { text, confidence };
    } catch (err) {
      console.error(err);
      showOCRResult('', 0, err.message);
      showToast('❌ OCR ล้มเหลว: ' + err.message, 'danger');
      return null;
    } finally {
      this.isProcessing = false;
      showOCRProgress(false);
    }
  }
}

const ocrProcessor = new OCRProcessor();

async function processOCR(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 8 * 1024 * 1024) {
    showToast('ไฟล์ใหญ่เกินไป สูงสุด 8MB', 'danger');
    return;
  }
  await ocrProcessor.processImage(file);
}

function showOCRProgress(show) {
  const div = document.getElementById('ocrProgress');
  if (div) div.classList.toggle('d-none', !show);
}

function updateProgress(percent) {
  const bar = document.getElementById('progressBar');
  const status = document.getElementById('ocrStatus');
  if (bar) bar.style.width = `${Math.round(percent)}%`;
  if (status) status.textContent = `กำลังอ่านข้อความ... ${Math.round(percent)}%`;
}

function showOCRResult(text, confidence, error = null) {
  const preview = document.getElementById('ocrPreview');
  const raw = document.getElementById('ocrRawText');
  if (raw && text) raw.value = text;
  if (!preview) return;

  if (error) {
    preview.innerHTML = `<div class="alert alert-danger"><strong>❌ OCR ล้มเหลว</strong><br>${escapeHtml(error)}</div>`;
    return;
  }

  const truncated = text.length > 700 ? text.slice(0, 700) + '...' : text;
  preview.innerHTML = `
    <div class="alert alert-success">
      <strong>✅ OCR สำเร็จ</strong>
      <span class="badge bg-primary">ความแม่นยำ: ${Math.round(confidence)}%</span>
      <pre class="ocr-text-preview mt-2 mb-0">${escapeHtml(truncated)}</pre>
    </div>`;
}

function autoFillFromOCR(text) {
  const fields = extractFieldsFromOCR(text);
  const mappings = {
    hn: fields.hn,
    pn: fields.pn,
    patientName: fields.patientName,
    drugName: fields.drugName,
    genericName: fields.genericName,
    strength: fields.strength,
    totalQty: fields.totalQty,
    unit: fields.unit,
    form: fields.form,
    storage: fields.storage,
    hospital: fields.hospital,
    entryDate: fields.entryDate,
    expiryDate: fields.expiryDate,
    administrationSchedule: fields.administrationSchedule,
    followUpDate: fields.followUpDate,
    notes: fields.notes,
    ocrRawText: text
  };

  let filled = 0;
  Object.keys(mappings).forEach(id => {
    const el = document.getElementById(id);
    const value = mappings[id];
    if (el && value !== undefined && value !== null && String(value).trim() !== '') {
      el.value = value;
      el.classList.add('is-valid');
      setTimeout(() => el.classList.remove('is-valid'), 2200);
      filled++;
    }
  });

  if (filled > 0) showToast(`📝 กรอกฟอร์มจาก OCR ${filled} รายการ กรุณาตรวจทานก่อนบันทึก`, 'info');
}

function extractFieldsFromOCR(text) {
  const t = normalizeOCRText(text);
  const fields = {};

  fields.hn = matchFirstPattern(t, [
    /HN\s*[:：]?\s*([0-9]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{4,8})/i,
    /HN\s*[:：]?\s*([A-Z0-9-]{6,})/i,
    /หมายเลขผู้ป่วย\s*[:：]?\s*([0-9-]+)/i
  ]);
  if (fields.hn) fields.hn = fields.hn.replace(/\s+/g, '');

  fields.pn = matchFirstPattern(t, [
    /PN\s*[:：]?\s*([A-Z0-9-]+)/i,
    /Prescription\s*[:：]?\s*([A-Z0-9-]+)/i
  ]);

  fields.patientName = extractPatientName(t);

  const drugLine = findLine(t, /(Espogen|Hema\s*Plus|Herna\s*Plus|Cef-?3|Ceftriaxone|Epoetin)/i);
  if (drugLine) fields.drugName = drugLine.replace(/^[-•\s]+/, '').trim();
  const drugMatch = matchFirstPattern(t, [
    /(Espogen(?:\s+Inj)?)/i,
    /(Hema\s*Plus|Herna\s*Plus)/i,
    /(Cef-?3)/i,
    /(Ceftriaxone)/i,
    /ชื่อยา\s*[:：]?\s*([^\n]+)/i
  ]);
  if (!fields.drugName && drugMatch) fields.drugName = drugMatch;
  if (fields.drugName) fields.drugName = fields.drugName.replace(/Herna/i, 'Hema');

  fields.genericName = matchFirstPattern(t, [
    /(epoetin\s+alfa)/i,
    /(ceftriaxone)/i,
    /ชื่อสามัญ\s*[:：]?\s*([^\n]+)/i
  ]);

  const strength = t.match(/([0-9,]+(?:\.\d+)?)\s*(IU|U|unit|units|mg|มิลลิกรัม|mcg|µg|g)\b/i);
  if (strength) fields.strength = `${strength[1].replace(/,/g, '')} ${strength[2].toUpperCase()}`;

  const qty = t.match(/#\s*(\d+(?:\.\d+)?)\s*(Vial|vial|ขวด|Ampoule|Tablet|Capsule|Syringe)?/i)
    || t.match(/จำนวน\s*[:：]?\s*(\d+(?:\.\d+)?)/i)
    || t.match(/(\d+(?:\.\d+)?)\s*(Vial|vial|ขวด|Ampoule|Tablet|Capsule|Syringe)/i);
  if (qty) {
    fields.totalQty = Number(qty[1]);
    const unitRaw = qty[2] || 'Vial';
    fields.unit = normalizeUnit(unitRaw);
    fields.form = fields.unit;
  }

  const storage = t.match(/([0-9]+\s*[-–]\s*[0-9]+)\s*°?\s*C/i)
    || t.match(/เก็บ[^\n]*?([0-9]+\s*[-–]\s*[0-9]+)\s*°?\s*C/i)
    || t.match(/เก็บในตู้เย็น/i);
  if (storage) fields.storage = storage[1] ? storage[1].replace(/\s/g, '') + '°C' : 'เก็บในตู้เย็น';

  if (/Bangkok\s*Hospital|โรงพยาบาลกรุงเทพ/i.test(t)) fields.hospital = 'Bangkok Hospital';

  const dates = extractDates(t);
  if (dates.length > 0) fields.entryDate = dates[0].iso;
  // ถ้ามีวันหมดอายุจริงมักมีคำ exp/expiry; ไม่บังคับ auto-fill จากวันที่ที่สองเสมอเพราะในฉลากอาจเป็น DOB/follow-up
  const expDate = findDateNearKeyword(t, /(exp|expiry|หมดอายุ)/i);
  if (expDate) fields.expiryDate = expDate.iso;

  const followDate = findDateNearKeyword(t, /(follow\s*up|นัด|ครั้งต่อไป|Follow)/i);
  if (followDate) fields.followUpDate = followDate.iso;

  const adminLine = findLine(t, /(SC|IM|IV|ฉีด|รับประทาน|ครั้งละ|ทุก\s*\d+|สัปดาห์ละ)/i);
  if (adminLine) fields.administrationSchedule = adminLine;

  const notes = [];
  if (fields.administrationSchedule) notes.push(fields.administrationSchedule);
  const cold = findLine(t, /(เก็บในตู้เย็น|2\s*[-–]\s*8\s*°?\s*C)/i);
  if (cold) notes.push(cold);
  fields.notes = [...new Set(notes)].join('\n');

  return fields;
}

function normalizeOCRText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[|]/g, 'I')
    .replace(/＃/g, '#');
}

function extractPatientName(text) {
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  const prefix = /(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|พระ|พระอธิการ|พระครู)/;
  for (const line of lines) {
    if (prefix.test(line) && !/(โรงพยาบาล|Hospital|HN|PN|วันเกิด|ฉีด|ยา|Epoetin|Cef|Espogen|Hema)/i.test(line)) {
      return line.replace(/[{}\[\]]/g, '').trim();
    }
  }
  const m = text.match(/Name\s*[:：]?\s*([^\n]+)/i);
  return m ? m[1].trim() : '';
}

function findLine(text, regex) {
  return text.split('\n').map(s => s.trim()).find(line => regex.test(line)) || '';
}

function normalizeUnit(unit) {
  const u = String(unit || '').toLowerCase();
  if (/vial|ขวด/.test(u)) return 'Vial';
  if (/amp/.test(u)) return 'Ampoule';
  if (/tab/.test(u)) return 'Tablet';
  if (/cap/.test(u)) return 'Capsule';
  if (/syringe/.test(u)) return 'Syringe';
  return unit || 'Vial';
}

function extractDates(text) {
  const thaiMonths = {
    'ม.ค.': '01', 'มค': '01', 'มกราคม': '01',
    'ก.พ.': '02', 'กพ': '02', 'กุมภาพันธ์': '02',
    'มี.ค.': '03', 'มีค': '03', 'มีนาคม': '03',
    'เม.ย.': '04', 'เมย': '04', 'เมษายน': '04',
    'พ.ค.': '05', 'พค': '05', 'พฤษภาคม': '05',
    'มิ.ย.': '06', 'มิย': '06', 'มิถุนายน': '06',
    'ก.ค.': '07', 'กค': '07', 'กรกฎาคม': '07',
    'ส.ค.': '08', 'สค': '08', 'สิงหาคม': '08',
    'ก.ย.': '09', 'กย': '09', 'กันยายน': '09',
    'ต.ค.': '10', 'ตค': '10', 'ตุลาคม': '10',
    'พ.ย.': '11', 'พย': '11', 'พฤศจิกายน': '11',
    'ธ.ค.': '12', 'ธค': '12', 'ธันวาคม': '12'
  };

  const found = [];
  const numeric = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/g;
  let m;
  while ((m = numeric.exec(text)) !== null) {
    found.push(makeDateObj(m[1], m[2], m[3], m[0]));
  }

  const thai = /(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มค|กพ|มีค|เมย|พค|มิย|กค|สค|กย|ตค|พย|ธค|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{2,4})/g;
  while ((m = thai.exec(text)) !== null) {
    found.push(makeDateObj(m[1], thaiMonths[m[2]], m[3], m[0]));
  }

  return found.filter(d => d && d.iso).filter((d, i, arr) => arr.findIndex(x => x.iso === d.iso) === i);
}

function makeDateObj(day, month, year, raw) {
  let y = Number(year);
  if (String(year).length === 2) y += 2500;
  if (y > 2400) y -= 543;
  const d = String(day).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  if (!y || Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return { raw, iso: `${y}-${m}-${d}` };
}

function findDateNearKeyword(text, keywordRegex) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (keywordRegex.test(lines[i])) {
      const block = [lines[i - 1], lines[i], lines[i + 1]].filter(Boolean).join('\n');
      const dates = extractDates(block);
      if (dates.length) return dates[0];
    }
  }
  return null;
}

function matchFirstPattern(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return (match[1] || match[0]).trim();
  }
  return '';
}


// ===== js/app.js =====
/**
 * ====================
 * MAIN APPLICATION
 * ====================
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showToast(message, type = 'info') {
  const toastEl = document.getElementById('liveToast');
  if (!toastEl || typeof bootstrap === 'undefined') {
    console.log(`[${type}] ${message}`);
    return;
  }

  const titleEl = document.getElementById('toastTitle');
  const msgEl = document.getElementById('toastMessage');
  const typeConfig = {
    success: { title: 'สำเร็จ', class: 'text-success' },
    danger: { title: 'ผิดพลาด', class: 'text-danger' },
    warning: { title: 'คำเตือน', class: 'text-warning' },
    info: { title: 'แจ้งเตือน', class: 'text-info' }
  };
  const config = typeConfig[type] || typeConfig.info;

  if (titleEl) {
    titleEl.textContent = config.title;
    titleEl.className = `me-auto ${config.class}`;
  }
  if (msgEl) msgEl.textContent = message;
  bootstrap.Toast.getOrCreateInstance(toastEl).show();
}

const submitLocks = {};

function toggleSavingOverlay(show, message) {
  const overlay = document.getElementById('savingOverlay');
  if (!overlay) return;
  overlay.classList.toggle('d-none', !show);
  const text = overlay.querySelector('[data-saving-message]');
  if (text) text.textContent = message || 'กำลังบันทึกข้อมูล กรุณารอสักครู่';
}

function setSubmitBusy(form, key, busy, message) {
  if (!form) return false;

  if (busy) {
    if (submitLocks[key]) return false;
    submitLocks[key] = true;
    form.dataset.busy = 'true';
    form.setAttribute('aria-busy', 'true');
    toggleSavingOverlay(true, message || 'กำลังบันทึกข้อมูล กรุณารอสักครู่');
  } else {
    submitLocks[key] = false;
    form.dataset.busy = 'false';
    form.removeAttribute('aria-busy');
    toggleSavingOverlay(false);
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  if (!submitBtn) return true;

  if (busy) {
    submitBtn.dataset.originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${message || 'กำลังบันทึก... กรุณารอ'}`;
    submitBtn.classList.add('disabled');
  } else {
    submitBtn.disabled = false;
    submitBtn.innerHTML = submitBtn.dataset.originalText || submitBtn.innerHTML;
    submitBtn.classList.remove('disabled');
  }

  return true;
}


function showInvalidStaffPopup() {
  showToast('Staff ID ไม่ถูกต้อง', 'danger');
  alert('Staff ID ไม่ถูกต้อง');
}

function popupWarning(message) {
  showToast(message, 'warning');
  alert(message);
}

function popupError(message) {
  showToast(message, 'danger');
  alert(message);
}

function validateRequiredFields(fieldDefs) {
  const missing = [];
  let firstMissingEl = null;

  fieldDefs.forEach(def => {
    const el = document.getElementById(def.id);
    const value = el ? String(el.value || '').trim() : '';
    if (!value) {
      missing.push(def.label);
      if (!firstMissingEl) firstMissingEl = el;
      if (el) el.classList.add('is-invalid');
    } else if (el) {
      el.classList.remove('is-invalid');
    }
  });

  if (missing.length > 0) {
    popupWarning('กรุณากรอกข้อมูลให้ครบถ้วน:\n- ' + missing.join('\n- '));
    if (firstMissingEl) firstMissingEl.focus();
    return false;
  }
  return true;
}

function validateHNFormatOrPopup(hn) {
  if (!/^07-\d{2}-\d{6}$/.test(String(hn || '').trim())) {
    popupWarning('รูปแบบ HN ไม่ถูกต้อง ต้องเป็น 07-XX-YYYYYY เช่น 07-25-000023');
    const hnInput = document.getElementById('hn') || document.getElementById('searchHN') || document.getElementById('historyHN');
    if (hnInput) {
      hnInput.classList.add('is-invalid');
      hnInput.focus();
    }
    return false;
  }
  return true;
}

async function validateStaffField(inputId, labelId) {
  const input = document.getElementById(inputId);
  const label = document.getElementById(labelId);
  if (!input || !String(input.value).trim()) {
    if (label) label.textContent = '';
    return null;
  }

  try {
    const res = await apiGet('validateStaff', { staffId: input.value.trim() });
    if (res.success && res.data) {
      if (label) {
        label.textContent = `ตรวจสอบแล้ว: ${res.data.StaffName || res.data.StaffID}`;
        label.className = 'text-success';
      }
      return res.data;
    }
    if (label) {
      label.textContent = 'Staff ID ไม่ถูกต้อง';
      label.className = 'text-danger';
    }
    showInvalidStaffPopup();
    return null;
  } catch (err) {
    console.error(err);
    if (label) {
      label.textContent = 'ตรวจสอบ Staff ID ไม่สำเร็จ';
      label.className = 'text-danger';
    }
    return null;
  }
}

function getLocalCache_(key, ttlMs) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || !cached.savedAt || Date.now() - cached.savedAt > ttlMs) return null;
    return cached.data;
  } catch (err) {
    return null;
  }
}

function setLocalCache_(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (err) {
    // localStorage เต็มหรือถูกปิดไว้ ให้ข้ามไปได้
  }
}

async function getDepartmentsCached() {
  const key = 'medlog_departments_v1';
  const ttl = 6 * 60 * 60 * 1000;
  const cached = getLocalCache_(key, ttl);
  if (cached) {
    // stale-while-revalidate: แสดงข้อมูล cache ทันที แล้วอัปเดตเบื้องหลัง
    apiGet('getDepartments')
      .then(res => { if (res.success) setLocalCache_(key, res.data || []); })
      .catch(() => {});
    return cached;
  }

  const res = await apiGet('getDepartments');
  const departments = res.success ? (res.data || []) : [];
  setLocalCache_(key, departments);
  return departments;
}

function populateDepartmentSelect(select, departments, selectedValue = '', label = '-- เลือกหน่วยงาน --') {
  if (!select) return;
  select.innerHTML = `<option value="">${label}</option>`;
  (departments || []).forEach(dep => {
    const option = document.createElement('option');
    option.value = dep.DepartmentCode || dep.DepartmentName;
    option.textContent = dep.DepartmentName || dep.DepartmentCode;
    option.dataset.name = dep.DepartmentName || '';
    option.dataset.code = dep.DepartmentCode || '';
    select.appendChild(option);
  });

  if (selectedValue) {
    const wanted = String(selectedValue).trim();
    const matched = Array.from(select.options).find(opt =>
      opt.value === wanted || opt.dataset.name === wanted || opt.textContent === wanted
    );
    if (matched) select.value = matched.value;
  }
}

async function loadDepartmentOptions(selectId = 'department', selectedValue = '') {
  const select = document.getElementById(selectId);
  if (!select || !checkConfig()) return;

  try {
    const departments = await getDepartmentsCached();
    populateDepartmentSelect(select, departments, selectedValue);
    if (departments.length === 0) {
      showToast('ยังไม่มีข้อมูลหน่วยงานใน Sheet Departments', 'warning');
    }
  } catch (err) {
    console.error(err);
    showToast('โหลดข้อมูลหน่วยงานไม่สำเร็จ: ' + err.message, 'danger');
  }
}

function showLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.classList.remove('d-none');
  const results = document.getElementById('results');
  if (results) results.innerHTML = '';
}

function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) loading.classList.add('d-none');
}

function formatHNInput(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (!digits.startsWith('07') || digits.length < 5) return String(value || '').trim();

  const prefix = digits.slice(0, 2);
  const middle = digits.slice(2, 4);
  const running = digits.slice(4).padStart(6, '0').slice(-6);
  return `${prefix}-${middle}-${running}`;
}

function applyHNFormat(input) {
  if (!input) return '';
  const formatted = formatHNInput(input.value);
  input.value = formatted;
  return formatted;
}

async function searchMedicine() {
  if (!checkConfig()) return;
  const searchInput = document.getElementById('searchHN');
  const hn = applyHNFormat(searchInput);
  if (!hn) {
    popupWarning('กรุณากรอก HN');
    return;
  }

  showLoading();
  try {
    const res = await apiGet('searchByHN', { hn });
    renderResults(res.success ? res.data : [], `HN: ${escapeHtml(hn)}`);
    if (!res.success) showToast(res.error || 'เกิดข้อผิดพลาด', 'danger');
  } catch (err) {
    console.error(err);
    showToast('ไม่สามารถเชื่อมต่อ API ได้: ' + err.message, 'danger');
    renderResults([], `HN: ${escapeHtml(hn)}`);
  } finally {
    hideLoading();
  }
}

async function loadAllActive() {
  if (!checkConfig()) return;
  showLoading();
  try {
    const res = await apiGet('getAllActive');
    renderResults(res.success ? res.data : [], 'รายการยาทั้งหมด');
    if (!res.success) showToast(res.error || 'เกิดข้อผิดพลาด', 'danger');
  } catch (err) {
    console.error(err);
    showToast('ไม่สามารถเชื่อมต่อ API ได้: ' + err.message, 'danger');
  } finally {
    hideLoading();
  }
}

function renderResults(medicines, title) {
  const container = document.getElementById('results');
  if (!container) return;

  if (!medicines || medicines.length === 0) {
    container.innerHTML = `
      <div class="text-center p-5">
        <div class="display-1 text-muted">📭</div>
        <h4 class="mt-3 text-muted">ไม่พบรายการยา</h4>
        <p class="text-muted">ไม่มีรายการยาฝากที่คงเหลืออยู่ หรือ HN ไม่ถูกต้อง</p>
        <a href="add-medicine.html" class="btn btn-primary">➕ เพิ่มยาฝากใหม่</a>
      </div>`;
    return;
  }

  let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">${title} <span class="badge bg-primary">${medicines.length} รายการ</span></h5>
      <small class="text-muted">แสดงเฉพาะรายการที่คงเหลือ &gt; 0</small>
    </div>
    <div class="row">`;

  medicines.forEach((med, index) => {
    const remainingQty = Number(med.RemainingQty) || 0;
    const unit = escapeHtml(med.Unit || '');
    const isLow = remainingQty <= CONFIG.ALERT.LOW_QTY && remainingQty > 0;
    const isCritical = remainingQty <= CONFIG.ALERT.CRITICAL_QTY;
    const cardClass = isCritical ? 'critical' : (isLow ? 'low' : 'available');
    const badgeClass = isCritical ? 'bg-danger' : (isLow ? 'bg-warning text-dark' : 'bg-success');
    const statusText = isCritical ? 'เหลือน้อยมาก!' : (isLow ? 'เหลือน้อย' : 'พร้อมจ่าย');
    const delay = index * 0.06;

    html += `
      <div class="col-md-6 col-lg-4 mb-3 fade-in-up" style="animation-delay: ${delay}s">
        <div class="card medicine-card ${cardClass} h-100 shadow-sm">
          <div class="card-header d-flex justify-content-between align-items-center bg-white">
            <strong class="text-truncate" style="max-width: 60%;">${escapeHtml(med.DrugName || 'ไม่ระบุชื่อยา')}</strong>
            <span class="badge ${badgeClass} badge-qty">${remainingQty} ${unit}</span>
          </div>
          <div class="card-body">
            <div class="mb-2"><small class="text-muted">HN</small><div class="fw-bold">${escapeHtml(med.HN || '-')}</div></div>
            <div class="mb-2"><small class="text-muted">ผู้ป่วย</small><div>${escapeHtml(med.PatientName || '-')}</div></div>
            <div class="mb-2"><small class="text-muted">รายละเอียด</small><div>${escapeHtml([med.GenericName, med.Strength].filter(Boolean).join(' ') || '-')}</div></div>
            <div class="mb-2"><small class="text-muted">PN</small><div class="font-monospace small">${escapeHtml(med.PN || '-')}</div></div>
            <div class="mb-2"><small class="text-muted">จุดรับฝาก / หน่วยงาน</small><div>${escapeHtml([med.DepositLocation, med.DepartmentName].filter(Boolean).join(' / ') || '-')}</div></div>
            <div class="mb-2"><small class="text-muted">Follow up</small><div>${med.FollowUpDate ? formatDate(med.FollowUpDate) : '-'}</div></div>
            <div class="mb-2"><small class="text-muted">วันหมดอายุ</small><div>${med.ExpiryDate ? formatDate(med.ExpiryDate) : '-'}</div></div>
            ${med.Notes ? `<div class="mt-2"><small class="text-muted">หมายเหตุ:</small><div class="small">${escapeHtml(med.Notes)}</div></div>` : ''}
          </div>
          <div class="card-footer bg-white border-top-0">
            <div class="d-grid gap-2">
              <a href="dispense.html?id=${encodeURIComponent(med.ID)}" class="btn btn-warning fw-bold">💊 จ่ายยา</a>
              <a href="history.html?hn=${encodeURIComponent(med.HN || '')}" class="btn btn-outline-info btn-sm">📜 ประวัติ</a>
              ${isLow ? `<div class="alert alert-${isCritical ? 'danger' : 'warning'} py-1 mb-0 text-center small">⚠️ ${statusText} (เหลือ ${remainingQty} ${unit})</div>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

async function submitMedicine(e) {
  e.preventDefault();
  if (!checkConfig()) return;

  const form = document.getElementById('addForm');
  if (!form) return;

  const requiredOk = validateRequiredFields([
    { id: 'hn', label: 'HN' },
    { id: 'patientName', label: 'ชื่อผู้ป่วย' },
    { id: 'drugName', label: 'ชื่อยา' },
    { id: 'totalQty', label: 'จำนวนรวม' },
    { id: 'entryDate', label: 'วันที่รับยา' },
    { id: 'depositLocation', label: 'จุดรับฝากยา' },
    { id: 'department', label: 'หน่วยงานที่เอายามาฝาก' },
    { id: 'createdByStaffId', label: 'Staff ID ผู้บันทึก' }
  ]);
  if (!requiredOk) return;

  const totalQty = Number(document.getElementById('totalQty').value);
  if (!totalQty || totalQty <= 0) {
    popupWarning('จำนวนรวมต้องมากกว่า 0');
    return;
  }

  const hnInput = document.getElementById('hn');
  const formattedHN = applyHNFormat(hnInput);
  if (!validateHNFormatOrPopup(formattedHN)) return;

  const departmentSelect = document.getElementById('department');
  const selectedDepartment = departmentSelect.options[departmentSelect.selectedIndex];

  const data = {
    action: 'addMedicine',
    hn: formattedHN,
    patientName: document.getElementById('patientName').value.trim(),
    drugName: document.getElementById('drugName').value.trim(),
    genericName: document.getElementById('genericName').value.trim(),
    strength: document.getElementById('strength').value.trim(),
    form: document.getElementById('form').value,
    totalQty,
    unit: document.getElementById('unit').value,
    storage: document.getElementById('storage').value.trim(),
    hospital: document.getElementById('hospital').value.trim(),
    pn: document.getElementById('pn').value.trim(),
    entryDate: document.getElementById('entryDate').value,
    expiryDate: document.getElementById('expiryDate').value,
    administrationSchedule: document.getElementById('administrationSchedule').value.trim(),
    followUpDate: document.getElementById('followUpDate').value,
    depositLocation: document.getElementById('depositLocation').value,
    departmentCode: selectedDepartment?.dataset?.code || departmentSelect.value,
    departmentName: selectedDepartment?.dataset?.name || selectedDepartment?.textContent || '',
    imageUrl: document.getElementById('imageUrl').value.trim(),
    ocrRawText: document.getElementById('ocrRawText').value.trim(),
    notes: document.getElementById('notes').value.trim(),
    createdByStaffId: document.getElementById('createdByStaffId').value.trim()
  };

  if (!setSubmitBusy(form, 'addMedicine', true, 'กำลังบันทึก... กรุณารอ')) return;
  showToast('กำลังบันทึกข้อมูล กรุณารอจนกว่าระบบจะแจ้งผล', 'info');

  let completed = false;
  try {
    const res = await apiPost(data);
    if (res.success) {
      completed = true;
      showToast('✅ เพิ่มยาฝากสำเร็จ', 'success');
      setTimeout(() => window.location.href = 'index.html', 800);
    } else {
      if ((res.error || '').includes('Staff ID')) showInvalidStaffPopup();
      else popupError('❌ ' + (res.error || 'เกิดข้อผิดพลาด'));
    }
  } catch (err) {
    console.error(err);
    showToast('❌ ไม่สามารถเชื่อมต่อ API ได้: ' + err.message, 'danger');
  } finally {
    if (!completed) setSubmitBusy(form, 'addMedicine', false);
  }
}

async function loadMedicineForDispense(medId) {
  if (!checkConfig()) return;

  try {
    const res = await apiGet('getDispensePageData', { id: medId });
    if (!res.success || !res.data || !res.data.medicine) throw new Error(res.error || 'ไม่พบรายการยา');
    const med = res.data.medicine;
    const departments = res.data.departments || [];
    setLocalCache_('medlog_departments_v1', departments);
    const remainingQty = Number(med.RemainingQty) || 0;

    document.getElementById('medicineId').value = med.ID;
    document.getElementById('hn').value = med.HN;
    document.getElementById('drugNameHidden').value = med.DrugName;

    const wardSelect = document.getElementById('ward');
    if (wardSelect && wardSelect.tagName === 'SELECT') {
      const wantedWard = med.DepartmentCode || med.DepartmentName || '';
      populateDepartmentSelect(wardSelect, departments, wantedWard, '-- เลือกหน่วยงานผู้รับ --');
    }

    const qtyInput = document.getElementById('dispenseQty');
    if (qtyInput) {
      qtyInput.max = remainingQty;
    }
    document.getElementById('unitLabel').textContent = med.Unit || 'Vial';
    document.getElementById('remainingHint').textContent = `${remainingQty} ${med.Unit || ''}`;

    const isLow = remainingQty <= CONFIG.ALERT.LOW_QTY;
    const alertClass = isLow ? 'bg-danger' : 'bg-success';

    document.getElementById('medicineInfo').innerHTML = `
      <div class="medicine-detail">
        <div class="row align-items-center">
          <div class="col-md-8">
            <h3>${escapeHtml(med.DrugName || 'ไม่ระบุชื่อยา')}</h3>
            <p class="mb-1">${escapeHtml([med.GenericName, med.Strength].filter(Boolean).join(' '))}</p>
            <p class="mb-1">HN: ${escapeHtml(med.HN || '-')} | ผู้ป่วย: ${escapeHtml(med.PatientName || '-')}</p>
            <p class="mb-0 small">Follow up: ${med.FollowUpDate ? formatDate(med.FollowUpDate) : '-'} | Storage: ${escapeHtml(med.Storage || '-')}</p>
            <p class="mb-0 small">จุดรับฝาก: ${escapeHtml(med.DepositLocation || '-')} | หน่วยงาน: ${escapeHtml(med.DepartmentName || '-')}</p>
          </div>
          <div class="col-md-4 text-md-end mt-3 mt-md-0">
            <span class="badge ${alertClass}" style="font-size: 1.5rem; padding: 0.75rem 1.5rem;">เหลือ ${remainingQty} ${escapeHtml(med.Unit || '')}</span>
          </div>
        </div>
        ${med.AdministrationSchedule ? `<div class="mt-3 pt-3 border-top border-white-50"><small>วิธีใช้/ตารางให้ยา: ${escapeHtml(med.AdministrationSchedule)}</small></div>` : ''}
        ${med.Notes ? `<div class="mt-2"><small>${escapeHtml(med.Notes)}</small></div>` : ''}
      </div>`;
  } catch (err) {
    console.error(err);
    document.getElementById('medicineInfo').innerHTML = `
      <div class="alert alert-danger text-center p-4">
        <h4>❌ ไม่พบรายการยา</h4>
        <p>${escapeHtml(err.message)}</p>
        <a href="index.html" class="btn btn-primary">กลับหน้าหลัก</a>
      </div>`;
  }
}

async function submitDispense(e) {
  e.preventDefault();
  if (!checkConfig()) return;

  const form = document.getElementById('dispenseForm');
  const dispenseQty = Number(document.getElementById('dispenseQty').value);
  const remainingQty = Number((document.getElementById('remainingHint').textContent || '').match(/[0-9.]+/)?.[0] || 0);

  const requiredOk = validateRequiredFields([
    { id: 'dispenseQty', label: 'จำนวนที่จ่าย' },
    { id: 'dispensedByStaffId', label: 'Staff ID ผู้จ่าย' },
    { id: 'ward', label: 'Ward / หน่วยงานผู้รับ' }
  ]);
  if (!requiredOk) return;

  if (!dispenseQty || dispenseQty <= 0) {
    popupWarning('จำนวนที่จ่ายต้องมากกว่า 0');
    return;
  }
  if (dispenseQty > remainingQty) {
    popupError(`จำนวนที่จ่ายมากกว่าจำนวนคงเหลือ (${remainingQty})`);
    return;
  }

  const wardEl = document.getElementById('ward');
  const wardName = wardEl && wardEl.tagName === 'SELECT'
    ? (wardEl.options[wardEl.selectedIndex]?.dataset?.name || wardEl.options[wardEl.selectedIndex]?.textContent || wardEl.value)
    : (wardEl ? wardEl.value.trim() : '');

  const data = {
    action: 'dispense',
    medicineId: document.getElementById('medicineId').value,
    dispenseQty,
    dispensedByStaffId: document.getElementById('dispensedByStaffId').value.trim(),
    receiver: document.getElementById('receiver').value.trim(),
    ward: wardName,
    notes: document.getElementById('dispenseNotes').value.trim()
  };

  if (!setSubmitBusy(form, 'dispense', true, 'กำลังตัดจ่าย... กรุณารอ')) return;
  showToast('กำลังตัดจ่ายยา กรุณารอจนกว่าระบบจะแจ้งผล', 'info');

  let completed = false;
  try {
    const res = await apiPost(data);
    if (res.success) {
      completed = true;
      showToast(res.isHidden ? '✅ จ่ายยาสำเร็จ คงเหลือ 0 รายการถูกซ่อนแล้ว' : `✅ จ่ายยาสำเร็จ เหลือ ${res.remainingQty}`, 'success');
      setTimeout(() => window.location.href = 'index.html', 800);
    } else {
      if ((res.error || '').includes('Staff ID')) showInvalidStaffPopup();
      else popupError('❌ ' + (res.error || 'เกิดข้อผิดพลาด'));
    }
  } catch (err) {
    console.error(err);
    showToast('❌ ไม่สามารถเชื่อมต่อ API ได้: ' + err.message, 'danger');
  } finally {
    if (!completed) setSubmitBusy(form, 'dispense', false);
  }
}

async function loadHistory() {
  if (!checkConfig()) return;
  const historyInput = document.getElementById('historyHN');
  const hn = applyHNFormat(historyInput);
  if (!hn) {
    popupWarning('กรุณากรอก HN');
    return;
  }
  const container = document.getElementById('historyResults');
  if (container) container.innerHTML = '<div class="text-center"><div class="spinner-border text-info"></div><p class="mt-2">กำลังโหลดประวัติ...</p></div>';

  try {
    const res = await apiGet('getHistory', { hn });
    if (res.success && res.data && res.data.length > 0) renderHistory(res.data, hn);
    else if (container) container.innerHTML = `<div class="text-center p-4"><div class="display-4 text-muted">📭</div><p class="mt-2 text-muted">ไม่พบประวัติการจ่ายยาสำหรับ HN: ${escapeHtml(hn)}</p></div>`;
  } catch (err) {
    console.error(err);
    if (container) container.innerHTML = `<div class="alert alert-danger">❌ ไม่สามารถโหลดประวัติได้: ${escapeHtml(err.message)}</div>`;
  }
}

function renderHistory(history, hn) {
  const container = document.getElementById('historyResults');
  if (!container) return;

  let html = `
    <h5 class="mb-3">ประวัติการจ่ายยา HN: ${escapeHtml(hn)} <span class="badge bg-info">${history.length} รายการ</span></h5>
    <div class="table-responsive">
      <table class="table table-hover table-medicines">
        <thead>
          <tr>
            <th>วันที่</th><th>ชื่อยา</th><th>จำนวนที่จ่าย</th><th>คงเหลือ</th><th>ผู้จ่าย</th><th>Staff ID</th><th>ผู้รับ</th><th>Ward</th><th>หมายเหตุ</th>
          </tr>
        </thead><tbody>`;

  history.forEach(item => {
    html += `
      <tr>
        <td>${item.DispenseDate ? formatDateTime(item.DispenseDate) : '-'}</td>
        <td>${escapeHtml(item.DrugName || '-')}</td>
        <td><span class="badge bg-warning text-dark">${escapeHtml(item.DispenseQty || 0)}</span></td>
        <td><span class="badge bg-success">${escapeHtml(item.RemainingAfter || 0)}</span></td>
        <td>${escapeHtml(item.DispensedByName || item.DispensedBy || '-')}</td>
        <td>${escapeHtml(item.DispensedByStaffID || '-')}</td>
        <td>${escapeHtml(item.Receiver || '-')}</td>
        <td>${escapeHtml(item.Ward || '-')}</td>
        <td>${escapeHtml(item.Notes || '-')}</td>
      </tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  return escapeHtml(dateStr);
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toLocaleString('th-TH');
  return escapeHtml(dateStr);
}

document.addEventListener('DOMContentLoaded', () => {
  checkConfig();

  const searchInput = document.getElementById('searchHN');
  if (searchInput) {
    searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchMedicine(); });
    searchInput.addEventListener('blur', () => applyHNFormat(searchInput));
  }

  const historyInput = document.getElementById('historyHN');
  if (historyInput) {
    historyInput.addEventListener('keypress', e => { if (e.key === 'Enter') loadHistory(); });
    historyInput.addEventListener('blur', () => applyHNFormat(historyInput));
  }

  const hnInput = document.getElementById('hn');
  if (hnInput) hnInput.addEventListener('blur', () => applyHNFormat(hnInput));

  if (document.getElementById('department')) loadDepartmentOptions();

  const createdByStaffInput = document.getElementById('createdByStaffId');
  if (createdByStaffInput) {
    createdByStaffInput.addEventListener('blur', () => validateStaffField('createdByStaffId', 'createdByStaffName'));
  }

  const dispensedByStaffInput = document.getElementById('dispensedByStaffId');
  if (dispensedByStaffInput) {
    dispensedByStaffInput.addEventListener('blur', () => validateStaffField('dispensedByStaffId', 'dispensedByStaffName'));
  }

  const entryDate = document.getElementById('entryDate');
  if (entryDate && !entryDate.value) entryDate.valueAsDate = new Date();

  const params = new URLSearchParams(window.location.search);
  const hnParam = params.get('hn');
  if (hnParam && historyInput) {
    historyInput.value = hnParam;
    loadHistory();
  }

  if (document.getElementById('results') && Number(CONFIG.AUTO_REFRESH_MS) > 0) {
    setInterval(() => {
      const input = document.getElementById('searchHN');
      if (input && input.value.trim()) searchMedicine();
      else loadAllActive();
    }, Number(CONFIG.AUTO_REFRESH_MS));
  }
});
