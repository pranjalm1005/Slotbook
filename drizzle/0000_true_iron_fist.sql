CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."hold_status" AS ENUM('active', 'expired', 'confirmed');--> statement-breakpoint
CREATE TABLE "availability_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"override_date" date NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL,
	"start_time" time,
	"end_time" time
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hold_id" uuid NOT NULL,
	"guest_name" varchar(150) NOT NULL,
	"guest_email" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_hold_id_unique" UNIQUE("hold_id"),
	CONSTRAINT "bookings_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"name" varchar(150) NOT NULL,
	"slug" varchar(150) NOT NULL,
	"duration" integer NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"buffer_before" integer DEFAULT 0 NOT NULL,
	"buffer_after" integer DEFAULT 0 NOT NULL,
	"min_notice" integer DEFAULT 240 NOT NULL,
	"booking_horizon" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "duration_range" CHECK ("event_types"."duration" BETWEEN 15 AND 120),
	CONSTRAINT "capacity_positive" CHECK ("event_types"."capacity" >= 1),
	CONSTRAINT "buffer_range" CHECK ("event_types"."buffer_before" BETWEEN 0 AND 30
      AND "event_types"."buffer_after" BETWEEN 0 AND 30)
);
--> statement-breakpoint
CREATE TABLE "holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type_id" uuid NOT NULL,
	"slot_start" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "hold_status" DEFAULT 'active' NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holds_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "hosts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(150) NOT NULL,
	"handle" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"timezone" varchar(100) DEFAULT 'Asia/Kolkata' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hosts_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"payload" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."holds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_host_id_hosts_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."hosts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holds" ADD CONSTRAINT "holds_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_slot_idx" ON "bookings" USING btree ("slot_start","status");--> statement-breakpoint
CREATE UNIQUE INDEX "event_host_slug_unique" ON "event_types" USING btree ("host_id","slug");--> statement-breakpoint
CREATE INDEX "holds_slot_idx" ON "holds" USING btree ("event_type_id","slot_start");