async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.append('action', action);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  
  const res = await fetch(url);
  return res.json();
}

async function apiPost(data) {
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}
