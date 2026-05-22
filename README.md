# 🏥 สมุดยาฝาก (Medication Logbook)

> Web Application สำหรับบันทึกและจัดการยาฝาก พร้อมฟังก์ชัน OCR อ่านใบสั่งยาอัตโนมัติ

---

## ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| 🔍 **ค้นหาด้วย HN** | ค้นหารายการยาฝากรวดเร็ว |
| 📷 **OCR อัตโนมัติ** | อ่านใบสั่งยาด้วย Tesseract.js (ภาษาไทย+อังกฤษ) |
| 💊 **จ่ายยา/หักลบ** | บันทึกการจ่ายยา พร้อมหักลบจำนวน |
| 🚫 **ซ่อนเมื่อหมด** | เมื่อจำนวนเป็น 0 รายการจะถูกซ่อนอัตโนมัติ |
| ⚠️ **แจ้งเตือน** | แจ้งเตือนเมื่อยาเหลือน้อย |
| 📜 **ประวัติการจ่าย** | ดูประวัติการจ่ายยาย้อนหลัง |
| 📱 **Responsive** | ใช้งานได้ทั้งคอมพิวเตอร์ แท็บเล็ต และมือถือ |

---

## 🛠️ Tech Stack

| ส่วน | เทคโนโลยี |
|-----|----------|
| **Frontend** | HTML5, Bootstrap 5, Vanilla JavaScript |
| **OCR Engine** | Tesseract.js v4 |
| **Backend** | Google Apps Script (GAS) |
| **Database** | Google Sheets |
| **Hosting** | GitHub Pages (ฟรี) |

---

## 🚀 ขั้นตอนการติดตั้ง

### 1. สร้าง Google Sheets (Database)

1. ไปที่ [Google Sheets](https://sheets.new)
2. สร้าง Sheet 2 แผ่น:

#### Sheet 1: `Medicines` (ข้อมูลยาฝาก)

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R | S |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ID | HN | PatientName | DrugName | GenericName | Strength | Form | TotalQty | RemainingQty | Unit | Storage | Hospital | PN | EntryDate | ExpiryDate | Notes | Status | CreatedAt | LastDispensed |

#### Sheet 2: `DispenseHistory` (ประวัติการจ่าย)

| A | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| DispenseID | MedicineID | HN | DrugName | DispenseQty | RemainingAfter | DispensedBy | DispenseDate | Notes |

### 2. ตั้งค่า Google Apps Script

1. เปิด Google Sheets → **Extensions** → **Apps Script**
2. ลบโค้ดเดิมทั้งหมด
3. วางโค้ดจากไฟล์ `google-apps-script.js` (ดูด้านล่าง)
4. บันทึก (Ctrl+S)
5. **Deploy** → **New deployment**
   - Type: **Web app**
   - Execute as: **Me**
   - Access: **Anyone**
   - กด **Deploy**
6. คัดลอก **URL** ที่ได้

### 3. อัปโหลดไฟล์ขึ้น GitHub

#### วิธีที่ 1: อัปโหลดผ่าน Web UI (ง่ายที่สุด)

1. ไปที่ [github.com/new](https://github.com/new)
2. ตั้งชื่อ: `medication-logbook`
3. เลือก **Public**
4. ✅ ติ๊ก "Add a README file"
5. คลิก **Create repository**
6. คลิก **"Add file"** → **"Upload files"**
7. ลากไฟล์ทั้งหมดจากโฟลเดอร์ `medication-logbook/` ขึ้นไป
8. กด **Commit changes**

#### วิธีที่ 2: ใช้ Git CLI

```bash
# 1. แตกไฟล์ ZIP แล้วเข้าโฟลเดอร์
cd medication-logbook

# 2. สร้าง Git repository
 git init
 git add .
 git commit -m "Initial commit: Medication logbook v1.0"

# 3. เชื่อมกับ GitHub (แก้ YOUR_USERNAME)
 git remote add origin https://github.com/YOUR_USERNAME/medication-logbook.git
 git branch -M main
 git push -u origin main
```

### 4. เปิดใช้ GitHub Pages

1. ไปที่ **Settings** (แท็บบน repository)
2. เลือก **Pages** (เมนูซ้าย)
3. **Source**: Deploy from a branch
4. **Branch**: `main` / `(root)`
5. กด **Save**
6. รอ 1-2 นาที

### 5. แก้ไข API URL

1. เปิดไฟล์ `js/config.js`
2. แก้บรรทัดนี้:
   ```javascript
   API_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
   ```
3. เปลี่ยนเป็น URL ที่ได้จากขั้นตอนที่ 2
4. Commit การเปลี่ยนแปลง

---

## 📂 โครงสร้างไฟล์

```
medication-logbook/
├── index.html              # 🏠 หน้าหลัก - ค้นหา HN
├── add-medicine.html       # ➕ เพิ่มยาใหม่ + OCR
├── dispense.html           # 💊 หน้าจ่ายยา
├── history.html            # 📜 ประวัติการจ่ายยา
├── css/
│   └── style.css           # 🎨 สไตล์
├── js/
│   ├── config.js           # ⚙️ ตั้งค่า API URL
│   ├── api.js              # 🔌 API Client
│   ├── app.js              # 🎯 ฟังก์ชันหลัก
│   └── ocr.js              # 📷 OCR Module
├── assets/
│   └── (รูปภาพ)
└── README.md               # 📖 คู่มือนี้
```

---

## 🔗 ลิงก์สำคัญ

| ลิงก์ | รายละเอียด |
|-------|-----------|
| **Live App** | `https://YOUR_USERNAME.github.io/medication-logbook` |
| **Google Sheets** | ฐานข้อมูลหลัก |
| **Tesseract.js** | [github.com/naptha/tesseract.js](https://github.com/naptha/tesseract.js) |
| **Bootstrap 5** | [getbootstrap.com](https://getbootstrap.com) |

---

## ⚠️ หมายเหตุสำคัญ

1. **API_URL ต้องแก้ก่อนใช้งาน** - ถ้าไม่แก้จะขึ้นแจ้งเตือน
2. **CORS** - Google Apps Script รองรับ CORS โดยอัตโนมัติ
3. **HTTPS** - GitHub Pages ใช้ HTTPS ซึ่งจำเป็นสำหรับ OCR
4. **OCR ภาษาไทย** - อาจไม่แม่นยำ 100% ควรตรวจสอบข้อมูลก่อนบันทึก

---

## 📝 License

MIT License - ใช้งานได้ฟรี

---

**สร้างด้วย ❤️ สำหรับการดูแลผู้ป่วย**
