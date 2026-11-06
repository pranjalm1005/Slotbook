import { randomBytes, createHash } from "node:crypto";
import { db } from "@/db";
import { holds, bookings, notificationOutbox } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ holdId: string }> }
) {
  try {
    const { holdId } = await params;
    const body = await request.json();

    const guestName =
      typeof body.guestName === "string" ? body.guestName.trim() : "";

    const guestEmail =
      typeof body.guestEmail === "string"
        ? body.guestEmail.trim().toLowerCase()
        : "";

    if (!guestName || guestName.length > 100) {
      return Response.json(
        { success: false, message: "A valid guest name is required" },
        { status: 400 }
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail) ||
      guestEmail.length > 255
    ) {
      return Response.json(
        { success: false, message: "A valid guest email is required" },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT id FROM holds WHERE id = ${holdId} FOR UPDATE`
      );

      const [hold] = await tx
        .select()
        .from(holds)
        .where(eq(holds.id, holdId))
        .limit(1);

      if (!hold) {
        return { error: "HOLD_NOT_FOUND" as const };
      }

      if (hold.status === "confirmed") {
        return { error: "ALREADY_CONFIRMED" as const };
      }

      if (hold.status !== "active" || hold.expiresAt <= new Date()) {
        await tx
          .update(holds)
          .set({ status: "expired" })
          .where(eq(holds.id, holdId));

        return { error: "HOLD_EXPIRED" as const };
      }

      const managementToken = randomBytes(32).toString("hex");

      const tokenHash = createHash("sha256")
        .update(managementToken)
        .digest("hex");

      const [booking] = await tx
        .insert(bookings)
        .values({
          holdId: hold.id,
          guestName,
          guestEmail,
          tokenHash,
          slotStart: hold.slotStart,
          status: "confirmed",
        })
        .returning();

      await tx
        .update(holds)
        .set({ status: "confirmed" })
        .where(eq(holds.id, hold.id));

      await tx.insert(notificationOutbox).values({
        bookingId: booking.id,
        type: "booking_confirmed",
        payload: JSON.stringify({
          bookingId: booking.id,
          guestName,
          guestEmail,
          slotStart: hold.slotStart.toISOString(),
        }),
      });

      return {
        booking,
        managementToken,
      };
    });

    if ("error" in result) {
      switch (result.error) {
        case "HOLD_NOT_FOUND":
          return Response.json(
            { success: false, message: "Booking hold not found" },
            { status: 404 }
          );

        case "HOLD_EXPIRED":
          return Response.json(
            { success: false, message: "This booking hold has expired" },
            { status: 410 }
          );

        case "ALREADY_CONFIRMED":
          return Response.json(
            { success: false, message: "This hold has already been confirmed" },
            { status: 409 }
          );
      }
    }

    return Response.json(
      {
        success: true,
        message: "Booking confirmed successfully",
        data: {
          booking: result.booking,
          managementToken: result.managementToken,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Confirm booking error:", error);

    return Response.json(
      { success: false, message: "Unable to confirm booking" },
      { status: 500 }
    );
  }
}