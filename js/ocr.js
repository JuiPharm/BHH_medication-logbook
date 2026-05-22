/**
 * ====================
 * OCR MODULE (Tesseract.js)
 * ====================
 * อ่านใบสั่งยาอัตโนมัติ
 */

class OCRProcessor {
  constructor() {
    this.worker = null;
    this.isProcessing = false;
  }

  /**
   * ประมวลผลรูปภาพด้วย OCR
   */
  async processImage(file) {
    if (this.isProcessing) {
      showToast('กำลังประมวลผลรูปภาพอื่นอยู่', 'warning');
      return null;
    }

    this.isProcessing = true;
    showOCRProgress(true);

    try {
      const result = await Tesseract.recognize(
        file,
        CONFIG.OCR.LANG,
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              updateProgress(m.progress * 100);
            }
          }
        }
      );

      const text = result.data.text;
      const confidence = result.data.confidence;

      console.log('OCR Result:', { text, confidence });

      showOCRResult(text, confidence);
      autoFillFromOCR(text);

      showToast(`✅ OCR เสร็จสิ้น (ความแม่นยำ: ${Math.round(confidence)}%)`, 'success');

      return { text, confidence };

    } catch (error) {
      console.error('OCR Error:', error);
      showOCRResult(null, 0, error.message);
      showToast('❌ OCR ล้มเหลว: ' + error.message, 'danger');
      return null;

    } finally {
      this.isProcessing = false;
      showOCRProgress(false);
    }
  }
}

const ocrProcessor = new OCRProcessor();

/**
 * เริ่มประมวลผล OCR จาก input file
 */
async function processOCR(input) {
  const file = input.files[0];
  if (!file) return;

  // ตรวจสอบขนาดไฟล์ (ไม่เกิน 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('❌ ไฟล์ใหญ่เกินไป (สูงสุด 5MB)', 'danger');
    return;
  }

  await ocrProcessor.processImage(file);
}

/**
 * แสดง/ซ่อน progress bar
 */
function showOCRProgress(show) {
  const progressDiv = document.getElementById('ocrProgress');
  if (progressDiv) {
    progressDiv.classList.toggle('d-none', !show);
  }
}

/**
 * อัพเดท progress bar
 */
function updateProgress(percent) {
  const bar = document.getElementById('progressBar');
  const status = document.getElementById('ocrStatus');
  if (bar) bar.style.width = `${percent}%`;
  if (status) status.textContent = `กำลังอ่านข้อความ... ${Math.round(percent)}%`;
}

/**
 * แสดงผล OCR
 */
function showOCRResult(text, confidence, error = null) {
  const preview = document.getElementById('ocrPreview');
  if (!preview) return;

  if (error) {
    preview.innerHTML = `
      <div class="alert alert-danger">
        <strong>❌ OCR ล้มเหลว</strong><br>
        ${error}
      </div>
    `;
    return;
  }

  const truncated = text.length > 500 ? text.substring(0, 500) + '...' : text;

  preview.innerHTML = `
    <div class="alert alert-success">
      <strong>✅ OCR สำเร็จ!</strong> 
      <span class="badge bg-primary">ความแม่นยำ: ${Math.round(confidence)}%</span>
      <div class="ocr-text-preview mt-2">${truncated}</div>
    </div>
  `;
}

/**
 * ดึงข้อมูลจาก OCR text แล้ว auto-fill form
 */
function autoFillFromOCR(text) {
  const fields = extractFieldsFromOCR(text);

  // ฟิลด์ mapping
  const mappings = {
    'hn': fields.hn,
    'pn': fields.pn,
    'drugName': fields.drugName,
    'genericName': fields.genericName,
    'strength': fields.strength,
    'totalQty': fields.totalQty,
    'storage': fields.storage,
    'hospital': fields.hospital,
    'entryDate': fields.entryDate,
    'expiryDate': fields.expiryDate,
    'notes': fields.notes
  };

  // Auto-fill ฟอร์ม
  let filledCount = 0;
  Object.keys(mappings).forEach(fieldId => {
    const element = document.getElementById(fieldId);
    const value = mappings[fieldId];

    if (element && value) {
      element.value = value;

      // Highlight ฟิลด์ที่ถูก fill
      element.classList.add('is-valid');
      setTimeout(() => element.classList.remove('is-valid'), 2000);

      filledCount++;
    }
  });

  if (filledCount > 0) {
    showToast(`📝 กรอกฟอร์มอัตโนมัติ ${filledCount} รายการ`, 'info');
  }
}

/**
 * ดึงข้อมูลจาก OCR text ด้วย Regex
 */
function extractFieldsFromOCR(text) {
  const fields = {};

  // HN: รูปแบบต่างๆ
  const hnPatterns = [
    /HN[:\s]*([0-9]{2}[-]?[0-9]{2}[-]?[0-9]{6,})/i,
    /HN[:\s]*([A-Z0-9-]+)/i,
    /หมายเลขผู้ป่วย[:\s]*([0-9-]+)/i
  ];
  fields.hn = matchFirstPattern(text, hnPatterns);

  // PN / Prescription Number
  const pnPatterns = [
    /PN[:\s]*([A-Z0-9]+)/i,
    /Prescription[:\s]*([A-Z0-9]+)/i
  ];
  fields.pn = matchFirstPattern(text, pnPatterns);

  // Drug Name - รายการยาทั่วไป
  const drugPatterns = [
    /(Espogen|Espogen Inj)/i,
    /(Herna Plus)/i,
    /(Cef-3|Ceftriaxone)/i,
    /ชื่อยา[:\s]*([฀-๿\w\s-]+)/i
  ];
  const drugMatch = matchFirstPattern(text, drugPatterns);
  if (drugMatch) {
    fields.drugName = drugMatch.replace(/Inj|Vial|Tablet|Capsule/gi, '').trim();
  }

  // Generic Name
  const genericPatterns = [
    /(epoetin alfa)/i,
    /(ceftriaxone)/i,
    /ชื่อสามัญ[:\s]*([\w\s-]+)/i
  ];
  fields.genericName = matchFirstPattern(text, genericPatterns);

  // Strength
  const strengthPatterns = [
    /(\d+(?:\.\d+)?)\s*(IU|iu|มิลลิกรัม|mg|Mg|g|mcg|μg)/i,
    /(\d+(?:\.\d+)?)\s*(unit|units|U)/i
  ];
  const strengthMatch = text.match(/(\d+(?:\.\d+)?)\s*(IU|iu|mg|Mg|มิลลิกรัม)/i);
  if (strengthMatch) {
    fields.strength = `${strengthMatch[1]} ${strengthMatch[2].toUpperCase()}`;
  }

  // Quantity
  const qtyPatterns = [
    /#\s*(\d+(?:\.\d+)?)\s*(?:Vial|vial|ขวด|เม็ด|แคปซูล)/i,
    /จำนวน[:\s]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:vial|Vial|ขวด)/i
  ];
  const qtyMatch = matchFirstPattern(text, qtyPatterns);
  if (qtyMatch) {
    fields.totalQty = parseFloat(qtyMatch);
  }

  // Storage
  const storagePatterns = [
    /([0-9]+[-–][0-9]+)\s*°?C/i,
    /เก็บ[:\s]*([0-9-]+\s*°?C)/i,
    /([0-9]+[-–][0-9]+)\s*องศา/i
  ];
  const storageMatch = text.match(/([0-9]+[-–][0-9]+)\s*°?C/i);
  if (storageMatch) {
    fields.storage = `${storageMatch[1]}°C`;
  }

  // Hospital
  if (text.includes('Bangkok Hospital') || text.includes('โรงพยาบาลกรุงเทพ')) {
    fields.hospital = 'Bangkok Hospital';
  } else if (text.includes('Ramathibodi') || text.includes('รามาธิบดี')) {
    fields.hospital = 'Ramathibodi Hospital';
  } else if (text.includes('Siriraj') || text.includes('ศิริราช')) {
    fields.hospital = 'Siriraj Hospital';
  }

  // Date - รูปแบบไทย
  const datePatterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/g,     // 30/12/2568
    /(\d{1,2})-(\d{1,2})-(\d{4})/g        // 30-12-2568
  ];

  const dates = [];
  datePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const [_, d, m, y] = match;
      const day = d.padStart(2, '0');
      const month = m.padStart(2, '0');
      let year = parseInt(y);

      // แปลง พ.ศ. → ค.ศ.
      if (year > 2500) year -= 543;

      dates.push({
        raw: match[0],
        iso: `${year}-${month}-${day}`,
        year: year
      });
    }
  });

  if (dates.length >= 1) {
    fields.entryDate = dates[0].iso;
  }
  if (dates.length >= 2) {
    fields.expiryDate = dates[1].iso;
  }

  // Notes - วิธีใช้
  const usagePatterns = [
    /(ฉีดเข้าใต้ผิวหนัง|SC|IM|IV)/i,
    /(รับประทาน|ทา|หยอด|พ่น)/i,
    /(ครั้งละ\s*\d+.*)/i
  ];
  const usageMatch = matchFirstPattern(text, usagePatterns);
  if (usageMatch) {
    fields.notes = usageMatch;
  }

  return fields;
}

/**
 * Helper: หา pattern แรกที่ match
 */
function matchFirstPattern(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] ? match[1].trim() : match[0].trim();
    }
  }
  return null;
}
