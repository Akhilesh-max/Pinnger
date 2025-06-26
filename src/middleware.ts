import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the pathname
  const pathname = request.nextUrl.pathname;

  // If trying to access dashboard, redirect to login if not authenticated
  if (pathname.startsWith('/dashboard')) {
    // This is client-side only, so we'll handle auth in the component itself
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*']
};
