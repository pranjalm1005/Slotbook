
import { db } from "@/db";
import { eventTypes, hosts } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const hostId = searchParams.get("hostId");

    if (!hostId) {
      return Response.json(
        { success: false, message: "hostId is required" },
        { status: 400 }
      );
    }

    const events = await db
      .select()
      .from(eventTypes)
      .where(eq(eventTypes.hostId, hostId))
      .orderBy(asc(eventTypes.name));

    return Response.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Fetch event types error:", error);

    return Response.json(
      { success: false, message: "Unable to fetch event types" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      hostId,
      name,
      slug,
      duration,
      capacity = 1,
      bufferBefore = 0,
      bufferAfter = 0,
      minNotice = 240,
      bookingHorizon = 30,
    } = body;

    if (
      typeof hostId !== "string" ||
      typeof name !== "string" ||
      !name.trim() ||
      typeof slug !== "string" ||
      !slug.trim() ||
      !Number.isInteger(duration) ||
      !Number.isInteger(capacity) ||
      !Number.isInteger(bufferBefore) ||
      !Number.isInteger(bufferAfter) ||
      !Number.isInteger(minNotice) ||
      !Number.isInteger(bookingHorizon)
    ) {
      return Response.json(
        { success: false, message: "Invalid or missing event details" },
        { status: 400 }
      );
    }

    if (
      duration < 15 || duration > 120 ||
      capacity < 1 ||
      bufferBefore < 0 || bufferBefore > 30 ||
      bufferAfter < 0 || bufferAfter > 30 ||
      minNotice < 0 ||
      bookingHorizon < 1
    ) {
      return Response.json(
        { success: false, message: "Event configuration is outside allowed limits" },
        { status: 400 }
      );
    }

    const [host] = await db
      .select({ id: hosts.id })
      .from(hosts)
      .where(eq(hosts.id, hostId))
      .limit(1);

    if (!host) {
      return Response.json(
        { success: false, message: "Host not found" },
        { status: 404 }
      );
    }

    const [newEvent] = await db
      .insert(eventTypes)
      .values({
        hostId,
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        duration,
        capacity,
        bufferBefore,
        bufferAfter,
        minNotice,
        bookingHorizon,
      })
      .returning();

    return Response.json(
      { success: true, data: newEvent },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create event type error:", error);

    return Response.json(
      { success: false, message: "Unable to create event type. Check whether the slug already exists for this host." },
      { status: 409 }
    );
  }
}
