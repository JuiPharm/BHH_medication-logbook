# Medication Logbook - Staff ID + Department + Deposit Location Version

ระบบสมุดยาฝากสำหรับ GitHub Pages + Google Apps Script + Google Sheet

## สิ่งที่ปรับในเวอร์ชันนี้

1. การตัดจ่ายยาใช้ `MedicineID` เป็นตัวอ้างอิงรายการยาโดยตรง  
   ดังนั้นแม้มีหลาย HN หรือ 1 HN มียาหลายรายการ ระบบจะตัดจ่ายเฉพาะรายการที่ผู้ใช้กดจากหน้าค้นหาเท่านั้น

2. เพิ่มการตรวจสอบ `Staff ID` ก่อนบันทึกยาฝากและก่อนตัดจ่ายยา
   - ตรวจสอบจาก Sheet `Staff`
   - ถ้า Staff ID ไม่ถูกต้อง หรือ `Active = FALSE` ระบบจะไม่บันทึกและไม่ตัดจ่าย
   - หน้าเว็บจะแสดง popup/alert ว่า `Staff ID ไม่ถูกต้อง`

3. เพิ่ม Dropdown จุดรับฝากยา
   - `OPD Pharmacy`
   - `IPD Pharmacy`

4. เพิ่ม Dropdown หน่วยงานที่เอายามาฝาก
   - ดึงข้อมูลจาก Sheet `Departments`
   - แสดงเฉพาะ row ที่ `Active` ไม่ใช่ `FALSE`

5. เพิ่ม Sheet ใหม่พร้อม Columns อัตโนมัติ
   - `Staff`
   - `Departments`

6. บันทึกผู้จ่ายในประวัติการจ่ายยา
   - `DispensedByStaffID`
   - `DispensedByName`

---

## โครงสร้าง Sheet ที่ระบบสร้างให้

### Sheet: `Medicines`

| Column |
|---|
| ID |
| HN |
| PatientName |
| DrugName |
| GenericName |
| Strength |
| Form |
| TotalQty |
| RemainingQty |
| Unit |
| Storage |
| Hospital |
| PN |
| EntryDate |
| ExpiryDate |
| AdministrationSchedule |
| FollowUpDate |
| DepositLocation |
| DepartmentCode |
| DepartmentName |
| ImageURL |
| OCRRawText |
| Notes |
| Status |
| CreatedAt |
| LastDispensed |
| CreatedByStaffID |
| CreatedByName |

### Sheet: `DispenseHistory`

| Column |
|---|
| DispenseID |
| MedicineID |
| HN |
| PatientName |
| DrugName |
| DispenseQty |
| RemainingAfter |
| DispensedByStaffID |
| DispensedByName |
| Receiver |
| Ward |
| DispenseDate |
| Notes |

### Sheet: `Staff`

| Column | ตัวอย่าง |
|---|---|
| StaffID | RX001 |
| StaffName | Somchai |
| Role | Pharmacist |
| Active | TRUE |
| CreatedAt | 2026-05-22 |
| Notes |  |

> ต้องเพิ่มข้อมูล Staff เองก่อนใช้งานจริง ถ้าไม่มี Staff ID ใน Sheet นี้ ระบบจะบันทึก/ตัดจ่ายไม่ได้

### Sheet: `Departments`

| Column | ตัวอย่าง |
|---|---|
| DepartmentCode | ER |
| DepartmentName | Emergency Room |
| Active | TRUE |
| CreatedAt | 2026-05-22 |
| Notes |  |

> ต้องเพิ่มข้อมูลหน่วยงานเองก่อนใช้งาน เพื่อให้ Dropdown ในหน้าเพิ่มยาฝากแสดงรายการ

---

## วิธีติดตั้ง

1. สร้าง Google Sheet ใหม่
2. เปิด Extensions → Apps Script
3. คัดลอกไฟล์ `Code.gs` ทั้งหมดไปวาง
4. แก้ค่า:

```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
```

5. Run function:

```javascript
setupDatabase
```

6. กลับไป Google Sheet แล้วเพิ่มข้อมูลใน Sheet `Staff` เช่น:

| StaffID | StaffName | Role | Active |
|---|---|---|---|
| RX001 | Somchai | Pharmacist | TRUE |
| RX002 | Suda | Pharmacist | TRUE |

7. เพิ่มข้อมูลใน Sheet `Departments` เช่น:

| DepartmentCode | DepartmentName | Active |
|---|---|---|
| ER | Emergency Room | TRUE |
| ICU | Intensive Care Unit | TRUE |
| WARD5 | Ward 5 | TRUE |

8. Deploy Apps Script เป็น Web App
   - Execute as: Me
   - Who has access: Anyone with the link

9. นำ Web App URL ไปใส่ใน `js/config.js`

```javascript
API_URL: 'YOUR_APPS_SCRIPT_WEB_APP_URL'
```

10. Upload ไฟล์ทั้งหมดขึ้น GitHub Pages

---

## Flow การจ่ายยาที่ถูกต้อง

1. เปิด `index.html`
2. ค้นหาด้วย HN เช่น `07-25-000023`
3. ระบบแสดงรายการยาคงเหลือทั้งหมดของ HN นั้น
4. ถ้า 1 HN มียาหลายรายการ จะเห็นหลาย card
5. ผู้ใช้กดปุ่ม `จ่ายยา` เฉพาะรายการที่ต้องการ
6. ระบบเปิด `dispense.html?id=<MedicineID>`
7. กรอกจำนวนที่จ่าย และ `Staff ID ผู้จ่าย`
8. ระบบตรวจสอบ Staff ID จาก Sheet `Staff`
9. ถ้าถูกต้อง ระบบหัก `RemainingQty`
10. ถ้า `RemainingQty = 0` ระบบเปลี่ยน `Status = HIDDEN` และรายการนั้นจะไม่แสดงในหน้าค้นหาปกติ
11. ระบบบันทึกประวัติใน `DispenseHistory`

## Flow การบันทึกยาฝาก

1. เปิด `add-medicine.html`
2. กรอก HN, ผู้ป่วย, ยา, จำนวน
3. เลือกจุดรับฝากยา: `OPD Pharmacy` หรือ `IPD Pharmacy`
4. เลือกหน่วยงานที่เอายามาฝากจาก Dropdown
5. กรอก `Staff ID ผู้บันทึก`
6. ระบบตรวจสอบ Staff ID จาก Sheet `Staff`
7. ถ้าถูกต้องจึงบันทึกลง Sheet `Medicines`

---

## หมายเหตุสำคัญเรื่อง HN

ระบบจะบันทึก HN เป็น Text และจัดรูปแบบเป็น:

```text
07-XX-YYYYYY
```

ตัวอย่าง:

```text
07-25-000023
```

ห้ามปล่อยให้ Google Sheet แปลง HN เป็นวันที่ เช่น `07-25-2023`  
ให้ Run `setupDatabase()` เพื่อกำหนด Column `HN` เป็น Plain text ก่อนนำเข้าข้อมูล

---

## วิธีทดสอบเร็ว

1. Run `setupDatabase()`
2. เพิ่ม Staff:

```text
StaffID: RX001
StaffName: Test Pharmacist
Active: TRUE
```

3. เพิ่ม Department:

```text
DepartmentCode: ER
DepartmentName: Emergency Room
Active: TRUE
```

4. เปิด `add-medicine.html`
5. กรอก Staff ID ผิด เช่น `ABC` → ต้อง popup ว่า Staff ID ไม่ถูกต้อง และไม่บันทึก
6. กรอก Staff ID ถูก เช่น `RX001` → ต้องบันทึกได้
7. เปิด `index.html` ค้นหา HN
8. กดจ่ายยา
9. กรอก Staff ID ผิด → ต้อง popup และไม่ตัดจ่าย
10. กรอก Staff ID ถูก → ต้องตัดจ่ายและบันทึกประวัติผู้จ่าย

## Logo และ Favicon

เวอร์ชันนี้เพิ่ม Logo และ Favicon ด้วย URL:

```text
https://lh5.googleusercontent.com/d/1r7PM1ogHIbxskvcauVIYaQOfSHXWGncO
```

ไฟล์ที่ปรับแล้ว: `index.html`, `add-medicine.html`, `dispense.html`, `history.html`, และ `css/style.css`

---

## ✅ Stable version notes

เวอร์ชันนี้ปรับตาม requirement ล่าสุด:

- `Code.gs` ตรวจสอบและสร้าง Sheet/Column อัตโนมัติทุกครั้งที่ API ทำงาน
- สร้าง Sheet หลักให้ครบ: `Medicines`, `DispenseHistory`, `Staff`, `Departments`
- ถ้า Column ขาด ระบบจะเพิ่มต่อท้ายโดยไม่ลบหรือย้าย Column เดิม
- HN ถูกบันทึกเป็น Text รูปแบบ `07-XX-YYYYYY` เพื่อป้องกัน Google Sheets แปลงเป็นวันที่
- การบันทึกยาฝากและการจ่ายยาจะตรวจ Staff ID จาก Sheet `Staff` ก่อนเสมอ
- ถ้ากรอกข้อมูล Required ไม่ครบ ระบบจะแสดง popup แจ้งรายการที่ยังไม่กรอก
- จุดรับฝากยาเลือกได้ 2 ค่า: `OPD Pharmacy`, `IPD Pharmacy`
- หน่วยงานที่เอายามาฝากดึงจาก Sheet `Departments`

### วิธีเตรียมข้อมูล Staff และ Departments

1. เปิด Google Sheet
2. ไปที่เมนู `Medication Logbook` → `ตรวจสอบ / สร้าง Columns`
3. เพิ่ม Staff จริงใน Sheet `Staff` เช่น:

| StaffID | StaffName | Role | Active |
|---|---|---|---|
| 12345 | Somchai | Pharmacist | TRUE |

4. เพิ่มหน่วยงานจริงใน Sheet `Departments` เช่น:

| DepartmentCode | DepartmentName | Active |
|---|---|---|
| OPD | OPD | TRUE |
| WARD9 | Ward 9 | TRUE |

> หมายเหตุ: ถ้า Staff ID ไม่มีใน Sheet `Staff` หรือ `Active = FALSE` ระบบจะไม่ให้บันทึก/ตัดจ่าย
