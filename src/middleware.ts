import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/membros",
  "/perfis-acesso",
  "/usuarios",
  "/solicitacoes-acesso",
  "/ministerios",
  "/membros-ministerios",
  "/escalas",
  "/minhas-escalas",
  "/portal",
  "/eventos",
  "/comunicados",
  "/relatorios",
  "/financeiro",
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

    if (pathname.startsWith("/dashboard") && !request.nextauth.token?.permissionCodes?.includes("dashboard.admin.view")) {
      const fallback = request.nextauth.token?.permissionCodes?.includes("dashboard.portal.view") ? "/portal" : "/login";

      return NextResponse.redirect(new URL(fallback, request.url));
    }

    if (pathname.startsWith("/perfis-acesso") && !request.nextauth.token?.permissionCodes?.includes("accessRole.view")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (pathname.startsWith("/usuarios") && !request.nextauth.token?.permissionCodes?.includes("user.view")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (
      pathname.startsWith("/solicitacoes-acesso") &&
      !request.nextauth.token?.permissionCodes?.includes("accessRequest.view")
    ) {
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

    if (pathname.startsWith("/eventos") && !request.nextauth.token?.permissionCodes?.includes("event.view")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (pathname.startsWith("/comunicados") && !request.nextauth.token?.permissionCodes?.includes("announcement.view")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (pathname.startsWith("/relatorios") && !request.nextauth.token?.permissionCodes?.includes("report.view")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (
      pathname.startsWith("/financeiro/categorias") &&
      !request.nextauth.token?.permissionCodes?.includes("financialCategory.view")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (
      pathname.startsWith("/financeiro/lancamentos") &&
      !request.nextauth.token?.permissionCodes?.includes("financialEntry.view")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (
      pathname.startsWith("/financeiro/fechamentos") &&
      !request.nextauth.token?.permissionCodes?.includes("financialClosing.view")
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (
      pathname.startsWith("/portal/minhas-contribuicoes") &&
      !request.nextauth.token?.permissionCodes?.includes("memberContribution.view")
    ) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }

    if (
      pathname.startsWith("/portal/avisos") &&
      !request.nextauth.token?.permissionCodes?.includes("portalAnnouncement.view")
    ) {
      return NextResponse.redirect(new URL("/portal", request.url));
    }

    if (
      pathname === "/portal" &&
      !request.nextauth.token?.permissionCodes?.includes("dashboard.portal.view")
    ) {
      const fallback = request.nextauth.token?.permissionCodes?.includes("dashboard.admin.view") ? "/dashboard" : "/login";

      return NextResponse.redirect(new URL(fallback, request.url));
    }

    if (
      pathname.startsWith("/portal") &&
      !request.nextauth.token?.permissionCodes?.includes("memberPortal.view")
    ) {
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
    "/solicitacoes-acesso/:path*",
    "/ministerios/:path*",
    "/membros-ministerios/:path*",
    "/escalas/:path*",
    "/minhas-escalas/:path*",
    "/portal/:path*",
    "/eventos/:path*",
    "/comunicados/:path*",
    "/relatorios/:path*",
    "/financeiro/:path*",
    "/contribuicoes/:path*"
  ]
};
