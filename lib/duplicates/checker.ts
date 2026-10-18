import { prisma } from "@/lib/db/prisma";
import { normalizeMobile, normalizeName } from "@/lib/validation/family";

export interface DuplicateCheckResult {
  isExactFamilyDuplicate: boolean;
  existingFamily?: {
    id: string;
    familyId: string;
    headName: string;
    mobile: string;
    sanghName: string;
    area: string;
    createdAt: Date;
  };
  possibleMemberDuplicates: Array<{
    name: string;
    age: number;
    relationship: string;
    warning: string;
  }>;
}

/**
 * Checks for exact family duplicate (normalizedMobile + sanghId)
 * and possible member duplicates within that family if editing or existing.
 */
export async function checkFamilyDuplicates(params: {
  mobile: string;
  sanghId: string;
  excludeFamilyId?: string;
  members?: Array<{ name: string; age: number; relationship: string }>;
}): Promise<DuplicateCheckResult> {
  const normalizedMobile = normalizeMobile(params.mobile);

  // Exact duplicate check: Same normalized mobile + same Sangh (active families)
  const existingFamily = await prisma.family.findFirst({
    where: {
      normalizedMobile,
      sanghId: params.sanghId,
      status: "ACTIVE",
      ...(params.excludeFamilyId ? { id: { not: params.excludeFamilyId } } : {}),
    },
    include: {
      sangh: true,
      members: {
        where: { status: "ACTIVE" },
      },
    },
  });

  const memberWarnings: Array<{
    name: string;
    age: number;
    relationship: string;
    warning: string;
  }> = [];

  // If there are members provided, check for potential internal duplicate submissions
  // e.g. two members with same name, age, and relationship in the same submission
  if (params.members && params.members.length > 1) {
    const seen = new Set<string>();
    for (const m of params.members) {
      const key = `${normalizeName(m.name)}|${m.age}|${m.relationship}`;
      if (seen.has(key)) {
        memberWarnings.push({
          name: m.name,
          age: m.age,
          relationship: m.relationship,
          warning: `Duplicate member entry '${m.name}' (${m.relationship}, age ${m.age}) within this submission.`,
        });
      }
      seen.add(key);
    }
  }

  // If existing family was found, also check if any submitted members match members already in that family
  if (existingFamily && params.members) {
    for (const m of params.members) {
      const norm = normalizeName(m.name);
      const match = existingFamily.members.find(
        (em) => em.normalizedName === norm && em.age === m.age && em.relationship === m.relationship
      );
      if (match) {
        memberWarnings.push({
          name: m.name,
          age: m.age,
          relationship: m.relationship,
          warning: `Member '${m.name}' (${m.relationship}, age ${m.age}) already exists in family ${existingFamily.familyId}.`,
        });
      }
    }
  }

  return {
    isExactFamilyDuplicate: !!existingFamily,
    existingFamily: existingFamily
      ? {
          id: existingFamily.id,
          familyId: existingFamily.familyId,
          headName: existingFamily.headName,
          mobile: existingFamily.mobile,
          sanghName: existingFamily.sangh.name,
          area: existingFamily.area,
          createdAt: existingFamily.createdAt,
        }
      : undefined,
    possibleMemberDuplicates: memberWarnings,
  };
}
