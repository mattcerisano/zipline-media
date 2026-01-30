import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Define the list of protected paths
  const protectedPaths = ['/crew'];
  
  // Check if the current path is one of the protected paths
  const isProtected = protectedPaths.some(path => req.nextUrl.pathname.startsWith(path));

  // Bypass auth for the Desktop App
  if (req.headers.get('x-zipline-client') === 'desktop-app') {
    return NextResponse.next();
  }

  if (isProtected) {
    const basicAuth = req.headers.get('authorization');

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      const [user, pwd] = atob(authValue).split(':');

      // Default credentials: admin / zipline
      // In production, these should be environment variables
      if (user === 'admin' && pwd === 'zipline') {
        return NextResponse.next();
      }
    }

    return new NextResponse('Authentication Required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Zipline Internal Area"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
