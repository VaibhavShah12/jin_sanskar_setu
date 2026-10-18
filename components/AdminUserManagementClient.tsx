"use client";

import React, { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import {
  addUserAction,
  updateUserStatusAction,
  updateUserRoleAndSanghAction,
  changePasswordAction,
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

  // Edit User Form
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("VOLUNTEER");
  const [editSanghId, setEditSanghId] = useState("");

  // Password Form
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showNewPwd, setShowNewPwd] = useState(false);

  const resetAddForm = () => {
    setNewUsername("");
    setNewPassword("");
    setNewName("");
    setNewRole("VOLUNTEER");
    setNewSanghId("");
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
    setModalMode("edit");
  };

  const openPasswordModal = (u: any) => {
    clearMessages();
    setSelectedUser(u);
    setNewPwd("");
    setConfirmPwd("");
    setShowNewPwd(false);
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
    setLoading(true);

    const res = await addUserAction({
      username: newUsername,
      password: newPassword,
      name: newName,
      role: newRole,
      sanghId: newSanghId || null,
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
    setLoading(true);

    const res = await updateUserRoleAndSanghAction(
      selectedUser.id,
      editRole,
      editSanghId || null,
      editName
    );

    setLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || "Failed to update user.");
      return;
    }
    setUsers(
      users.map((u) =>
        u.id === selectedUser.id
          ? { ...u, name: editName || u.name, role: editRole, sanghId: editSanghId || null }
          : u
      )
    );
    setSuccessMsg(`User "${selectedUser.username}" updated successfully.`);
    closeModal();
  };

  // ---- CHANGE PASSWORD ----
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    clearMessages();

    if (newPwd !== confirmPwd) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (newPwd.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await changePasswordAction(selectedUser.id, newPwd);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to change password.");
      return;
    }
    setSuccessMsg(`Password for "${selectedUser.username}" changed successfully.`);
    closeModal();
  };

  // ---- TOGGLE STATUS ----
  const handleToggleStatus = async (u: any) => {
    clearMessages();
    const targetStatus = u.status === "ACTIVE" ? UserStatus.DISABLED : UserStatus.ACTIVE;
    setLoading(true);

    const res = await updateUserStatusAction(u.id, targetStatus);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to update status.");
      return;
    }
    setUsers(users.map((usr) => (usr.id === u.id ? { ...usr, status: targetStatus } : usr)));
    setSuccessMsg(
      `${u.username} is now ${targetStatus === "ACTIVE" ? "enabled" : "disabled"}.`
    );
  };

  return (
    <>
      {/* Alert messages */}
      {errorMsg && (
        <div
          className="alert alert-danger py-2 px-3 small mb-3 d-flex align-items-center justify-content-between"
          role="alert"
        >
          <span>
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {errorMsg}
          </span>
          <button type="button" className="btn-close" onClick={() => setErrorMsg(null)}></button>
        </div>
      )}
      {successMsg && (
        <div
          className="alert alert-success py-2 px-3 small mb-3 d-flex align-items-center justify-content-between"
          role="alert"
        >
          <span>
            <i className="bi bi-check-circle-fill me-2"></i>
            {successMsg}
          </span>
          <button
            type="button"
            className="btn-close"
            onClick={() => setSuccessMsg(null)}
          ></button>
        </div>
      )}

      <div className="card-clean p-4 mb-4 bg-white">
        {/* Header row */}
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
          <div>
            <h4 className="fw-bold text-dark mb-1">Authorized Volunteers &amp; Admins</h4>
            <p className="text-muted small mb-0">
              Only users listed here with ACTIVE status can log in to Jin Sanskar Setu.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="btn btn-jain-primary d-flex align-items-center gap-2 shadow-sm"
            id="open-add-user-modal-btn"
          >
            <i className="bi bi-person-plus-fill"></i>
            <span>Add Volunteer</span>
          </button>
        </div>

        {/* User table */}
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="ps-3">User</th>
                <th>Role</th>
                <th>Sangh</th>
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
                    <i className="bi bi-person-plus-fill me-2 text-primary"></i>Add New Volunteer
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
                      placeholder="e.g. volunteer5"
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
                        onChange={(e) => setNewRole(e.target.value as Role)}
                        className="form-select"
                      >
                        <option value="VOLUNTEER">Volunteer</option>
                        <option value="ADMIN">Administrator</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-dark">
                        Assign Sangh
                      </label>
                      <select
                        value={newSanghId}
                        onChange={(e) => setNewSanghId(e.target.value)}
                        className="form-select"
                      >
                        <option value="">All Sanghs</option>
                        {sanghs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.prefix} - {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
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
                        onChange={(e) => setEditRole(e.target.value as Role)}
                        className="form-select"
                      >
                        <option value="VOLUNTEER">Volunteer</option>
                        <option value="ADMIN">Administrator</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-dark">
                        Assigned Sangh
                      </label>
                      <select
                        value={editSanghId}
                        onChange={(e) => setEditSanghId(e.target.value)}
                        className="form-select"
                      >
                        <option value="">All Sanghs</option>
                        {sanghs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.prefix} - {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
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

      {/* ===================== CHANGE PASSWORD MODAL ===================== */}
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
              <form onSubmit={handleChangePassword}>
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title fw-bold text-dark">
                    <i className="bi bi-key-fill me-2 text-warning"></i>Change Password:{" "}
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
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      New Password <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        type={showNewPwd ? "text" : "password"}
                        required
                        minLength={8}
                        placeholder="Minimum 8 characters"
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                        className="form-control"
                        autoComplete="new-password"
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
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-dark">
                      Confirm Password <span className="text-danger">*</span>
                    </label>
                    <input
                      type={showNewPwd ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Re-enter new password"
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      className="form-control"
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="alert alert-warning py-2 px-3 small">
                    <i className="bi bi-info-circle me-1"></i>
                    The user will need to use the new password on their next login.
                  </div>
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
                    className="btn btn-warning px-4 fw-semibold"
                    disabled={loading}
                  >
                    {loading ? "Changing..." : "Change Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
