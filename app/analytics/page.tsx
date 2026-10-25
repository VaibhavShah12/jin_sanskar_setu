import { requireAuth, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { prisma } from "@/lib/db/prisma";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import Link from "next/link";
import React from "react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await requireAuth();
  const sanghFilter = getSanghAccessFilter(user);

  // Fetch active Sanghs (Trustees are restricted to their assigned Sangh)
  const sanghs = await prisma.sangh.findMany({
    where: user.role === "TRUSTEE" && user.sanghId ? { id: user.sanghId, active: true } : { active: true },
    orderBy: { name: "asc" },
  });

  // 1 & 2. Members and Families by Sangh
  const [membersGroup, familiesGroup, childrenGroup] = await Promise.all([
    prisma.member.groupBy({
      by: ["sanghId"],
      where: { status: "ACTIVE", ...sanghFilter },
      _count: { id: true },
    }),
    prisma.family.groupBy({
      by: ["sanghId"],
      where: { status: "ACTIVE", ...sanghFilter },
      _count: { id: true },
    }),
    prisma.member.groupBy({
      by: ["sanghId"],
      where: { status: "ACTIVE", age: { lt: 18 }, ...sanghFilter },
      _count: { id: true },
    }),
  ]);

  const membersBySangh = sanghs.map((s) => ({
    name: s.name,
    prefix: s.prefix,
    count: membersGroup.find((g) => g.sanghId === s.id)?._count.id || 0,
    sanghId: s.id,
  }));

  const familiesBySangh = sanghs.map((s) => ({
    name: s.name,
    prefix: s.prefix,
    count: familiesGroup.find((g) => g.sanghId === s.id)?._count.id || 0,
    sanghId: s.id,
  }));

  const childrenBySangh = sanghs.map((s) => ({
    name: s.name,
    prefix: s.prefix,
    count: childrenGroup.find((g) => g.sanghId === s.id)?._count.id || 0,
    sanghId: s.id,
  }));

  // 3. Members by Age Group (0-5, 6-10, 11-15, 16-18, 19-25, 26-40, 41-60, 61+)
  const ageBuckets = [
    { group: "0–5", min: 0, max: 5 },
    { group: "6–10", min: 6, max: 10 },
    { group: "11–15", min: 11, max: 15 },
    { group: "16–18", min: 16, max: 18 },
    { group: "19–25", min: 19, max: 25 },
    { group: "26–40", min: 26, max: 40 },
    { group: "41–60", min: 41, max: 60 },
    { group: "61+", min: 61, max: 120 },
  ];

  const membersByAgeGroup = await Promise.all(
    ageBuckets.map(async (b) => {
      const count = await prisma.member.count({
        where: {
          status: "ACTIVE",
          age: { gte: b.min, lte: b.max },
          ...sanghFilter,
        },
      });
      return { group: b.group, count, min: b.min, max: b.max };
    })
  );

  // 4. Children by Pathshala Status (<18)
  const pathshalaStatusGroup = await prisma.member.groupBy({
    by: ["pathshalaStatus"],
    where: { status: "ACTIVE", age: { lt: 18 }, ...sanghFilter },
    _count: { id: true },
  });

  const childrenByPathshalaStatus = [
    {
      name: "Attending",
      status: "YES",
      count: pathshalaStatusGroup.find((g) => g.pathshalaStatus === "YES")?._count.id || 0,
    },
    {
      name: "Not Attending",
      status: "NO",
      count: pathshalaStatusGroup.find((g) => g.pathshalaStatus === "NO")?._count.id || 0,
    },
    {
      name: "Previously",
      status: "PREVIOUSLY_ATTENDED",
      count: pathshalaStatusGroup.find((g) => g.pathshalaStatus === "PREVIOUSLY_ATTENDED")?._count.id || 0,
    },
    {
      name: "Unknown",
      status: "UNKNOWN",
      count: pathshalaStatusGroup.find((g) => g.pathshalaStatus === "UNKNOWN")?._count.id || 0,
    },
  ];



  // 6. Top 5 Areas by Members
  const areaGroup = await prisma.family.groupBy({
    by: ["area"],
    where: { status: "ACTIVE", ...sanghFilter },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 6,
  });

  const membersByArea = areaGroup.map((a) => ({
    area: a.area,
    count: a._count.id,
  }));

  // 7. Registrations Over Time (last 14 days)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const recentFamilies = await prisma.family.findMany({
    where: {
      status: "ACTIVE",
      createdAt: { gte: fourteenDaysAgo },
      ...sanghFilter,
    },
    select: { createdAt: true },
  });

  const dateMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    dateMap.set(dateStr, 0);
  }

  for (const f of recentFamilies) {
    const dateStr = f.createdAt.toISOString().split("T")[0];
    if (dateMap.has(dateStr)) {
      dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
    }
  }

  const registrationsOverTime = Array.from(dateMap.entries()).map(([date, families]) => ({
    date: date.substring(5), // MM-DD
    families,
  }));

  const analyticsData = {
    membersBySangh,
    familiesBySangh,
    membersByAgeGroup,
    childrenByPathshalaStatus,
    membersByArea,
    registrationsOverTime,
    childrenBySangh,
  };

  return (
    <div className="container py-2 py-md-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">Community Survey Analytics</h1>
          <p className="text-muted small mb-0">
            Real-time demographic, geographic, and educational metrics from PostgreSQL
          </p>
        </div>
        <Link href="/search" className="btn btn-outline-secondary btn-sm px-3">
          <i className="bi bi-search me-1"></i> Open Query Explorer
        </Link>
      </div>

      <AnalyticsCharts data={analyticsData} />
    </div>
  );
}
