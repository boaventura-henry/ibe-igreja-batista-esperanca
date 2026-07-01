import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/membros",
  "/perfis-acesso",
  "/usuarios",
  "/ministerios",
  "/membros-ministerios",
  "/escalas",
  "/minhas-escalas",
  "/eventos",
  "/contribuicoes"
];

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

    if (pathname.startsWith("/perfis-acesso") && !request.nextauth.token?.permissionCodes?.includes("accessRole.view")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (pathname.startsWith("/usuarios") && !request.nextauth.token?.permissionCodes?.includes("user.view")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (pathname.startsWith("/ministerios") && !request.nextauth.token?.permissionCodes?.includes("ministry.view")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (
      pathname.startsWith("/membros-ministerios") &&
      !request.nextauth.token?.permissionCodes?.includes("memberMinistry.view")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (pathname.startsWith("/escalas") && !request.nextauth.token?.permissionCodes?.includes("schedule.view")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (pathname.startsWith("/minhas-escalas") && !request.nextauth.token?.permissionCodes?.includes("mySchedule.view")) {
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
    "/usuarios/:path*",
    "/ministerios/:path*",
    "/membros-ministerios/:path*",
    "/escalas/:path*",
    "/minhas-escalas/:path*",
    "/eventos/:path*",
    "/contribuicoes/:path*"
  ]
};
