// ========== ค้นหา HN ==========
async function searchMedicine() {
  const hn = document.getElementById('searchHN').value.trim();
  if (!hn) return alert('กรุณากรอก HN');
  
  showLoading();
  try {
    const res = await apiGet('searchByHN', { hn });
    renderResults(res.data, `HN: ${hn}`);
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
  hideLoading();
}

async function loadAllActive() {
  showLoading();
  try {
    const res = await apiGet('getAllActive');
    renderResults(res.data, 'รายการยาทั้งหมด');
  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
  }
  hideLoading();
}

// ========== แสดงผล ==========
function renderResults(medicines, title) {
  const container = document.getElementById('results');
  
  if (!medicines || medicines.length === 0) {
    container.innerHTML = `
      <div class="alert alert-info">ไม่พบรายการยา (หรือจำนวนคงเหลือเป็น 0)</div>
    `;
    return;
  }

  let html = `<h5 class="mb-3">${title} <span class="badge bg-primary">${medicines.length} รายการ</span></h5>`;
  
  html += '<div class="row">';
  medicines.forEach(med => {
    const isLow = med.RemainingQty <= 2;
    const cardClass = isLow ? 'border-danger' : 'border-success';
    const badgeClass = isLow ? 'bg-danger' : 'bg-success';
    
    html += `
      <div class="col-md-6 col-lg-4 mb-3">
        <div class="card ${cardClass} h-100">
          <div class="card-header d-flex justify-content-between">
            <strong>${med.DrugName}</strong>
            <span class="badge ${badgeClass} fs-6">เหลือ ${med.RemainingQty} ${med.Unit}</span>
          </div>
          <div class="card-body">
            <p class="mb-1"><strong>HN:</strong> ${med.HN}</p>
            <p class="mb-1"><strong>ผู้ป่วย:</strong> ${med.PatientName}</p>
            <p class="mb-1"><strong>สรรพคุณ:</strong> ${med.GenericName} ${med.Strength}</p>
            <p class="mb-1"><strong>PN:</strong> ${med.PN}</p>
            <p class="mb-1"><strong>วันหมดอายุ:</strong> ${med.ExpiryDate || '-'}</p>
            <p class="mb-0"><strong>หมายเหตุ:</strong> ${med.Notes || '-'}</p>
          </div>
          <div class="card-footer">
            <a href="dispense.html?id=${med.ID}" class="btn btn-warning btn-sm w-100">
              💊 จ่ายยา
            </a>
          </div>
        </div>
      </div>
    `;
  });
  html += '</div>';
  
  container.innerHTML = html;
}

// ========== เพิ่มยา ==========
async function submitMedicine(e) {
  e.preventDefault();
  
  const data = {
    action: 'addMedicine',
    hn: document.getElementById('hn').value,
    patientName: document.getElementById('patientName').value,
    drugName: document.getElementById('drugName').value,
    genericName: document.getElementById('genericName').value,
    strength: document.getElementById('strength').value,
    form: document.getElementById('form').value,
    totalQty: parseFloat(document.getElementById('totalQty').value),
    unit: document.getElementById('unit').value,
    storage: document.getElementById('storage').value,
    hospital: document.getElementById('hospital').value,
    pn: document.getElementById('pn').value,
    entryDate: document.getElementById('entryDate').value,
    expiryDate: document.getElementById('expiryDate').value,
    notes: document.getElementById('notes').value
  };

  try {
    const res = await apiPost(data);
    if (res.success) {
      alert('✅ เพิ่มยาสำเร็จ!');
      window.location.href = 'index.html';
    } else {
      alert('❌ ผิดพลาด: ' + res.error);
    }
  } catch (err) {
    alert('❌ เกิดข้อผิดพลาด: ' + err.message);
  }
}

// ========== จ่ายยา ==========
async function loadMedicineForDispense(medId) {
  // โหลดข้อมูลยา (จาก localStorage หรือ API)
  const res = await apiGet('getAllActive');
  const med = res.data.find(m => m.ID === medId);
  
  if (!med) {
    document.getElementById('medicineInfo').innerHTML = 
      '<div class="alert alert-danger">ไม่พบรายการยา</div>';
    return;
  }

  document.getElementById('medicineId').value = med.ID;
  document.getElementById('hn').value = med.HN;
  document.getElementById('drugNameHidden').value = med.DrugName;
  
  document.getElementById('medicineInfo').innerHTML = `
    <div class="card-body">
      <h5>${med.DrugName} <span class="badge bg-primary">เหลือ ${med.RemainingQty} ${med.Unit}</span></h5>
      <p class="mb-0">HN: ${med.HN} | ผู้ป่วย: ${med.PatientName}</p>
    </div>
  `;
  
  // ตั้งค่า max ของ input
  document.getElementById('dispenseQty').max = med.RemainingQty;
}

async function submitDispense(e) {
  e.preventDefault();
  
  const dispenseQty = parseFloat(document.getElementById('dispenseQty').value);
  const data = {
    action: 'dispense',
    medicineId: document.getElementById('medicineId').value,
    hn: document.getElementById('hn').value,
    drugName: document.getElementById('drugNameHidden').value,
    dispenseQty: dispenseQty,
    dispensedBy: document.getElementById('dispensedBy').value,
    notes: document.getElementById('dispenseNotes').value
  };

  try {
    const res = await apiPost(data);
    if (res.success) {
      const msg = res.isHidden 
        ? '✅ จ่ายยาสำเร็จ! จำนวนคงเหลือเป็น 0 - รายการจะถูกซ่อน' 
        : `✅ จ่ายยาสำเร็จ! เหลือ ${res.remainingQty}`;
      alert(msg);
      window.location.href = 'index.html';
    } else {
      alert('❌ ' + res.error);
    }
  } catch (err) {
    alert('❌ เกิดข้อผิดพลาด: ' + err.message);
  }
}

// ========== Helpers ==========
function showLoading() {
  document.getElementById('results').innerHTML = 
    '<div class="text-center"><div class="spinner-border"></div><p>กำลังโหลด...</p></div>';
}
function hideLoading() {}

// Enter key to search
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchHN');
  if (searchInput) {
    searchInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') searchMedicine();
    });
  }
});
