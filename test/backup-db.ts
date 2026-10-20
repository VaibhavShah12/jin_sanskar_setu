import { prisma } from "../lib/db/prisma";
import * as fs from "fs";
import * as path from "path";

async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Connection attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Failed after retries");
}

async function backupDb() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(__dirname, "..", "backups", `backup-${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`[BACKUP] Starting backup into: ${backupDir}`);

  console.log("Fetching users...");
  const users = await fetchWithRetry(() => prisma.user.findMany());
  console.log("Fetching sanghs...");
  const sanghs = await fetchWithRetry(() => prisma.sangh.findMany());
  console.log("Fetching families...");
  const families = await fetchWithRetry(() => prisma.family.findMany());
  console.log("Fetching members...");
  const members = await fetchWithRetry(() => prisma.member.findMany());
  console.log("Fetching idCounters...");
  const idCounters = await fetchWithRetry(() => prisma.idCounter.findMany());
  console.log("Fetching familyIdCounters...");
  const familyIdCounters = await fetchWithRetry(() => prisma.familyIdCounter.findMany());
  console.log("Fetching auditLogs...");
  const auditLogs = await fetchWithRetry(() => prisma.auditLog.findMany());
  console.log("Fetching googleSheetSyncs...");
  const googleSheetSyncs = await fetchWithRetry(() => prisma.googleSheetSync.findMany());

  fs.writeFileSync(path.join(backupDir, "users.json"), JSON.stringify(users, null, 2));
  fs.writeFileSync(path.join(backupDir, "sanghs.json"), JSON.stringify(sanghs, null, 2));
  fs.writeFileSync(path.join(backupDir, "families.json"), JSON.stringify(families, null, 2));
  fs.writeFileSync(path.join(backupDir, "members.json"), JSON.stringify(members, null, 2));
  fs.writeFileSync(path.join(backupDir, "id_counters.json"), JSON.stringify(idCounters, null, 2));
  fs.writeFileSync(path.join(backupDir, "family_id_counters.json"), JSON.stringify(familyIdCounters, null, 2));
  fs.writeFileSync(path.join(backupDir, "audit_logs.json"), JSON.stringify(auditLogs, null, 2));
  fs.writeFileSync(path.join(backupDir, "google_sheet_syncs.json"), JSON.stringify(googleSheetSyncs, null, 2));

  console.log(`[BACKUP] Successfully backed up:
  - ${users.length} users
  - ${sanghs.length} sanghs
  - ${families.length} families
  - ${members.length} members
  - ${idCounters.length} idCounters
  - ${familyIdCounters.length} familyIdCounters
  - ${auditLogs.length} auditLogs
  - ${googleSheetSyncs.length} googleSheetSyncs`);
}

backupDb()
  .catch((e) => {
    console.error("[BACKUP ERROR]:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
