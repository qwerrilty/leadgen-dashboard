import { NextResponse } from 'next/server';

const COOKIE_NAME = 'leadgen_session';

async function expectedToken(password) {
  const data = new TextEncoder().encode('leadgen-dashboard:' + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Cron routes authenticate via CRON_SECRET header, not the cookie.
  if (pathname.startsWith('/api/cron/')) return NextResponse.next();
  // Login page + its API must stay reachable.
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();
  // Unsubscribe page must be public — recipients land here from email, not us.
  if (pathname === '/unsubscribe' || pathname === '/api/unsubscribe') return NextResponse.next();
  // Let static assets through.
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const expected = await expectedToken(process.env.APP_PASSWORD);

  if (cookie === expected) return NextResponse.next();

  const loginUrl = new URL('/login', req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
