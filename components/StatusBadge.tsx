import React from "react";

interface StatusBadgeProps {
  type: "pathshala" | "interest" | "role" | "status" | "gender" | "sync";
  value: string;
}

export default function StatusBadge({ type, value }: StatusBadgeProps) {
  if (type === "pathshala") {
    switch (value) {
      case "YES":
        return <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1"><i className="bi bi-check-circle-fill me-1"></i>Attending</span>;
      case "NO":
        return <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1"><i className="bi bi-x-circle-fill me-1"></i>Not Attending</span>;
      case "PREVIOUSLY_ATTENDED":
        return <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1"><i className="bi bi-clock-history me-1"></i>Previously</span>;
      default:
        return <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1">Unknown</span>;
    }
  }

  if (type === "interest") {
    switch (value) {
      case "YES":
        return <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">Interested</span>;
      case "MAYBE":
        return <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2 py-1">Maybe</span>;
      case "NO":
        return <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1">Not Interested</span>;
      default:
        return <span className="badge bg-light text-muted border px-2 py-1">Unknown</span>;
    }
  }

  if (type === "role") {
    return value === "ADMIN" ? (
      <span className="badge bg-purple-subtle text-primary border border-primary-subtle px-2 py-1 font-monospace">ADMIN</span>
    ) : (
      <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1 font-monospace">VOLUNTEER</span>
    );
  }

  if (type === "status") {
    return value === "ACTIVE" ? (
      <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">Active</span>
    ) : (
      <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">Disabled</span>
    );
  }

  if (type === "sync") {
    switch (value) {
      case "SYNCED":
        return <span className="badge bg-success text-white px-2 py-1"><i className="bi bi-cloud-check-fill me-1"></i>Synced</span>;
      case "FAILED":
        return <span className="badge bg-danger text-white px-2 py-1"><i className="bi bi-exclamation-triangle-fill me-1"></i>Failed</span>;
      default:
        return <span className="badge bg-warning text-dark px-2 py-1"><i className="bi bi-hourglass-split me-1"></i>Pending</span>;
    }
  }

  return <span className="badge bg-secondary px-2 py-1">{value}</span>;
}
