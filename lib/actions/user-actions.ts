"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth/auth-helpers";
import { logAuditEvent } from "@/lib/audit/logger";
import { Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface CreateUserData {
  username: string;
  password: string;
  name?: string;
  role: Role;
  sanghId?: string | null;
  canExport?: boolean;
  mustChangePassword?: boolean;
}

export interface UpdateUserData {
  name?: string;
  role?: Role;
  sanghId?: string | null;
  canExport?: boolean;
}

import { validatePasswordStrength } from "@/lib/validation/password";

export interface ChangeOwnPasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Re-export as async Server Action if needed externally
export async function validatePasswordStrengthAction(password: string) {
  return validatePasswordStrength(password);
}

// --------------------------------------------------------------------------
// SELF-SERVICE CHANGE OWN PASSWORD (ADMIN, TRUSTEE, VOLUNTEER)
// Strictly operates on the authenticated user's session ID (IDOR-safe)
// --------------------------------------------------------------------------
export async function changeOwnPasswordAction(input: ChangeOwnPasswordInput) {
  const user = await requireAuth();

  const { currentPassword, newPassword, confirmPassword } = input;

  if (!currentPassword) {
    return { success: false, error: "Current password is required." };
  }

  if (!newPassword || !confirmPassword) {
    return { success: false, error: "New password and confirmation are required." };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "New password and confirmation password do not match." };
  }

  const strengthCheck = validatePasswordStrength(newPassword);
  if (!strengthCheck.valid) {
    return { success: false, error: strengthCheck.error };
  }

  // Fetch db user record
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser || dbUser.status !== "ACTIVE") {
    return { success: false, error: "Account not found or disabled." };
  }

  // Verify current password against stored hash
  const matches = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!matches) {
    return { success: false, error: "Current password is incorrect." };
  }

  // Hash new password using bcrypt
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false, // Clears temporary password requirement
    },
  });

  // Log audit event (never log plaintext passwords)
  await logAuditEvent({
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
    performedBy: user.username,
    metadata: {
      username: user.username,
      role: user.role,
    },
  });

  return { success: true, message: "Your password has been updated successfully." };
}

// --------------------------------------------------------------------------
// CREATE USER (ADMIN ONLY)
// --------------------------------------------------------------------------
export async function addUserAction(data: CreateUserData) {
  const admin = await requireAdmin();
  const username = data.username.trim().toLowerCase();

  if (!username || username.length < 3) {
    return { success: false, error: "Username must be at least 3 characters." };
  }

  const strength = validatePasswordStrength(data.password);
  if (!strength.valid) {
    return { success: false, error: strength.error };
  }

  // A Trustee MUST be assigned to exactly one Sangh
  if (data.role === Role.TRUSTEE && (!data.sanghId || data.sanghId.trim() === "")) {
    return { success: false, error: "A Trustee must be assigned to exactly one Sangh." };
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return { success: false, error: "A user with this username already exists." };
  }

  try {
    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        name: data.name?.trim() || null,
        role: data.role,
        status: UserStatus.ACTIVE,
        sanghId: data.sanghId || null,
        canExport: data.canExport ?? false,
        mustChangePassword: data.mustChangePassword ?? false,
        createdBy: admin.id,
      },
      include: { sangh: true },
    });

    await logAuditEvent({
      action: "USER_ADDED",
      entityType: "User",
      entityId: user.id,
      performedBy: admin.username,
      metadata: {
        username: user.username,
        role: user.role,
        status: user.status,
        sanghId: user.sanghId,
        canExport: user.canExport,
      },
    });

    // Never expose passwordHash in returned object
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        sanghId: user.sanghId,
        sangh: user.sangh,
        canExport: user.canExport,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create user." };
  }
}

// --------------------------------------------------------------------------
// ADMIN RESET PASSWORD WITH TEMPORARY PASSWORD
// (Passwords are never visible to admin; admin only generates a temporary password)
// --------------------------------------------------------------------------
export async function adminResetUserPasswordAction(userId: string, customTempPassword?: string) {
  const admin = await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return { success: false, error: "User not found." };
  }

  // Generate a secure temporary password if none supplied
  let tempPassword = customTempPassword?.trim();
  if (!tempPassword) {
    // Generate e.g. "Jss#72kM!9"
    const randomChars = crypto.randomBytes(3).toString("hex").toUpperCase();
    tempPassword = `Jin#${randomChars}9!`;
  }

  const strengthCheck = validatePasswordStrength(tempPassword);
  if (!strengthCheck.valid) {
    return { success: false, error: strengthCheck.error };
  }

  try {
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true, // Forces password change on next login
      },
    });

    await logAuditEvent({
      action: "ADMIN_PASSWORD_RESET",
      entityType: "User",
      entityId: userId,
      performedBy: admin.username,
      metadata: {
        username: target.username,
        mustChangePassword: true,
      },
    });

    return {
      success: true,
      username: target.username,
      temporaryPassword: tempPassword,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to reset password." };
  }
}

// --------------------------------------------------------------------------
// TOGGLE USER STATUS (ACTIVE ↔ DISABLED)
// --------------------------------------------------------------------------
export async function updateUserStatusAction(userId: string, newStatus: UserStatus) {
  const admin = await requireAdmin();

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return { success: false, error: "User not found." };
  }

  if (targetUser.username === admin.username && newStatus === UserStatus.DISABLED) {
    return { success: false, error: "You cannot disable your own administrator account." };
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: newStatus },
      include: { sangh: true },
    });

    await logAuditEvent({
      action: newStatus === UserStatus.ACTIVE ? "USER_ENABLED" : "USER_DISABLED",
      entityType: "User",
      entityId: userId,
      performedBy: admin.username,
      metadata: { username: updated.username, status: newStatus },
    });

    return {
      success: true,
      user: {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        role: updated.role,
        status: updated.status,
        sanghId: updated.sanghId,
        sangh: updated.sangh,
        canExport: updated.canExport,
        mustChangePassword: updated.mustChangePassword,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update user status." };
  }
}

// --------------------------------------------------------------------------
// UPDATE USER (role, sangh, name, canExport)
// --------------------------------------------------------------------------
export async function updateUserRoleAndSanghAction(
  userId: string,
  role: Role,
  sanghId: string | null,
  name?: string,
  canExport?: boolean
) {
  const admin = await requireAdmin();

  if (role === Role.TRUSTEE && (!sanghId || sanghId.trim() === "")) {
    return { success: false, error: "A Trustee must be assigned to exactly one Sangh." };
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        sanghId: sanghId || null,
        name: name !== undefined ? name.trim() || null : undefined,
        canExport: canExport !== undefined ? canExport : undefined,
      },
      include: { sangh: true },
    });

    await logAuditEvent({
      action: "USER_UPDATED",
      entityType: "User",
      entityId: userId,
      performedBy: admin.username,
      metadata: { username: updated.username, role, sanghId, canExport: updated.canExport },
    });

    return {
      success: true,
      user: {
        id: updated.id,
        username: updated.username,
        name: updated.name,
        role: updated.role,
        status: updated.status,
        sanghId: updated.sanghId,
        sangh: updated.sangh,
        canExport: updated.canExport,
        mustChangePassword: updated.mustChangePassword,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update user details." };
  }
}
