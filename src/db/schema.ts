
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  date,
  time,
  boolean,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

// Booking status
export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "cancelled",
]);

// Hold status
export const holdStatusEnum = pgEnum("hold_status", [
  "active",
  "expired",
  "confirmed",
]);

// 1. Hosts
export const hosts = pgTable("hosts", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", { length: 150 }).notNull(),

  handle: varchar("handle", { length: 100 }).notNull().unique(),

  email: varchar("email", { length: 255 }).notNull(),

  timezone: varchar("timezone", { length: 100 })
    .notNull()
    .default("Asia/Kolkata"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow().notNull(),
});

// 2. Event Types
export const eventTypes = pgTable(
  "event_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    hostId: uuid("host_id")
      .notNull()
      .references(() => hosts.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 150 }).notNull(),

    slug: varchar("slug", { length: 150 }).notNull(),

    duration: integer("duration").notNull(),

    capacity: integer("capacity").notNull().default(1),

    bufferBefore: integer("buffer_before").notNull().default(0),

    bufferAfter: integer("buffer_after").notNull().default(0),

    minNotice: integer("min_notice").notNull().default(240),

    bookingHorizon: integer("booking_horizon").notNull().default(30),

    active: boolean("active").notNull().default(true),
  },
  (table) => [
    uniqueIndex("event_host_slug_unique").on(
      table.hostId,
      table.slug
    ),
    check("duration_range", sql`${table.duration} BETWEEN 15 AND 120`),
    check("capacity_positive", sql`${table.capacity} >= 1`),
    check(
      "buffer_range",
      sql`${table.bufferBefore} BETWEEN 0 AND 30
      AND ${table.bufferAfter} BETWEEN 0 AND 30`
    ),
  ]
);

// 3. Weekly Availability Rules
export const availabilityRules = pgTable("availability_rules", {
  id: uuid("id").defaultRandom().primaryKey(),

  hostId: uuid("host_id")
    .notNull()
    .references(() => hosts.id, { onDelete: "cascade" }),

  weekday: integer("weekday").notNull(),

  startTime: time("start_time").notNull(),

  endTime: time("end_time").notNull(),
});

// 4. Date Overrides
export const availabilityOverrides = pgTable("availability_overrides", {
  id: uuid("id").defaultRandom().primaryKey(),

  hostId: uuid("host_id")
    .notNull()
    .references(() => hosts.id, { onDelete: "cascade" }),

  overrideDate: date("override_date", { mode: "string" }).notNull(),

  isAvailable: boolean("is_available").notNull().default(false),

  startTime: time("start_time"),

  endTime: time("end_time"),
});

// 5. Temporary Holds
export const holds = pgTable(
  "holds",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id),

    slotStart: timestamp("slot_start", {
      withTimezone: true,
    }).notNull(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    status: holdStatusEnum("status").notNull().default("active"),

    idempotencyKey: varchar("idempotency_key", {
      length: 255,
    }).notNull().unique(),

    requestHash: varchar("request_hash", { length: 64 }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("holds_slot_idx").on(
      table.eventTypeId,
      table.slotStart
    ),
  ]
);

// 6. Confirmed Bookings
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    holdId: uuid("hold_id")
      .notNull()
      .unique()
      .references(() => holds.id),

    guestName: varchar("guest_name", { length: 150 }).notNull(),

    guestEmail: varchar("guest_email", { length: 255 }).notNull(),

    tokenHash: varchar("token_hash", { length: 64 })
      .notNull()
      .unique(),

    slotStart: timestamp("slot_start", {
      withTimezone: true,
    }).notNull(),

    status: bookingStatusEnum("status")
      .notNull()
      .default("confirmed"),

    cancellationReason: text("cancellation_reason"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    index("bookings_slot_idx").on(
      table.slotStart,
      table.status
    ),
  ]
);

// 7. Notification Outbox
export const notificationOutbox = pgTable("notification_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),

  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id),

  type: varchar("type", { length: 50 }).notNull(),

  payload: text("payload").notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow().notNull(),

  deliveredAt: timestamp("delivered_at", {
    withTimezone: true,
  }),
});
