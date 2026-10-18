import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, getSanghAccessFilter } from "@/lib/auth/auth-helpers";
import { logAuditEvent } from "@/lib/audit/logger";

export const dynamic = "force-dynamic";

function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '""';
  const stringVal = String(val).replace(/"/g, '""');
  return `"${stringVal}"`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type") || "members"; // "members", "families", or "pathshala_potential"
    const sanghId = searchParams.get("sanghId") || undefined;
    const pathshalaStatus = searchParams.get("pathshalaStatus") || undefined;
    const area = searchParams.get("area") || undefined;

    // Apply server-side Sangh authorization filter
    const sanghFilter = getSanghAccessFilter(user, sanghId);

    let csvContent = "";
    let exportCount = 0;

    if (type === "families") {
      const families = await prisma.family.findMany({
        where: {
          status: "ACTIVE",
          ...sanghFilter,
          ...(area ? { area: { contains: area, mode: "insensitive" } } : {}),
        },
        include: {
          sangh: true,
          members: { where: { status: "ACTIVE" } },
        },
        orderBy: { createdAt: "desc" },
      });

      exportCount = families.length;
      const headers = [
        "Family ID",
        "Head of Family",
        "Mobile",
        "Sangh",
        "Area",
        "Address",
        "Total Members",
        "Created At",
        "Created By",
      ];

      const rows = families.map((f) => [
        escapeCsvValue(f.familyId),
        escapeCsvValue(f.headName),
        escapeCsvValue(f.mobile),
        escapeCsvValue(f.sangh.name),
        escapeCsvValue(f.area),
        escapeCsvValue(f.address),
        escapeCsvValue(f.members.length),
        escapeCsvValue(f.createdAt.toISOString()),
        escapeCsvValue(f.createdBy || ""),
      ]);

      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    } else {
      // Default: members export or pathshala potential
      const isPathshalaPotential = type === "pathshala_potential";

      const whereClause: any = {
        status: "ACTIVE",
        ...sanghFilter,
        ...(area ? { family: { area: { contains: area, mode: "insensitive" } } } : {}),
      };

      if (isPathshalaPotential) {
        whereClause.age = { lt: 18 };
        whereClause.pathshalaStatus = "NO";
      } else if (pathshalaStatus) {
        whereClause.pathshalaStatus = pathshalaStatus;
      }

      const members = await prisma.member.findMany({
        where: whereClause,
        include: {
          family: true,
          sangh: true,
        },
        orderBy: [{ sanghId: "asc" }, { memberId: "asc" }],
      });

      exportCount = members.length;
      const headers = [
        "Member ID",
        "Family ID",
        "Sangh",
        "Name",
        "Age",
        "Gender",
        "Relationship",
        "Head of Family",
        "Mobile",
        "Address",
        "Area",
        "Pathshala Status",
        "Pathshala Interest",
        "Transport Preference",
        "No Interest Reason",
        "Preferred Day",
        "Preferred Weekdays",
        "Preferred Time",
        "Created At",
        "Created By",
      ];

      const rows = members.map((m) => [
        escapeCsvValue(m.memberId),
        escapeCsvValue(m.family.familyId),
        escapeCsvValue(m.sangh.name),
        escapeCsvValue(m.name),
        escapeCsvValue(m.age),
        escapeCsvValue(m.gender),
        escapeCsvValue(m.relationship),
        escapeCsvValue(m.family.headName),
        escapeCsvValue(m.family.mobile),
        escapeCsvValue(m.family.address),
        escapeCsvValue(m.family.area),
        escapeCsvValue(m.pathshalaStatus),
        escapeCsvValue(m.pathshalaInterest),
        escapeCsvValue(m.transportPreference || ""),
        escapeCsvValue(m.noInterestReason || ""),
        escapeCsvValue(m.preferredDay),
        escapeCsvValue(m.preferredWeekdays || ""),
        escapeCsvValue(m.preferredTime),
        escapeCsvValue(m.createdAt.toISOString()),
        escapeCsvValue(m.createdBy || ""),
      ]);

      csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    }

    // Log CSV export event in audit_logs
    await logAuditEvent({
      action: "CSV_EXPORTED",
      entityType: "Export",
      entityId: `${type}_${Date.now()}`,
      performedBy: user.username,
      metadata: {
        exportType: type,
        recordsExported: exportCount,
        filters: { sanghId, pathshalaStatus, area },
      },
    });

    const filename = `jin_sanskar_setu_${type}_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("CSV Export error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate CSV export" },
      { status: 500 }
    );
  }
}
