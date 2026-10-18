import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export type AuditAction =
  | "FAMILY_CREATED"
  | "FAMILY_UPDATED"
  | "FAMILY_ARCHIVED"
  | "MEMBER_CREATED"
  | "MEMBER_UPDATED"
  | "MEMBER_ARCHIVED"
  | "USER_ADDED"
  | "USER_UPDATED"
  | "USER_ENABLED"
  | "USER_DISABLED"
  | "CSV_EXPORTED"
  | "GOOGLE_SHEET_SYNC_TRIGGERED"
  | "GOOGLE_SHEET_SYNC_FAILED"
  | "GOOGLE_SHEET_SYNC_RETRIED"
  | "DATABASE_SEEDED";

export interface LogAuditParams {
  action: AuditAction | string;
  entityType: "Family" | "Member" | "User" | "Sync" | "Export" | "System";
  entityId: string;
  performedBy: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Creates an immutable audit log record.
 * Can be executed inside an existing Prisma transaction or with the standard client.
 */
export async function logAuditEvent(
  params: LogAuditParams,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  try {
    return await client.auditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        performedBy: params.performedBy,
        metadata: params.metadata ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
    // Do not throw so primary transaction/action is not blocked by non-critical logging failure
    return null;
  }
}
