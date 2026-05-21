# สมุดยาฝาก Medication Logbook

Web application สำหรับบันทึกยาฝาก ค้นหาด้วย HN จ่ายยาออกและหักจำนวนคงเหลือ พร้อม OCR จากรูปฉลากยา/ใบสั่งยา

## สิ่งที่ปรับปรุงในเวอร์ชันนี้

- แก้ Google Apps Script CORS โดยไม่ใช้ `setHeader()` / `setHeaders()`
- เพิ่ม `LockService` กันการจ่ายซ้ำพร้อมกัน
- ค้นหา HN แบบ normalize ได้ทั้งมีขีดและไม่มีขีด
- เมื่อ `RemainingQty = 0` ระบบเปลี่ยน `Status = HIDDEN` และไม่แสดงในหน้าค้นหาปกติ
- เพิ่มข้อมูล `Receiver`, `Ward`, `FollowUpDate`, `AdministrationSchedule`, `OCRRawText`, `ImageURL`, `CreatedBy`
- ป้องกัน XSS ฝั่ง frontend ด้วย `escapeHtml()`
- ปรับ OCR ให้รองรับ Hema Plus, Espogen, Ceftriaxone, HN, PN, ชื่อผู้ป่วย, วันที่ไทย เช่น `30 มี.ค. 2569`
- เพิ่ม `setupDatabase()` / `ensureDatabase()` สำหรับตรวจสอบ Sheet และสร้าง Column ที่ขาดให้อัตโนมัติ โดยไม่เขียนทับข้อมูลเดิม

## โครงสร้างไฟล์

```text
medication-logbook/
├── index.html
├── add-medicine.html
├── dispense.html
├── history.html
├── google-apps-script.js
├── Code.gs                 # ไฟล์เดียวกัน สำหรับคัดลอกไปวางใน Apps Script
├── css/style.css
└── js/
    ├── config.js
    ├── api.js
    ├── app.js
    └── ocr.js
```

## Google Sheet Schema

### Sheet: `Medicines`

```text
ID
HN
PatientName
DrugName
GenericName
Strength
Form
TotalQty
RemainingQty
Unit
Storage
Hospital
PN
EntryDate
ExpiryDate
AdministrationSchedule
FollowUpDate
ImageURL
OCRRawText
Notes
Status
CreatedAt
LastDispensed
CreatedBy
```

### Sheet: `DispenseHistory`

```text
DispenseID
MedicineID
HN
PatientName
DrugName
DispenseQty
RemainingAfter
DispensedBy
Receiver
Ward
DispenseDate
Notes
```

## วิธีติดตั้ง Backend: Google Apps Script

1. สร้าง Google Sheet ใหม่
2. คัดลอก Spreadsheet ID จาก URL
3. เปิด Google Sheet → Extensions → Apps Script
4. ลบโค้ดเดิม แล้ววางโค้ดจาก `Code.gs` หรือ `google-apps-script.js`
5. แก้บรรทัดนี้:

```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
```

6. กด Save
7. เลือก function `setupDatabase` แล้วกด Run หนึ่งครั้ง เพื่อสร้างหัวตารางครั้งแรก
   - หลังจากนี้ API จะเรียก `ensureDatabase()` อัตโนมัติ และจะเพิ่ม Column ที่ขาดต่อท้ายให้เอง
8. Deploy → New deployment → Web app
9. ตั้งค่า:
   - Execute as: Me
   - Access: Anyone หรือ Anyone with the link
10. Copy Web App URL

## วิธีตั้งค่า Frontend

เปิดไฟล์ `js/config.js` แล้วแก้:

```javascript
API_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
```

ถ้าต้องการป้องกันเบื้องต้น ให้ตั้งค่า token ทั้งใน `google-apps-script.js` และ `js/config.js` ให้ตรงกัน:

```javascript
API_TOKEN: 'CHANGE_THIS_SECRET'
```

หมายเหตุ: ถ้า GitHub repository เป็น public ค่า token ใน frontend จะมองเห็นได้ จึงเป็นการป้องกันเบื้องต้นเท่านั้น ไม่ใช่ระบบ login จริง

## วิธี Deploy GitHub Pages

1. สร้าง repository ใหม่บน GitHub
2. Upload ไฟล์ทั้งหมดในโฟลเดอร์นี้
3. ไปที่ Settings → Pages
4. Source: Deploy from a branch
5. Branch: main / root
6. เปิด URL ที่ GitHub Pages สร้างให้

## การใช้งาน

### เพิ่มยาฝาก

1. เปิด `add-medicine.html`
2. Upload รูปฉลากยาเพื่อ OCR หรือกรอกเอง
3. ตรวจทาน HN, ชื่อผู้ป่วย, ชื่อยา, จำนวน, วันที่
4. กดบันทึก

### ค้นหา HN

1. เปิดหน้าแรก `index.html`
2. กรอก HN เช่น `07-13-000025` หรือ `0713000025`
3. ระบบแสดงเฉพาะรายการที่ `RemainingQty > 0` และ `Status = ACTIVE`

### จ่ายยา

1. กดปุ่ม “จ่ายยา” จากรายการที่ค้นหา
2. กรอกจำนวนที่จ่าย, ผู้จ่าย, ผู้รับ, Ward
3. ระบบหักจำนวนและบันทึกใน `DispenseHistory`
4. ถ้าคงเหลือเป็น 0 ระบบเปลี่ยนสถานะเป็น `HIDDEN` และไม่แสดงในหน้าค้นหาปกติ

## ข้อควรระวัง

- OCR เป็นตัวช่วยกรอกข้อมูลเท่านั้น ต้องตรวจทานก่อนบันทึกทุกครั้ง
- ข้อมูลผู้ป่วยเป็นข้อมูลอ่อนไหว ควรจำกัดสิทธิ์ Google Sheet และ Apps Script ให้เหมาะสม
- ถ้าใช้ในหน่วยงานจริง ควรเพิ่ม Google Login / Role / Audit log ระดับผู้ใช้
- ไม่ควรเปิดเผย Google Sheet ให้เป็น public

## Troubleshooting

### กดค้นหาแล้วขึ้นให้แก้ API_URL

ให้แก้ไฟล์ `js/config.js` แล้วใส่ Web App URL ที่ได้จาก Apps Script deployment

### API ตอบ Invalid action

ตรวจสอบว่า deployment ใช้โค้ดล่าสุด และ Deploy เป็นเวอร์ชันใหม่แล้ว

### Sheet ไม่พบหัวตาราง หรือ Column ขาด

ให้กลับไป Apps Script แล้ว Run function `setupDatabase()` อีกครั้ง หรือเรียก API ใดก็ได้ ระบบจะตรวจและเพิ่ม Column ที่ขาดต่อท้ายอัตโนมัติ

### OCR ภาษาไทยไม่แม่น

ถ่ายรูปให้คมชัด ตรง ไม่เอียง แสงพอ และให้เจ้าหน้าที่ตรวจแก้ข้อมูลก่อนบันทึก


## การจ่ายยาใช้หน้าไหน

ให้เริ่มที่ `index.html` ซึ่งเป็นหน้าค้นหาด้วย HN ก่อน จากนั้นกดปุ่ม `จ่ายยา` ในรายการยาที่ต้องการ ระบบจะพาไปหน้า `dispense.html?id=...` เพื่อกรอกจำนวนที่จ่าย ผู้จ่าย ผู้รับ Ward/จุดรับยา และหมายเหตุ

ไม่แนะนำให้เปิด `dispense.html` โดยตรง เพราะหน้านี้ต้องรับ `id` ของรายการยาจากหน้าค้นหา

## การปรับล่าสุด

- เอา placeholder ออกจากทุกช่องกรอกข้อมูลในหน้าเว็บ
- เอา placeholder แบบ dynamic ในช่องจำนวนที่จ่ายออก
