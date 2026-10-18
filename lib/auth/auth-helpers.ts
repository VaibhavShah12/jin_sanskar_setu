import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

export interface AuthenticatedUser {
  id: string;
  username: string;
  name: string | null;
  role: "ADMIN" | "VOLUNTEER";
  status: "ACTIVE" | "DISABLED";
  sanghId: string | null;
  sanghName?: string | null;
  sanghPrefix?: string | null;
}

/**
 * Gets the current verified user directly validated against PostgreSQL.
 * If user was disabled after login, access is immediately revoked.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return null;
  }

  const username = (session.user as any).username as string;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { sangh: true },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      status: user.status,
      sanghId: user.sanghId,
      sanghName: user.sangh?.name,
      sanghPrefix: user.sangh?.prefix,
    };
  } catch (error) {
    console.error("[AUTH] getCurrentUser DB error:", error);
    return null;
  }
}

/**
 * Requires an authenticated, active user. Redirects to /login if not permitted.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Requires an authenticated ADMIN user. Redirects to /dashboard if unauthorized.
 */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    redirect("/dashboard?error=unauthorized_admin");
  }
  return user;
}

/**
 * Helper to build server-side Sangh authorization filter.
 * If volunteer is restricted to a specific Sangh, forces that Sangh ID.
 * If admin, allows querying any or all Sanghs.
 */
export function getSanghAccessFilter(user: AuthenticatedUser, requestedSanghId?: string) {
  if (user.role === "VOLUNTEER" && user.sanghId) {
    return { sanghId: user.sanghId };
  }
  if (requestedSanghId && requestedSanghId !== "ALL") {
    return { sanghId: requestedSanghId };
  }
  return {};
}
