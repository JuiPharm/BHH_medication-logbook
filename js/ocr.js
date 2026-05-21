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
