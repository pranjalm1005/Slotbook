import { db } from "@/db";
import {
  eventTypes,
  hosts,
  availabilityRules,
  availabilityOverrides,
  holds,
  bookings,
} from "@/db/schema";

import { and, eq, gt } from "drizzle-orm";
import { DateTime } from "luxon";
import { generateCandidateSlots } from "@/lib/slots";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventTypeId: string }> }
) {
  try {
    const { eventTypeId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json(
        { success: false, message: "A valid date (YYYY-MM-DD) is required" },
        { status: 400 }
      );
    }

    const [event] = await db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.id, eventTypeId))
      .limit(1);

    if (!event || !event.active) {
      return Response.json(
        { success: false, message: "Event type not found or inactive" },
        { status: 404 }
      );
    }

    const [host] = await db
      .select()
      .from(hosts)
      .where(eq(hosts.id, event.hostId))
      .limit(1);

    if (!host) {
      return Response.json(
        { success: false, message: "Host not found" },
        { status: 404 }
      );
    }

    const requestedDate = DateTime.fromISO(date, {
      zone: host.timezone,
    });

    if (!requestedDate.isValid || requestedDate.toISODate() !== date) {
      return Response.json(
        { success: false, message: "Invalid date or host timezone" },
        { status: 400 }
      );
    }

    // Sunday = 0, Monday = 1, ..., Saturday = 6
    const weekday = requestedDate.weekday % 7;

    const [override] = await db
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
      if (!override.isAvailable) {
        return Response.json({
          success: true,
          date,
          timezone: host.timezone,
          data: [],
          message: "Host is unavailable on this date",
        });
      }

      startTime = override.startTime!;
      endTime = override.endTime!;
    } else {
      const [rule] = await db
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
        return Response.json({
          success: true,
          date,
          timezone: host.timezone,
          data: [],
          message: "No availability configured for this day",
        });
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

    // Fetch holds that have not expired.
    const activeHolds = await db
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

    // Fetch confirmed bookings for this event type.
    const confirmedBookings = await db
      .select({
        slotStart: holds.slotStart,
      })
      .from(bookings)
      .innerJoin(holds, eq(bookings.holdId, holds.id))
      .where(
        and(
          eq(holds.eventTypeId, event.id),
          eq(bookings.status, "confirmed")
        )
      );

    const occupiedSlots = [
      ...activeHolds,
      ...confirmedBookings,
    ];

    const availableSlots = candidates.filter((candidate) => {
      const candidateStart = DateTime.fromISO(candidate.bufferedStart!).toMillis();
      const candidateEnd = DateTime.fromISO(candidate.bufferedEnd!).toMillis();

      return !occupiedSlots.some((occupied) => {
        const occupiedStart = DateTime.fromJSDate(occupied.slotStart)
          .minus({ minutes: event.bufferBefore })
          .toMillis();

        const occupiedEnd = DateTime.fromJSDate(occupied.slotStart)
          .plus({
            minutes: event.duration + event.bufferAfter,
          })
          .toMillis();

        return candidateStart < occupiedEnd && candidateEnd > occupiedStart;
      });
    });

    return Response.json({
      success: true,
      date,
      timezone: host.timezone,
      event: event.name,
      data: availableSlots,
    });
  } catch (error) {
    console.error("Generate slots error:", error);

    return Response.json(
      { success: false, message: "Unable to generate available slots" },
      { status: 500 }
    );
  }
}