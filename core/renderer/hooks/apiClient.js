// Lazy-initialized so config is available when first call is made
let _baseUrl = null;

function getBaseUrl() {
  if (!_baseUrl) {
    // window.nexus.getConfig() is async — callers must await config before using apiClient,
    // OR the app must call initApiClient() on startup.
    throw new Error('apiClient not initialized. Call initApiClient(port) first.');
  }
  return _baseUrl;
}

export function initApiClient(port) {
  _baseUrl = `http://127.0.0.1:${port}`;
}

async function request(method, path, body) {
  const url = `${getBaseUrl()}${path}`;
  const options = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(url, options);
  const json = await response.json();

  if (!response.ok) {
    return { data: null, error: json.error || `HTTP ${response.status}` };
  }
  return { data: json.data, error: json.error };
}

export const apiClient = {
  get:    (path)        => request('GET',    path, null),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path, null),
};
