import { NextResponse } from 'next/server';
import { crmApiFetch } from '@/lib/server/crmApi';
import { cookies } from 'next/headers';

const publicRouteKey = 'POST:/api/leads';

async function handleRequest(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
  method: string
) {
  const { slug } = await params;
  const requestUrl = new URL(request.url);
  const path = `/api/${slug.join('/')}${requestUrl.search}`;
  const routeKey = `${method}:/api/${slug.join('/')}`;
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get('hog_session')?.value === '1';

  if (!isLoggedIn && routeKey !== publicRouteKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') || '';
  let body: BodyInit | undefined;

  if (method !== 'GET' && method !== 'DELETE') {
    if (contentType.includes('application/json')) {
      body = JSON.stringify(await request.json().catch(() => ({})));
    } else if (contentType.includes('multipart/form-data')) {
      body = await request.formData();
    } else {
      body = await request.text();
    }
  }

  let response: Response;
  try {
    response = await crmApiFetch(path, {
      method,
      headers: contentType.includes('multipart/form-data')
        ? undefined
        : { 'Content-Type': contentType || 'application/json' },
      body,
    });
  } catch (error) {
    console.error('CRM proxy upstream request failed:', error);
    return NextResponse.json(
      { error: 'CRM API unavailable. Please try again shortly.' },
      { status: 502 }
    );
  }

  const responseContentType = response.headers.get('content-type') || '';
  if (response.status === 204 || response.status === 205) {
    return new NextResponse(null, { status: response.status });
  }

  if (responseContentType.includes('application/json')) {
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  }

  const blob = await response.blob();
  return new NextResponse(blob, {
    status: response.status,
    headers: {
      'Content-Type': responseContentType || 'application/octet-stream',
      'Content-Disposition': response.headers.get('content-disposition') || '',
    },
  });
}

export async function GET(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  return handleRequest(request, context, 'GET');
}
export async function POST(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  return handleRequest(request, context, 'POST');
}
export async function PATCH(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  return handleRequest(request, context, 'PATCH');
}
export async function DELETE(request: Request, context: { params: Promise<{ slug: string[] }> }) {
  return handleRequest(request, context, 'DELETE');
}
