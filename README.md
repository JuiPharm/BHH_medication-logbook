# สมุดยาฝาก Medication Logbook — Typhoon OCR Version

Web application สำหรับบันทึกยาฝาก ค้นหาด้วย HN จ่ายยา/หักจำนวนคงเหลือ ตรวจ Staff ID และอ่านฉลากยาด้วย Typhoon OCR ผ่าน Google Apps Script

## สิ่งที่ปรับในเวอร์ชันนี้

- เปลี่ยน OCR จาก Tesseract.js เป็น Typhoon OCR ผ่าน `Code.gs`
- ไม่เก็บ Typhoon API Key ใน GitHub Pages
- เพิ่ม action `typhoonOcrMedication` ใน Google Apps Script
- OCR เติมข้อมูลเข้าฟอร์มอัตโนมัติ: HN, ชื่อผู้ป่วย, ชื่อยา, ชื่อสามัญ, ความแรง, จำนวน, หน่วย, วิธีใช้, PN
- เพิ่มหน่วย `Set`
- ยังรองรับ Staff ID validation, Department dropdown, จุดรับฝากยา OPD/IPD Pharmacy, HN format `07-XX-YYYYYY`, Logo/Favicon

## โครงสร้างไฟล์

```text
medication-logbook-staff-dept/
├── Code.gs                  # ใช้คัดลอกไปวางใน Google Apps Script
├── google-apps-script.js    # สำเนาของ Code.gs
├── index.html
├── add-medicine.html        # หน้าเพิ่มยา + Typhoon OCR
├── dispense.html
├── history.html
├── css/style.css
└── js/
    ├── config.js
    ├── api.js
    ├── app.js
    └── ocr.js               # ส่งรูปไป Code.gs เพื่อเรียก Typhoon OCR
```

## วิธีตั้งค่า Google Apps Script

1. เปิด Google Sheet ที่ใช้เป็น database
2. ไปที่ `Extensions` → `Apps Script`
3. ลบโค้ดเดิม แล้วคัดลอกไฟล์ `Code.gs` ไปวางทั้งหมด
4. แก้บรรทัดนี้ให้เป็น Spreadsheet ID จริง

```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
```

5. กด Save
6. Run function `setupDatabase()` หนึ่งครั้ง
7. Deploy → New deployment → Web app
8. ตั้งค่า:
   - Execute as: `Me`
   - Who has access: `Anyone`
9. Copy Web app URL ไปใส่ใน `js/config.js`

```javascript
API_URL: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec'
```

## วิธีนำ Typhoon OCR API Key ไปวาง

ห้ามวาง API Key ใน `js/config.js` หรือไฟล์หน้าเว็บ เพราะ GitHub Pages เป็น public static site

ให้วางใน Apps Script แบบนี้:

1. เปิด Apps Script project
2. กดไอคอนเฟือง `Project Settings`
3. เลื่อนลงไปที่ `Script Properties`
4. กด `Add script property`
5. ใส่ค่า:

```text
Property: TYPHOON_OCR_API_KEY
Value: your_typhoon_api_key_here
```

6. กด Save
7. Deploy Web app ใหม่อีกครั้งถ้ามีการแก้ Code.gs

หมายเหตุ: `Code.gs` รองรับชื่อ property สำรอง `TYPHOON_API_KEY` ด้วย แต่แนะนำใช้ `TYPHOON_OCR_API_KEY`

## วิธีขอ Typhoon API Key

1. เข้า Typhoon Playground / API Keys
2. Login หรือสร้างบัญชี
3. Create API Key
4. Copy key แล้วนำไปใส่ใน Script Properties ตามขั้นตอนด้านบน

## ทดสอบ OCR ด้วยรูปฉลากตัวอย่าง

เปิดหน้า `add-medicine.html` แล้วอัปโหลดรูปฉลากยา ระบบควรเติมข้อมูลประมาณนี้:

```text
HN: 07-02-022206
ชื่อ-สกุล: นาง หนูถิ้น จันทราช
ชื่อยา: NESP Inj. +++40 mcg/0.5 ml++ Syring
ชื่อสามัญ: darbepoetin alfa
ความแรง: 40 mcg
จำนวน: 1
หน่วย: Set
วิธีใช้: ฉีดเข้าใต้ผิวหนัง (SC) ครั้งละ 40 ไมโครกรัม เดือนละ 1 ครั้ง
```

กรุณาตรวจสอบข้อมูลก่อนกดบันทึกเสมอ เพราะ OCR อาจอ่าน `0.5` / `O.5`, ตัวเลข, หรือคำย่อผิดได้ในบางภาพ

## วิธี Verify หลังติดตั้ง

1. Run `setupDatabase()` แล้วตรวจว่า Sheet เหล่านี้ถูกสร้าง/มี columns ครบ:
   - `Medicines`
   - `DispenseHistory`
   - `Staff`
   - `Departments`
2. เพิ่มข้อมูล Staff ใน Sheet `Staff` เช่น:

```text
StaffID | StaffName | Role | Active
P001    | Test User | Pharmacist | TRUE
```

3. เพิ่มข้อมูลหน่วยงานใน Sheet `Departments` เช่น:

```text
DepartmentCode | DepartmentName | Active
OPD            | OPD            | TRUE
WARD9          | Ward 9         | TRUE
```

4. เปิด GitHub Pages
5. ไปที่หน้าเพิ่มยา
6. เลือกรูปฉลากยาแล้วรอ Typhoon OCR
7. ตรวจว่าฟอร์มถูกเติมข้อมูล
8. กรอก Staff ID ที่มีอยู่ใน Sheet `Staff`
9. กดบันทึก
10. ค้นหา HN ด้วย `07-02-022206`

## หมายเหตุด้านความปลอดภัย

- Typhoon API Key อยู่ใน Apps Script Properties เท่านั้น
- GitHub Pages ส่งรูปไปยัง Apps Script แล้ว Apps Script เป็นตัวเรียก Typhoon API
- ถ้า repo เป็น public ห้ามใส่ API Key ในไฟล์ frontend ทุกกรณี
