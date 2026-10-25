"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import React, { useState } from "react";
import Logo from "@/components/Logo";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // While registering for trustee without an active session, no navbar above is needed
  if (pathname === "/register-trustee" && !session?.user) {
    return null;
  }

  // If on login or unauthorized page, render minimal header
  if (pathname === "/login" || pathname === "/unauthorized") {
    return (
      <header className="py-3 bg-white border-bottom shadow-sm">
        <div className="container text-center">
          <Link href="/" className="text-decoration-none d-inline-flex align-items-center gap-2">
            <Logo size={40} />
            <div className="text-start">
              <span className="brand-title fs-4 d-block">Jin Sanskar Setu</span>
              <small className="brand-hindi d-block">जिन संस्कार सेतु</small>
            </div>
          </Link>
        </div>
      </header>
    );
  }

  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";
  const isTrustee = user?.role === "TRUSTEE";
  const canExport = isAdmin || user?.role === "VOLUNTEER" || (isTrustee && Boolean(user?.canExport));

  const isActive = (path: string) => {
    if (path === "/dashboard" && pathname === "/dashboard") return true;
    if (path !== "/dashboard" && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <>
      {/* Top Navbar */}
      <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom shadow-sm sticky-top">
        <div className="container-fluid px-3 px-lg-4">
          <Link href="/dashboard" className="navbar-brand d-flex align-items-center gap-2">
            <Logo size={36} />
            <div>
              <span className="brand-title fs-5 d-block lh-sm">Jin Sanskar Setu</span>
              <small className="brand-hindi d-block fs-8 lh-1">जिन संस्कार सेतु</small>
            </div>
          </Link>

          {/* Mobile Right: Add Family button & Menu toggle */}
          <div className="d-flex align-items-center gap-2 d-lg-none">
            {!isTrustee && (
              <Link
                href="/families/new"
                className="btn btn-jain-primary btn-sm px-3 d-flex align-items-center gap-1 shadow-sm"
                id="mobile-header-add-family"
              >
                <i className="bi bi-person-plus-fill"></i>
                <span>Add</span>
              </Link>
            )}
            <button
              className="btn btn-outline-secondary btn-sm p-2"
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              <i className={`bi ${mobileMenuOpen ? "bi-x-lg" : "bi-list"} fs-5`}></i>
            </button>
          </div>

          {/* Desktop Links */}
          <div className="collapse navbar-collapse d-none d-lg-flex" id="navbarNav">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-3">
              <li className="nav-item">
                <Link
                  href="/dashboard"
                  className={`nav-link px-3 fw-medium ${isActive("/dashboard") ? "active text-primary fw-bold" : ""}`}
                >
                  <i className="bi bi-speedometer2 me-1"></i> Dashboard
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  href="/families"
                  className={`nav-link px-3 fw-medium ${isActive("/families") && pathname !== "/families/new" ? "active text-primary fw-bold" : ""}`}
                >
                  <i className="bi bi-people me-1"></i> Families
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  href="/members"
                  className={`nav-link px-3 fw-medium ${isActive("/members") ? "active text-primary fw-bold" : ""}`}
                >
                  <i className="bi bi-person-lines-fill me-1"></i> Members
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  href="/search"
                  className={`nav-link px-3 fw-medium ${isActive("/search") ? "active text-primary fw-bold" : ""}`}
                >
                  <i className="bi bi-search me-1"></i> Search
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  href="/analytics"
                  className={`nav-link px-3 fw-medium ${isActive("/analytics") ? "active text-primary fw-bold" : ""}`}
                >
                  <i className="bi bi-pie-chart-fill me-1"></i> Analytics
                </Link>
              </li>
              {!isTrustee && (
                <li className="nav-item">
                  <Link
                    href="/admin/qr-code"
                    className={`nav-link px-3 fw-medium ${isActive("/admin/qr-code") ? "active text-primary fw-bold" : ""}`}
                  >
                    <i className="bi bi-qr-code me-1 text-primary"></i> Portal QR
                  </Link>
                </li>
              )}
              {canExport && (
                <li className="nav-item">
                  <Link
                    href="/export"
                    className={`nav-link px-3 fw-medium ${isActive("/export") ? "active text-primary fw-bold" : ""}`}
                  >
                    <i className="bi bi-file-earmark-spreadsheet me-1"></i> Export
                  </Link>
                </li>
              )}

              {/* Admin Menu */}
              {isAdmin && (
                <li className="nav-item dropdown">
                  <a
                    className="nav-link dropdown-toggle px-3 fw-medium text-dark"
                    href="#"
                    role="button"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                  >
                    <i className="bi bi-shield-lock-fill me-1 text-primary"></i> Admin
                  </a>
                  <ul className="dropdown-menu shadow border-0">
                    <li>
                      <Link href="/admin/users" className="dropdown-item py-2">
                        <i className="bi bi-person-gear me-2"></i> User Management
                      </Link>
                    </li>
                    <li>
                      <Link href="/admin/qr-code" className="dropdown-item py-2">
                        <i className="bi bi-qr-code me-2"></i> Member Access QR
                      </Link>
                    </li>
                    <li>
                      <Link href="/admin/audit-logs" className="dropdown-item py-2">
                        <i className="bi bi-clock-history me-2"></i> Audit Logs
                      </Link>
                    </li>
                    <li>
                      <Link href="/admin/sync" className="dropdown-item py-2">
                        <i className="bi bi-arrow-repeat me-2"></i> Sheet Sync
                      </Link>
                    </li>
                    <li>
                      <hr className="dropdown-divider" />
                    </li>
                    <li>
                      <Link href="/settings" className="dropdown-item py-2">
                        <i className="bi bi-gear-fill me-2"></i> Settings
                      </Link>
                    </li>
                  </ul>
                </li>
              )}
            </ul>

            {/* Desktop Actions */}
            <div className="d-flex align-items-center gap-3">
              {!isTrustee && (
                <Link
                  href="/families/new"
                  className="btn btn-jain-primary d-flex align-items-center gap-2 shadow-sm px-3"
                  id="desktop-add-family-btn"
                >
                  <i className="bi bi-person-plus-fill"></i>
                  <span>Add Family</span>
                </Link>
              )}

              {user ? (
                <div className="d-flex align-items-center gap-2 border-start ps-3">
                  <div className="text-end d-none d-xl-block">
                    <span className="d-block fw-semibold text-dark small lh-1">{user.name || user.username}</span>
                    <span className="badge bg-light text-secondary border mt-1">
                      {isAdmin ? "Admin" : isTrustee ? `${user.sanghPrefix || ""} Trustee` : user.sanghPrefix || "Volunteer"}
                    </span>
                  </div>
                  <Link
                    href="/change-password"
                    className="btn btn-outline-secondary btn-sm"
                    title="Change Password"
                    aria-label="Change Password"
                  >
                    <i className="bi bi-key-fill"></i>
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="btn btn-outline-danger btn-sm"
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <i className="bi bi-box-arrow-right"></i>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu when toggled */}
        {mobileMenuOpen && (
          <div className="d-lg-none w-100 bg-white border-top px-3 py-3 shadow-lg">
            <div className="mb-3 pb-3 border-bottom d-flex align-items-center justify-content-between">
              <div>
                <strong className="d-block text-dark">{user?.name || user?.username}</strong>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                  {user?.role} {user?.sanghPrefix ? `• ${user?.sanghPrefix}` : ""}
                </span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="btn btn-outline-danger btn-sm"
              >
                <i className="bi bi-box-arrow-right me-1"></i> Sign out
              </button>
            </div>

            <div className="list-group list-group-flush mb-3">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`list-group-item list-group-item-action border-0 py-2 ${isActive("/dashboard") ? "fw-bold text-primary" : ""}`}
              >
                <i className="bi bi-speedometer2 me-2"></i> Dashboard
              </Link>
              <Link
                href="/families"
                onClick={() => setMobileMenuOpen(false)}
                className={`list-group-item list-group-item-action border-0 py-2 ${isActive("/families") && pathname !== "/families/new" ? "fw-bold text-primary" : ""}`}
              >
                <i className="bi bi-people me-2"></i> Families Directory
              </Link>
              <Link
                href="/members"
                onClick={() => setMobileMenuOpen(false)}
                className={`list-group-item list-group-item-action border-0 py-2 ${isActive("/members") ? "fw-bold text-primary" : ""}`}
              >
                <i className="bi bi-person-lines-fill me-2"></i> Members Directory
              </Link>
              <Link
                href="/search"
                onClick={() => setMobileMenuOpen(false)}
                className={`list-group-item list-group-item-action border-0 py-2 ${isActive("/search") ? "fw-bold text-primary" : ""}`}
              >
                <i className="bi bi-search me-2"></i> Search & Filters
              </Link>
              <Link
                href="/analytics"
                onClick={() => setMobileMenuOpen(false)}
                className={`list-group-item list-group-item-action border-0 py-2 ${isActive("/analytics") ? "fw-bold text-primary" : ""}`}
              >
                <i className="bi bi-pie-chart-fill me-2"></i> Community Analytics
              </Link>
              {canExport && (
                <Link
                  href="/export"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`list-group-item list-group-item-action border-0 py-2 ${isActive("/export") ? "fw-bold text-primary" : ""}`}
                >
                  <i className="bi bi-file-earmark-spreadsheet me-2"></i> CSV Export
                </Link>
              )}

              {!isTrustee && (
                <Link
                  href="/admin/qr-code"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`list-group-item list-group-item-action border-0 py-2 ${isActive("/admin/qr-code") ? "fw-bold text-primary" : ""}`}
                >
                  <i className="bi bi-qr-code me-2 text-primary"></i> Portal QR Code
                </Link>
              )}

              <Link
                href="/change-password"
                onClick={() => setMobileMenuOpen(false)}
                className={`list-group-item list-group-item-action border-0 py-2 ${isActive("/change-password") ? "fw-bold text-primary" : ""}`}
              >
                <i className="bi bi-key-fill me-2 text-warning-emphasis"></i> Change Password
              </Link>

              {isAdmin && (
                <>
                  <div className="text-muted small fw-bold text-uppercase px-3 pt-3 pb-1">
                    Administration
                  </div>
                  <Link
                    href="/admin/users"
                    onClick={() => setMobileMenuOpen(false)}
                    className="list-group-item list-group-item-action border-0 py-2"
                  >
                    <i className="bi bi-person-gear me-2 text-primary"></i> User Management
                  </Link>
                  <Link
                    href="/admin/qr-code"
                    onClick={() => setMobileMenuOpen(false)}
                    className="list-group-item list-group-item-action border-0 py-2"
                  >
                    <i className="bi bi-qr-code me-2 text-primary"></i> Member Access QR
                  </Link>
                  <Link
                    href="/admin/audit-logs"
                    onClick={() => setMobileMenuOpen(false)}
                    className="list-group-item list-group-item-action border-0 py-2"
                  >
                    <i className="bi bi-clock-history me-2 text-primary"></i> Audit Trail
                  </Link>
                  <Link
                    href="/admin/sync"
                    onClick={() => setMobileMenuOpen(false)}
                    className="list-group-item list-group-item-action border-0 py-2"
                  >
                    <i className="bi bi-arrow-repeat me-2 text-primary"></i> Google Sheet Sync
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="list-group-item list-group-item-action border-0 py-2"
                  >
                    <i className="bi bi-gear-fill me-2 text-primary"></i> Settings & Sanghs
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Must Change Password Alert Banner */}
      {user?.mustChangePassword && pathname !== "/change-password" && (
        <div className="bg-warning text-dark py-2 px-3 text-center small fw-semibold border-bottom shadow-sm">
          <i className="bi bi-shield-exclamation me-2 fs-6 align-middle"></i>
          Password change required: An administrator has issued a temporary password for your account.{" "}
          <Link href="/change-password" className="text-dark text-decoration-underline ms-1 fw-bold">
            Set Your New Password Now &rarr;
          </Link>
        </div>
      )}

      {/* Floating Action Button (FAB) for Mobile Quick Add */}
      {!isTrustee && (
        <Link
          href="/families/new"
          className="mobile-fab-add"
          id="mobile-fab-add-family"
          aria-label="Add New Family"
          title="Add New Family"
        >
          <i className="bi bi-plus-lg"></i>
        </Link>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <div className="mobile-bottom-nav">
        <Link
          href="/dashboard"
          className={`mobile-bottom-item ${isActive("/dashboard") ? "active" : ""}`}
        >
          <i className="bi bi-speedometer2"></i>
          <span>Home</span>
        </Link>
        <Link
          href="/families"
          className={`mobile-bottom-item ${isActive("/families") && pathname !== "/families/new" ? "active" : ""}`}
        >
          <i className="bi bi-people"></i>
          <span>Families</span>
        </Link>
        <Link
          href="/search"
          className={`mobile-bottom-item ${isActive("/search") ? "active" : ""}`}
        >
          <i className="bi bi-search"></i>
          <span>Search</span>
        </Link>
        <Link
          href="/analytics"
          className={`mobile-bottom-item ${isActive("/analytics") ? "active" : ""}`}
        >
          <i className="bi bi-pie-chart-fill"></i>
          <span>Analytics</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="mobile-bottom-item border-0 bg-transparent"
        >
          <i className="bi bi-grid-fill"></i>
          <span>Menu</span>
        </button>
      </div>
    </>
  );
}
