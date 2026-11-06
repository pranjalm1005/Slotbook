import { db } from "@/db";
import { bookings, holds, eventTypes } from "@/db/schema";
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

    const hostBookings = await db
      .select({
        id: bookings.id,
        guestName: bookings.guestName,
        guestEmail: bookings.guestEmail,
        slotStart: bookings.slotStart,
        status: bookings.status,
        cancellationReason: bookings.cancellationReason,
        createdAt: bookings.createdAt,
        eventName: eventTypes.name,
        duration: eventTypes.duration,
      })
      .from(bookings)
      .innerJoin(holds, eq(bookings.holdId, holds.id))
      .innerJoin(eventTypes, eq(holds.eventTypeId, eventTypes.id))
      .where(eq(eventTypes.hostId, hostId))
      .orderBy(desc(bookings.slotStart));

    return Response.json({
      success: true,
      data: hostBookings,
    });
  } catch (error) {
    console.error("Host bookings error:", error);

    return Response.json(
      { success: false, message: "Unable to load bookings" },
      { status: 500 }
    );
  }
}