import { db } from "@/db";
import { availabilityRules, hosts } from "@/db/schema";
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

    const rules = await db
      .select()
      .from(availabilityRules)
      .where(eq(availabilityRules.hostId, hostId))
      .orderBy(asc(availabilityRules.weekday));

    return Response.json({ success: true, data: rules });
  } catch (error) {
    console.error("Fetch availability error:", error);

    return Response.json(
      { success: false, message: "Unable to fetch availability" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { hostId, weekday, startTime, endTime } = body;

    if (
      typeof hostId !== "string" ||
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6 ||
      typeof startTime !== "string" ||
      typeof endTime !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
      startTime >= endTime
    ) {
      return Response.json(
        { success: false, message: "Invalid availability details" },
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

    const [rule] = await db
      .insert(availabilityRules)
      .values({ hostId, weekday, startTime, endTime })
      .returning();

    return Response.json(
      { success: true, data: rule },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create availability error:", error);

    return Response.json(
      { success: false, message: "Unable to create availability" },
      { status: 500 }
    );
  }
}