"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  AdminDashboardData,
  sendTestBirthdayMessageAction,
  triggerManualSchedulerRunAction,
} from "@/lib/actions/birthday-actions";

interface Props {
  initialData: AdminDashboardData;
}

export default function AdminBirthdaysClient({ initialData }: Props) {
  const [data, setData] = useState<AdminDashboardData>(initialData);
  const [isPending, startTransition] = useTransition();

  // Test Mode State
  const [testPhone, setTestPhone] = useState<string>("");
  const [testName, setTestName] = useState<string>("प्रिय सदस्य");
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; messageId?: string; error?: string } | null>(null);

  // Manual Scheduler Execution State
  const [schedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const [schedulerIsDryRun, setSchedulerIsDryRun] = useState(true);
  const [schedulerResult, setSchedulerResult] = useState<any | null>(null);

  // Filter logs
  const [logFilter, setLogFilter] = useState<string>("ALL");

  const handleOpenTestModal = () => {
    setTestResult(null);
    setTestModalOpen(true);
  };

  const handleSendTestMessage = () => {
    if (!testPhone.trim()) return;

    startTransition(async () => {
      try {
        const res = await sendTestBirthdayMessageAction(testPhone, testName);
        setTestResult(res);
      } catch (err: any) {
        setTestResult({ success: false, error: err?.message || "Test dispatch failed." });
      }
    });
  };

  const handleOpenSchedulerModal = (dryRun: boolean) => {
    setSchedulerIsDryRun(dryRun);
    setSchedulerResult(null);
    setSchedulerModalOpen(true);
  };

  const handleExecuteScheduler = () => {
    startTransition(async () => {
      try {
        const res = await triggerManualSchedulerRunAction(schedulerIsDryRun);
        if (res.success) {
          setSchedulerResult(res.result);
        } else {
          setSchedulerResult({ error: res.error });
        }
      } catch (err: any) {
        setSchedulerResult({ error: err?.message || "Execution failed." });
      }
    });
  };

  const filteredLogs = data.recentLogs.filter((log) => {
    if (logFilter === "ALL") return true;
    return log.status === logFilter;
  });

  return (
    <div className="container-fluid px-3 px-lg-4 py-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-danger text-white fs-7 px-2 py-1">ADMINISTRATOR</span>
            {data.configStatus.sendingEnabled ? (
              <span className="badge bg-success-subtle text-success border border-success-subtle">
                <i className="bi bi-broadcast me-1"></i> Sending: ENABLED
              </span>
            ) : (
              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                <i className="bi bi-shield-lock me-1"></i> Production Sending: DISABLED (Safety Mode)
              </span>
            )}
          </div>
          <h1 className="h3 fw-bold text-dark mb-0">
            <i className="bi bi-whatsapp text-success me-2"></i>
            WhatsApp Birthday Messaging Administration
          </h1>
          <p className="text-muted small mb-0 mt-1">
            Centralized automated Meta WhatsApp Cloud API greeting dispatch across all six Jain Sanghs.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Link href="/birthdays" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-eye-fill me-1"></i> View Trustee Portal
          </Link>
          <button
            onClick={() => handleOpenSchedulerModal(true)}
            className="btn btn-outline-primary btn-sm"
          >
            <i className="bi bi-play-circle me-1"></i> Run Simulation (Dry-Run)
          </button>
          <button onClick={handleOpenTestModal} className="btn btn-jain-primary btn-sm">
            <i className="bi bi-send-fill me-1"></i> Safe Test Mode
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card-clean p-3 shadow-sm border-start border-primary border-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold text-uppercase">Total Family Heads</span>
              <div className="rounded-circle bg-primary-subtle p-2 text-primary">
                <i className="bi bi-people-fill fs-5"></i>
              </div>
            </div>
            <h2 className="display-6 fw-bold text-dark mb-0">{data.totalEligibleHeads}</h2>
            <div className="mt-2 small text-muted">
              Across all 6 registered Sanghs
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card-clean p-3 shadow-sm border-start border-success border-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold text-uppercase">Explicit Consent</span>
              <div className="rounded-circle bg-success-subtle p-2 text-success">
                <i className="bi bi-whatsapp fs-5"></i>
              </div>
            </div>
            <h2 className="display-6 fw-bold text-dark mb-0">{data.totalConsented}</h2>
            <div className="mt-2 small text-muted">
              <span className="text-danger fw-semibold">{data.totalNotConsented} excluded</span> (no consent)
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card-clean p-3 shadow-sm border-start border-danger border-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold text-uppercase">Today's Birthdays</span>
              <div className="rounded-circle bg-danger-subtle p-2 text-danger">
                <i className="bi bi-cake2-fill fs-5"></i>
              </div>
            </div>
            <h2 className="display-6 fw-bold text-dark mb-0">{data.todayTotalBirthdays}</h2>
            <div className="mt-2 small text-muted">
              <span className="text-success fw-semibold">{data.todayEligibleBirthdays} eligible</span> for greetings today
            </div>
          </div>
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <div className="card-clean p-3 shadow-sm border-start border-info border-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="text-muted small fw-semibold text-uppercase">Delivery Pipeline</span>
              <div className="rounded-circle bg-info-subtle p-2 text-info">
                <i className="bi bi-send-check-fill fs-5"></i>
              </div>
            </div>
            <h2 className="display-6 fw-bold text-dark mb-0">{data.deliveredThisYear}</h2>
            <div className="mt-2 small text-muted">
              <span>{data.sentThisYear} sent</span> •{" "}
              <span className={data.failedThisYear > 0 ? "text-danger" : ""}>{data.failedThisYear} failed</span> •{" "}
              <span>{data.skippedThisYear} skipped</span>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* Left Column: Configuration & Meta Checklist */}
        <div className="col-12 col-lg-6">
          <div className="card-clean shadow-sm p-4 h-100">
            <h5 className="fw-bold text-dark mb-3">
              <i className="bi bi-sliders me-2 text-primary"></i>
              Meta WhatsApp Cloud API Configuration
            </h5>

            <div className="list-group list-group-flush mb-4">
              {/* Access Token */}
              <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                <div>
                  <div className="fw-semibold text-dark">WHATSAPP_ACCESS_TOKEN</div>
                  <small className="text-muted">System User Token with whatsapp_business_messaging permission</small>
                </div>
                {data.configStatus.accessTokenConfigured ? (
                  <span className="badge bg-success"><i className="bi bi-check-lg me-1"></i> Configured</span>
                ) : (
                  <span className="badge bg-danger"><i className="bi bi-x-lg me-1"></i> Missing</span>
                )}
              </div>

              {/* Phone Number ID */}
              <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                <div>
                  <div className="fw-semibold text-dark">WHATSAPP_PHONE_NUMBER_ID</div>
                  <small className="text-muted">Sender phone number identifier from Meta App Dashboard</small>
                </div>
                {data.configStatus.phoneNumberIdConfigured ? (
                  <span className="badge bg-success"><i className="bi bi-check-lg me-1"></i> Configured</span>
                ) : (
                  <span className="badge bg-danger"><i className="bi bi-x-lg me-1"></i> Missing</span>
                )}
              </div>

              {/* Business Account ID */}
              <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                <div>
                  <div className="fw-semibold text-dark">WHATSAPP_BUSINESS_ACCOUNT_ID</div>
                  <small className="text-muted">Meta WABA Account ID</small>
                </div>
                {data.configStatus.businessAccountIdConfigured ? (
                  <span className="badge bg-success"><i className="bi bi-check-lg me-1"></i> Configured</span>
                ) : (
                  <span className="badge bg-secondary"><i className="bi bi-dash me-1"></i> Optional</span>
                )}
              </div>

              {/* API Version */}
              <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                <div>
                  <div className="fw-semibold text-dark">WHATSAPP_API_VERSION</div>
                  <small className="text-muted">Meta Graph API version</small>
                </div>
                <span className="badge bg-light text-dark border font-monospace">{data.configStatus.apiVersion}</span>
              </div>

              {/* Template Name & Language */}
              <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                <div>
                  <div className="fw-semibold text-dark">Template Approval &amp; Language</div>
                  <small className="text-muted">
                    {data.configStatus.templateName} ({data.configStatus.templateLanguage})
                  </small>
                </div>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                  Category: MARKETING
                </span>
              </div>

              {/* Vercel Cron Secret */}
              <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                <div>
                  <div className="fw-semibold text-dark">CRON_SECRET</div>
                  <small className="text-muted">Daily scheduler endpoint authorization secret</small>
                </div>
                {data.configStatus.cronSecretConfigured ? (
                  <span className="badge bg-success"><i className="bi bi-check-lg me-1"></i> Configured</span>
                ) : (
                  <span className="badge bg-danger"><i className="bi bi-x-lg me-1"></i> Missing</span>
                )}
              </div>

              {/* Webhook Token */}
              <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                <div>
                  <div className="fw-semibold text-dark">WHATSAPP_WEBHOOK_VERIFY_TOKEN</div>
                  <small className="text-muted">Meta delivery status callback handshake token</small>
                </div>
                {data.configStatus.webhookVerifyTokenConfigured ? (
                  <span className="badge bg-success"><i className="bi bi-check-lg me-1"></i> Configured</span>
                ) : (
                  <span className="badge bg-danger"><i className="bi bi-x-lg me-1"></i> Missing</span>
                )}
              </div>
            </div>

            {/* Proposed Template Content Reference */}
            <div className="p-3 bg-light rounded-3 border">
              <div className="fw-semibold text-dark small mb-1">
                <i className="bi bi-chat-quote-fill me-1 text-primary"></i> Proposed Message Template Content:
              </div>
              <p className="text-muted small fst-italic mb-2" style={{ lineHeight: "1.5" }}>
                "🌸 जन्मदिन की हार्दिक शुभकामनाएँ, &#123;&#123;1&#125;&#125;! 🙏 आपका जीवन सुख, शांति, उत्तम स्वास्थ्य और धर्ममय संस्कारों से परिपूर्ण रहे। जिनशासन के प्रति आपकी श्रद्धा निरंतर बढ़ती रहे। जिन Sanskar Setu परिवार की ओर से मंगलमय जन्मदिन की शुभकामनाएँ! 🎂"
              </p>
              <div className="small text-secondary" style={{ fontSize: "0.75rem" }}>
                Note: Template must be submitted to Meta Business Manager for approval under Marketing category before live sending is enabled.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Estimated Cost & Operational Actions */}
        <div className="col-12 col-lg-6">
          <div className="card-clean shadow-sm p-4 h-100 d-flex flex-column justify-content-between">
            <div>
              <h5 className="fw-bold text-dark mb-3">
                <i className="bi bi-currency-rupee me-1 text-success"></i>
                Meta WhatsApp Business Estimated Pricing
              </h5>

              <div className="p-3 bg-light rounded-3 border mb-3">
                <div className="row g-3">
                  <div className="col-6">
                    <span className="text-muted small d-block">Current Month Sent:</span>
                    <strong className="fs-5 text-dark">
                      {data.currentMonthEstimatedCost.sentMessagesCount} messages
                    </strong>
                  </div>
                  <div className="col-6">
                    <span className="text-muted small d-block">Estimated Meta Charges:</span>
                    <strong className="fs-5 text-success">
                      {data.currentMonthEstimatedCost.estimatedCostInr}
                    </strong>
                  </div>
                  <div className="col-12">
                    <span className="text-muted small d-block">Applicable Meta Rate:</span>
                    <span className="small text-dark fw-medium">
                      {data.currentMonthEstimatedCost.ratePerMessageInr} (India Marketing Conversation)
                    </span>
                  </div>
                </div>
              </div>

              <div className="alert alert-secondary py-2 px-3 small mb-4">
                <i className="bi bi-info-circle-fill me-2 text-primary"></i>
                {data.currentMonthEstimatedCost.disclaimer}
              </div>

              <h6 className="fw-bold text-dark mb-2">Scheduler Controls</h6>
              <div className="d-flex flex-column gap-2 mb-4">
                <button
                  onClick={() => handleOpenSchedulerModal(true)}
                  className="btn btn-outline-primary text-start d-flex justify-content-between align-items-center"
                >
                  <div>
                    <div className="fw-semibold">Run Simulation (Dry-Run Preview)</div>
                    <small className="text-muted">Simulate today's birthday candidate detection without sending</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </button>

                <button
                  onClick={() => handleOpenSchedulerModal(false)}
                  className="btn btn-outline-danger text-start d-flex justify-content-between align-items-center"
                  disabled={!data.configStatus.sendingEnabled}
                  title={!data.configStatus.sendingEnabled ? "Enable WHATSAPP_BIRTHDAY_SENDING_ENABLED to execute live sending" : ""}
                >
                  <div>
                    <div className="fw-semibold">Execute Live Scheduler Run</div>
                    <small className="text-muted">Immediately process and dispatch greetings for today's eligible birthdays</small>
                  </div>
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>

            <div className="p-3 bg-light rounded-3 border small text-muted">
              <i className="bi bi-calendar3 me-1 text-primary"></i> Daily Automated Run: <strong>09:00 AM IST (03:30 UTC)</strong> via Vercel Cron.
            </div>
          </div>
        </div>
      </div>

      {/* Sangh Summaries Table */}
      <div className="card-clean shadow-sm p-4 mb-4">
        <h5 className="fw-bold text-dark mb-3">
          <i className="bi bi-building me-2 text-primary"></i>
          Sangh-by-Sangh Birthday Breakdown
        </h5>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Sangh Name</th>
                <th>Prefix</th>
                <th>Family Heads</th>
                <th>Consented</th>
                <th>Today's Birthdays</th>
                <th>Sent / Delivered This Year</th>
                <th>Failures</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.sanghSummaries.map((s) => (
                <tr key={s.sanghId}>
                  <td className="fw-bold text-dark">{s.name}</td>
                  <td><span className="badge-sangh font-monospace">{s.prefix}</span></td>
                  <td>{s.totalFamilyHeads}</td>
                  <td>
                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                      {s.consentedCount}
                    </span>
                  </td>
                  <td>
                    {s.todayBirthdaysCount > 0 ? (
                      <span className="badge bg-danger text-white">{s.todayBirthdaysCount}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td>
                    <span className="text-dark fw-medium">{s.sentThisYearCount}</span>
                    <small className="text-muted ms-1">({s.deliveredThisYearCount} delivered)</small>
                  </td>
                  <td>
                    {s.failedThisYearCount > 0 ? (
                      <span className="badge bg-danger">{s.failedThisYearCount}</span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className="text-end">
                    <Link href={`/birthdays?sanghId=${s.sanghId}`} className="btn btn-outline-secondary btn-sm">
                      <i className="bi bi-eye-fill me-1"></i> View Sangh
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Today's Birthdays Across All Sanghs */}
      <div className="card-clean shadow-sm p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="fw-bold text-dark mb-0">
            <i className="bi bi-cake2-fill text-danger me-2"></i>
            Today's Birthdays Across All Sanghs ({data.todayRecipients.length})
          </h5>
          <span className="badge bg-light text-muted border">Asia/Kolkata Calendar</span>
        </div>

        {data.todayRecipients.length === 0 ? (
          <div className="text-center py-4 text-muted small">
            No family heads have birthdays today across the six Sanghs.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Sangh</th>
                  <th>Family Head</th>
                  <th>Member ID</th>
                  <th>Phone</th>
                  <th>Age</th>
                  <th>Consent</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.todayRecipients.map((r) => (
                  <tr key={r.memberId}>
                    <td>
                      <span className="badge-sangh font-monospace">{r.sanghPrefix}</span>
                      <small className="text-muted ms-1">{r.sanghName}</small>
                    </td>
                    <td className="fw-bold text-dark">{r.name}</td>
                    <td className="font-monospace small text-muted">{r.memberId}</td>
                    <td className="font-monospace small text-dark">{r.maskedPhone}</td>
                    <td>{r.age} yrs</td>
                    <td>
                      {r.whatsappConsent ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          Consented
                        </span>
                      ) : (
                        <span className="badge bg-light text-secondary border">No Consent</span>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border">
                        {r.latestMessageStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global Delivery Logs & Audit */}
      <div className="card-clean shadow-sm p-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
          <h5 className="fw-bold text-dark mb-0">
            <i className="bi bi-clock-history me-2 text-info"></i>
            Central Delivery Logs &amp; Audit Trail ({data.recentLogs.length})
          </h5>

          {/* Log Filter Pills */}
          <div className="btn-group btn-group-sm">
            {["ALL", "SENT", "DELIVERED", "FAILED", "SKIPPED"].map((st) => (
              <button
                key={st}
                className={`btn ${logFilter === st ? "btn-primary" : "btn-outline-secondary"}`}
                onClick={() => setLogFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-4 text-muted small">
            No logs matched the selected filter.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Timestamp</th>
                  <th>Sangh</th>
                  <th>Recipient</th>
                  <th>Masked Phone</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Sanitized Errors / Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="small text-muted">
                      {new Date(log.createdAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td><span className="badge-sangh font-monospace">{log.sanghPrefix}</span></td>
                    <td>
                      <div className="fw-semibold text-dark">{log.memberName}</div>
                      <div className="small text-muted font-monospace">{log.memberId}</div>
                    </td>
                    <td className="font-monospace small text-dark">{log.maskedPhone}</td>
                    <td>
                      <span className={`badge ${
                        log.status === "DELIVERED" ? "bg-success" :
                        log.status === "SENT" ? "bg-info text-dark" :
                        log.status === "FAILED" ? "bg-danger" :
                        "bg-secondary"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td>{log.attemptCount}</td>
                    <td className="small">
                      {log.errorMessage ? (
                        <span className="text-danger">{log.errorMessage}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SAFE TEST MODE MODAL */}
      {testModalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content shadow-card">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-shield-check text-success me-2"></i>
                  Safe Test Mode (Single Test Recipient)
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setTestModalOpen(false)}
                  disabled={isPending}
                ></button>
              </div>

              <div className="modal-body">
                <div className="alert alert-info py-2 px-3 small mb-3">
                  <i className="bi bi-info-circle-fill me-1"></i>
                  <strong>Safety Guarantee:</strong> This test will dispatch the approved WhatsApp greeting template
                  strictly to the mobile number entered below. It will <strong>never</strong> message any actual database
                  recipients.
                </div>

                {testResult && (
                  <div
                    className={`alert ${testResult.success ? "alert-success" : "alert-danger"} py-2 px-3 small mb-3`}
                  >
                    {testResult.success ? (
                      <div>
                        <i className="bi bi-check-circle-fill me-1"></i>
                        <strong>Success!</strong> WhatsApp message accepted by Meta API.
                        <div className="font-monospace small mt-1">Message ID: {testResult.messageId}</div>
                      </div>
                    ) : (
                      <div>
                        <i className="bi bi-exclamation-triangle-fill me-1"></i>
                        <strong>Send Failed:</strong> {testResult.error}
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-3">
                  <label htmlFor="test-phone-input" className="form-label fw-semibold text-dark small">
                    Test Mobile Number <span className="text-danger">*</span>
                  </label>
                  <input
                    type="tel"
                    id="test-phone-input"
                    className="form-control"
                    placeholder="e.g. 9822012345 or +919822012345"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    disabled={isPending}
                  />
                  <div className="form-text">Must be a valid 10-digit Indian phone number.</div>
                </div>

                <div className="mb-3">
                  <label htmlFor="test-name-input" className="form-label fw-semibold text-dark small">
                    Sample Recipient Name (&#123;&#123;1&#125;&#125; variable)
                  </label>
                  <input
                    type="text"
                    id="test-name-input"
                    className="form-control"
                    placeholder="e.g. Priyank Nagori"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setTestModalOpen(false)}
                  disabled={isPending}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleSendTestMessage}
                  disabled={isPending || !testPhone.trim()}
                >
                  {isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Dispatching Test...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill me-1"></i> Dispatch Test Greeting
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULER EXECUTION MODAL */}
      {schedulerModalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
            <div className="modal-content shadow-card">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-dark">
                  {schedulerIsDryRun ? (
                    <>
                      <i className="bi bi-play-circle text-primary me-2"></i>
                      Birthday Scheduler Simulation (Dry-Run Preview)
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-exclamation-fill text-danger me-2"></i>
                      Execute Live Birthday Greeting Dispatch
                    </>
                  )}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSchedulerModalOpen(false)}
                  disabled={isPending}
                ></button>
              </div>

              <div className="modal-body">
                {schedulerIsDryRun ? (
                  <p className="text-muted small">
                    This simulation evaluates today's birthday candidates in <strong>Asia/Kolkata</strong>, checks
                    validity of phone numbers, verifies explicit WhatsApp consent, and checks duplicate suppression
                    without dispatching any live messages or recording billable API requests.
                  </p>
                ) : (
                  <div className="alert alert-warning py-2 px-3 small mb-3">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                    <strong>Caution:</strong> Live execution will dispatch WhatsApp template greetings to all eligible
                    consented family heads whose birthdays fall on today's calendar date.
                  </div>
                )}

                {schedulerResult && (
                  <div className="card bg-light p-3 border mb-3">
                    <h6 className="fw-bold text-dark mb-2">Execution Results:</h6>
                    {schedulerResult.error ? (
                      <div className="text-danger small">{schedulerResult.error}</div>
                    ) : (
                      <div className="small">
                        <div className="row g-2 mb-2">
                          <div className="col-4">Candidates: <strong>{schedulerResult.totalCandidates}</strong></div>
                          <div className="col-4">Sent: <strong className="text-success">{schedulerResult.sentCount}</strong></div>
                          <div className="col-4">Skipped: <strong className="text-secondary">{schedulerResult.skippedCount}</strong></div>
                        </div>

                        {schedulerResult.details && schedulerResult.details.length > 0 && (
                          <div className="table-responsive max-h-60 mt-2">
                            <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.78rem" }}>
                              <thead className="table-white">
                                <tr>
                                  <th>Name</th>
                                  <th>Sangh</th>
                                  <th>Phone</th>
                                  <th>Action / Status</th>
                                  <th>Reason</th>
                                </tr>
                              </thead>
                              <tbody>
                                {schedulerResult.details.map((d: any, idx: number) => (
                                  <tr key={idx}>
                                    <td className="fw-medium">{d.headName}</td>
                                    <td>{d.sanghPrefix}</td>
                                    <td className="font-monospace">{d.phone}</td>
                                    <td>
                                      <span className={`badge ${d.status === "SENT" ? "bg-success" : "bg-secondary"}`}>
                                        {d.status}
                                      </span>
                                    </td>
                                    <td className="text-muted">{d.reason || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setSchedulerModalOpen(false)}
                  disabled={isPending}
                >
                  Close
                </button>
                <button
                  type="button"
                  className={`btn ${schedulerIsDryRun ? "btn-primary" : "btn-danger"}`}
                  onClick={handleExecuteScheduler}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                      Executing...
                    </>
                  ) : schedulerIsDryRun ? (
                    "Run Simulation"
                  ) : (
                    "Confirm & Execute Live Dispatch"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
