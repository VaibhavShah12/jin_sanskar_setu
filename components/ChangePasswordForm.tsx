"use client";

import React, { useState } from "react";
import { changeOwnPasswordAction } from "@/lib/actions/user-actions";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Real-time strength checks
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg("Please enter your current password.");
      return;
    }

    if (!hasMinLength || !hasUpper || !hasLower || !hasNumber) {
      setErrorMsg("Please ensure your new password satisfies all strength requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("New password and confirmation do not match.");
      return;
    }

    setLoading(true);

    const res = await changeOwnPasswordAction({
      currentPassword,
      newPassword,
      confirmPassword,
    });

    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to update password.");
      return;
    }

    setSuccessMsg(res.message || "Your password has been updated successfully.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="card-clean p-4 bg-white border shadow-sm rounded-4">
      <div className="mb-3">
        <h4 className="fw-bold text-dark mb-1">
          <i className="bi bi-shield-lock-fill text-primary me-2"></i>
          Change Account Password
        </h4>
        <p className="text-muted small mb-0">
          Update your login password. Passwords are one-way hashed using bcrypt and are never visible to administrators.
        </p>
      </div>

      {errorMsg && (
        <div className="alert alert-danger border-danger-subtle small d-flex align-items-center gap-2 mb-3" role="alert">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>{errorMsg}</div>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success border-success-subtle small d-flex align-items-center gap-2 mb-3" role="alert">
          <i className="bi bi-check-circle-fill"></i>
          <div>{successMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
        {/* Current Password */}
        <div>
          <label className="form-label small fw-semibold text-dark mb-1">
            Current Password <span className="text-danger">*</span>
          </label>
          <div className="input-group">
            <input
              type={showCurrent ? "text" : "password"}
              className="form-control"
              placeholder="Enter existing password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowCurrent(!showCurrent)}
              aria-label="Toggle password visibility"
            >
              <i className={`bi ${showCurrent ? "bi-eye-slash" : "bi-eye"}`}></i>
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="form-label small fw-semibold text-dark mb-1">
            New Password <span className="text-danger">*</span>
          </label>
          <div className="input-group">
            <input
              type={showNew ? "text" : "password"}
              className="form-control"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setShowNew(!showNew)}
              aria-label="Toggle password visibility"
            >
              <i className={`bi ${showNew ? "bi-eye-slash" : "bi-eye"}`}></i>
            </button>
          </div>
        </div>

        {/* Real-time Strength Indicators */}
        <div className="p-3 bg-light rounded-3 border small">
          <span className="text-muted fw-semibold d-block mb-1">Password Strength Requirements:</span>
          <div className="row g-1">
            <div className="col-6">
              <i className={`bi ${hasMinLength ? "bi-check-circle-fill text-success" : "bi-circle text-muted"} me-1`}></i>
              <span className={hasMinLength ? "text-success fw-medium" : "text-muted"}>Min 8 characters</span>
            </div>
            <div className="col-6">
              <i className={`bi ${hasUpper ? "bi-check-circle-fill text-success" : "bi-circle text-muted"} me-1`}></i>
              <span className={hasUpper ? "text-success fw-medium" : "text-muted"}>1 uppercase (A-Z)</span>
            </div>
            <div className="col-6">
              <i className={`bi ${hasLower ? "bi-check-circle-fill text-success" : "bi-circle text-muted"} me-1`}></i>
              <span className={hasLower ? "text-success fw-medium" : "text-muted"}>1 lowercase (a-z)</span>
            </div>
            <div className="col-6">
              <i className={`bi ${hasNumber ? "bi-check-circle-fill text-success" : "bi-circle text-muted"} me-1`}></i>
              <span className={hasNumber ? "text-success fw-medium" : "text-muted"}>1 number (0-9)</span>
            </div>
          </div>
        </div>

        {/* Confirm New Password */}
        <div>
          <label className="form-label small fw-semibold text-dark mb-1">
            Confirm New Password <span className="text-danger">*</span>
          </label>
          <input
            type="password"
            className="form-control"
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {confirmPassword && (
            <small className={`d-block mt-1 ${isMatch ? "text-success" : "text-danger"}`}>
              {isMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
            </small>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !currentPassword || !hasMinLength || !hasUpper || !hasLower || !hasNumber || !isMatch}
            className="btn btn-jain-primary px-4 py-2 d-flex align-items-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span>Updating Password...</span>
              </>
            ) : (
              <>
                <i className="bi bi-key-fill"></i>
                <span>Update Password</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
