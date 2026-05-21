async function processOCR(input) {
  const file = input.files[0];
  if (!file) return;

  const progressDiv = document.getElementById('ocrProgress');
  const progressBar = document.getElementById('progressBar');
  const status = document.getElementById('ocrStatus');
  
  progressDiv.classList.remove('d-none');
  
  try {
    const result = await Tesseract.recognize(
      file,
      'tha+eng', // ภาษาไทย + อังกฤษ
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            progressBar.style.width = `${m.progress * 100}%`;
            status.textContent = `กำลังอ่านข้อความ... ${Math.round(m.progress * 100)}%`;
          }
        }
      }
    );

    const text = result.data.text;
    console.log('OCR Result:', text);
    
    // แสดง preview
    document.getElementById('ocrPreview').innerHTML = `
      <div class="alert alert-success">
        <strong>✅ OCR สำเร็จ!</strong>
        <pre class="mt-2 small">${text.substring(0, 500)}...</pre>
      </div>
    `;

    // Auto-fill form จาก OCR
    autoFillFromOCR(text);
    
  } catch (err) {
    document.getElementById('ocrPreview').innerHTML = `
      <div class="alert alert-danger">❌ OCR ล้มเหลว: ${err.message}</div>
    `;
  }
}

function autoFillFromOCR(text) {
  // ดึงข้อมูลจาก text ด้วย Regex patterns
  
  // HN: 07-13-000025
  const hnMatch = text.match(/HN[:\s]*([0-9-]+)/i);
  if (hnMatch) document.getElementById('hn').value = hnMatch[1].trim();
  
  // PN: O2603300492
  const pnMatch = text.match(/PN[:\s]*([A-Z0-9]+)/i);
  if (pnMatch) document.getElementById('pn').value = pnMatch[1].trim();
  
  // Drug Name
  const drugMatch = text.match(/(Espogen|Herna Plus|Cef-3|Ceftriaxone)[\s\w]*/i);
  if (drugMatch) document.getElementById('drugName').value = drugMatch[0].trim();
  
  // Generic Name
  const genericMatch = text.match(/(epoetin alfa|ceftriaxone)/i);
  if (genericMatch) document.getElementById('genericName').value = genericMatch[0].trim();
  
  // Strength: 4000 IU, 500 Mg
  const strengthMatch = text.match(/(\d+)\s*(IU|mg|Mg|มิลลิกรัม)/i);
  if (strengthMatch) document.getElementById('strength').value = 
    `${strengthMatch[1]} ${strengthMatch[2]}`;
  
  // Quantity: # 9 Vial
  const qtyMatch = text.match(/#\s*(\d+)\s*Vial/i);
  if (qtyMatch) document.getElementById('totalQty').value = qtyMatch[1];
  
  // Storage: 2-8°C
  const storageMatch = text.match(/([0-9-]+)\s*°?C/);
  if (storageMatch) document.getElementById('storage').value = `${storageMatch[1]}°C`;
  
  // Hospital
  if (text.includes('Bangkok Hospital')) {
    document.getElementById('hospital').value = 'Bangkok Hospital';
  }
  
  // Date: 30/12/2568
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateMatch) {
    const [_, d, m, y] = dateMatch;
    // แปลง พ.ศ. เป็น ค.ศ. ถ้าจำเป็น
    const year = parseInt(y) > 2500 ? parseInt(y) - 543 : parseInt(y);
    document.getElementById('entryDate').value = `${year}-${m}-${d}`;
  }
}
