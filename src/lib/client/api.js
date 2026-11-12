'use client';
// Small fetch wrapper: JSON in/out; throws an Error carrying { status, code, data } on failure.
export async function api(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code;
    err.data = data;
    throw err;
  }
  return data;
}

export async function uploadImage(file, folder = 'misc') {
  // Cloudinary signed direct upload when configured, otherwise POST to /api/uploads.
  const sig = await api(`/api/uploads/sign?folder=${encodeURIComponent(folder)}`).catch(() => null);
  if (sig?.signature) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('api_key', sig.apiKey);
    fd.append('timestamp', String(sig.timestamp));
    fd.append('folder', sig.folder);
    fd.append('signature', sig.signature);
    const res = await fetch(sig.url, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Upload failed');
    return data.secure_url;
  }
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  const res = await fetch('/api/uploads', { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Upload failed');
  return data.url;
}
