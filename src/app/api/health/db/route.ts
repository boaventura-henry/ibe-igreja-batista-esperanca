import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      status: "ok",
      database: "connected"
    });
  } catch {
    return Response.json(
      {
        status: "error",
        database: "unavailable"
      },
      { status: 500 }
    );
  }
}
