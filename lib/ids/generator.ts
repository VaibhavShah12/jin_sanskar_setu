import { Prisma } from "@prisma/client";

/**
 * Concurrency-Safe Atomic Family ID Generator
 * Generates sequential IDs formatted as FAM-000001, FAM-000002, etc.
 * Uses an atomic UPDATE with increment within the transaction to guarantee no collisions.
 */
export async function generateFamilyId(
  tx: Prisma.TransactionClient
): Promise<string> {
  const counter = await tx.familyIdCounter.upsert({
    where: { id: "GLOBAL_FAMILY_COUNTER" },
    create: {
      id: "GLOBAL_FAMILY_COUNTER",
      lastNumber: 1,
    },
    update: {
      lastNumber: { increment: 1 },
    },
  });

  const paddedNumber = String(counter.lastNumber).padStart(6, "0");
  return `FAM-${paddedNumber}`;
}

/**
 * Concurrency-Safe Atomic Member ID Batch Generator
 * Generates an array of sequential IDs formatted as {PREFIX}-000001, {PREFIX}-000002, etc.
 * Atomically increments the Sangh counter by `count` in a single transaction step.
 * Returns the array of reserved Member IDs.
 */
export async function generateMemberIds(
  tx: Prisma.TransactionClient,
  sanghId: string,
  prefix: string,
  count: number = 1
): Promise<string[]> {
  if (count <= 0) return [];

  // Atomic row lock & increment in PostgreSQL:
  const updatedCounter = await tx.idCounter.upsert({
    where: { sanghId },
    create: {
      sanghId,
      lastNumber: count,
    },
    update: {
      lastNumber: { increment: count },
    },
  });

  const endNumber = updatedCounter.lastNumber;
  const startNumber = endNumber - count + 1;

  const generatedIds: string[] = [];
  for (let num = startNumber; num <= endNumber; num++) {
    const padded = String(num).padStart(6, "0");
    generatedIds.push(`${prefix.toUpperCase()}-${padded}`);
  }

  return generatedIds;
}
