"use client";

import React, { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import {
  addUserAction,
  updateUserStatusAction,
  updateUserRoleAndSanghAction,
  adminResetUserPasswordAction,
} from "@/lib/actions/user-actions";
import { Role, UserStatus } from "@prisma/client";

interface AdminUserManagementProps {
  initialUsers: any[];
  sanghs: any[];
  adminId: string;
}

type ModalMode = "add" | "edit" | "password" | null;

export default function AdminUserManagementClient({
  initialUsers,
  sanghs,
  adminId,
}: AdminUserManagementProps) {
  const [users, setUsers] = useState<any[]>(initialUsers);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add User Form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("VOLUNTEER");
  const [newSanghId, setNewSanghId] = useState("");
  const [newCanExport, setNewCanExport] = useState(false);

  // Edit User Form
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("VOLUNTEER");
  const [editSanghId, setEditSanghId] = useState("");
  const [editCanExport, setEditCanExport] = useState(false);

  // Password Form & Reset State
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [generatedTempPassword, setGeneratedTempPassword] = useState<string | null>(null);
  const [tempPasswordCopied, setTempPasswordCopied] = useState(false);

  const resetAddForm = () => {
    setNewUsername("");
    setNewPassword("");
    setNewName("");
    setNewRole("VOLUNTEER");
    setNewSanghId("");
    setNewCanExport(false);
  };

  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const openAddModal = () => {
    clearMessages();
    resetAddForm();
    setModalMode("add");
  };

  const openEditModal = (u: any) => {
    clearMessages();
    setSelectedUser(u);
    setEditName(u.name || "");
    setEditRole(u.role);
    setEditSanghId(u.sanghId || "");
    setEditCanExport(Boolean(u.canExport));
    setModalMode("edit");
  };

  const openPasswordModal = (u: any) => {
    clearMessages();
    setSelectedUser(u);
    setNewPwd("");
    setConfirmPwd("");
    setShowNewPwd(false);
    setGeneratedTempPassword(null);
    setTempPasswordCopied(false);
    setModalMode("password");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedUser(null);
  };

  // ---- ADD USER ----
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (newRole === "TRUSTEE" && !newSanghId) {
      setErrorMsg("A Trustee must be assigned to exactly one Sangh.");
      return;
    }

    setLoading(true);

    const res = await addUserAction({
      username: newUsername,
      password: newPassword,
      name: newName,
      role: newRole,
      sanghId: newSanghId || null,
      canExport: newCanExport,
    });

    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || "Failed to add user.");
      return;
    }
    setUsers([res.user, ...users]);
    setSuccessMsg(`User "${res.user?.username}" created successfully.`);
    closeModal();
    resetAddForm();
  };

  // ---- EDIT USER ----
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    clearMessages();

    if (editRole === "TRUSTEE" && !editSanghId) {
      setErrorMsg("A Trustee must be assigned to exactly one Sangh.");
      return;
    }

    setLoading(true);

    const res = await updateUserRoleAndSanghAction(
      selectedUser.id,
      editRole,
      editSanghId || null,
      editName,
      editCanExport
    );

    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || "Failed to update user.");
      return;
    }
    setUsers(
      users.map((u) =>
        u.id === selectedUser.id
          ? {
              ...u,
              name: editName || u.name,
              role: editRole,
              sanghId: editSanghId || null,
              canExport: editCanExport,
            }
          : u
      )
    );
    setSuccessMsg(`User "${selectedUser.username}" updated successfully.`);
    closeModal();
  };

  // ---- TOGGLE USER STATUS ----
  const handleToggleStatus = async (user: any) => {
    clearMessages();
    const newStatus: UserStatus =
      user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    setLoading(true);

    const res = await updateUserStatusAction(user.id, newStatus);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to change user status.");
      return;
    }
    setUsers(
      users.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
    );
    setSuccessMsg(
      `User "${user.username}" is now ${
        newStatus === "ACTIVE" ? "Active" : "Disabled"
      }.`
    );
  };

  // ---- RESET USER PASSWORD (GENERATES TEMPORARY PASSWORD) ----
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    clearMessages();

    if (newPwd && newPwd.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await adminResetUserPasswordAction(
      selectedUser.id,
      newPwd.trim() || undefined
    );
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to reset password.");
      return;
    }

    setGeneratedTempPassword(res.temporaryPassword || "");
    setUsers(
      users.map((u) =>
        u.id === selectedUser.id ? { ...u, mustChangePassword: true } : u
      )
    );
    setSuccessMsg(
      `Temporary password generated for "${selectedUser.username}". User must change password upon next login.`
    );
  };

  return (
    <>
      {/* Notifications */}
      {successMsg && (
        <div
          className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-4"
          role="alert"
        >
          <i className="bi bi-check-circle-fill"></i>
          <span>{successMsg}</span>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setSuccessMsg(null)}
          ></button>
        </div>
      )}
      {errorMsg && (
        <div
          className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2 mb-4"
          role="alert"
        >
          <i className="bi bi-exclamation-triangle-fill"></i>
          <span>{errorMsg}</span>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setErrorMsg(null)}
          ></button>
        </div>
      )}

      {/* Main Card */}
      <div className="card-clean p-0 overflow-hidden shadow-sm">
        {/* Card Header */}
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center p-3 p-md-4 border-bottom gap-2">
          <div>
            <h4 className="fw-bold text-dark mb-1">System User Accounts</h4>
            <p className="text-muted small mb-0">
              Manage Volunteers, Trustees, and Administrators with role-based access control.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="btn btn-jain-primary d-flex align-items-center gap-2 px-3 align-self-start align-self-sm-auto shadow-sm"
            id="add-user-btn"
          >
            <i className="bi bi-person-plus-fill"></i>
            <span>Add User</span>
          </button>
        </div>

        {/* Users Table */}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-3">User</th>
                <th>Role</th>
                <th>Sangh Scope</th>
                <th>Status</th>
                <th>Last Login</th>
                <th className="text-end pe-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const isSelf = u.id === adminId;
                const assignedSangh = sanghs.find((s) => s.id === u.sanghId);
                return (
                  <tr key={u.id}>
                    <td className="ps-3">
                      <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle bg-light border p-2 text-primary fw-bold fs-6">
                          <i className="bi bi-person"></i>
                        </div>
                        <div>
                          <strong className="d-block text-dark">{u.name || u.username}</strong>
                          <span className="small text-muted font-monospace">{u.username}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge type="role" value={u.role} />
                      {u.role === "TRUSTEE" && (
                        <div className="mt-1">
                          {u.canExport ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: "0.68rem" }}>
                              Export: ON
                            </span>
                          ) : (
                            <span className="badge bg-light text-muted border" style={{ fontSize: "0.68rem" }}>
                              Export: OFF
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      {assignedSangh ? (
                        <span className="badge-sangh font-monospace">
                          {assignedSangh.prefix} — {assignedSangh.name}
                        </span>
                      ) : (
                        <span className="text-muted small">All Sanghs</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge type="status" value={u.status} />
                      {u.mustChangePassword && (
                        <div className="mt-1">
                          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle" style={{ fontSize: "0.68rem" }}>
                            <i className="bi bi-key me-1"></i>Reset Required
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="small text-muted">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                    </td>
                    <td className="text-end pe-3">
                      <div className="d-flex gap-1 justify-content-end flex-wrap">
                        {/* Edit */}
                        <button
                          onClick={() => openEditModal(u)}
                          disabled={loading}
                          className="btn btn-sm btn-outline-secondary"
                          title="Edit user"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        {/* Change Password */}
                        <button
                          onClick={() => openPasswordModal(u)}
                          disabled={loading}
                          className="btn btn-sm btn-outline-warning"
                          title="Change password"
                        >
                          <i className="bi bi-key"></i>
                        </button>
                        {/* Enable / Disable */}
                        {!isSelf && (
                          <button
                            onClick={() => handleToggleStatus(u)}
                            disabled={loading}
                            className={`btn btn-sm ${
                              u.status === "ACTIVE"
                                ? "btn-outline-danger"
                                : "btn-outline-success"
                            }`}
                            title={u.status === "ACTIVE" ? "Disable user" : "Enable user"}
                          >
                            {u.status === "ACTIVE" ? (
                              <i className="bi bi-slash-circle"></i>
                            ) : (
                              <i className="bi bi-check-circle"></i>
                            )}
                          </button>
                        )}
                        {isSelf && (
                          <span className="badge bg-light text-muted border small">You</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== ADD USER MODAL ===================== */}
      {modalMode === "add" && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <form onSubmit={handleAddUser}>
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title fw-bold text-dark">
                    <i className="bi bi-person-plus-fill me-2 text-primary"></i>Add New User
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeModal}
                    disabled={loading}
                  ></button>
                </div>
                <div className="modal-body py-3">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      Username <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      placeholder="e.g. trustee_msjs"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                      className="form-control"
                      autoFocus
                    />
                    <div className="form-text">Lowercase letters, numbers, underscores only.</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      Password <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="form-control"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="Full name (optional)"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="form-control"
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-dark">Role</label>
                      <select
                        value={newRole}
                        onChange={(e) => {
                          const r = e.target.value as Role;
                          setNewRole(r);
                          if (r === "TRUSTEE" && !newSanghId && sanghs.length > 0) {
                            setNewSanghId(sanghs[0].id);
                          }
                        }}
                        className="form-select"
                      >
                        <option value="VOLUNTEER">Volunteer</option>
                        <option value="TRUSTEE">Trustee (Sangh Scoped)</option>
                        <option value="ADMIN">Administrator</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-dark">
                        Assigned Sangh {newRole === "TRUSTEE" && <span className="text-danger">*</span>}
                      </label>
                      <select
                        value={newSanghId}
                        onChange={(e) => setNewSanghId(e.target.value)}
                        className="form-select"
                        required={newRole === "TRUSTEE"}
                      >
                        {newRole !== "TRUSTEE" && <option value="">All Sanghs</option>}
                        {sanghs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.prefix} - {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {newRole === "TRUSTEE" && (
                    <div className="p-3 bg-light border rounded-3 mb-3">
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="new-can-export"
                          checked={newCanExport}
                          onChange={(e) => setNewCanExport(e.target.checked)}
                        />
                        <label className="form-check-label small fw-semibold text-dark" htmlFor="new-can-export">
                          Allow CSV Data Export for this Sangh
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        When enabled, trustee can export family and member CSV reports for their assigned Sangh.
                      </small>
                    </div>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={closeModal}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-jain-primary px-4 fw-semibold"
                    disabled={loading}
                    id="submit-new-user-btn"
                  >
                    {loading ? "Creating..." : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================== EDIT USER MODAL ===================== */}
      {modalMode === "edit" && selectedUser && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <form onSubmit={handleEditUser}>
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title fw-bold text-dark">
                    <i className="bi bi-pencil-square me-2 text-secondary"></i>Edit User:{" "}
                    <span className="font-monospace">{selectedUser.username}</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeModal}
                    disabled={loading}
                  ></button>
                </div>
                <div className="modal-body py-3">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">Display Name</label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="form-control"
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-dark">Role</label>
                      <select
                        value={editRole}
                        onChange={(e) => {
                          const r = e.target.value as Role;
                          setEditRole(r);
                          if (r === "TRUSTEE" && !editSanghId && sanghs.length > 0) {
                            setEditSanghId(sanghs[0].id);
                          }
                        }}
                        className="form-select"
                      >
                        <option value="VOLUNTEER">Volunteer</option>
                        <option value="TRUSTEE">Trustee (Sangh Scoped)</option>
                        <option value="ADMIN">Administrator</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-dark">
                        Assigned Sangh {editRole === "TRUSTEE" && <span className="text-danger">*</span>}
                      </label>
                      <select
                        value={editSanghId}
                        onChange={(e) => setEditSanghId(e.target.value)}
                        className="form-select"
                        required={editRole === "TRUSTEE"}
                      >
                        {editRole !== "TRUSTEE" && <option value="">All Sanghs</option>}
                        {sanghs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.prefix} - {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {editRole === "TRUSTEE" && (
                    <div className="p-3 bg-light border rounded-3 mb-3">
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="edit-can-export"
                          checked={editCanExport}
                          onChange={(e) => setEditCanExport(e.target.checked)}
                        />
                        <label className="form-check-label small fw-semibold text-dark" htmlFor="edit-can-export">
                          Allow CSV Data Export for this Sangh
                        </label>
                      </div>
                      <small className="text-muted d-block mt-1">
                        When enabled, trustee can export family and member CSV reports for their assigned Sangh.
                      </small>
                    </div>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={closeModal}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary px-4 fw-semibold"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================== RESET PASSWORD MODAL ===================== */}
      {modalMode === "password" && selectedUser && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
        >
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <form onSubmit={handleResetPassword}>
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title fw-bold text-dark">
                    <i className="bi bi-key-fill me-2 text-warning"></i>Reset Password:{" "}
                    <span className="font-monospace">{selectedUser.username}</span>
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeModal}
                    disabled={loading}
                  ></button>
                </div>
                <div className="modal-body py-3">
                  {errorMsg && (
                    <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
                      {errorMsg}
                    </div>
                  )}

                  {/* If Temporary Password has been generated, show prominent copy box */}
                  {generatedTempPassword ? (
                    <div className="p-4 bg-warning-subtle border border-warning-subtle rounded-3 text-center my-2">
                      <i className="bi bi-shield-check text-success display-5 d-block mb-2"></i>
                      <h6 className="fw-bold text-dark mb-1">Temporary Password Created</h6>
                      <p className="text-muted small mb-3">
                        Give this password to <strong>{selectedUser.username}</strong>. They will be required to choose a new password on their next login.
                      </p>

                      <div className="p-3 bg-white border rounded font-monospace fs-4 fw-bold text-dark mb-3 select-all">
                        {generatedTempPassword}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedTempPassword);
                          setTempPasswordCopied(true);
                          setTimeout(() => setTempPasswordCopied(false), 2500);
                        }}
                        className="btn btn-outline-dark px-3 py-2 d-inline-flex align-items-center gap-2"
                      >
                        <i className={`bi ${tempPasswordCopied ? "bi-check2-circle text-success" : "bi-clipboard"}`}></i>
                        <span>{tempPasswordCopied ? "Copied to Clipboard!" : "Copy Temporary Password"}</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-light rounded-3 border small mb-3 text-secondary">
                        <i className="bi bi-shield-lock-fill text-primary me-2"></i>
                        <strong>One-Way Hash Protection:</strong> Existing passwords are never visible or retrievable. You can either specify a custom temporary password or leave it blank to auto-generate a secure key.
                      </div>

                      <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <label className="form-label small fw-semibold text-dark mb-0">
                            Custom Temporary Password (Optional)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const rand = Math.random().toString(36).slice(-6).toUpperCase();
                              setNewPwd(`Jin#${rand}9!`);
                            }}
                            className="btn btn-link btn-sm text-decoration-none py-0 px-1 text-primary small"
                          >
                            <i className="bi bi-shuffle me-1"></i>Generate Random
                          </button>
                        </div>
                        <div className="input-group">
                          <input
                            type={showNewPwd ? "text" : "password"}
                            placeholder="Leave blank to auto-generate"
                            value={newPwd}
                            onChange={(e) => setNewPwd(e.target.value)}
                            className="form-control"
                            autoComplete="off"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setShowNewPwd((v) => !v)}
                            tabIndex={-1}
                          >
                            <i className={`bi ${showNewPwd ? "bi-eye-slash" : "bi-eye"}`}></i>
                          </button>
                        </div>
                        <small className="text-muted d-block mt-1">
                          Must be at least 8 characters with letters, numbers, and symbols if entered manually.
                        </small>
                      </div>

                      <div className="alert alert-info py-2 px-3 small mb-0">
                        <i className="bi bi-info-circle me-1"></i>
                        The user will be flagged with <strong>Must Change Password</strong> and required to reset it upon login.
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0">
                  {generatedTempPassword ? (
                    <button
                      type="button"
                      className="btn btn-jain-primary px-4 fw-semibold"
                      onClick={closeModal}
                    >
                      Done
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn-light"
                        onClick={closeModal}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-warning px-4 fw-semibold"
                        disabled={loading}
                      >
                        {loading ? "Resetting..." : "Reset & Issue Temporary Password"}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
