import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/membros", "/perfis-acesso", "/ministerios", "/eventos", "/contribuicoes"];

function isProtectedRoute(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export default withAuth(
  function middleware(request) {
    const { pathname } = request.nextUrl;
    const isAuthenticated = Boolean(request.nextauth.token);

    if (pathname === "/login" && isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (pathname.startsWith("/perfis-acesso") && request.nextauth.token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized({ req, token }) {
        if (req.nextUrl.pathname === "/login") {
          return true;
        }

        if (isProtectedRoute(req.nextUrl.pathname)) {
          return Boolean(token);
        }

        return true;
      }
    },
    pages: {
      signIn: "/login"
    }
  }
);

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/membros/:path*",
    "/perfis-acesso/:path*",
    "/ministerios/:path*",
    "/eventos/:path*",
    "/contribuicoes/:path*"
  ]
};
