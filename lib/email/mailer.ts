import nodemailer from "nodemailer";

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export interface FamilyMemberInfo {
  name: string;
  relationship: string;
  memberId: string;
}

/**
 * Returns the base URL of the running application for deep links in emails.
 */
export function getAppBaseUrl(): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/+$/, "");
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }
  return "http://localhost:3000";
}

/**
 * Creates or retrieves the nodemailer transporter.
 * If SMTP credentials are missing in .env, returns null to signal simulated mode.
 */
function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Low-level email sender. Gracefully falls back to simulated logging if SMTP is not configured.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const fromAddress =
    process.env.SMTP_FROM || `"Jin Sanskar Setu" <no-reply@jinsanskarsetu.org>`;
  const transporter = getTransporter();

  // If no SMTP credentials provided, log simulated email for development/testing
  if (!transporter) {
    console.log("================================================================================");
    console.log("[EMAIL SIMULATION - SMTP Credentials Not Set in .env]");
    console.log(`To: ${Array.isArray(to) ? to.join(", ") : to}`);
    console.log(`Subject: ${subject}`);
    console.log(`From: ${fromAddress}`);
    console.log("--------------------------------------------------------------------------------");
    console.log(text || "HTML Content provided (rendered in browser)");
    console.log("================================================================================");

    return {
      success: true,
      simulated: true,
      messageId: `simulated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: text || "Please open this email in an HTML-compatible email reader.",
      html,
    });

    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
    };
  } catch (error: any) {
    console.error("[EMAIL_DISPATCH_ERROR]:", error);
    return {
      success: false,
      error: error?.message || "Failed to send email via SMTP.",
    };
  }
}

/**
 * 1. REGISTRATION EMAIL CONFIRMATION
 * Dispatched automatically to headEmail upon successful family survey registration.
 * Eliminates need for QR scan: provides Family ID, Member IDs, and direct access link.
 */
export async function sendFamilyRegistrationEmail({
  to,
  headName,
  familyId,
  memberIds,
  sanghName,
  membersList,
}: {
  to: string;
  headName: string;
  familyId: string;
  memberIds: string[];
  sanghName: string;
  membersList?: { name: string; relationship: string; memberId: string }[];
}): Promise<SendEmailResult> {
  const baseUrl = getAppBaseUrl();
  const directLink = `${baseUrl}/member-portal?familyId=${encodeURIComponent(familyId)}`;
  const familyViewLink = `${baseUrl}/families/${encodeURIComponent(familyId)}`;

  const subject = `जय जिनेन्द्र - Jin Sanskar Setu Family Registration Confirmed [${familyId}]`;

  // Render members rows
  let membersHtml = "";
  if (membersList && membersList.length > 0) {
    membersHtml = membersList
      .map(
        (m, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">#${idx + 1} ${m.name}</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px;">${m.relationship}</td>
          <td style="padding: 10px 12px; text-align: right;">
            <span style="font-family: monospace; font-size: 13px; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; border: 1px solid #bae6fd;">
              ${m.memberId}
            </span>
          </td>
        </tr>
      `
      )
      .join("");
  } else {
    membersHtml = memberIds
      .map(
        (mid, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 12px; font-weight: 600; color: #1e293b;">Member #${idx + 1}</td>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px;">—</td>
          <td style="padding: 10px 12px; text-align: right;">
            <span style="font-family: monospace; font-size: 13px; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; border: 1px solid #bae6fd;">
              ${mid}
            </span>
          </td>
        </tr>
      `
      )
      .join("");
  }

  const html = `
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Family Registration Confirmation</title>
    </head>
    <body style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0d5c3a 0%, #198754 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
            <div style="font-size: 32px; margin-bottom: 8px;">☸️</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">जिन संस्कार सेतु</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #e2e8f0; font-weight: 500;">Jin Sanskar Setu • Jain Sangh Digital Platform</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 32px 28px;">
            <p style="font-size: 16px; margin: 0 0 16px 0; font-weight: 600; color: #166534;">
              सादर जय जिनेन्द्र, ${headName} जी 🙏
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
              आपके परिवार का पंजीकरण <strong>${sanghName}</strong> के डिजिटल रजिस्टर में सफलतापूर्वक पूर्ण हो गया है। आपका रिकॉर्ड सुरक्षित रूप से दर्ज कर दिया गया है।
            </p>

            <!-- Family ID Banner -->
            <div style="background-color: #f0fdf4; border: 2px dashed #86efac; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">
                आपका स्थायी Family ID
              </span>
              <span style="font-size: 28px; font-weight: 800; font-family: monospace; color: #15803d; letter-spacing: 1px;">
                ${familyId}
              </span>
            </div>

            <!-- Direct Portal Access Highlight -->
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
              <div style="display: flex; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 16px; margin-right: 8px;">🔗</span>
                <strong style="color: #1e40af; font-size: 14px;">सीधा पोर्टल लिंक (No QR Scanner Required)</strong>
              </div>
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #1e3a8a; line-height: 1.5;">
                आपको किसी QR कोड को स्कैन करने की आवश्यकता नहीं है। आप नीचे दिए गए डायरेक्ट लिंक पर क्लिक करके सीधे अपना परिवार विवरण और सदस्य कार्ड देख सकते हैं:
              </p>
              <div style="text-align: center; margin-top: 14px;">
                <a href="${directLink}" style="background-color: #0d5c3a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  👉 अपना परिवार पोर्टल खोलें (Open Family Portal)
                </a>
              </div>
            </div>

            <!-- Member IDs Table -->
            <h3 style="font-size: 15px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
              पंजीकृत सदस्य एवं संघ सदस्य संख्या (Member IDs)
            </h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; margin-bottom: 24px; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #475569; text-align: left; font-size: 12px; text-transform: uppercase;">
                  <th style="padding: 8px 12px;">सदस्य का नाम</th>
                  <th style="padding: 8px 12px;">सम्बन्ध</th>
                  <th style="padding: 8px 12px; text-align: right;">सदस्य संख्या (Member ID)</th>
                </tr>
              </thead>
              <tbody>
                ${membersHtml}
              </tbody>
            </table>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
              * भविष्य में संघ लवाजम भुगतान, पाठशाला नामांकन या संपर्क के लिए कृपया इस Family ID को संभाल कर रखें।
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">${sanghName} • जिन संस्कार सेतु</p>
            <p style="margin: 0;">यह एक स्वचालित संदेश है। कृपया इस ईमेल का सीधा उत्तर न दें।</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
जय जिनेन्द्र ${headName} जी 🙏

आपके परिवार का पंजीकरण ${sanghName} में सफलतापूर्वक संपन्न हो गया है।
Family ID: ${familyId}

सीधा पोर्टल लिंक (No QR needed):
${directLink}

पंजीकृत सदस्य संख्या (Member IDs):
${memberIds.join(", ")}

जिन संस्कार सेतु
  `.trim();

  return sendEmail({ to, subject, html, text });
}

/**
 * 2. LAVAAJAM PAYMENT EMAIL RECEIPT
 * Automatically dispatched to family's registered email when Lavaajam is paid.
 */
export async function sendLavaajamReceiptEmail({
  to,
  headName,
  familyId,
  sanghName,
  receiptNumber,
  amount,
  year,
  paymentDate,
  paymentMode,
  receiverName,
  notes,
}: {
  to: string;
  headName: string;
  familyId: string;
  sanghName: string;
  receiptNumber: string;
  amount: number;
  year: string;
  paymentDate?: string | null;
  paymentMode?: string | null;
  receiverName?: string | null;
  notes?: string | null;
}): Promise<SendEmailResult> {
  const formattedDate = paymentDate
    ? new Date(paymentDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

  const subject = `लवाजम रसीद [${receiptNumber}] - श्री ${sanghName} (${year})`;

  const html = `
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="utf-8">
      <title>Lavaajam Payment Receipt</title>
    </head>
    <body style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
            <div style="font-size: 28px; margin-bottom: 6px;">📜</div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">श्री ${sanghName}</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #dbeafe; font-weight: 500;">
              वार्षिक संघ लवाजम एवं सदस्यता शुल्क रसीद • सत्र ${year}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 28px 24px;">
            <p style="font-size: 15px; margin: 0 0 16px 0; font-weight: 600; color: #1e3a8a;">
              सादर जय जिनेन्द्र, ${headName} जी 🙏
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
              सत्र <strong>${year}</strong> के लिए आपके परिवार का वार्षिक संघ लवाजम सधन्यवाद प्राप्त हुआ। आपकी आधिकारिक डिजिटल रसीद विवरण नीचे दिए गए हैं:
            </p>

            <!-- Receipt Box -->
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 0; color: #64748b;">रसीद क्रमांक (Receipt No):</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 700; font-family: monospace; color: #0f172a;">
                    ${receiptNumber}
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 0; color: #64748b;">Family ID:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 700; font-family: monospace; color: #2563eb;">
                    ${familyId}
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 0; color: #64748b;">भुगतान तिथि (Payment Date):</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #0f172a;">
                    ${formattedDate}
                  </td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 0; color: #64748b;">भुगतान माध्यम (Mode):</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #0f172a;">
                    ${paymentMode || "CASH"}
                  </td>
                </tr>
                ${
                  receiverName
                    ? `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 0; color: #64748b;">प्राप्तकर्ता / ट्रस्टी:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #0f172a;">
                    ${receiverName}
                  </td>
                </tr>`
                    : ""
                }
                ${
                  notes
                    ? `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 0; color: #64748b;">टिप्पणी / Remarks:</td>
                  <td style="padding: 8px 0; text-align: right; color: #475569;">
                    ${notes}
                  </td>
                </tr>`
                    : ""
                }
                <tr>
                  <td style="padding: 12px 0 4px 0; font-size: 16px; font-weight: 700; color: #166534;">
                    प्राप्त कुल राशि (Total Paid):
                  </td>
                  <td style="padding: 12px 0 4px 0; text-align: right; font-size: 20px; font-weight: 800; color: #166534;">
                    ₹${amount.toLocaleString("en-IN")}
                  </td>
                </tr>
              </table>
            </div>

            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 14px; text-align: center; color: #166534; font-size: 13px; font-weight: 600;">
              ✨ संघ के धार्मिक एवं सामाजिक सेवा कार्यों में आपके निरंतर सहयोग के लिए हार्दिक आभार!
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">श्री ${sanghName} • जिन संस्कार सेतु</p>
            <p style="margin: 0;">यह एक कंप्यूटर-जनरेटेड डिजिटल लवाजम रसीद है।</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
जय जिनेन्द्र ${headName} जी 🙏

श्री ${sanghName} - वार्षिक लवाजम रसीद (सत्र ${year})
रसीद क्रमांक: ${receiptNumber}
Family ID: ${familyId}
तारीख: ${formattedDate}
जमा राशि: ₹${amount}
माध्यम: ${paymentMode || "CASH"}
प्राप्तकर्ता: ${receiverName || "संघ कार्यालय"}

संघ कार्यों में आपके सहयोग हेतु धन्यवाद!
  `.trim();

  return sendEmail({ to, subject, html, text });
}

/**
 * 3. SANGH BROADCAST EMAIL (TRUSTEE / ADMIN)
 * Enables a Trustee or Admin to broadcast announcements to their Sangh members.
 */
export async function sendSanghBroadcastEmail({
  recipients,
  sanghName,
  subject,
  messageBody,
  senderName,
  senderRole,
}: {
  recipients: string[];
  sanghName: string;
  subject: string;
  messageBody: string;
  senderName: string;
  senderRole: string;
}): Promise<SendEmailResult> {
  if (!recipients || recipients.length === 0) {
    return { success: false, error: "No recipients provided for Sangh broadcast." };
  }

  const formattedSubject = `[श्री ${sanghName}] ${subject}`;

  const html = `
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0d5c3a 0%, #198754 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
            <div style="font-size: 28px; margin-bottom: 6px;">📢</div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">श्री ${sanghName}</h1>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #e2e8f0; font-weight: 500;">
              आधिकारिक संघ सूचना एवं संदेश (Official Announcement)
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 28px 24px;">
            <p style="font-size: 15px; margin: 0 0 16px 0; font-weight: 600; color: #166534;">
              सादर जय जिनेन्द्र सभी साधार्मिक बन्धुओं 🙏
            </p>

            <div style="background-color: #f8fafc; border-left: 4px solid #16a34a; border-radius: 4px; padding: 18px; margin-bottom: 24px; font-size: 14px; line-height: 1.7; color: #1e293b; white-space: pre-wrap;">${messageBody}</div>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 20px; font-size: 13px; color: #64748b;">
              <div><strong>प्रेषक (Sender):</strong> ${senderName} (${senderRole === "TRUSTEE" ? "ट्रस्टी" : "व्यवस्थापक / Admin"})</div>
              <div><strong>संघ:</strong> श्री ${sanghName}</div>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 4px 0;">श्री ${sanghName} • जिन संस्कार सेतु</p>
            <p style="margin: 0;">यह संदेश केवल आपके पंजीकृत संघ ईमेल पर भेजा गया है।</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Use BCC for broadcast privacy
  return sendEmail({
    to: recipients,
    subject: formattedSubject,
    html,
    text: `जय जिनेन्द्र,\n\nश्री ${sanghName} सूचना:\n\n${messageBody}\n\nप्रेषक: ${senderName}`,
  });
}

/**
 * 4. DIRECT EMAIL TO A FAMILY / MEMBER
 * For resending registration info, member credentials, or direct communication from the Family View.
 */
export async function sendDirectFamilyMessageEmail({
  to,
  headName,
  familyId,
  sanghName,
  subject,
  message,
  senderName,
}: {
  to: string;
  headName: string;
  familyId: string;
  sanghName: string;
  subject: string;
  message: string;
  senderName: string;
}): Promise<SendEmailResult> {
  const baseUrl = getAppBaseUrl();
  const directLink = `${baseUrl}/member-portal?familyId=${encodeURIComponent(familyId)}`;

  const html = `
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
        <tr>
          <td style="background: linear-gradient(135deg, #0d5c3a 0%, #198754 100%); padding: 24px; text-align: center; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">श्री ${sanghName}</h2>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #e2e8f0;">जिन संस्कार सेतु • Family ID: ${familyId}</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 28px 24px;">
            <p style="font-size: 15px; margin: 0 0 16px 0; font-weight: 600; color: #166534;">
              सादर जय जिनेन्द्र, ${headName} जी 🙏
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 20px; font-size: 14px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${message}</div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${directLink}" style="background-color: #0d5c3a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 700; font-size: 13px; display: inline-block;">
                👉 परिवार प्रोफाइल खोलें (Open Family Portal)
              </a>
            </div>

            <p style="font-size: 12px; color: #64748b; margin: 0;">
              प्रेषक: ${senderName} (श्री ${sanghName})
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `[${familyId}] ${subject}`,
    html,
    text: `जय जिनेन्द्र ${headName} जी,\n\n${message}\n\nपोर्टल लिंक: ${directLink}\n\nप्रेषक: ${senderName}`,
  });
}

/**
 * 4. FAMILY ID CARDS EMAIL
 * Dispatches official digital family ID cards for all family members to the registered head email.
 */
export async function sendFamilyIdCardsEmail({
  to,
  headName,
  familyId,
  sanghName,
  sanghPrefix,
  address,
  lane,
  area,
  sect,
  members,
}: {
  to: string;
  headName: string;
  familyId: string;
  sanghName: string;
  sanghPrefix: string;
  address: string;
  lane?: string | null;
  area: string;
  sect?: string | null;
  members: Array<{
    memberId: string;
    name: string;
    relationship: string;
    age: number;
    gender: string;
    bloodGroup?: string | null;
    residenceLocation?: string | null;
    dateOfBirth?: string | null;
  }>;
}): Promise<SendEmailResult> {
  const baseUrl = getAppBaseUrl();
  const directLink = `${baseUrl}/member-portal?familyId=${encodeURIComponent(familyId)}`;
  const subject = `जय जिनेन्द्र - आपके परिवार के डिजिटल पहचान पत्र (Digital Family ID Cards) [${familyId}]`;

  const memberCardsHtml = members
    .map(
      (m) => `
      <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-left: 5px solid #0d5c3a; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
          <tr>
            <td style="vertical-align: top;">
              <div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">
                ${sanghPrefix} • ${m.relationship === 'HEAD' ? 'मुखिया (HEAD)' : m.relationship}
              </div>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 2px 0 4px 0;">
                ${m.name}
              </div>
              <div style="color: #475569; font-size: 12px;">
                आयु: <strong>${m.age} वर्ष</strong> • लिंग: ${m.gender}
                ${m.dateOfBirth ? ` • जन्मतिथि: <span style="font-family: monospace;">${m.dateOfBirth}</span>` : ''}
              </div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 4px 8px; font-family: monospace; font-size: 13px; font-weight: 700; color: #065f46;">
                ${m.memberId}
              </div>
              ${
                m.bloodGroup
                  ? `<div style="margin-top: 4px;"><span style="display: inline-block; background-color: #fee2e2; border: 1px solid #fecaca; color: #991b1b; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">🩸 ${m.bloodGroup}</span></div>`
                  : ''
              }
              ${
                m.residenceLocation === 'FOREIGN'
                  ? `<div style="margin-top: 4px;"><span style="display: inline-block; background-color: #fef2f2; border: 1px solid #f87171; color: #b91c1c; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">✈️ Foreign / NRI</span></div>`
                  : ''
              }
            </td>
          </tr>
        </table>
      </div>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="hi">
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #0f172a;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #0d5c3a 0%, #15803d 100%); padding: 26px 20px; text-align: center; color: #ffffff;">
            <div style="font-size: 26px; margin-bottom: 4px;">☸️</div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">श्री ${sanghName}</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #dcfce7; font-weight: 500;">
              जिन संस्कार सेतु • आधिकारिक पारिवारिक डिजिटल पहचान पत्र
            </p>
          </td>
        </tr>

        <!-- Main Body -->
        <tr>
          <td style="padding: 24px;">
            <p style="font-size: 15px; margin: 0 0 12px 0; font-weight: 600; color: #166534;">
              सादर जय जिनेन्द्र, ${headName} जी 🙏
            </p>
            <p style="font-size: 13px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
              श्री ${sanghName} की समग्र जनगणना एवं जिन संस्कार सेतु डिजिटल डायरेक्टरी के अंतर्गत आपके परिवार के सभी सदस्यों के अधिकृत डिजिटल पहचान पत्र (Family ID Cards) नीचे संलग्न हैं।
            </p>

            <!-- Family Master Box -->
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                <tr>
                  <td>
                    <span style="color: #166534; font-size: 11px; text-transform: uppercase; font-weight: 700;">Family ID</span>
                    <div style="font-size: 18px; font-family: monospace; font-weight: 800; color: #0d5c3a;">${familyId}</div>
                  </td>
                  <td style="text-align: right;">
                    <span style="color: #166534; font-size: 11px; text-transform: uppercase; font-weight: 700;">सम्प्रदाय / Sect</span>
                    <div style="font-size: 13px; font-weight: 700; color: #1e293b;">${sect || 'जैन (Jain)'}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 8px; font-size: 12px; color: #334155;">
                    📍 <strong>पता:</strong> ${address}${lane ? ', ' + lane : ''}, ${area}
                  </td>
                </tr>
              </table>
            </div>

            <!-- Member Cards Section -->
            <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">
              पारिवारिक सदस्य पहचान पत्र (${members.length} सदस्य)
            </h3>
            
            ${memberCardsHtml}

            <!-- Direct Access Button -->
            <div style="text-align: center; margin: 24px 0 12px 0;">
              <a href="${directLink}" style="background-color: #0d5c3a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                👉 डिजिटल परिवार प्रोफाइल व कार्ड खोलें (Open Digital ID)
              </a>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0; text-align: center;">
              * इन सदस्य संख्याओं (Member IDs) का उपयोग संघ लवाजम भुगतान, धार्मिक अनुष्ठान एवं संघ सेवाओं के लिए किया जा सकता है।
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">श्री ${sanghName} • जिन संस्कार सेतु</p>
            <p style="margin: 0;">अहिंसा परमो धर्मः • जीओ और जीने दो</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject,
    html,
    text: `जय जिनेन्द्र ${headName} जी,\n\nश्री ${sanghName} - आपके परिवार का Family ID: ${familyId}\n\nसदस्य संख्या:\n${members
      .map((m) => `- ${m.name} (${m.relationship}): ${m.memberId}`)
      .join('\n')}\n\nडिजिटल कार्ड पोर्टल लिंक: ${directLink}\n\nजिन संस्कार सेतु`,
  });
}
