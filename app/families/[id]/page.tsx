import { requireAuth } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import FamilyDetailClient from "@/components/FamilyDetailClient";
import Link from "next/link";
import { notFound } from "next/navigation";
import React from "react";

export const dynamic = "force-dynamic";

interface FamilyPageProps {
  params: {
    id: string;
  };
}

export default async function FamilyDetailPage({ params }: FamilyPageProps) {
  const user = await requireAuth();

  const family = await prisma.family.findUnique({
    where: { id: params.id },
    include: {
      sangh: true,
      members: {
        orderBy: [{ relationship: "asc" }, { age: "desc" }],
      },
    },
  });

  if (!family) {
    notFound();
  }

  // Check Sangh-specific authorization
  if (
    (user.role === "VOLUNTEER" && user.sanghId && user.sanghId !== family.sanghId) ||
    (user.role === "TRUSTEE" && (!user.sanghId || user.sanghId !== family.sanghId))
  ) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger d-inline-block p-4">
          <i className="bi bi-shield-lock display-4 d-block mb-2"></i>
          <h4 className="fw-bold">Unauthorized Record Access</h4>
          <p className="mb-3">You are only permitted to view records from your assigned Sangh.</p>
          <Link href="/families" className="btn btn-outline-danger">
            Back to Permitted Families
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "ADMIN";
  const canEdit = isAdmin || (user.role === "VOLUNTEER" && (!user.sanghId || user.sanghId === family.sanghId));

  return (
    <div className="container py-2 py-md-4">
      {/* Breadcrumb Navigation */}
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb small">
          <li className="breadcrumb-item">
            <Link href="/dashboard" className="text-decoration-none">Dashboard</Link>
          </li>
          <li className="breadcrumb-item">
            <Link href="/families" className="text-decoration-none">Families</Link>
          </li>
          <li className="breadcrumb-item active font-monospace" aria-current="page">
            {family.familyId}
          </li>
        </ol>
      </nav>

      <FamilyDetailClient
        family={family}
        isAdmin={isAdmin}
        canEdit={canEdit}
      />
    </div>
  );
}
