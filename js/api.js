/**
 * ====================
 * API CLIENT
 * ====================
 * ใช้ simple request เพื่อให้เรียก Google Apps Script จาก GitHub Pages ได้ง่ายขึ้น
 */

class ApiClient {
  constructor() {
    this.baseUrl = CONFIG.API_URL;
  }

  async get(action, params = {}) {
    const url = new URL(this.baseUrl);
    url.searchParams.set('action', action);
    if (CONFIG.API_TOKEN) url.searchParams.set('token', CONFIG.API_TOKEN);

    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.set(key, params[key]);
      }
    });

    const response = await fetch(url.toString(), { method: 'GET' });
    return await this.parseResponse(response);
  }

  async post(data) {
    const payload = { ...data };
    if (CONFIG.API_TOKEN) payload.token = CONFIG.API_TOKEN;

    // ห้ามตั้ง Content-Type: application/json เพื่อหลีกเลี่ยง preflight CORS
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return await this.parseResponse(response);
  }

  async parseResponse(response) {
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      throw new Error('API ไม่ได้ตอบกลับเป็น JSON: ' + text.slice(0, 200));
    }
    if (!response.ok) {
      throw new Error(json.error || `HTTP ${response.status}`);
    }
    return json;
  }
}

const api = new ApiClient();

async function apiGet(action, params) {
  return await api.get(action, params);
}

async function apiPost(data) {
  return await api.post(data);
}
