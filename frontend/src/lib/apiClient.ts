const jsonHeaders = { 'Content-Type': 'application/json' };

async function parseResponse(response: Response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Request failed');
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.blob();
}

export const apiClient = {
  get: async <T>(url: string): Promise<T> => {
    const response = await fetch(url, { credentials: 'include' });
    return parseResponse(response) as Promise<T>;
  },
  post: async <T>(url: string, body: unknown): Promise<T> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return parseResponse(response) as Promise<T>;
  },
  patch: async <T>(url: string, body: unknown): Promise<T> => {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return parseResponse(response) as Promise<T>;
  },
  delete: async (url: string): Promise<void> => {
    const response = await fetch(url, { method: 'DELETE', credentials: 'include' });
    await parseResponse(response);
  },
};
