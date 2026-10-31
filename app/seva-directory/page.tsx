import { requireAuth, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import SevaDirectoryClient, { SevaMember } from "@/components/SevaDirectoryClient";
import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seva Directory (सेवा निर्देशिका) | Jin Sanskar Setu",
  description:
    "Community Seva Directory for coordinating volunteers by Vihar Seva, Vaiyavach, Management, and Pathshala interests.",
};

export const dynamic = "force-dynamic";

export default async function SevaDirectoryPage() {
  const user = await requireAuth();

  // Scoped Sangh access filter
  const accessFilter = getSanghAccessFilter(user);

  // Fetch all active members who have at least 1 registered interest
  const [rawMembers, sanghs] = await Promise.all([
    prisma.member.findMany({
      where: {
        status: "ACTIVE",
        interests: {
          isEmpty: false,
        },
        ...accessFilter,
      },
      include: {
        family: {
          select: {
            id: true,
            familyId: true,
            headName: true,
            mobile: true,
            area: true,
            address: true,
          },
        },
        sangh: {
          select: {
            id: true,
            name: true,
            prefix: true,
          },
        },
      },
      orderBy: [{ sanghId: "asc" }, { name: "asc" }],
      take: 500,
    }),
    prisma.sangh.findMany({
      where: { active: true },
      select: { id: true, name: true, prefix: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const members: SevaMember[] = rawMembers.map((m) => ({
    id: m.id,
    memberId: m.memberId,
    name: m.name,
    age: m.age,
    gender: m.gender,
    relationship: m.relationship,
    maritalStatus: m.maritalStatus,
    whatsappNumber: m.whatsappNumber,
    interests: m.interests,
    family: m.family,
    sangh: m.sangh,
  }));

  return (
    <main className="min-vh-100 bg-light pb-5">
      <SevaDirectoryClient
        initialMembers={members}
        sanghs={sanghs}
        userRole={user.role}
        userSanghId={user.sanghId}
      />
    </main>
  );
}
