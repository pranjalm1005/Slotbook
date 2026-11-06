
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);

    return Response.json({
      success: true,
      message: "Database connection successful",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    return Response.json(
      {
        success: false,
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }
}
