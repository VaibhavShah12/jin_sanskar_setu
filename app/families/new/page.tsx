import { requireAuth } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import FamilyForm from "@/components/FamilyForm";
import React from "react";

export const dynamic = "force-dynamic";

export default async function NewFamilyPage() {
  const user = await requireAuth();

  // Load the six active Sanghs
  const sanghs = await prisma.sangh.findMany({
    where: { active: true },
    select: { id: true, name: true, prefix: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="container py-2 py-md-4">
      <div className="mb-4">
        <h1 className="h3 fw-bold text-dark mb-1">New Family Survey Registration</h1>
        <p className="text-muted small mb-0">
          Enter verified Sangh household and Pathshala information. All records are saved directly to PostgreSQL.
        </p>
      </div>

      <FamilyForm
        sanghs={sanghs}
        userSanghId={user.sanghId}
        userUsername={user.username}
      />
    </div>
  );
}
