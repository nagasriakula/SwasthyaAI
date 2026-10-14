import { NextResponse, type NextRequest } from 'next/server';

/**
 * Online demo: the backend runs on a laptop and is reached through an ngrok
 * tunnel. ngrok's free plan shows a warning page to browsers unless the
 * request carries the "ngrok-skip-browser-warning" header, so API and image
 * requests are forwarded here with that header added.
 *
 * Only active when BACKEND_URL is an ngrok address. On a normal local setup
 * (BACKEND_URL = http://127.0.0.1:8000) this does nothing and the rewrites in
 * next.config.mjs handle the forwarding as before.
 */
const BACKEND_URL = (process.env.BACKEND_URL || '').replace(/\/$/, '');
const VIA_NGROK = /ngrok/i.test(BACKEND_URL);

export function middleware(request: NextRequest) {
  if (!VIA_NGROK) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set('ngrok-skip-browser-warning', 'true');

  return NextResponse.rewrite(new URL(`${BACKEND_URL}${pathname}${search}`), {
    request: { headers },
  });
}

export const config = {
  matcher: ['/api/:path*', '/uploads/:path*'],
};
