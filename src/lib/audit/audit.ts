import type { Database } from "@/lib/db/client";
import { getDb } from "@/lib/db/client";
import { createId } from "@/lib/ids";
import { auditLogs } from "@/db/schema";

export type AuditEntry = {
  organizationId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
  ipHash?: string | null;
  userAgent?: string | null;
};

function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export async function writeAudit(entry: AuditEntry, db: Database = getDb()): Promise<void> {
  await db.insert(auditLogs).values({
    id: createId("aud"),
    organizationId: entry.organizationId,
    branchId: entry.branchId ?? null,
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    beforeData: serialize(entry.beforeData),
    afterData: serialize(entry.afterData),
    metadata: serialize(entry.metadata),
    ipHash: entry.ipHash ?? null,
    userAgent: entry.userAgent ?? null,
    createdAt: new Date(),
  });
}

export async function writeAuditBestEffort(entry: AuditEntry, db: Database = getDb()): Promise<void> {
  try {
    await writeAudit(entry, db);
  } catch (error) {
    console.error("Audit write failed", { action: entry.action, error });
  }
}
