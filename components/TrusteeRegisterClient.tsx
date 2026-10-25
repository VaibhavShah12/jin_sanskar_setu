"use client";

import React, { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { registerTrusteeAction } from "@/lib/actions/user-actions";

interface SanghOption {
  id: string;
  name: string;
  prefix: string;
}

interface TrusteeRegisterClientProps {
  sanghs: SanghOption[];
}

export default function TrusteeRegisterClient({ sanghs }: TrusteeRegisterClientProps) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [sanghId, setSanghId] = useState(sanghs.length > 0 ? sanghs[0].id : "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!username.trim() || username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    if (!sanghId) {
      setError("Please select your Sangh.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await registerTrusteeAction({
        name,
        username,
        sanghId,
        phone,
        email,
        password,
        confirmPassword,
      });

      setLoading(false);

      if (!res.success) {
        setError(res.error || "Failed to submit trustee registration request.");
        return;
      }

      setSuccessMessage(res.message || "Registration request submitted successfully.");
      setSubmitted(true);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "An unexpected error occurred. Please try again.");
    }
  };

  const selectedSangh = sanghs.find((s) => s.id === sanghId);

  return (
    <div className="card-clean card-accent-top shadow-elevated overflow-hidden">
      {/* Header */}
      <div className="text-center p-4 pb-0">
        <div className="mb-3 d-flex justify-content-center">
          <Logo size={64} />
        </div>
        <h1 className="brand-title h4 mb-1">Trustee Registration Request</h1>
        <p className="brand-hindi fs-6 mb-1">जिन संस्कार सेतु • ट्रस्टी पंजीकरण</p>
        <p className="text-muted small mb-0">
          Request authorized view access for your Jain Sangh
        </p>
      </div>

      <div className="p-4">
        {submitted ? (
          <div className="text-center py-4">
            <div className="rounded-circle bg-success-subtle text-success p-3 d-inline-flex mb-3">
              <i className="bi bi-shield-check display-5"></i>
            </div>
            <h4 className="fw-bold text-dark mb-2">Request Submitted to Admin</h4>
            <div className="alert alert-info py-3 px-3 small text-start mb-4">
              <i className="bi bi-info-circle-fill me-2 text-primary"></i>
              {successMessage}
            </div>
            <p className="text-muted small mb-4">
              Your account for <strong>{username}</strong> has been registered with status{" "}
              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                Pending Approval
              </span>
              . Once the administrator verifies your trustee credentials for{" "}
              <strong>{selectedSangh?.name}</strong>, you will be able to log in.
            </p>
            <Link
              href="/login?registered=trustee_pending"
              className="btn btn-jain-primary btn-lg w-100 fw-semibold"
            >
              <i className="bi bi-box-arrow-in-right me-2"></i>
              Return to Login
            </Link>
          </div>
        ) : (
          <>
            {/* Notice */}
            <div className="bg-light border rounded-3 p-3 mb-4 small text-secondary">
              <div className="d-flex align-items-start gap-2">
                <i className="bi bi-shield-lock-fill text-warning fs-5 lh-1 mt-1 flex-shrink-0"></i>
                <div>
                  <strong className="d-block text-dark mb-1">Administrative Verification Required</strong>
                  When you register, your request is submitted directly to the Administrator for verification. After approval, you will be able to log in and view only your assigned Sangh details.
                </div>
              </div>
            </div>

            {error && (
              <div
                className="alert alert-danger py-2 px-3 small d-flex align-items-start gap-2 mb-3"
                role="alert"
              >
                <i className="bi bi-exclamation-triangle-fill mt-1 flex-shrink-0"></i>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Full Name */}
              <div className="mb-3">
                <label className="form-label fw-semibold text-dark small mb-1">
                  Full Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rameshchandra Shah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-control"
                  disabled={loading}
                />
              </div>

              {/* Username */}
              <div className="mb-3">
                <label className="form-label fw-semibold text-dark small mb-1">
                  Username <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  placeholder="e.g. trustee_msjs_ramesh"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                  className="form-control font-monospace"
                  disabled={loading}
                />
                <div className="form-text fs-8">
                  Lowercase letters, numbers, and underscores. Min 3 characters.
                </div>
              </div>

              {/* Sangh Selection */}
              <div className="mb-3">
                <label className="form-label fw-semibold text-dark small mb-1">
                  Designated Jain Sangh <span className="text-danger">*</span>
                </label>
                <select
                  value={sanghId}
                  onChange={(e) => setSanghId(e.target.value)}
                  className="form-select"
                  required
                  disabled={loading}
                >
                  {sanghs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.prefix} — {s.name}
                    </option>
                  ))}
                </select>
                <div className="form-text fs-8 text-primary">
                  <i className="bi bi-eye-slash me-1"></i>
                  Trustees are strictly restricted to view only their assigned Sangh records.
                </div>
              </div>

              {/* Mobile Phone */}
              <div className="mb-3">
                <label className="form-label fw-semibold text-dark small mb-1">
                  Contact Mobile / WhatsApp No. <span className="text-muted fw-normal">(For verification)</span>
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="e.g. 9822012345"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="form-control"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="mb-3">
                <label className="form-label fw-semibold text-dark small mb-1">
                  Email Address <span className="text-muted fw-normal">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. trustee@example.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control"
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div className="mb-3">
                <label className="form-label fw-semibold text-dark small mb-1">
                  Password <span className="text-danger">*</span>
                </label>
                <div className="input-group">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-control"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="mb-4">
                <label className="form-label fw-semibold text-dark small mb-1">
                  Confirm Password <span className="text-danger">*</span>
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-control"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="submit-trustee-register-btn"
                className="btn btn-jain-primary btn-lg w-100 fw-semibold d-flex align-items-center justify-content-center gap-2"
                disabled={loading}
                style={{ minHeight: "50px" }}
              >
                {loading ? (
                  <>
                    <div className="spinner-border spinner-border-sm" role="status"></div>
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-send-check"></i>
                    <span>Submit Registration Request</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center mt-3 pt-3 border-top">
              <span className="text-muted small">Already have an active account? </span>
              <Link href="/login" className="small fw-semibold text-primary text-decoration-none">
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
