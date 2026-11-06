
# Slotbook — Appointment Booking Engine

A full-stack appointment scheduling and booking platform built with **Next.js, TypeScript, PostgreSQL, and Drizzle ORM**.

Slotbook allows hosts to configure event types, define their availability, and manage appointments. Guests can view available time slots, temporarily reserve a slot, confirm a booking, and manage an existing appointment.

The project focuses on reliable booking workflows, temporary slot reservations, idempotent requests, time-zone-aware scheduling, and transactional persistence.

**Repository:** https://github.com/pranjalm1005/Slotbook

---

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Application Workflow](#application-workflow)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Database Design](#database-design)
- [Booking Lifecycle](#booking-lifecycle)
- [Availability and Time-Zone Handling](#availability-and-time-zone-handling)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Database Migrations](#database-migrations)
- [Testing and Verification](#testing-and-verification)
- [Current Limitations](#current-limitations)
- [Future Improvements](#future-improvements)

---

## Overview

Appointment booking systems need to do more than display available time slots. They must also handle competing booking requests, temporary reservations, cancellations, rescheduling, and differences between time zones.

Slotbook addresses these requirements through a database-backed booking workflow.

The application has two main user experiences:

**1. Host experience**

Hosts can manage event types, configure weekly working hours, define date-specific availability exceptions, review bookings, and process notification events.

**2. Guest experience**

Guests can open a public booking page, select an available slot, create a temporary hold, provide their details, confirm the appointment, and manage their booking.

PostgreSQL acts as the persistent source of truth for booking and availability data.

---

## Core Features

### 1. Host Dashboard

The dashboard provides a centralized interface for managing scheduling operations.

- View the host dashboard.
- Create and manage event types.
- Configure event duration and capacity.
- Set minimum booking notice.
- Configure the booking horizon.
- Define weekly availability.
- Add date-specific availability overrides.
- Review confirmed and cancelled bookings.
- View notification records.
- Process pending notification events.

### 2. Event Type Management

Hosts can create different appointment types with configurable scheduling rules.

Each event type supports:

| Configuration | Description |
|---|---|
| Name | Display name of the event |
| Slug | Public URL identifier |
| Duration | Appointment duration in minutes |
| Capacity | Number of attendees supported |
| Buffer before | Preparation time before an appointment |
| Buffer after | Cleanup time after an appointment |
| Minimum notice | Minimum advance booking time |
| Booking horizon | Maximum number of days ahead |
| Active status | Whether the event can be booked |

The database enforces constraints on duration, capacity, and buffer values.

### 3. Weekly Availability

Hosts can define recurring working hours for each weekday.

Availability rules contain:

- Host identifier
- Weekday
- Start time
- End time

The availability engine uses these rules to generate candidate appointment slots.

### 4. Date-Specific Availability Overrides

Weekly schedules are not always sufficient. Hosts may have holidays, special working hours, or other exceptions.

Slotbook supports date-specific overrides.

Examples:

- Mark a particular date as unavailable.
- Define special working hours for a particular date.
- Apply an exception to the normal weekly schedule.

### 5. Public Booking Page

Every event type can have a public booking page based on the host handle and event slug.

Example:

`/pranjal/30-minute-consultation`

Guests can:

1. View the event details.
2. Select a date.
3. View available time slots.
4. Select a slot.
5. Temporarily hold the selected slot.
6. Enter their name and email address.
7. Confirm their booking.

### 6. Temporary Slot Holds

Before a booking is confirmed, Slotbook creates a temporary reservation.

- A hold reserves a selected slot temporarily.
- Holds expire after five minutes.
- Expired holds no longer block availability.
- The guest must confirm before the hold expires.
- Hold creation supports an idempotency key.

This separates the slot-selection process from final booking confirmation.

### 7. Booking Management

Confirmed bookings can be managed using a private booking management token.

Supported operations include:

- Retrieve booking details.
- Cancel an appointment.
- Reschedule an appointment when the requested time is available.

The application stores a SHA-256 hash of the management token instead of storing the raw token in the booking record.

### 8. Notification Outbox

Booking-related events are recorded in a notification outbox.

Supported event types include:

- Booking confirmed
- Booking rescheduled
- Booking cancelled

The host dashboard can view notification records and process pending events.

The current implementation uses a local development notification sink. It does not send real emails through an external provider.

---

## Application Workflow

The typical booking process follows this sequence:

```text
Host configures event and availability
                  |
                  v
Guest opens public booking page
                  |
                  v
Guest selects a date and time
                  |
                  v
Backend validates slot availability
                  |
                  v
Temporary hold created (5 minutes)
                  |
                  v
Guest enters name and email
                  |
                  v
Backend confirms booking
                  |
                  v
Booking persisted in PostgreSQL
                  |
                  v
Notification event added to outbox
                  |
                  v
Host can view and process event
```

If the guest does not confirm within the hold period, the temporary reservation expires.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | Full-stack application framework |
| React 19 | User interface |
| TypeScript | Static typing |
| PostgreSQL 15 | Relational database |
| Drizzle ORM | Database queries and schema management |
| Drizzle Kit | Database migrations |
| Luxon | Date, time, and time-zone handling |
| Zod | Schema validation dependency |
| Docker Compose | Local PostgreSQL environment |
| Node.js | JavaScript runtime |
| Tailwind CSS 4 | Styling |

---

## System Architecture

Slotbook uses a straightforward full-stack architecture.

```text
                GUEST / HOST
                     |
                     v
              Next.js Frontend
                     |
                     v
             Next.js API Routes
                     |
          +----------+-----------+
          |                      |
          v                      v
   Booking Logic          Availability Logic
          |                      |
          +----------+-----------+
                     |
                     v
               Drizzle ORM
                     |
                     v
                PostgreSQL
                     |
          +----------+-----------+
          |                      |
          v                      v
      Bookings              Notification
      and Holds                Outbox
```

### Architectural Responsibilities

**Frontend**

- Displays the host dashboard.
- Provides event and availability management.
- Displays public booking pages.
- Handles slot selection and booking confirmation.
- Provides booking management interfaces.

**API Layer**

- Validates incoming requests.
- Retrieves available slots.
- Creates temporary holds.
- Confirms bookings.
- Handles cancellation and rescheduling.
- Manages host booking and notification data.

**Database Layer**

- Stores hosts and event types.
- Persists availability rules and overrides.
- Tracks temporary holds.
- Stores confirmed bookings.
- Maintains notification events.

**PostgreSQL**

PostgreSQL is the primary persistence layer. Transactions and row-level locking are used in important booking operations to coordinate concurrent requests.

---

## Database Design

The application uses seven primary database tables.

### 1. hosts

Stores host profile and scheduling information.

Important fields:

- `id`
- `name`
- `handle`
- `email`
- `timezone`
- `created_at`

The host handle is used to construct public booking URLs.

### 2. event_types

Stores appointment types created by hosts.

Important fields:

- `id`
- `host_id`
- `name`
- `slug`
- `duration`
- `capacity`
- `buffer_before`
- `buffer_after`
- `min_notice`
- `booking_horizon`
- `active`

Each event type belongs to a host.

### 3. availability_rules

Stores recurring weekly availability.

Important fields:

- `id`
- `host_id`
- `weekday`
- `start_time`
- `end_time`

### 4. availability_overrides

Stores date-specific availability exceptions.

Important fields:

- `id`
- `host_id`
- `override_date`
- `is_available`
- `start_time`
- `end_time`

### 5. holds

Stores temporary slot reservations.

Important fields:

- `id`
- `event_type_id`
- `slot_start`
- `expires_at`
- `status`
- `idempotency_key`
- `request_hash`
- `created_at`

Hold statuses:

- `active`
- `expired`
- `confirmed`

### 6. bookings

Stores confirmed and cancelled appointments.

Important fields:

- `id`
- `hold_id`
- `guest_name`
- `guest_email`
- `token_hash`
- `slot_start`
- `status`
- `cancellation_reason`
- `created_at`

Booking statuses:

- `confirmed`
- `cancelled`

### 7. notification_outbox

Stores notification events generated by booking operations.

Important fields:

- `id`
- `booking_id`
- `type`
- `payload`
- `created_at`
- `delivered_at`

The outbox allows booking changes and notification records to be persisted as part of the same application workflow.

---

## Booking Lifecycle

### Step 1: Slot Discovery

The guest requests available slots for a selected event and date.

The availability logic considers:

- Host weekly availability.
- Date-specific overrides.
- Event duration.
- Buffer times.
- Minimum booking notice.
- Booking horizon.
- Existing active holds.
- Existing confirmed bookings.

Candidate appointment start times are generated at 15-minute intervals.

### Step 2: Temporary Hold Creation

When a guest selects a slot, the frontend sends a hold creation request.

The backend:

1. Validates the event and requested slot.
2. Checks availability.
3. Uses a database transaction.
4. Locks the relevant event row during the critical operation.
5. Applies idempotency checks.
6. Creates a hold with a five-minute expiry.

### Step 3: Booking Confirmation

The guest provides their name and email.

The confirmation operation:

1. Retrieves and validates the hold.
2. Checks its status and expiry.
3. Performs the booking operation transactionally.
4. Creates the booking record.
5. Updates the hold status.
6. Generates a private management token.
7. Stores the token hash.
8. Creates a booking notification outbox record.

### Step 4: Booking Management

The guest can use the management token to retrieve or modify their booking.

Cancellation changes the booking status and records a notification event.

Rescheduling validates the requested time before updating the booking and its associated hold.

---

## Reliability and Design Decisions

### Database Transactions

Transactions are used for critical booking operations so related database changes are committed together.

### Row-Level Locking

The hold creation workflow locks the relevant event row during its critical section. This helps coordinate competing requests for the same event type.

### Idempotency

Hold creation accepts an `Idempotency-Key`.

The request hash is stored alongside the key to identify repeated requests and detect reuse of a key with different request data.

### Hold Expiration

Temporary holds expire after five minutes. Availability calculations consider active, unexpired holds rather than treating every historical hold as a reservation.

### Private Management Tokens

A management token is generated for booking management. Its SHA-256 hash is stored in the database rather than the raw token.

### Notification Outbox

Booking events are recorded in the notification outbox. The current local processor marks pending records as delivered through a development sink.

These decisions provide a foundation for more robust production booking workflows, although dedicated concurrency and load testing remain necessary.

---

## Availability and Time-Zone Handling

Scheduling applications must distinguish between the host's local time and the UTC timestamps used for persistence.

Slotbook uses:

- IANA time-zone identifiers.
- Luxon for date and time operations.
- Time-zone-aware PostgreSQL timestamps.
- Host-specific time zones for availability calculations.

For example, the same local appointment time in New York can correspond to different UTC timestamps depending on daylight saving time.

The application uses the host's configured time zone when interpreting availability rules and generating appointment slots.

This avoids treating every host as if they operate in the same time zone.

---

## API Reference

The application exposes REST-style API routes through Next.js.

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health/db` | Checks database connectivity |

### Hosts

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/hosts` | Retrieve hosts |
| POST | `/api/hosts` | Create a host |

### Event Types

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/event-types?hostId={hostId}` | Retrieve event types for a host |
| POST | `/api/event-types` | Create an event type |

### Availability

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/availability?hostId={hostId}` | Retrieve weekly availability |
| POST | `/api/availability` | Create a weekly availability rule |
| GET | `/api/availability/overrides?hostId={hostId}` | Retrieve date overrides |
| POST | `/api/availability/overrides` | Create a date override |

### Public Booking

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/public/events/{hostHandle}/{eventSlug}` | Retrieve public event information |
| GET | `/api/event-types/{eventTypeId}/slots?date={date}` | Retrieve available slots |
| POST | `/api/event-types/{eventTypeId}/holds` | Create a temporary hold |
| POST | `/api/holds/{holdId}/confirm` | Confirm a held slot |

### Booking Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/bookings/{bookingId}/manage` | Retrieve booking details |
| POST | `/api/bookings/{bookingId}/manage` | Cancel or reschedule a booking |

Booking management requests require the appropriate private bearer token.

### Host Bookings and Notifications

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/hosts/{hostId}/bookings` | Retrieve host bookings |
| GET | `/api/hosts/{hostId}/notifications` | Retrieve notification records |
| POST | `/api/hosts/{hostId}/notifications/process` | Process pending notifications |

---

## Project Structure

```text
Slotbook/
│
├── drizzle/
│   ├── meta/
│   └── *.sql
│
├── public/
│   └── Static assets
│
├── src/
│   ├── app/
│   │   ├── [hostHandle]/
│   │   │   └── [eventSlug]/
│   │   │       └── page.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── availability/
│   │   │   ├── bookings/
│   │   │   ├── event-types/
│   │   │   ├── health/
│   │   │   ├── holds/
│   │   │   ├── hosts/
│   │   │   └── public/
│   │   │
│   │   ├── booking/
│   │   │   └── manage/
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   │
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   └── booking/
│   │       └── availability-picker.tsx
│   │
│   ├── db/
│   │   ├── index.ts
│   │   └── schema.ts
│   │
│   └── lib/
│       └── slots.ts
│
├── docker-compose.yml
├── drizzle.config.ts
├── package.json
├── package-lock.json
├── tsconfig.json
└── README.md
```

---

## Getting Started

### Prerequisites

Install the following:

- Node.js 20 or later
- npm
- Docker Desktop
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/pranjalm1005/Slotbook.git
cd Slotbook
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the project root.

```env
DATABASE_URL="postgresql://slotbook:slotbook_dev_password@localhost:5432/slotbook"
```

For local development, these credentials match the supplied Docker Compose configuration.

Do not commit `.env` files or production credentials to GitHub.

### 4. Start PostgreSQL

```bash
docker compose up -d
```

Check the container:

```bash
docker compose ps
```

The PostgreSQL service is exposed on port `5432`.

### 5. Run Database Migrations

```bash
npx drizzle-kit migrate
```

### 6. Start the Development Server

```bash
npm run dev
```

Open the application:

http://localhost:3000

### 7. Create Initial Host and Scheduling Data

A fresh database starts without the demo host and event records.

Create a host using:

```http
POST /api/hosts
Content-Type: application/json
```

Example request body:

```json
{
  "name": "Demo Host",
  "handle": "demo",
  "email": "demo@example.com",
  "timezone": "Asia/Kolkata"
}
```

Use the returned host ID to create an event type through `POST /api/event-types`.

Then configure weekly availability using `POST /api/availability`.

The dashboard currently uses a seeded/demo host ID, so a fresh local database may require updating the dashboard's configured host ID to match the newly created host.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npx drizzle-kit generate` | Generate database migrations |
| `npx drizzle-kit migrate` | Apply database migrations |
| `npx drizzle-kit studio` | Open Drizzle Studio |

---

## Testing and Verification

The project has been manually verified through development and API testing.

Areas checked include:

- Database connectivity.
- Host creation and retrieval.
- Event type creation.
- Weekly availability configuration.
- Date-specific availability overrides.
- Available slot generation.
- Temporary hold creation.
- Booking confirmation.
- Booking cancellation.
- Booking rescheduling.
- Host booking retrieval.
- Notification outbox retrieval.
- Local notification processing.
- TypeScript compilation using `npx tsc --noEmit`.

### Testing Still Required

The following require additional automated verification:

- Dedicated concurrent booking tests.
- Automated end-to-end tests.
- Load and stress testing.
- Comprehensive daylight-saving transition tests.
- Further validation of event capacity greater than one.

Manual verification should not be interpreted as a completed automated test suite.

---

## Current Limitations

Slotbook is a development-stage project and is not presented as a production-ready scheduling service.

Known limitations include:

1. **Authentication:** The host dashboard currently uses a seeded/demo host configuration rather than a complete authentication and authorization system.

2. **Notification delivery:** Notifications are processed using a local development sink. No external email provider is integrated.

3. **Automated testing:** Dedicated automated end-to-end and concurrency test suites remain to be implemented.

4. **Capacity validation:** Capacity greater than one needs more extensive overlap and concurrent-booking validation.

5. **Rescheduling experience:** The booking management interface needs a more complete available-slot selection experience.

6. **Deployment:** The project has not yet been deployed to a production environment.

---

## Future Improvements

Potential next steps include:

- Implement secure host authentication and authorization.
- Add automated integration and end-to-end tests.
- Add dedicated concurrent booking tests.
- Improve capacity-based availability calculations.
- Integrate an email provider for booking notifications.
- Improve the rescheduling interface with live slot selection.
- Add recurring notification delivery and retry handling.
- Add structured logging and application monitoring.
- Deploy the application with production database configuration.
- Add CI/CD automation.

---

## Design Philosophy

The main engineering focus of Slotbook is booking correctness.

Rather than treating appointment scheduling as a simple calendar interface, the project models the booking process as a sequence of database-backed operations.

Temporary holds, idempotency, transactional updates, time-zone-aware availability, and a notification outbox form the foundation of the implementation.

The project is intended to demonstrate practical full-stack engineering, relational data modelling, API design, and the challenges involved in building a reliable appointment booking workflow.

---

## Repository

**GitHub:** https://github.com/pranjalm1005/Slotbook

Built with Next.js, TypeScript, PostgreSQL, and Drizzle ORM.
