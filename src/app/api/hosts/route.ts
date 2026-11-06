
import { db } from "@/db";
import { hosts } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const allHosts = await db
      .select()
      .from(hosts)
      .orderBy(desc(hosts.createdAt));

    return Response.json({
      success: true,
      data: allHosts,
    });
  } catch (error) {
    console.error("Fetch hosts error:", error);

    return Response.json(
      { success: false, message: "Unable to fetch hosts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { name, handle, email, timezone } = body;

    if (
      typeof name !== "string" || !name.trim() ||
      typeof handle !== "string" || !handle.trim() ||
      typeof email !== "string" || !email.trim()
    ) {
      return Response.json(
        { success: false, message: "Name, handle and email are required" },
        { status: 400 }
      );
    }

    const [newHost] = await db
      .insert(hosts)
      .values({
        name: name.trim(),
        handle: handle.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        timezone:
          typeof timezone === "string" && timezone.trim()
            ? timezone.trim()
            : "Asia/Kolkata",
      })
      .returning();

    return Response.json(
      { success: true, data: newHost },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create host error:", error);

    return Response.json(
      { success: false, message: "Unable to create host. Check whether the handle already exists." },
      { status: 409 }
    );
  }
}
