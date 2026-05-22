/**
 * ====================
 * API CLIENT
 * ====================
 * เชื่อมต่อกับ Google Apps Script API
 */

class ApiClient {
  constructor() {
    this.baseUrl = CONFIG.API_URL;
  }

  // GET Request
  async get(action, params = {}) {
    const url = new URL(this.baseUrl);
    url.searchParams.append('action', action);

    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });

    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API GET Error:', error);
      throw error;
    }
  }

  // POST Request
  async post(data) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API POST Error:', error);
      throw error;
    }
  }
}

// สร้าง instance ใช้งาน
const api = new ApiClient();

// ฟังก์ชัน wrapper สำหรับใช้งานง่าย
async function apiGet(action, params) {
  return await api.get(action, params);
}

async function apiPost(data) {
  return await api.post(data);
}
