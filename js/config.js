/**
 * ====================
 * CONFIGURATION
 * ====================
 * 
 * แก้ไข API_URL หลังจาก Deploy Google Apps Script
 * 
 * วิธีเอา URL:
 * 1. เปิด Google Apps Script
 * 2. Deploy → New deployment
 * 3. Type: Web app
 * 4. Execute as: Me
 * 5. Access: Anyone
 * 6. คัดลอก URL มาวางด้านล่าง
 */

const CONFIG = {
  // 🔴 แก้ URL ตรงนี้หลัง Deploy Google Apps Script
  API_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',

  APP_NAME: 'สมุดยาฝาก',
  VERSION: '1.0.0',

  // การตั้งค่า OCR
  OCR: {
    LANG: 'tha+eng',      // ภาษาไทย + อังกฤษ
    CONFIDENCE: 60        // ความมั่นใจขั้นต่ำ (%)
  },

  // การแจ้งเตือน
  ALERT: {
    LOW_QTY: 2,           // แจ้งเตือนเมื่อเหลือน้อยกว่านี้
    CRITICAL_QTY: 1       // แจ้งเตือนวิกฤต
  }
};

// ตรวจสอบว่า API_URL ถูกตั้งค่าหรือยัง
function checkConfig() {
  if (CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID')) {
    console.error('⚠️ กรุณาแก้ไข API_URL ใน js/config.js ก่อนใช้งาน!');
    alert('⚠️ กรุณาแก้ไข API_URL ใน js/config.js ก่อนใช้งาน!\n\nดูคู่มือใน README.md');
    return false;
  }
  return true;
}
