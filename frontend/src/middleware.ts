import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/leads', '/segments', '/campaigns', '/tools'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = protectedRoutes.some((route) => pathname.startsWith(route));
  const hasSession = request.cookies.get('hog_session')?.value === '1';

  if (needsAuth && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/dashboard/:path*', '/leads/:path*', '/segments/:path*', '/campaigns/:path*', '/tools/:path*'],
};
