import { AuditAction, AuditActorType, Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { logger } from "@/lib/logger";

interface AuditInput {
  actorType?: AuditActorType;
  actorId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: input.actorType ?? AuditActorType.USER,
        actorId: input.actorId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        description: input.description,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue
      }
    });
  } catch (error) {
    logger.error("Failed to write audit log", {
      action: input.action,
      resource: input.resource,
      error: String(error)
    });
  }
}