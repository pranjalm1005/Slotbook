import { db } from "@/db";
import { hosts, eventTypes } from "@/db/schema";
import { and, eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{
    hostHandle: string;
    eventSlug: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    const { hostHandle, eventSlug } = await context.params;

    const [result] = await db
      .select({
        hostName: hosts.name,
        hostHandle: hosts.handle,
        timezone: hosts.timezone,
        eventId: eventTypes.id,
        eventName: eventTypes.name,
        eventSlug: eventTypes.slug,
        duration: eventTypes.duration,
        capacity: eventTypes.capacity,
        bufferBefore: eventTypes.bufferBefore,
        bufferAfter: eventTypes.bufferAfter,
        minNotice: eventTypes.minNotice,
        bookingHorizon: eventTypes.bookingHorizon,
      })
      .from(eventTypes)
      .innerJoin(hosts, eq(eventTypes.hostId, hosts.id))
      .where(
        and(
          eq(hosts.handle, hostHandle.toLowerCase()),
          eq(eventTypes.slug, eventSlug.toLowerCase()),
          eq(eventTypes.active, true)
        )
      )
      .limit(1);

    if (!result) {
      return Response.json(
        {
          success: false,
          message: "Booking page not found",
        },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Public event details error:", error);

    return Response.json(
      {
        success: false,
        message: "Unable to fetch booking details",
      },
      { status: 500 }
    );
  }
}