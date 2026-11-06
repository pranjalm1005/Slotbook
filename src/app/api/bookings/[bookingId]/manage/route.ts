
import { createHash, randomUUID } from "node:crypto";

import { db } from "@/db";

import {
  bookings,
  holds,
  notificationOutbox,
  eventTypes,
  hosts,
  availabilityRules,
  availabilityOverrides,
} from "@/db/schema";

import {
  and,
  eq,
  gt,
  ne,
  sql,
} from "drizzle-orm";

import { DateTime } from "luxon";

import { generateCandidateSlots } from "@/lib/slots";

// Validate management token
async function verifyBookingAccess(
  bookingId: string,
  token: string
) {
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    return null;
  }

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const [booking] = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.tokenHash, tokenHash)
      )
    )
    .limit(1);

  return booking ?? null;
}

// Validate replacement slot
async function validateRescheduleSlot(
  tx: any,
  booking: typeof bookings.$inferSelect,
  newSlotStart: Date
) {
  const [oldHold] = await tx
    .select()
    .from(holds)
    .where(eq(holds.id, booking.holdId))
    .limit(1);

  if (!oldHold) {
    return "ORIGINAL_HOLD_NOT_FOUND";
  }

  // Get event and serialize booking changes for this event.
  await tx.execute(
    sql`SELECT id FROM event_types
        WHERE id = ${oldHold.eventTypeId}
        FOR UPDATE`
  );

  const [event] = await tx
    .select()
    .from(eventTypes)
    .where(eq(eventTypes.id, oldHold.eventTypeId))
    .limit(1);

  if (!event || !event.active) {
    return "EVENT_UNAVAILABLE";
  }

  const [host] = await tx
    .select()
    .from(hosts)
    .where(eq(hosts.id, event.hostId))
    .limit(1);

  if (!host) {
    return "HOST_NOT_FOUND";
  }

  const localDate = DateTime.fromJSDate(newSlotStart, {
    zone: host.timezone,
  });

  if (!localDate.isValid) {
    return "INVALID_DATE";
  }

  const date = localDate.toISODate()!;
  const weekday = localDate.weekday % 7;

  const [override] = await tx
    .select()
    .from(availabilityOverrides)
    .where(
      and(
        eq(availabilityOverrides.hostId, host.id),
        eq(availabilityOverrides.overrideDate, date)
      )
    )
    .limit(1);

  let startTime: string;
  let endTime: string;

  if (override) {
    if (
      !override.isAvailable ||
      !override.startTime ||
      !override.endTime
    ) {
      return "HOST_UNAVAILABLE";
    }

    startTime = override.startTime;
    endTime = override.endTime;
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
      return "HOST_UNAVAILABLE";
    }

    startTime = rule.startTime;
    endTime = rule.endTime;
  }

  const candidates = generateCandidateSlots({
    date,
    timezone: host.timezone,
    startTime,
    endTime,
    duration: event.duration,
    bufferBefore: event.bufferBefore,
    bufferAfter: event.bufferAfter,
    minNotice: event.minNotice,
    bookingHorizon: event.bookingHorizon,
  });

  const candidate = candidates.find(
    (slot) =>
      DateTime.fromISO(slot.start!).toMillis() ===
      newSlotStart.getTime()
  );

  if (!candidate) {
    return "SLOT_OUTSIDE_BOOKING_RULES";
  }

  // Active temporary holds
  const activeHolds = await tx
    .select({
      slotStart: holds.slotStart,
    })
    .from(holds)
    .where(
      and(
        eq(holds.eventTypeId, event.id),
        eq(holds.status, "active"),
        gt(holds.expiresAt, new Date())
      )
    );

  // Other confirmed bookings, excluding the booking being moved
  const confirmedBookings = await tx
    .select({
      slotStart: holds.slotStart,
    })
    .from(bookings)
    .innerJoin(holds, eq(bookings.holdId, holds.id))
    .where(
      and(
        eq(holds.eventTypeId, event.id),
        eq(bookings.status, "confirmed"),
        ne(bookings.id, booking.id)
      )
    );

  const occupied = [
    ...activeHolds,
    ...confirmedBookings,
  ];

  const candidateStart = DateTime.fromISO(
    candidate.bufferedStart!
  ).toMillis();

  const candidateEnd = DateTime.fromISO(
    candidate.bufferedEnd!
  ).toMillis();

  const conflicts = occupied.filter((item) => {
    const occupiedStart = DateTime.fromJSDate(item.slotStart)
      .minus({ minutes: event.bufferBefore })
      .toMillis();

    const occupiedEnd = DateTime.fromJSDate(item.slotStart)
      .plus({
        minutes: event.duration + event.bufferAfter,
      })
      .toMillis();

    return (
      candidateStart < occupiedEnd &&
      candidateEnd > occupiedStart
    );
  });

  if (conflicts.length >= event.capacity) {
    return "SLOT_UNAVAILABLE";
  }

  return {
    event,
    slotStart: newSlotStart,
  };
}

// GET: Retrieve booking details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return Response.json(
        { success: false, message: "Management token required" },
        { status: 401 }
      );
    }

    const booking = await verifyBookingAccess(
      bookingId,
      token
    );

    if (!booking) {
      return Response.json(
        {
          success: false,
          message: "Invalid booking or management token",
        },
        { status: 404 }
      );
    }

    const [eventDetails] = await db
        .select({
            eventTypeId: eventTypes.id,
            eventName: eventTypes.name,
            timezone: hosts.timezone,
            duration: eventTypes.duration,
        })
        .from(holds)
        .innerJoin(eventTypes, eq(holds.eventTypeId, eventTypes.id))
        .innerJoin(hosts, eq(eventTypes.hostId, hosts.id))
        .where(eq(holds.id, booking.holdId))
        .limit(1);

        return Response.json({
        success: true,
        data: {
            id: booking.id,
            guestName: booking.guestName,
            guestEmail: booking.guestEmail,
            slotStart: booking.slotStart,
            status: booking.status,
            ...eventDetails,
        },
        });
  } catch (error) {
    console.error("Get booking error:", error);

    return Response.json(
      { success: false, message: "Unable to retrieve booking" },
      { status: 500 }
    );
  }
}

// POST: Cancel or reschedule a booking
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return Response.json(
        { success: false, message: "Management token required" },
        { status: 401 }
      );
    }

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return Response.json(
        { success: false, message: "Invalid management token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = body.action;

    if (action !== "cancel" && action !== "reschedule") {
      return Response.json(
        { success: false, message: "Unsupported action" },
        { status: 400 }
      );
    }

    let newSlotStart: Date | null = null;

    if (action === "reschedule") {
      if (
        typeof body.slotStart !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(
          body.slotStart
        )
      ) {
        return Response.json(
          {
            success: false,
            message: "A valid ISO slotStart with timezone is required",
          },
          { status: 400 }
        );
      }

      const parsedDate = DateTime.fromISO(body.slotStart, {
        setZone: true,
      });

      if (!parsedDate.isValid) {
        return Response.json(
          { success: false, message: "Invalid slot date" },
          { status: 400 }
        );
      }

      newSlotStart = parsedDate.toUTC().toJSDate();
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const result = await db.transaction(async (tx) => {
      // Lock booking to prevent concurrent modifications.
      await tx.execute(
        sql`SELECT id FROM bookings
            WHERE id = ${bookingId}
            FOR UPDATE`
      );

      const [booking] = await tx
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.tokenHash, tokenHash)
          )
        )
        .limit(1);

      if (!booking) {
        return { error: "NOT_FOUND" as const };
      }

      if (booking.status === "cancelled") {
        return { error: "ALREADY_CANCELLED" as const };
      }

      // CANCEL BOOKING
      if (action === "cancel") {
        await tx
          .update(bookings)
          .set({
            status: "cancelled",
            cancellationReason: "Cancelled by guest",
          })
          .where(eq(bookings.id, bookingId));

        await tx
          .update(holds)
          .set({ status: "expired" })
          .where(eq(holds.id, booking.holdId));

        await tx.insert(notificationOutbox).values({
          bookingId: booking.id,
          type: "booking_cancelled",
          payload: JSON.stringify({
            bookingId: booking.id,
            guestName: booking.guestName,
            guestEmail: booking.guestEmail,
          }),
        });

        return {
          success: true,
          action: "cancel",
        };
      }

      // RESCHEDULE BOOKING
      if (!newSlotStart) {
        return { error: "INVALID_DATE" as const };
      }

      const validation = await validateRescheduleSlot(
        tx,
        booking,
        newSlotStart
      );

      if (typeof validation === "string") {
        return { error: validation };
      }

      // Create a new confirmed hold.
      const [newHold] = await tx
        .insert(holds)
        .values({
          eventTypeId: validation.event.id,
          slotStart: newSlotStart,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          status: "confirmed",
          idempotencyKey: `reschedule-${randomUUID()}`,
          requestHash: createHash("sha256")
            .update(
              `${booking.id}:${newSlotStart.toISOString()}`
            )
            .digest("hex"),
        })
        .returning();

      // Retire the old hold.
      await tx
        .update(holds)
        .set({ status: "expired" })
        .where(eq(holds.id, booking.holdId));

      // Preserve booking ID, guest details and token hash.
      const [updatedBooking] = await tx
        .update(bookings)
        .set({
          holdId: newHold.id,
          slotStart: newSlotStart,
        })
        .where(eq(bookings.id, booking.id))
        .returning();

      // Insert notification in the same transaction.
      await tx.insert(notificationOutbox).values({
        bookingId: booking.id,
        type: "booking_rescheduled",
        payload: JSON.stringify({
          bookingId: booking.id,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          oldSlotStart: booking.slotStart.toISOString(),
          newSlotStart: newSlotStart.toISOString(),
        }),
      });

      return {
        success: true,
        action: "reschedule",
        booking: updatedBooking,
      };
    });

    if ("error" in result) {
      const errors: Record<
        string,
        { message: string; status: number }
      > = {
        NOT_FOUND: {
          message: "Invalid booking or management token",
          status: 404,
        },
        ALREADY_CANCELLED: {
          message: "Booking already cancelled",
          status: 409,
        },
        ORIGINAL_HOLD_NOT_FOUND: {
          message: "Original booking hold not found",
          status: 404,
        },
        EVENT_UNAVAILABLE: {
          message: "Event type is unavailable",
          status: 409,
        },
        HOST_NOT_FOUND: {
          message: "Host not found",
          status: 404,
        },
        INVALID_DATE: {
          message: "Invalid replacement slot date",
          status: 400,
        },
        HOST_UNAVAILABLE: {
          message: "Host is unavailable on this date",
          status: 409,
        },
        SLOT_OUTSIDE_BOOKING_RULES: {
          message: "Slot violates booking rules or is outside availability",
          status: 409,
        },
        SLOT_UNAVAILABLE: {
          message: "This slot is no longer available",
          status: 409,
        },
      };

      const error = result.error
        ? errors[result.error] ?? {
            message: "Unable to process booking request",
            status: 400,
            }
        : {
            message: "Unable to process booking request",
            status: 400,
        };

      return Response.json(
        {
          success: false,
          message: error.message,
        },
        { status: error.status }
      );
    }

    if (result.action === "cancel") {
      return Response.json({
        success: true,
        message: "Booking cancelled successfully",
      });
    }

    return Response.json({
      success: true,
      message: "Booking rescheduled successfully",
      data: {
        booking: result.booking,
      },
    });
  } catch (error) {
    console.error("Manage booking error:", error);

    return Response.json(
      {
        success: false,
        message: "Unable to process booking request",
      },
      { status: 500 }
    );
  }
}
