/**
 * ====================
 * MAIN APPLICATION
 * ====================
 * ฟังก์ชันหลักของสมุดยาฝาก
 */

// ==================== Toast Notifications ====================
function showToast(message, type = 'info') {
  const toastEl = document.getElementById('liveToast');
  if (!toastEl) {
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

  if (titleEl) titleEl.textContent = config.title;
  if (titleEl) titleEl.className = `me-auto ${config.class}`;
  if (msgEl) msgEl.textContent = message;

  const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
  toast.show();
}

// ==================== Loading ====================
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

// ==================== Search by HN ====================
async function searchMedicine() {
  if (!checkConfig()) return;

  const hnInput = document.getElementById('searchHN');
  const hn = hnInput ? hnInput.value.trim() : '';

  if (!hn) {
    showToast('กรุณากรอก HN', 'warning');
    return;
  }

  showLoading();

  try {
    const res = await apiGet('searchByHN', { hn });

    if (res.success) {
      renderResults(res.data, `HN: ${hn}`);
    } else {
      showToast(res.error || 'เกิดข้อผิดพลาด', 'danger');
      renderResults([], `HN: ${hn}`);
    }
  } catch (err) {
    console.error('Search error:', err);
    showToast('ไม่สามารถเชื่อมต่อ API ได้ กรุณาตรวจสอบการตั้งค่า', 'danger');
    renderResults([], `HN: ${hn}`);
  } finally {
    hideLoading();
  }
}

// ==================== Load All Active ====================
async function loadAllActive() {
  if (!checkConfig()) return;

  showLoading();

  try {
    const res = await apiGet('getAllActive');

    if (res.success) {
      renderResults(res.data, 'รายการยาทั้งหมด');
    } else {
      showToast(res.error || 'เกิดข้อผิดพลาด', 'danger');
    }
  } catch (err) {
    console.error('Load error:', err);
    showToast('ไม่สามารถเชื่อมต่อ API ได้', 'danger');
  } finally {
    hideLoading();
  }
}

// ==================== Render Results ====================
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
      </div>
    `;
    return;
  }

  let html = `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h5 class="mb-0">
        ${title} 
        <span class="badge bg-primary">${medicines.length} รายการ</span>
      </h5>
      <small class="text-muted">แสดงเฉพาะที่คงเหลือ > 0</small>
    </div>
    <div class="row">
  `;

  medicines.forEach((med, index) => {
    const remainingQty = parseFloat(med.RemainingQty) || 0;
    const isLow = remainingQty <= CONFIG.ALERT.LOW_QTY && remainingQty > 0;
    const isCritical = remainingQty <= CONFIG.ALERT.CRITICAL_QTY;

    let cardClass = 'available';
    let badgeClass = 'bg-success';
    let statusText = 'พร้อมจ่าย';

    if (isCritical) {
      cardClass = 'critical';
      badgeClass = 'bg-danger';
      statusText = 'เหลือน้อยมาก!';
    } else if (isLow) {
      cardClass = 'low';
      badgeClass = 'bg-warning text-dark';
      statusText = 'เหลือน้อย';
    }

    // Animation delay
    const delay = index * 0.1;

    html += `
      <div class="col-md-6 col-lg-4 mb-3 fade-in-up" style="animation-delay: ${delay}s">
        <div class="card medicine-card ${cardClass} h-100 shadow-sm">
          <div class="card-header d-flex justify-content-between align-items-center bg-white">
            <strong class="text-truncate" style="max-width: 60%;">${med.DrugName || 'ไม่ระบุชื่อยา'}</strong>
            <span class="badge ${badgeClass} badge-qty">${remainingQty} ${med.Unit || ''}</span>
          </div>
          <div class="card-body">
            <div class="mb-2">
              <small class="text-muted">HN</small>
              <div class="fw-bold">${med.HN || '-'}</div>
            </div>
            <div class="mb-2">
              <small class="text-muted">ผู้ป่วย</small>
              <div>${med.PatientName || '-'}</div>
            </div>
            <div class="mb-2">
              <small class="text-muted">รายละเอียด</small>
              <div>${med.GenericName || ''} ${med.Strength || ''}</div>
            </div>
            <div class="mb-2">
              <small class="text-muted">PN</small>
              <div class="font-monospace small">${med.PN || '-'}</div>
            </div>
            <div class="mb-2">
              <small class="text-muted">วันหมดอายุ</small>
              <div>${med.ExpiryDate ? formatDate(med.ExpiryDate) : '-'}</div>
            </div>
            ${med.Notes ? `<div class="mt-2"><small class="text-muted">หมายเหตุ:</small><div class="small">${med.Notes}</div></div>` : ''}
          </div>
          <div class="card-footer bg-white border-top-0">
            <div class="d-grid gap-2">
              <a href="dispense.html?id=${med.ID}" class="btn btn-warning fw-bold">
                💊 จ่ายยา
              </a>
              ${isLow ? `<div class="alert alert-${isCritical ? 'danger' : 'warning'} py-1 mb-0 text-center small">
                ⚠️ ${statusText} (เหลือ ${remainingQty} ${med.Unit || ''})
              </div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ==================== Add Medicine ====================
async function submitMedicine(e) {
  e.preventDefault();

  if (!checkConfig()) return;

  const form = document.getElementById('addForm');
  if (!form) return;

  // Validate
  const required = ['hn', 'patientName', 'drugName', 'totalQty', 'entryDate'];
  for (const field of required) {
    const el = document.getElementById(field);
    if (!el || !el.value.trim()) {
      showToast(`กรุณากรอกข้อมูลให้ครบถ้วน`, 'warning');
      if (el) el.focus();
      return;
    }
  }

  const data = {
    action: 'addMedicine',
    hn: document.getElementById('hn').value.trim(),
    patientName: document.getElementById('patientName').value.trim(),
    drugName: document.getElementById('drugName').value.trim(),
    genericName: document.getElementById('genericName').value.trim(),
    strength: document.getElementById('strength').value.trim(),
    form: document.getElementById('form').value,
    totalQty: parseFloat(document.getElementById('totalQty').value),
    unit: document.getElementById('unit').value,
    storage: document.getElementById('storage').value.trim(),
    hospital: document.getElementById('hospital').value.trim(),
    pn: document.getElementById('pn').value.trim(),
    entryDate: document.getElementById('entryDate').value,
    expiryDate: document.getElementById('expiryDate').value,
    notes: document.getElementById('notes').value.trim()
  };

  // Loading state
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> กำลังบันทึก...';
  }

  try {
    const res = await apiPost(data);

    if (res.success) {
      showToast('✅ เพิ่มยาฝากสำเร็จ!', 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    } else {
      showToast('❌ ' + (res.error || 'เกิดข้อผิดพลาด'), 'danger');
    }
  } catch (err) {
    console.error('Add medicine error:', err);
    showToast('❌ ไม่สามารถเชื่อมต่อ API ได้', 'danger');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

// ==================== Dispense Medicine ====================
async function loadMedicineForDispense(medId) {
  if (!checkConfig()) return;

  try {
    const res = await apiGet('getAllActive');
    const med = res.data.find(m => m.ID === medId);

    if (!med) {
      document.getElementById('medicineInfo').innerHTML = `
        <div class="alert alert-danger text-center p-4">
          <h4>❌ ไม่พบรายการยา</h4>
          <p>รายการยาอาจถูกจ่ายจนหมดแล้ว</p>
          <a href="index.html" class="btn btn-primary">กลับหน้าหลัก</a>
        </div>
      `;
      return;
    }

    const remainingQty = parseFloat(med.RemainingQty) || 0;

    // Set hidden fields
    document.getElementById('medicineId').value = med.ID;
    document.getElementById('hn').value = med.HN;
    document.getElementById('drugNameHidden').value = med.DrugName;

    // Set quantity constraints
    const qtyInput = document.getElementById('dispenseQty');
    if (qtyInput) {
      qtyInput.max = remainingQty;
      qtyInput.placeholder = `สูงสุด ${remainingQty}`;
    }

    const unitLabel = document.getElementById('unitLabel');
    if (unitLabel) unitLabel.textContent = med.Unit || 'Vial';

    const remainingHint = document.getElementById('remainingHint');
    if (remainingHint) remainingHint.textContent = `${remainingQty} ${med.Unit || ''}`;

    // Display medicine info
    const isLow = remainingQty <= CONFIG.ALERT.LOW_QTY;
    const alertClass = isLow ? 'bg-danger' : 'bg-success';

    document.getElementById('medicineInfo').innerHTML = `
      <div class="medicine-detail">
        <div class="row align-items-center">
          <div class="col-md-8">
            <h3>${med.DrugName || 'ไม่ระบุชื่อยา'}</h3>
            <p class="mb-1">${med.GenericName || ''} ${med.Strength || ''}</p>
            <p class="mb-0">HN: ${med.HN} | ผู้ป่วย: ${med.PatientName || '-'}</p>
          </div>
          <div class="col-md-4 text-md-end mt-3 mt-md-0">
            <span class="badge ${alertClass}" style="font-size: 1.5rem; padding: 0.75rem 1.5rem;">
              เหลือ ${remainingQty} ${med.Unit || ''}
            </span>
          </div>
        </div>
        ${med.Notes ? `<div class="mt-3 pt-3 border-top border-white-50"><small>${med.Notes}</small></div>` : ''}
      </div>
    `;

  } catch (err) {
    console.error('Load medicine error:', err);
    document.getElementById('medicineInfo').innerHTML = `
      <div class="alert alert-danger text-center">
        ❌ ไม่สามารถโหลดข้อมูลยาได้<br>
        <small>${err.message}</small>
      </div>
    `;
  }
}

async function submitDispense(e) {
  e.preventDefault();

  if (!checkConfig()) return;

  const form = document.getElementById('dispenseForm');
  if (!form) return;

  const dispenseQty = parseFloat(document.getElementById('dispenseQty').value);
  const remainingQty = parseFloat(document.getElementById('remainingHint').textContent) || 0;

  if (!dispenseQty || dispenseQty <= 0) {
    showToast('กรุณาระบุจำนวนที่จ่าย', 'warning');
    return;
  }

  if (dispenseQty > remainingQty) {
    showToast(`❌ จำนวนที่จ่าย (${dispenseQty}) มากกว่าจำนวนคงเหลือ (${remainingQty})`, 'danger');
    return;
  }

  const data = {
    action: 'dispense',
    medicineId: document.getElementById('medicineId').value,
    hn: document.getElementById('hn').value,
    drugName: document.getElementById('drugNameHidden').value,
    dispenseQty: dispenseQty,
    dispensedBy: document.getElementById('dispensedBy').value.trim(),
    notes: document.getElementById('dispenseNotes').value.trim()
  };

  // Loading
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> กำลังจ่ายยา...';
  }

  try {
    const res = await apiPost(data);

    if (res.success) {
      if (res.isHidden) {
        showToast('✅ จ่ายยาสำเร็จ! จำนวนคงเหลือเป็น 0 - รายการจะถูกซ่อน', 'success');
      } else {
        showToast(`✅ จ่ายยาสำเร็จ! เหลือ ${res.remainingQty}`, 'success');
      }

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1500);
    } else {
      showToast('❌ ' + (res.error || 'เกิดข้อผิดพลาด'), 'danger');
    }
  } catch (err) {
    console.error('Dispense error:', err);
    showToast('❌ ไม่สามารถเชื่อมต่อ API ได้', 'danger');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

// ==================== History ====================
async function loadHistory() {
  if (!checkConfig()) return;

  const hnInput = document.getElementById('historyHN');
  const hn = hnInput ? hnInput.value.trim() : '';

  if (!hn) {
    showToast('กรุณากรอก HN', 'warning');
    return;
  }

  const container = document.getElementById('historyResults');
  if (container) {
    container.innerHTML = '<div class="text-center"><div class="spinner-border text-info"></div><p class="mt-2">กำลังโหลดประวัติ...</p></div>';
  }

  try {
    const res = await apiGet('getHistory', { hn });

    if (res.success && res.data && res.data.length > 0) {
      renderHistory(res.data, hn);
    } else {
      if (container) {
        container.innerHTML = `
          <div class="text-center p-4">
            <div class="display-4 text-muted">📭</div>
            <p class="mt-2 text-muted">ไม่พบประวัติการจ่ายยาสำหรับ HN: ${hn}</p>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('History error:', err);
    if (container) {
      container.innerHTML = '<div class="alert alert-danger">❌ ไม่สามารถโหลดประวัติได้</div>';
    }
  }
}

function renderHistory(history, hn) {
  const container = document.getElementById('historyResults');
  if (!container) return;

  let html = `
    <h5 class="mb-3">ประวัติการจ่ายยา HN: ${hn} 
      <span class="badge bg-info">${history.length} รายการ</span>
    </h5>
    <div class="table-responsive">
      <table class="table table-hover table-medicines">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>ชื่อยา</th>
            <th>จำนวนที่จ่าย</th>
            <th>คงเหลือหลังจ่าย</th>
            <th>ผู้จ่าย</th>
            <th>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
  `;

  history.forEach(item => {
    const date = item.DispenseDate ? new Date(item.DispenseDate).toLocaleString('th-TH') : '-';
    html += `
      <tr>
        <td>${date}</td>
        <td>${item.DrugName || '-'}</td>
        <td><span class="badge bg-warning text-dark">${item.DispenseQty || 0}</span></td>
        <td><span class="badge bg-success">${item.RemainingAfter || 0}</span></td>
        <td>${item.DispensedBy || '-'}</td>
        <td>${item.Notes || '-'}</td>
      </tr>
    `;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// ==================== Helpers ====================
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// ==================== Event Listeners ====================
document.addEventListener('DOMContentLoaded', () => {
  // Check config on load
  checkConfig();

  // Enter key to search
  const searchInput = document.getElementById('searchHN');
  if (searchInput) {
    searchInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') searchMedicine();
    });
  }

  // Enter key for history
  const historyInput = document.getElementById('historyHN');
  if (historyInput) {
    historyInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') loadHistory();
    });
  }

  // Set default date
  const entryDate = document.getElementById('entryDate');
  if (entryDate && !entryDate.value) {
    entryDate.valueAsDate = new Date();
  }
});
