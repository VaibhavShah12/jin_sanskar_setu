"use server";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth/auth-helpers";
import { logAuditEvent } from "@/lib/audit/logger";
import { Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

export interface CreateUserData {
  username: string;
  password: string;
  name?: string;
  role: Role;
  sanghId?: string | null;
}

export interface UpdateUserData {
  name?: string;
  role?: Role;
  sanghId?: string | null;
}

// --------------------------------------------------------------------------
// CREATE USER
// --------------------------------------------------------------------------
export async function addUserAction(data: CreateUserData) {
  const admin = await requireAdmin();
  const username = data.username.trim().toLowerCase();

  if (!username || username.length < 3) {
    return { success: false, error: "Username must be at least 3 characters." };
  }
  if (!data.password || data.password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
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
        createdBy: admin.id,
      },
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
      },
    });

    return { success: true, user: { ...user, passwordHash: undefined } };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to create user." };
  }
}

// --------------------------------------------------------------------------
// CHANGE PASSWORD
// --------------------------------------------------------------------------
export async function changePasswordAction(userId: string, newPassword: string) {
  const admin = await requireAdmin();

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return { success: false, error: "User not found." };
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await logAuditEvent({
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: userId,
      performedBy: admin.username,
      metadata: { username: target.username },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to change password." };
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
    });

    await logAuditEvent({
      action: newStatus === UserStatus.ACTIVE ? "USER_ENABLED" : "USER_DISABLED",
      entityType: "User",
      entityId: userId,
      performedBy: admin.username,
      metadata: { username: updated.username, status: newStatus },
    });

    return { success: true, user: updated };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update user status." };
  }
}

// --------------------------------------------------------------------------
// UPDATE USER (role, sangh, name)
// --------------------------------------------------------------------------
export async function updateUserRoleAndSanghAction(
  userId: string,
  role: Role,
  sanghId: string | null,
  name?: string
) {
  const admin = await requireAdmin();

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        sanghId: sanghId || null,
        name: name !== undefined ? name.trim() || null : undefined,
      },
    });

    await logAuditEvent({
      action: "USER_UPDATED",
      entityType: "User",
      entityId: userId,
      performedBy: admin.username,
      metadata: { username: updated.username, role, sanghId },
    });

    return { success: true, user: updated };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update user details." };
  }
}
