/**
 * ====================
 * CONFIGURATION
 * ====================
 * แก้ไข API_URL หลังจาก Deploy Google Apps Script
 */

const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxbtLBYZqxvzkV1x7duacaub7ARdzgaoqW7bsuktK7aqJsigEFFK6I12Lsyk71Ef8B0/exec',

  // ถ้าใน google-apps-script.js ตั้ง API_TOKEN ให้ใส่ค่าเดียวกันตรงนี้
  // หมายเหตุ: ถ้า GitHub repo เป็น public token นี้จะมองเห็นได้ จึงเป็นแค่การป้องกันเบื้องต้น
  API_TOKEN: '',

  APP_NAME: 'สมุดยาฝาก',
  VERSION: '1.1.0',

  OCR: {
    LANG: 'tha+eng',
    CONFIDENCE: 60
  },

  ALERT: {
    LOW_QTY: 2,
    CRITICAL_QTY: 1
  }
};

function checkConfig() {
  if (CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID')) {
    console.error('กรุณาแก้ไข API_URL ใน js/config.js ก่อนใช้งาน');
    alert('⚠️ กรุณาแก้ไข API_URL ใน js/config.js ก่อนใช้งาน\n\nดูคู่มือใน README.md');
    return false;
  }
  return true;
}
