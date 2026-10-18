import { requireAdmin } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import AdminUserManagementClient from "@/components/AdminUserManagementClient";
import React from "react";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();

  const [users, sanghs] = await Promise.all([
    prisma.user.findMany({
      include: { sangh: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sangh.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Strip passwordHash before sending to client
  const safeUsers = users.map(({ passwordHash: _ph, ...u }) => u);

  return (
    <div className="container py-2 py-md-4">
      <div className="mb-4">
        <h1 className="h3 fw-bold text-dark mb-1">User &amp; Volunteer Management</h1>
        <p className="text-muted small mb-0">
          Manage login accounts. Only users with ACTIVE status can access Jin Sanskar Setu.
        </p>
      </div>

      <AdminUserManagementClient
        initialUsers={safeUsers}
        sanghs={sanghs}
        adminId={admin.id}
      />
    </div>
  );
}
