import React from "react";
import { requireAuth } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import { getTrusteeBirthdayDashboardDataAction } from "@/lib/actions/birthday-actions";
import TrusteeBirthdaysClient from "@/components/TrusteeBirthdaysClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: {
    sanghId?: string;
  };
}

export default async function BirthdaysPage({ searchParams }: Props) {
  const user = await requireAuth();

  // If trustee has no sanghId assigned, deny access
  if (user.role === "TRUSTEE" && !user.sanghId) {
    redirect("/login?error=TRUSTEE_NO_SANGH");
  }

  // Strict server-side Sangh target determination
  let targetSanghId = user.sanghId || searchParams.sanghId;

  // If Admin and no sanghId requested, default to first active Sangh
  if (user.role === "ADMIN" && !targetSanghId) {
    const firstSangh = await prisma.sangh.findFirst({
      where: { active: true },
      orderBy: { prefix: "asc" },
    });
    targetSanghId = firstSangh?.id;
  }

  if (!targetSanghId) {
    redirect("/dashboard");
  }

  const result = await getTrusteeBirthdayDashboardDataAction(targetSanghId);

  if (!result.success || !result.data) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger max-w-md mx-auto" role="alert">
          <h5 className="alert-heading fw-bold">Unable to Load Birthday Data</h5>
          <p className="mb-0">{result.error || "An unexpected error occurred."}</p>
        </div>
      </div>
    );
  }

  // If user is Admin, fetch all Sanghs so they can toggle between Sanghs
  let allSanghs: { id: string; name: string; prefix: string }[] | undefined;
  if (user.role === "ADMIN") {
    allSanghs = await prisma.sangh.findMany({
      where: { active: true },
      select: { id: true, name: true, prefix: true },
      orderBy: { prefix: "asc" },
    });
  }

  return (
    <TrusteeBirthdaysClient
      initialData={result.data}
      userRole={user.role}
      allSanghs={allSanghs}
      currentSanghId={targetSanghId}
    />
  );
}
