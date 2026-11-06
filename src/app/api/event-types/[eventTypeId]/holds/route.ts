import { createHash } from "node:crypto";
import { db } from "@/db";
import {
  eventTypes,
  hosts,
  availabilityRules,
  availabilityOverrides,
  holds,
  bookings,
} from "@/db/schema";

import { and, eq, gt, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { generateCandidateSlots } from "@/lib/slots";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventTypeId: string }> }
) {
  try {
    const { eventTypeId } = await params;

    const idempotencyKey = request.headers.get("Idempotency-Key");

    if (!idempotencyKey || idempotencyKey.length > 255) {
      return Response.json(
        { success: false, message: "A valid Idempotency-Key header is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { slotStart } = body;

    if (
      typeof slotStart !== "string" ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(slotStart)
    ) {
      return Response.json(
        { success: false, message: "slotStart must be an ISO timestamp with timezone" },
        { status: 400 }
      );
    }

    const requestedStart = DateTime.fromISO(slotStart, { setZone: true });

    if (!requestedStart.isValid) {
      return Response.json(
        { success: false, message: "Invalid slotStart" },
        { status: 400 }
      );
    }

    
    const slotStartDate = requestedStart.toUTC().toJSDate();

    const requestHash = createHash("sha256")
      .update(`${eventTypeId}:${slotStartDate.toISOString()}`)
      .digest("hex");

    const result = await db.transaction(async (tx) => {
      // Serialize booking attempts for this event type.
      const [event] = await tx
        .select()
        .from(eventTypes)
        .where(eq(eventTypes.id, eventTypeId))
        .limit(1);

      if (!event || !event.active) {
        throw new Error("EVENT_NOT_FOUND");
      }

      await tx.execute(
        sql`SELECT id FROM event_types WHERE id = ${eventTypeId} FOR UPDATE`
      );

      // Handle retries using the same idempotency key.
      const [existingHold] = await tx
        .select()
        .from(holds)
        .where(eq(holds.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existingHold) {
        if (existingHold.requestHash !== requestHash) {
          throw new Error("IDEMPOTENCY_CONFLICT");
        }

        if (
          existingHold.status === "expired" ||
          (existingHold.status === "active" &&
            existingHold.expiresAt <= new Date())
        ) {
          throw new Error("HOLD_EXPIRED");
        }

        return { hold: existingHold, reused: true };
      }

      const [host] = await tx
        .select()
        .from(hosts)
        .where(eq(hosts.id, event.hostId))
        .limit(1);

      if (!host) {
        throw new Error("HOST_NOT_FOUND");
      }

      const localDate = DateTime.fromJSDate(slotStartDate, {
        zone: host.timezone,
        });

        if (!localDate.isValid) {
        throw new Error("INVALID_SLOT_DATE");
        }

      const slotDate = localDate.toISODate()!;

      const weekday = localDate.weekday % 7;

      const [override] = await tx
        .select()
        .from(availabilityOverrides)
        .where(
          and(
            eq(availabilityOverrides.hostId, host.id),
            eq(availabilityOverrides.overrideDate, slotDate)
          )
        )
        .limit(1);

      let startTime: string;
      let endTime: string;

      if (override) {
        if (!override.isAvailable) {
          throw new Error("HOST_UNAVAILABLE");
        }

        startTime = override.startTime!;
        endTime = override.endTime!;
      } else {
        const [rule] = await tx
          .select()
          .from(availabilityRules)
          .where(
            and(
              eq(availabilityRules.hostId, host.id),
              eq(availabilityRules.weekday, weekday)
            )
          )
          .limit(1);

        if (!rule) {
          throw new Error("HOST_UNAVAILABLE");
        }

        startTime = rule.startTime;
        endTime = rule.endTime;
      }

      const candidates = generateCandidateSlots({
        date: slotDate,
        timezone: host.timezone,
        startTime,
        endTime,
        duration: event.duration,
        bufferBefore: event.bufferBefore,
        bufferAfter: event.bufferAfter,
        minNotice: event.minNotice,
        bookingHorizon: event.bookingHorizon,
      });

      const validSlot = candidates.some(
        (candidate) =>
          DateTime.fromISO(candidate.start!).toMillis() ===
          slotStartDate.getTime()
      );

      if (!validSlot) {
        throw new Error("SLOT_UNAVAILABLE");
      }

      const now = new Date();

      const activeHolds = await tx
        .select({ slotStart: holds.slotStart })
        .from(holds)
        .where(
          and(
            eq(holds.eventTypeId, event.id),
            eq(holds.status, "active"),
            gt(holds.expiresAt, now)
          )
        );

      const confirmedBookings = await tx
        .select({ slotStart: holds.slotStart })
        .from(bookings)
        .innerJoin(holds, eq(bookings.holdId, holds.id))
        .where(
          and(
            eq(holds.eventTypeId, event.id),
            eq(bookings.status, "confirmed")
          )
        );

      const requestedStartMs =
        slotStartDate.getTime() - event.bufferBefore * 60000;

      const requestedEndMs =
        slotStartDate.getTime() +
        (event.duration + event.bufferAfter) * 60000;

      const occupiedSlots = [...activeHolds, ...confirmedBookings];

      const overlappingCount = occupiedSlots.filter((occupied) => {
        const occupiedStart =
          occupied.slotStart.getTime() - event.bufferBefore * 60000;

        const occupiedEnd =
          occupied.slotStart.getTime() +
          (event.duration + event.bufferAfter) * 60000;

        return (
          requestedStartMs < occupiedEnd &&
          requestedEndMs > occupiedStart
        );
      }).length;

      if (overlappingCount >= event.capacity) {
        throw new Error("SLOT_CAPACITY_REACHED");
      }

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const [newHold] = await tx
        .insert(holds)
        .values({
          eventTypeId: event.id,
          slotStart: slotStartDate,
          expiresAt,
          status: "active",
          idempotencyKey,
          requestHash,
        })
        .returning();

      return { hold: newHold, reused: false };
    });

    return Response.json(
      {
        success: true,
        reused: result.reused,
        data: result.hold,
      },
      { status: result.reused ? 200 : 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "UNKNOWN_ERROR";

    console.error("Create hold error:", error);

    const errors: Record<string, { status: number; message: string }> = {
      EVENT_NOT_FOUND: { status: 404, message: "Event type not found" },
      HOST_NOT_FOUND: { status: 404, message: "Host not found" },
      IDEMPOTENCY_CONFLICT: { status: 409, message: "Idempotency key already used for another request" },
      HOLD_EXPIRED: { status: 410, message: "This hold has expired" },
      INVALID_SLOT_DATE: { status: 400, message: "Invalid slot date" },
      HOST_UNAVAILABLE: { status: 409, message: "Host is unavailable on this date" },
      SLOT_UNAVAILABLE: { status: 409, message: "Selected slot is unavailable" },
      SLOT_CAPACITY_REACHED: { status: 409, message: "This slot is already fully booked" },
    };

    const errorResponse = errors[message] ?? {
      status: 500,
      message: "Unable to create booking hold",
    };

    return Response.json(
      { success: false, message: errorResponse.message },
      { status: errorResponse.status }
    );
  }
}