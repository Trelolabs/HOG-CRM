import { cookies } from 'next/headers';

const DEFAULT_API_URL = 'http://127.0.0.1:8080';

function getAuthHeader() {
  const username = process.env.CRM_ADMIN_USERNAME || '';
  const password = process.env.CRM_ADMIN_PASSWORD || '';
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

export async function crmApiFetch(path: string, init?: RequestInit) {
  const baseUrl = process.env.CRM_API_BASE_URL || DEFAULT_API_URL;
  const cookieStore = await cookies();
  const hasSession = cookieStore.get('hog_session')?.value === '1';

  if (!hasSession && !path.startsWith('/api/leads') && init?.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: getAuthHeader(),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(120_000),
  });

  return response;
}
