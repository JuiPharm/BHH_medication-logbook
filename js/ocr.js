/**
 * ====================
 * OCR MODULE - Typhoon OCR via Google Apps Script
 * ====================
 * Flow: Browser compresses image -> Code.gs calls Typhoon OCR -> parsed JSON fills the form.
 */

let isOcrProcessing = false;

async function processOCR(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  if (!checkConfig()) return;

  if (isOcrProcessing) {
    showToast('กำลังประมวลผลรูปภาพอื่นอยู่', 'warning');
    return;
  }

  if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
    showToast('รองรับเฉพาะไฟล์ JPG หรือ PNG', 'warning');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast('ไฟล์ใหญ่เกินไป สูงสุด 10MB', 'danger');
    return;
  }

  isOcrProcessing = true;
  showOCRProgress(true, 15, 'กำลังเตรียมรูปภาพ...');

  try {
    const compressed = await imageFileToCompressedBase64(file, 1600, 0.85);
    showOCRProgress(true, 45, 'กำลังส่งรูปไป Typhoon OCR...');

    const res = await apiPost({
      action: 'typhoonOcrMedication',
      imageBase64: compressed.base64,
      mimeType: compressed.mimeType
    });

    showOCRProgress(true, 90, 'กำลังเติมข้อมูลลงฟอร์ม...');

    if (!res.success) {
      showOCRResult('', res.error || 'OCR ไม่สำเร็จ', res.detail || res.rawText || '');
      showToast(res.error || 'OCR ไม่สำเร็จ', 'danger');
      return;
    }

    fillMedicationFormFromTyphoon(res.parsed || {});

    const rawText = res.rawText || JSON.stringify(res.parsed || {}, null, 2);
    const rawTextEl = document.getElementById('ocrRawText');
    if (rawTextEl) rawTextEl.value = rawText;

    showOCRResult(rawText, null, JSON.stringify(res.parsed || {}, null, 2));
    showToast('✅ OCR สำเร็จ กรุณาตรวจสอบข้อมูลก่อนบันทึก', 'success');
    showOCRProgress(true, 100, 'ประมวลผลเสร็จสิ้น');

  } catch (err) {
    console.error('Typhoon OCR error:', err);
    showOCRResult('', 'ไม่สามารถ OCR ได้', err.message);
    showToast('ไม่สามารถ OCR ได้: ' + err.message, 'danger');
  } finally {
    isOcrProcessing = false;
    setTimeout(() => showOCRProgress(false), 800);
  }
}

function showOCRProgress(show, percent = 0, message = '') {
  const div = document.getElementById('ocrProgress');
  const bar = document.getElementById('progressBar');
  const status = document.getElementById('ocrStatus');

  if (div) div.classList.toggle('d-none', !show);
  if (bar) bar.style.width = `${Math.round(percent)}%`;
  if (status && message) status.textContent = message;
}

function showOCRResult(rawText, error = null, detail = '') {
  const preview = document.getElementById('ocrPreview');
  if (!preview) return;

  if (error) {
    preview.innerHTML = `
      <div class="alert alert-danger">
        <strong>❌ OCR ไม่สำเร็จ</strong><br>
        ${escapeHtml(error)}
        ${detail ? `<pre class="ocr-text-preview mt-2 mb-0">${escapeHtml(detail).slice(0, 1200)}</pre>` : ''}
      </div>`;
    return;
  }

  preview.innerHTML = `
    <div class="alert alert-success">
      <strong>✅ OCR สำเร็จ</strong>
      <div class="small mt-1">ระบบเติมข้อมูลลงฟอร์มแล้ว กรุณาตรวจสอบความถูกต้องก่อนบันทึก</div>
      ${detail ? `<pre class="ocr-text-preview mt-2 mb-0">${escapeHtml(detail)}</pre>` : ''}
    </div>`;
}

function fillMedicationFormFromTyphoon(parsed) {
  if (!parsed) return;

  const mappings = {
    hn: parsed.hn,
    pn: parsed.pn,
    patientName: parsed.patientName,
    drugName: parsed.drugName,
    genericName: parsed.genericName,
    strength: parsed.strength,
    totalQty: parsed.totalQty,
    unit: parsed.unit,
    form: parsed.form || (parsed.unit === 'Set' ? 'Other' : parsed.unit),
    administrationSchedule: parsed.administrationSchedule || parsed.usage,
    notes: parsed.notes || parsed.usage
  };

  let filled = 0;
  Object.keys(mappings).forEach(id => {
    const el = document.getElementById(id);
    const value = mappings[id];
    if (!el || value === undefined || value === null || String(value).trim() === '') return;

    if (el.tagName === 'SELECT') {
      ensureSelectOption(el, String(value));
    }

    el.value = value;
    el.classList.add('is-valid');
    setTimeout(() => el.classList.remove('is-valid'), 2200);
    filled++;
  });

  if (filled > 0) {
    showToast(`📝 กรอกฟอร์มจาก Typhoon OCR ${filled} รายการ`, 'info');
  }
}

function ensureSelectOption(selectEl, value) {
  const exists = Array.from(selectEl.options).some(opt => opt.value === value);
  if (exists) return;

  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  selectEl.appendChild(option);
}

function imageFileToCompressedBase64(file, maxWidth = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round(height * maxWidth / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);

        resolve({
          mimeType,
          dataUrl,
          base64: dataUrl.split(',')[1]
        });
      };

      img.onerror = reject;
      img.src = reader.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
