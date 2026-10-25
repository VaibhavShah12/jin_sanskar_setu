"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import React, { useEffect, useState, Suspense } from "react";
import Logo from "@/components/Logo";

function LoginFormContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const errorParam = searchParams.get("error");
  const registeredParam = searchParams.get("registered");

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  // Map URL error and status params from NextAuth
  useEffect(() => {
    if (registeredParam === "trustee_pending") {
      setError("Registration submitted successfully! Your account is pending Administrator verification before login is enabled.");
    } else if (errorParam === "CredentialsSignin") {
      setError("Invalid username or password. Please try again.");
    } else if (errorParam === "ACCOUNT_PENDING_APPROVAL") {
      setError("Your Trustee account is pending verification by the Administrator. Please wait for approval before logging in.");
    } else if (errorParam === "ACCOUNT_DISABLED") {
      setError("Your account has been disabled. Contact your administrator.");
    } else if (errorParam === "TRUSTEE_NO_SANGH") {
      setError("Trustee account has no assigned Sangh. Please contact your administrator.");
    }
  }, [errorParam, registeredParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      setLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        username: username.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "ACCOUNT_PENDING_APPROVAL") {
          setError("Your Trustee account is pending verification by the Administrator. Once verified, you will be able to log in.");
        } else if (result.error === "ACCOUNT_DISABLED") {
          setError("Your account has been disabled. Contact your Sangh administrator.");
        } else {
          setError("Invalid username or password. Please try again.");
        }
        setLoading(false);
        return;
      }

      if (result?.ok) {
        router.push("/dashboard");
      }
    } catch (err) {
      setError("A connection error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="text-center p-5">
        <div className="spinner-border text-warning" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card-clean card-accent-top shadow-elevated overflow-hidden">
      {/* Header */}
      <div className="text-center p-4 pb-0">
        <div className="mb-3 d-flex justify-content-center">
          <Logo size={68} />
        </div>
        <h1 className="brand-title h3 mb-1">Jin Sanskar Setu</h1>
        <p className="brand-hindi fs-5 mb-1">जिन संस्कार सेतु</p>
        <p className="text-muted small mb-0">
          Connecting Families • Strengthening Sangh • Nurturing Sanskars
        </p>
      </div>

      {/* Form */}
      <div className="p-4">
        {/* Error Banner */}
        {error && (
          <div
            className="alert alert-danger py-2 px-3 small d-flex align-items-start gap-2 mb-3"
            role="alert"
          >
            <i className="bi bi-exclamation-triangle-fill mt-1 flex-shrink-0"></i>
            <span>{error}</span>
          </div>
        )}

        {/* Access Notice */}
        <div className="bg-light border rounded-3 p-3 mb-4 small text-secondary">
          <div className="d-flex align-items-start gap-2">
            <i className="bi bi-shield-check text-primary fs-6 lh-1 mt-1 flex-shrink-0"></i>
            <div>
              <strong className="d-block text-dark mb-1">Authorized Access Only</strong>
              Access is restricted to verified Sangh survey volunteers. Login credentials are
              provided by your Sangh administrator.
            </div>
          </div>
        </div>

        <form onSubmit={handleLogin} noValidate>
          {/* Username */}
          <div className="mb-3">
            <label htmlFor="login-username" className="form-label fw-semibold text-dark">
              <i className="bi bi-person me-1"></i>Username
            </label>
            <input
              id="login-username"
              type="text"
              className="form-control form-control-lg"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              disabled={loading}
              style={{ fontSize: "1rem" }}
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label htmlFor="login-password" className="form-label fw-semibold text-dark">
              <i className="bi bi-lock me-1"></i>Password
            </label>
            <div className="input-group">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="form-control form-control-lg"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
                style={{ fontSize: "1rem" }}
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="login-submit-btn"
            className="btn btn-jain-primary btn-lg w-100 fw-semibold d-flex align-items-center justify-content-center gap-2"
            disabled={loading}
            style={{ minHeight: "52px" }}
          >
            {loading ? (
              <>
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Logging in...</span>
                </div>
                <span>Logging in...</span>
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right fs-5"></i>
                <span>Login</span>
              </>
            )}
          </button>
        </form>

        {/* Trustee Registration Link */}
        <div className="mt-4 pt-3 border-top text-center">
          <p className="small text-muted mb-2">Are you a Jain Sangh Trustee?</p>
          <Link
            href="/register-trustee"
            id="register-trustee-link"
            className="btn btn-outline-primary btn-sm px-3 py-2 fw-semibold d-inline-flex align-items-center gap-2"
          >
            <i className="bi bi-person-badge"></i>
            <span>Register for Trustee Access</span>
          </Link>
          <div className="text-muted small mt-2" style={{ fontSize: "0.75rem" }}>
            <i className="bi bi-shield-check me-1"></i>
            Trustee requests are verified by the Administrator prior to login activation.
          </div>
        </div>

        <p className="text-center text-muted small mt-4 mb-0">
          <i className="bi bi-database-fill-lock me-1"></i>
          Secured by Neon PostgreSQL
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="container py-4 py-md-5 d-flex align-items-center justify-content-center"
      style={{ minHeight: "85vh" }}
    >
      <div className="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4">
        <Suspense
          fallback={
            <div className="text-center p-5">
              <div className="spinner-border text-warning" role="status"></div>
            </div>
          }
        >
          <LoginFormContent />
        </Suspense>
      </div>
    </div>
  );
}
