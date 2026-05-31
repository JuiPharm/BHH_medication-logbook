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


function showInvalidStaffPopup() {
  showToast('Staff ID ไม่ถูกต้อง', 'danger');
  alert('Staff ID ไม่ถูกต้อง');
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

async function loadDepartmentOptions() {
  const select = document.getElementById('department');
  if (!select || !checkConfig()) return;

  try {
    const res = await apiGet('getDepartments');
    const departments = res.success ? (res.data || []) : [];
    select.innerHTML = '<option value="">-- เลือกหน่วยงาน --</option>';
    departments.forEach(dep => {
      const option = document.createElement('option');
      option.value = dep.DepartmentCode || dep.DepartmentName;
      option.textContent = dep.DepartmentName || dep.DepartmentCode;
      option.dataset.name = dep.DepartmentName || '';
      option.dataset.code = dep.DepartmentCode || '';
      select.appendChild(option);
    });
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
    showToast('กรุณากรอก HN', 'warning');
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
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const fragment = document.createDocumentFragment();
  while (tempDiv.firstChild) {
    fragment.appendChild(tempDiv.firstChild);
  }
  container.replaceChildren(fragment);
}

async function submitMedicine(e) {
  e.preventDefault();
  if (!checkConfig()) return;

  const form = document.getElementById('addForm');
  if (!form) return;

  const required = ['hn', 'patientName', 'drugName', 'totalQty', 'entryDate', 'depositLocation', 'department', 'createdByStaffId'];
  for (const id of required) {
    const el = document.getElementById(id);
    if (!el || !String(el.value).trim()) {
      showToast('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน', 'warning');
      if (el) el.focus();
      return;
    }
  }

  const totalQty = Number(document.getElementById('totalQty').value);
  if (!totalQty || totalQty <= 0) {
    showToast('จำนวนรวมต้องมากกว่า 0', 'warning');
    return;
  }

  const hnInput = document.getElementById('hn');
  const formattedHN = applyHNFormat(hnInput);

  const staff = await validateStaffField('createdByStaffId', 'createdByStaffName');
  if (!staff) return;

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

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> กำลังบันทึก...';
  }

  try {
    const res = await apiPost(data);
    if (res.success) {
      showToast('✅ เพิ่มยาฝากสำเร็จ', 'success');
      setTimeout(() => window.location.href = 'index.html', 1200);
    } else {
      if ((res.error || '').includes('Staff ID')) showInvalidStaffPopup();
      else showToast('❌ ' + (res.error || 'เกิดข้อผิดพลาด'), 'danger');
    }
  } catch (err) {
    console.error(err);
    showToast('❌ ไม่สามารถเชื่อมต่อ API ได้: ' + err.message, 'danger');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

async function loadMedicineForDispense(medId) {
  if (!checkConfig()) return;

  try {
    const res = await apiGet('getMedicineById', { id: medId });
    if (!res.success || !res.data) throw new Error(res.error || 'ไม่พบรายการยา');
    const med = res.data;
    const remainingQty = Number(med.RemainingQty) || 0;

    document.getElementById('medicineId').value = med.ID;
    document.getElementById('hn').value = med.HN;
    document.getElementById('drugNameHidden').value = med.DrugName;

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

  if (!dispenseQty || dispenseQty <= 0) {
    showToast('กรุณาระบุจำนวนที่จ่าย', 'warning');
    return;
  }
  if (dispenseQty > remainingQty) {
    showToast(`จำนวนที่จ่ายมากกว่าจำนวนคงเหลือ (${remainingQty})`, 'danger');
    return;
  }

  const data = {
    action: 'dispense',
    medicineId: document.getElementById('medicineId').value,
    dispenseQty,
    dispensedByStaffId: document.getElementById('dispensedByStaffId').value.trim(),
    receiver: document.getElementById('receiver').value.trim(),
    ward: document.getElementById('ward').value.trim(),
    notes: document.getElementById('dispenseNotes').value.trim()
  };

  if (!data.dispensedByStaffId) {
    showToast('กรุณากรอก Staff ID ผู้จ่าย', 'warning');
    return;
  }

  const staff = await validateStaffField('dispensedByStaffId', 'dispensedByStaffName');
  if (!staff) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> กำลังจ่ายยา...';
  }

  try {
    const res = await apiPost(data);
    if (res.success) {
      showToast(res.isHidden ? '✅ จ่ายยาสำเร็จ คงเหลือ 0 รายการถูกซ่อนแล้ว' : `✅ จ่ายยาสำเร็จ เหลือ ${res.remainingQty}`, 'success');
      setTimeout(() => window.location.href = 'index.html', 1200);
    } else {
      if ((res.error || '').includes('Staff ID')) showInvalidStaffPopup();
      else showToast('❌ ' + (res.error || 'เกิดข้อผิดพลาด'), 'danger');
    }
  } catch (err) {
    console.error(err);
    showToast('❌ ไม่สามารถเชื่อมต่อ API ได้: ' + err.message, 'danger');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

async function loadHistory() {
  if (!checkConfig()) return;
  const historyInput = document.getElementById('historyHN');
  const hn = applyHNFormat(historyInput);
  if (!hn) {
    showToast('กรุณากรอก HN', 'warning');
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
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const fragment = document.createDocumentFragment();
  while (tempDiv.firstChild) {
    fragment.appendChild(tempDiv.firstChild);
  }
  container.replaceChildren(fragment);
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
});
