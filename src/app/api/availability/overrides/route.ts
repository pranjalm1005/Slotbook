import { db } from "@/db";
import { availabilityOverrides, hosts } from "@/db/schema";
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

    const overrides = await db
      .select()
      .from(availabilityOverrides)
      .where(eq(availabilityOverrides.hostId, hostId))
      .orderBy(asc(availabilityOverrides.overrideDate));

    return Response.json({ success: true, data: overrides });
  } catch (error) {
    console.error("Fetch overrides error:", error);

    return Response.json(
      { success: false, message: "Unable to fetch overrides" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { hostId, date, isAvailable, startTime, endTime } = body;

    if (
      typeof hostId !== "string" ||
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof isAvailable !== "boolean"
    ) {
      return Response.json(
        { success: false, message: "Invalid override details" },
        { status: 400 }
      );
    }

    if (isAvailable) {
      if (
        typeof startTime !== "string" ||
        typeof endTime !== "string" ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
        startTime >= endTime
      ) {
        return Response.json(
          { success: false, message: "Valid startTime and endTime are required" },
          { status: 400 }
        );
      }
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

    const [override] = await db
      .insert(availabilityOverrides)
      .values({
        hostId,
        overrideDate: date,
        isAvailable,
        startTime: isAvailable ? startTime : null,
        endTime: isAvailable ? endTime : null,
        })
      .returning();

    return Response.json(
      { success: true, data: override },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create override error:", error);

    return Response.json(
      { success: false, message: "Unable to create override" },
      { status: 500 }
    );
  }
}