import { PrismaClient, Role, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SANGHS = [
  { name: "Munisuvrat Swami Jain Sangh", prefix: "MSJS" },
  { name: "Shree Adinath Jain Sangh", prefix: "SAJS" },
  { name: "Shree Sambhavnath Jain Sangh", prefix: "SSJS" },
  { name: "Shree Kunthunath Jain Sangh", prefix: "SKJS" },
  { name: "Eternia Jain Sangh", prefix: "EJS" },
  { name: "NIBM Jain Sangh", prefix: "NJS" },
];

// ---------------------------------------------------------------------------
// Read credentials from env vars (never hard-coded, never logged)
// ---------------------------------------------------------------------------
function getCredential(key: string, fallback: string): string {
  const val = process.env[key]?.trim();
  if (!val) {
    console.warn(`⚠  [SEED] ${key} not set in environment — using default "${fallback}". Change this immediately!`);
    return fallback;
  }
  return val;
}

interface UserSeed {
  username: string;
  password: string;
  name: string;
  role: Role;
}

async function main() {
  console.log("🌸 [SEED] Starting Jin Sanskar Setu database seed...");

  // -------------------------------------------------------------------------
  // 1. Seed the Six Sanghs and their member ID counters
  // -------------------------------------------------------------------------
  for (const s of SANGHS) {
    const sangh = await prisma.sangh.upsert({
      where: { prefix: s.prefix },
      update: { name: s.name, active: true },
      create: { name: s.name, prefix: s.prefix, active: true },
    });

    await prisma.idCounter.upsert({
      where: { sanghId: sangh.id },
      update: {},
      create: { sanghId: sangh.id, lastNumber: 0 },
    });

    console.log(`  ✓ Sangh: ${sangh.name} (${sangh.prefix})`);
  }

  // -------------------------------------------------------------------------
  // 2. Ensure global Family ID counter exists
  // -------------------------------------------------------------------------
  await prisma.familyIdCounter.upsert({
    where: { id: "GLOBAL_FAMILY_COUNTER" },
    update: {},
    create: { id: "GLOBAL_FAMILY_COUNTER", lastNumber: 0 },
  });
  console.log("  ✓ Global Family ID Counter initialized");

  // -------------------------------------------------------------------------
  // 3. Build list of users to seed from environment variables
  // -------------------------------------------------------------------------
  const usersToSeed: UserSeed[] = [
    {
      username: getCredential("ADMIN_USERNAME", "admin"),
      password: getCredential("ADMIN_PASSWORD", "Admin@123456"),
      name: "Sangh Administrator",
      role: Role.ADMIN,
    },
    {
      username: getCredential("VOLUNTEER1_USERNAME", "volunteer1"),
      password: getCredential("VOLUNTEER1_PASSWORD", "Volunteer@1234"),
      name: "Survey Volunteer 1",
      role: Role.VOLUNTEER,
    },
    {
      username: getCredential("VOLUNTEER2_USERNAME", "volunteer2"),
      password: getCredential("VOLUNTEER2_PASSWORD", "Volunteer@1234"),
      name: "Survey Volunteer 2",
      role: Role.VOLUNTEER,
    },
    {
      username: getCredential("VOLUNTEER3_USERNAME", "volunteer3"),
      password: getCredential("VOLUNTEER3_PASSWORD", "Volunteer@1234"),
      name: "Survey Volunteer 3",
      role: Role.VOLUNTEER,
    },
    {
      username: getCredential("VOLUNTEER4_USERNAME", "volunteer4"),
      password: getCredential("VOLUNTEER4_PASSWORD", "Volunteer@1234"),
      name: "Survey Volunteer 4",
      role: Role.VOLUNTEER,
    },
  ];

  // -------------------------------------------------------------------------
  // 4. Upsert all users with hashed passwords
  // -------------------------------------------------------------------------
  for (const u of usersToSeed) {
    const passwordHash = await bcrypt.hash(u.password, 12);

    const existingUser = await prisma.user.findUnique({ where: { username: u.username } });

    if (existingUser) {
      // Update password hash and role, but don't override admin-managed fields
      await prisma.user.update({
        where: { username: u.username },
        data: {
          passwordHash,
          role: u.role,
          status: UserStatus.ACTIVE,
          name: existingUser.name || u.name,
        },
      });
      console.log(`  ✓ Updated user: ${u.username} (${u.role})`);
    } else {
      await prisma.user.create({
        data: {
          username: u.username,
          passwordHash,
          name: u.name,
          role: u.role,
          status: UserStatus.ACTIVE,
          createdBy: "SEED",
        },
      });
      console.log(`  ✓ Created user: ${u.username} (${u.role})`);
    }
  }

  // -------------------------------------------------------------------------
  // 5. Log seed event into AuditLog
  // -------------------------------------------------------------------------
  await prisma.auditLog.create({
    data: {
      action: "DATABASE_SEEDED",
      entityType: "System",
      entityId: "INITIAL_SEED",
      performedBy: "SYSTEM_SEED",
      metadata: {
        sanghsSeeded: SANGHS.map((s) => s.prefix),
        usersSeeded: usersToSeed.map((u) => ({ username: u.username, role: u.role })),
        // NEVER log passwords
      },
    },
  });

  console.log("✨ [SEED] Jin Sanskar Setu database successfully seeded.");
  console.log("📋 [SEED] Accounts created: 1 ADMIN + 4 VOLUNTEERs");
  console.log("🔒 [SEED] Set strong passwords via environment variables before production use.");
}

main()
  .catch((e) => {
    console.error("❌ [SEED ERROR]:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
