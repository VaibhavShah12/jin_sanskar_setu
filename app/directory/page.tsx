import React from "react";
import { Metadata } from "next";
import { requireAuth, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import SanghDirectoryClient, { DirectoryFamily } from "@/components/SanghDirectoryClient";

export const metadata: Metadata = {
  title: "Printable Sangh Directory | Jin Sanskar Setu",
  description: "Official community directory of Jain Sangh households, printable booklet, and CSV export.",
};

export const dynamic = "force-dynamic";

export default async function SanghDirectoryPage() {
  const user = await requireAuth();
  const sanghFilter = getSanghAccessFilter(user);

  const [familiesData, sanghs] = await Promise.all([
    prisma.family.findMany({
      where: {
        status: "ACTIVE",
        ...sanghFilter,
      },
      include: {
        sangh: {
          select: {
            id: true,
            name: true,
            prefix: true,
          },
        },
        members: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            memberId: true,
            name: true,
            age: true,
            gender: true,
            relationship: true,
            occupation: true,
            whatsappNumber: true,
            husbandName: true,
            maritalStatus: true,
            residenceLocation: true,
            bloodGroup: true,
          },
          orderBy: [{ relationship: "asc" }, { age: "desc" }],
        },
      },
      orderBy: [{ area: "asc" }, { headName: "asc" }],
    }),
    prisma.sangh.findMany({
      where: {
        active: true,
        ...(user.role === "TRUSTEE" && user.sanghId ? { id: user.sanghId } : {}),
      },
      select: {
        id: true,
        name: true,
        prefix: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const families: DirectoryFamily[] = familiesData.map((f) => ({
    id: f.id,
    familyId: f.familyId,
    headName: f.headName,
    mobile: f.mobile || "",
    address: f.address,
    area: f.area,
    nativePlace: f.nativePlace,
    sangh: {
      id: f.sangh.id,
      name: f.sangh.name,
      prefix: f.sangh.prefix,
    },
    members: f.members.map((m) => ({
      id: m.id,
      memberId: m.memberId,
      name: m.name,
      age: m.age,
      gender: m.gender,
      relationship: m.relationship,
      occupation: m.occupation,
      whatsappNumber: m.whatsappNumber,
      husbandName: m.husbandName,
      maritalStatus: m.maritalStatus,
      residenceLocation: m.residenceLocation,
      bloodGroup: m.bloodGroup,
    })),
  }));

  return (
    <SanghDirectoryClient
      initialFamilies={families}
      sanghs={sanghs}
      userRole={user.role}
      userSanghId={user.sanghId}
    />
  );
}
