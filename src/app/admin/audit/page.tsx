"use client";

import { useEffect, useState } from "react";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTable,
} from "@/components/admin/admin-ui";
import { RequireAdmin } from "@/components/auth/require-admin";
import { listAuditLogs } from "@/services/audit.service";
import type { AuditLog } from "@/types/admin";

export default function AdminAuditPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listAuditLogs(150)
      .then(setItems)
      .catch(() => setError("Could not load audit logs."));
  }, []);

  return (
    <RequireAdmin permission="audit:read">
      <AdminPageHeader
        title="Audit log"
        description="Product, order, coupon, banner and settings changes recorded for accountability."
      />
      {error ? (
        <p className="text-sm text-primary" role="alert">
          {error}
        </p>
      ) : null}
      {!items.length && !error ? (
        <AdminEmpty
          title="No audit entries yet"
          description="Admin write actions will appear here."
        />
      ) : (
        <AdminTable
          headers={["When", "Actor", "Action", "Resource", "Details"]}
        >
          {items.map((item) => (
            <tr key={item.id} className="text-[13px]">
              <td className="px-4 py-3 text-muted">
                {item.createdAt instanceof Date
                  ? item.createdAt.toLocaleString()
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <p className="text-ink">{item.actorEmail || item.actorId}</p>
              </td>
              <td className="px-4 py-3 text-ink">{item.action}</td>
              <td className="px-4 py-3 text-muted">
                {item.resourceType}
                {item.resourceId ? ` · ${item.resourceId}` : ""}
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-muted">
                {item.newValue
                  ? JSON.stringify(item.newValue).slice(0, 120)
                  : "—"}
              </td>
            </tr>
          ))}
        </AdminTable>
      )}
    </RequireAdmin>
  );
}
