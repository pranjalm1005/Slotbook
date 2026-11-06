import { db } from "@/db";
import {
  notificationOutbox,
  bookings,
  holds,
  eventTypes,
} from "@/db/schema";

import {
  and,
  asc,
  eq,
  isNull,
} from "drizzle-orm";

export async function POST(
  _request: Request,
  context: { params: Promise<{ hostId: string }> }
) {
  try {
    const { hostId } = await context.params;

    if (!hostId) {
      return Response.json(
        { success: false, message: "hostId is required" },
        { status: 400 }
      );
    }

    const processed = await db.transaction(async (tx) => {
      const pending = await tx
        .select({
          id: notificationOutbox.id,
          bookingId: notificationOutbox.bookingId,
          type: notificationOutbox.type,
          guestName: bookings.guestName,
          eventName: eventTypes.name,
        })
        .from(notificationOutbox)
        .innerJoin(
          bookings,
          eq(notificationOutbox.bookingId, bookings.id)
        )
        .innerJoin(holds, eq(bookings.holdId, holds.id))
        .innerJoin(
          eventTypes,
          eq(holds.eventTypeId, eventTypes.id)
        )
        .where(
          and(
            eq(eventTypes.hostId, hostId),
            isNull(notificationOutbox.deliveredAt)
          )
        )
        .orderBy(asc(notificationOutbox.createdAt))
        .limit(10)
        .for("update", {
          of: notificationOutbox,
          skipLocked: true,
        });

      for (const notification of pending) {
        await tx
          .update(notificationOutbox)
          .set({ deliveredAt: new Date() })
          .where(
            and(
              eq(notificationOutbox.id, notification.id),
              isNull(notificationOutbox.deliveredAt)
            )
          );
      }

      return pending;
    });

    // Local development sink: log each delivered notification.
    for (const notification of processed) {
      console.info("[Notification Sink] Delivered:", {
        id: notification.id,
        bookingId: notification.bookingId,
        type: notification.type,
        guestName: notification.guestName,
        eventName: notification.eventName,
      });
    }

    return Response.json({
      success: true,
      message: "Notification processing completed",
      processedCount: processed.length,
      data: processed,
    });
  } catch (error) {
    console.error("Notification processing error:", error);

    return Response.json(
      {
        success: false,
        message: "Unable to process notifications",
      },
      { status: 500 }
    );
  }
}