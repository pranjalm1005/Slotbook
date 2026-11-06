import { db } from "@/db";
import {
  notificationOutbox,
  bookings,
  holds,
  eventTypes,
} from "@/db/schema";

import { desc, eq } from "drizzle-orm";

export async function GET(
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

    const notifications = await db
      .select({
        id: notificationOutbox.id,
        bookingId: notificationOutbox.bookingId,
        type: notificationOutbox.type,
        createdAt: notificationOutbox.createdAt,
        deliveredAt: notificationOutbox.deliveredAt,
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
      .where(eq(eventTypes.hostId, hostId))
      .orderBy(desc(notificationOutbox.createdAt));

    return Response.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error("Notification outbox error:", error);

    return Response.json(
      {
        success: false,
        message: "Unable to load notification records",
      },
      { status: 500 }
    );
  }
}