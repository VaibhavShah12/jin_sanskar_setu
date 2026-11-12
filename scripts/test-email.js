// ==============================================================================
// Jin Sanskar Setu - SMTP Email Verification Utility
// Run: node scripts/test-email.js [recipient-email@example.com]
// ==============================================================================

const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const nodemailer = require("nodemailer");

async function testEmail() {
  const targetEmail = process.argv[2] || process.env.SMTP_USER;

  console.log("\n=======================================================");
  console.log("  JIN SANSKAR SETU — EMAIL DISPATCH TEST");
  console.log("=======================================================\n");

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"Jin Sanskar Setu" <${user}>`;

  console.log("1. Checking Environment Variables in .env:");
  console.log("   - SMTP_HOST :", host || "❌ NOT SET");
  console.log("   - SMTP_PORT :", port || "❌ NOT SET");
  console.log("   - SMTP_USER :", user || "❌ NOT SET");
  console.log("   - SMTP_PASS :", pass ? `****** (length: ${pass.length})` : "❌ NOT SET");
  console.log("   - SMTP_FROM :", from);

  if (!host || !user || !pass) {
    console.error("\n❌ FAILED: Missing SMTP credentials in .env file.");
    console.error("Please add the following lines to your .env file:\n");
    console.error("SMTP_HOST=smtp.gmail.com");
    console.error("SMTP_PORT=587");
    console.error("SMTP_USER=your-email@gmail.com");
    console.error("SMTP_PASS=your-16-char-app-password");
    console.error("SMTP_FROM=\"Jin Sanskar Setu\" <your-email@gmail.com>\n");
    process.exit(1);
  }

  if (!targetEmail) {
    console.error("\n❌ Please provide a destination email address:");
    console.error("   node scripts/test-email.js your-email@example.com\n");
    process.exit(1);
  }

  console.log(`\n2. Connecting to SMTP Server (${host}:${port})...`);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.verify();
    console.log("   ✔ SMTP Connection successfully verified!");
  } catch (verifyErr) {
    console.error("\n❌ SMTP Authentication Failed:", verifyErr.message);
    if (host.includes("gmail.com")) {
      console.error("\n💡 Gmail Tip:");
      console.error("   - You MUST use a 16-character 'App Password', not your regular Gmail password.");
      console.error("   - Ensure 2-Step Verification is enabled on your Google Account.");
      console.error("   - Generate App Password at: https://myaccount.google.com/apppasswords");
    }
    process.exit(1);
  }

  console.log(`\n3. Sending Test Email to: ${targetEmail}...`);
  try {
    const info = await transporter.sendMail({
      from,
      to: targetEmail,
      subject: "जय जिनेन्द्र - Jin Sanskar Setu SMTP Test Email",
      text: "This is a test email from Jin Sanskar Setu confirming that real email sending is working properly.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0d5c3a; margin-top: 0;">☸️ जय जिनेन्द्र</h2>
          <h3 style="color: #1e293b;">Jin Sanskar Setu Email Dispatch Working!</h3>
          <p style="color: #475569;">
            This test email confirms that your SMTP settings in <code>.env</code> are active and configured correctly.
          </p>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px; color: #334155;">
            <strong>Sender:</strong> ${from}<br>
            <strong>Recipient:</strong> ${targetEmail}<br>
            <strong>Timestamp:</strong> ${new Date().toLocaleString()}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">
            Jin Sanskar Setu • Jain Sangh Digital Platform
          </p>
        </div>
      `,
    });

    console.log("   ✔ Test Email successfully sent!");
    console.log("   ✔ Message ID:", info.messageId);
    console.log("\n=======================================================");
    console.log("  SUCCESS! Check the inbox of:", targetEmail);
    console.log("=======================================================\n");
  } catch (sendErr) {
    console.error("\n❌ Failed to send email:", sendErr.message);
    process.exit(1);
  }
}

testEmail();

