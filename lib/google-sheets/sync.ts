import { google } from "googleapis";
import { prisma } from "@/lib/db/prisma";
import { logAuditEvent } from "@/lib/audit/logger";

const SHEET_HEADERS = [
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
  "Updated At",
];

/**
 * Returns authenticated Google Sheets client, or null if credentials are not configured
 */
export function getGoogleSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !privateKey || !sheetId) {
    return null;
  }

  // Handle newlines in private key string
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  return { sheets, sheetId };
}

/**
 * Ensures the Google Sheet has the correct header row
 */
async function ensureHeaders(sheets: any, spreadsheetId: string) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Sheet1!A1:T1",
    });

    const rows = res.data.values;
    if (!rows || rows.length === 0 || rows[0].length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Sheet1!A1:T1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [SHEET_HEADERS],
        },
      });
    }
  } catch (err) {
    console.warn("Could not verify/initialize Google Sheet headers:", err);
  }
}

/**
 * Formats a member and their family data into the row schema
 */
function formatMemberRow(member: any): string[] {
  return [
    member.memberId,
    member.family.familyId,
    member.sangh.name,
    member.name,
    String(member.age),
    member.gender,
    member.relationship,
    member.family.headName,
    member.family.mobile,
    member.family.address,
    member.family.area,
    member.pathshalaStatus,
    member.pathshalaInterest,
    member.transportPreference || "",
    member.noInterestReason || "",
    member.preferredDay,
    member.preferredWeekdays || "",
    member.preferredTime,
    new Date(member.createdAt).toISOString(),
    new Date(member.updatedAt).toISOString(),
  ];
}

/**
 * Synchronizes a single member to the synchronized Google Sheet.
 * PostgreSQL is the single source of truth.
 * This operation will NEVER throw an error that bubbles up to abort database transactions.
 */
export async function syncMemberToGoogleSheet(
  memberId: string,
  userEmail: string = "system"
): Promise<{ success: boolean; error?: string }> {
  const clientConfig = getGoogleSheetsClient();

  if (!clientConfig) {
    const msg = "Google Sheets credentials not configured in environment variables";
    await prisma.googleSheetSync.upsert({
      where: { memberId },
      create: {
        memberId,
        status: "FAILED",
        errorMessage: msg,
        lastAttemptAt: new Date(),
        retryCount: 1,
      },
      update: {
        status: "FAILED",
        errorMessage: msg,
        lastAttemptAt: new Date(),
        retryCount: { increment: 1 },
      },
    });
    return { success: false, error: msg };
  }

  const { sheets, sheetId } = clientConfig;

  try {
    const member = await prisma.member.findUnique({
      where: { memberId },
      include: {
        family: true,
        sangh: true,
      },
    });

    if (!member) {
      return { success: false, error: "Member not found in database" };
    }

    await ensureHeaders(sheets, sheetId);

    // Fetch Column A (Member IDs) to determine insert vs update
    const colAResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Sheet1!A:A",
    });

    const colAValues: string[][] = colAResponse.data.values || [];
    let existingRowIndex = -1;

    for (let i = 0; i < colAValues.length; i++) {
      if (colAValues[i] && colAValues[i][0] === memberId) {
        existingRowIndex = i + 1; // 1-indexed sheet row
        break;
      }
    }

    const rowData = formatMemberRow(member);

    if (existingRowIndex > 0) {
      // Update existing row
      const range = `Sheet1!A${existingRowIndex}:Q${existingRowIndex}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowData],
        },
      });

      await prisma.googleSheetSync.upsert({
        where: { memberId },
        create: {
          memberId,
          status: "SYNCED",
          sheetRowReference: range,
          syncedAt: new Date(),
          lastAttemptAt: new Date(),
          errorMessage: null,
        },
        update: {
          status: "SYNCED",
          sheetRowReference: range,
          syncedAt: new Date(),
          lastAttemptAt: new Date(),
          errorMessage: null,
        },
      });
    } else {
      // Append new row
      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A:Q",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [rowData],
        },
      });

      const updatedRange = appendResponse.data.updates?.updatedRange || null;

      await prisma.googleSheetSync.upsert({
        where: { memberId },
        create: {
          memberId,
          status: "SYNCED",
          sheetRowReference: updatedRange,
          syncedAt: new Date(),
          lastAttemptAt: new Date(),
          errorMessage: null,
        },
        update: {
          status: "SYNCED",
          sheetRowReference: updatedRange,
          syncedAt: new Date(),
          lastAttemptAt: new Date(),
          errorMessage: null,
        },
      });
    }

    return { success: true };
  } catch (err: any) {
    const errorMsg = err?.message || "Unknown error during Google Sheets synchronization";
    console.error(`[Google Sheet Sync Error for ${memberId}]:`, errorMsg);

    await prisma.googleSheetSync.upsert({
      where: { memberId },
      create: {
        memberId,
        status: "FAILED",
        errorMessage: errorMsg,
        lastAttemptAt: new Date(),
        retryCount: 1,
      },
      update: {
        status: "FAILED",
        errorMessage: errorMsg,
        lastAttemptAt: new Date(),
        retryCount: { increment: 1 },
      },
    });

    await logAuditEvent({
      action: "GOOGLE_SHEET_SYNC_FAILED",
      entityType: "Sync",
      entityId: memberId,
      performedBy: userEmail,
      metadata: { error: errorMsg },
    });

    return { success: false, error: errorMsg };
  }
}

/**
 * Triggers background synchronization for multiple member IDs asynchronously
 */
export async function triggerBackgroundSync(memberIds: string[], userEmail: string = "system") {
  // Execute sequentially without blocking the caller response
  setTimeout(async () => {
    for (const id of memberIds) {
      await syncMemberToGoogleSheet(id, userEmail);
    }
  }, 100);
}
