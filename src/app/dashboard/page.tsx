"use client";

import { useEffect, useState } from "react";

type EventType = {
  id: string;
  name: string;
  slug: string;
  duration: number;
  capacity: number;
  active: boolean;
};

type AvailabilityRule = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

type AvailabilityOverride = {
  id: string;
  overrideDate: string;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
};

type Booking = {
  id: string;
  guestName: string;
  guestEmail: string;
  slotStart: string;
  status: "confirmed" | "cancelled";
  cancellationReason: string | null;
  createdAt: string;
  eventName: string;
  duration: number;
};

type Notification = {
  id: string;
  bookingId: string;
  type: string;
  createdAt: string;
  deliveredAt: string | null;
  guestName: string;
  eventName: string;
};

type Section =
  | "Dashboard"
  | "Event Types"
  | "Availability"
  | "Bookings"
  | "Notifications";

const HOST_ID = "9245b4a4-f762-4230-87f5-067ffe14d6aa";

const navigation: Section[] = [
  "Dashboard",
  "Event Types",
  "Availability",
  "Bookings",
  "Notifications",
];

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

const labelClass = "text-sm font-semibold text-slate-800";

const cardClass =
  "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

const buttonClass =
  "rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

export default function DashboardPage() {
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<Section>("Dashboard");

  // Create event type form states
  const [eventName, setEventName] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [duration, setDuration] = useState("30");
  const [capacity, setCapacity] = useState("1");
  const [bufferBefore, setBufferBefore] = useState("5");
  const [bufferAfter, setBufferAfter] = useState("5");
  const [minNotice, setMinNotice] = useState("240");
  const [bookingHorizon, setBookingHorizon] = useState("30");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Weekly availability states
  const [availabilityRules, setAvailabilityRules] = useState<
    AvailabilityRule[]
  >([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilitySuccess, setAvailabilitySuccess] = useState("");
  const [savingAvailability, setSavingAvailability] = useState(false);

  const [weekday, setWeekday] = useState("1");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  // Date override states
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideAvailable, setOverrideAvailable] = useState(false);
  const [overrideStartTime, setOverrideStartTime] = useState("09:00");
  const [overrideEndTime, setOverrideEndTime] = useState("17:00");

  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState("");
  const [overrideSuccess, setOverrideSuccess] = useState("");

  // Bookings states
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  // Notifications states
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [processingNotifications, setProcessingNotifications] = useState(false);
  const [notificationSuccess, setNotificationSuccess] = useState("");

  useEffect(() => {
    async function loadEvents() {
      try {
        const response = await fetch(`/api/event-types?hostId=${HOST_ID}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load events");
        }

        setEvents(result.data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  useEffect(() => {
    if (activeSection === "Availability") {
      loadAvailability();
      loadOverrides();
    }

    if (activeSection === "Bookings") {
      loadBookings();
    }

    if (activeSection === "Notifications") {
      loadNotifications();
    }
  }, [activeSection]);

  async function createEventType(e: React.FormEvent) {
    e.preventDefault();

    setCreating(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const response = await fetch("/api/event-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostId: HOST_ID,
          name: eventName,
          slug: eventSlug,
          duration: Number(duration),
          capacity: Number(capacity),
          bufferBefore: Number(bufferBefore),
          bufferAfter: Number(bufferAfter),
          minNotice: Number(minNotice),
          bookingHorizon: Number(bookingHorizon),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to create event type");
      }

      setEvents((previous) => [result.data, ...previous]);
      setCreateSuccess("Event type created successfully!");

      setEventName("");
      setEventSlug("");
      setDuration("30");
      setCapacity("1");
      setBufferBefore("5");
      setBufferAfter("5");
      setMinNotice("240");
      setBookingHorizon("30");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setCreating(false);
    }
  }

  async function loadAvailability() {
    setAvailabilityLoading(true);
    setAvailabilityError("");

    try {
      const response = await fetch(
        `/api/availability?hostId=${HOST_ID}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load availability");
      }

      setAvailabilityRules(result.data);
    } catch (err) {
      setAvailabilityError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function loadOverrides() {
    setOverrideLoading(true);
    setOverrideError("");

    try {
      const response = await fetch(
        `/api/availability/overrides?hostId=${HOST_ID}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load date overrides");
      }

      setOverrides(result.data);
    } catch (err) {
      setOverrideError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setOverrideLoading(false);
    }
  }

  async function loadBookings() {
    setBookingsLoading(true);
    setBookingsError("");

    try {
      const response = await fetch(
        `/api/hosts/${HOST_ID}/bookings`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to load bookings");
      }

      setBookings(result.data);
    } catch (err) {
      setBookingsError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setBookingsLoading(false);
    }
  }

  async function loadNotifications() {
    setNotificationsLoading(true);
    setNotificationsError("");
    setNotificationSuccess("");

    try {
      const response = await fetch(
        `/api/hosts/${HOST_ID}/notifications`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load notifications"
        );
      }

      setNotifications(result.data);
    } catch (err) {
      setNotificationsError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function processNotifications() {
    setProcessingNotifications(true);
    setNotificationsError("");
    setNotificationSuccess("");

    try {
      const response = await fetch(
        `/api/hosts/${HOST_ID}/notifications/process`,
        { method: "POST" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to process notifications"
        );
      }

      await loadNotifications();

      setNotificationSuccess(
        `${result.processedCount} notification(s) processed successfully.`
      );
    } catch (err) {
      setNotificationsError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );
    } finally {
      setProcessingNotifications(false);
    }
  }

  async function addOverride(e: React.FormEvent) {
    e.preventDefault();

    setOverrideSaving(true);
    setOverrideError("");
    setOverrideSuccess("");

    try {
      const response = await fetch("/api/availability/overrides", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostId: HOST_ID,
          date: overrideDate,
          isAvailable: overrideAvailable,
          startTime: overrideAvailable ? overrideStartTime : undefined,
          endTime: overrideAvailable ? overrideEndTime : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save date override");
      }

      setOverrides((previous) =>
        [...previous, result.data].sort((a, b) =>
          a.overrideDate.localeCompare(b.overrideDate)
        )
      );

      setOverrideSuccess("Date override saved successfully!");
      setOverrideDate("");
    } catch (err) {
      setOverrideError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setOverrideSaving(false);
    }
  }

  async function addAvailability(e: React.FormEvent) {
    e.preventDefault();

    setSavingAvailability(true);
    setAvailabilityError("");
    setAvailabilitySuccess("");

    try {
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostId: HOST_ID,
          weekday: Number(weekday),
          startTime,
          endTime,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to save availability");
      }

      setAvailabilityRules((previous) =>
        [...previous, result.data].sort(
          (a, b) => a.weekday - b.weekday
        )
      );

      setAvailabilitySuccess("Availability saved successfully!");
    } catch (err) {
      setAvailabilityError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setSavingAvailability(false);
    }
  }

  function renderEvents() {
    if (loading) {
      return (
        <p className="mt-6 text-sm font-medium text-slate-600">
          Loading event types...
        </p>
      );
    }

    if (error) {
      return (
        <p className="mt-6 text-sm font-medium text-red-700">
          {error}
        </p>
      );
    }

    if (events.length === 0) {
      return (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          No event types found.
        </p>
      );
    }

    return (
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {events.map((event) => (
          <article
            key={event.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-lg font-bold tracking-tight text-slate-950">
                {event.name}
              </h4>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  event.active
                    ? "bg-green-50 text-green-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {event.active ? "Active" : "Inactive"}
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              {event.duration} minutes · Capacity {event.capacity}
            </p>

            <p className="mt-3 break-all rounded-lg bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
              /pranjal/{event.slug}
            </p>
          </article>
        ))}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white px-5 py-7 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-black text-white shadow-lg shadow-indigo-200">
              S
            </div>

            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">
                Slotbook<span className="text-indigo-600">.</span>
              </h1>
              <p className="text-xs font-medium tracking-wide text-slate-500">
                SMART BOOKING PLATFORM
              </p>
            </div>
          </div>

          <nav className="mt-10 flex flex-col gap-2">
            {navigation.map((item) => (
              <button
                key={item}
                onClick={() => setActiveSection(item)}
                className={`block w-full rounded-xl px-4 py-3.5 text-left text-sm font-semibold transition-all duration-200 ${
                  activeSection === item
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>

          <div className="mt-10 border-t border-slate-200 pt-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Host profile
            </p>
            <p className="mt-2 font-semibold text-slate-900">
              Pranjal Mahapatra
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Asia/Kolkata
            </p>
          </div>
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1 px-6 py-8 md:px-10 md:py-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Host dashboard
              </p>

              <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">
                {activeSection === "Dashboard"
                  ? "Welcome, Pranjal"
                  : activeSection}
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                Manage your events and booking availability.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-slate-500">
                Timezone
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                Asia/Kolkata
              </p>
            </div>
          </header>

          {/* Dashboard */}
          {activeSection === "Dashboard" && (
            <>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <p className="text-sm font-semibold text-slate-500">
                    Event types
                  </p>
                  <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
                    {events.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <p className="text-sm font-semibold text-slate-500">
                    Host status
                  </p>
                  <p className="mt-3 text-2xl font-extrabold text-green-700">
                    Active
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <p className="text-sm font-semibold text-slate-500">
                    Public booking page
                  </p>
                  <a
                    href="/pranjal/30-minute-consultation"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block font-bold text-indigo-700 hover:text-indigo-900 hover:underline"
                  >
                    View booking page →
                  </a>
                </div>
              </div>

              <section className="mt-10">
                <h3 className="text-xl font-extrabold tracking-tight text-slate-950">
                  Your event types
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Events available for guests to book.
                </p>
                {renderEvents()}
              </section>
            </>
          )}

          {/* Event Types */}
          {activeSection === "Event Types" && (
            <section className="mt-10">
              <h3 className="text-xl font-extrabold tracking-tight text-slate-950">
                Manage event types
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Create and manage the booking events available to your guests.
              </p>

              <form
                onSubmit={createEventType}
                className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <h4 className="text-xl font-extrabold tracking-tight text-slate-950">
                  Create a new event type
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Configure the duration, capacity, and booking rules.
                </p>

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Event name</label>
                    <input
                      required
                      value={eventName}
                      onChange={(e) => {
                        setEventName(e.target.value);
                        setEventSlug(
                          e.target.value
                            .toLowerCase()
                            .trim()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-|-$/g, "")
                        );
                      }}
                      placeholder="e.g. 60 Minute Consultation"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>URL slug</label>
                    <input
                      required
                      value={eventSlug}
                      onChange={(e) => setEventSlug(e.target.value)}
                      placeholder="60-minute-consultation"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Duration (minutes)</label>
                    <input
                      type="number"
                      required
                      min="15"
                      max="120"
                      step="15"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Capacity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Buffer before (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={bufferBefore}
                      onChange={(e) => setBufferBefore(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Buffer after (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={bufferAfter}
                      onChange={(e) => setBufferAfter(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Minimum notice (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={minNotice}
                      onChange={(e) => setMinNotice(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Booking horizon (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={bookingHorizon}
                      onChange={(e) => setBookingHorizon(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                {createError && (
                  <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
                    {createError}
                  </p>
                )}

                {createSuccess && (
                  <p className="mt-5 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
                    {createSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={creating}
                  className={`mt-6 ${buttonClass}`}
                >
                  {creating ? "Creating..." : "Create Event Type"}
                </button>
              </form>

              <div className="mt-10">
                <h3 className="text-xl font-extrabold tracking-tight text-slate-950">
                  Existing event types
                </h3>
                {renderEvents()}
              </div>
            </section>
          )}

          {/* Availability */}
          {activeSection === "Availability" && (
            <section className="mt-10 space-y-6">
              <div className={cardClass}>
                <h3 className="text-xl font-extrabold text-slate-950">
                  Weekly availability
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Configure the days and hours when guests can book appointments.
                  All times are in Asia/Kolkata.
                </p>

                <form
                  onSubmit={addAvailability}
                  className="mt-6 grid gap-5 md:grid-cols-2"
                >
                  <div>
                    <label className={labelClass}>Weekday</label>
                    <select
                      value={weekday}
                      onChange={(e) => setWeekday(e.target.value)}
                      className={inputClass}
                    >
                      {weekdays.map((day, index) => (
                        <option key={day} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass}>Start time</label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>End time</label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={savingAvailability}
                      className={`w-full ${buttonClass}`}
                    >
                      {savingAvailability ? "Saving..." : "Add Availability"}
                    </button>
                  </div>
                </form>

                {availabilityError && (
                  <p className="mt-4 text-sm font-medium text-red-700">
                    {availabilityError}
                  </p>
                )}

                {availabilitySuccess && (
                  <p className="mt-4 text-sm font-medium text-green-700">
                    {availabilitySuccess}
                  </p>
                )}
              </div>

              <div className={cardClass}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-extrabold text-slate-950">
                    Saved availability
                  </h3>

                  <button
                    type="button"
                    onClick={loadAvailability}
                    disabled={availabilityLoading}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                  >
                    {availabilityLoading ? "Loading..." : "Refresh"}
                  </button>
                </div>

                {availabilityLoading && availabilityRules.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    Loading availability...
                  </p>
                ) : availabilityRules.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    No availability rules loaded. Click Refresh to load your saved rules.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {availabilityRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between rounded-xl bg-slate-50 p-4"
                      >
                        <p className="font-semibold text-slate-900">
                          {weekdays[rule.weekday]}
                        </p>
                        <p className="text-sm font-medium text-slate-600">
                          {rule.startTime} – {rule.endTime}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Date Overrides */}
              <div className={cardClass}>
                <h3 className="text-xl font-extrabold text-slate-950">
                  Date Overrides
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Set specific dates as unavailable or provide different
                  working hours for a particular date.
                </p>

                <form
                  onSubmit={addOverride}
                  className="mt-6 grid gap-5 md:grid-cols-2"
                >
                  <div>
                    <label className={labelClass}>Override date</label>
                    <input
                      type="date"
                      required
                      value={overrideDate}
                      onChange={(e) => setOverrideDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Availability</label>
                    <select
                      value={overrideAvailable ? "available" : "unavailable"}
                      onChange={(e) =>
                        setOverrideAvailable(e.target.value === "available")
                      }
                      className={inputClass}
                    >
                      <option value="unavailable">Unavailable (Holiday)</option>
                      <option value="available">Available (Custom hours)</option>
                    </select>
                  </div>

                  {overrideAvailable && (
                    <>
                      <div>
                        <label className={labelClass}>Start time</label>
                        <input
                          type="time"
                          required
                          value={overrideStartTime}
                          onChange={(e) =>
                            setOverrideStartTime(e.target.value)
                          }
                          className={inputClass}
                        />
                      </div>

                      <div>
                        <label className={labelClass}>End time</label>
                        <input
                          type="time"
                          required
                          value={overrideEndTime}
                          onChange={(e) =>
                            setOverrideEndTime(e.target.value)
                          }
                          className={inputClass}
                        />
                      </div>
                    </>
                  )}

                  {overrideError && (
                    <p className="text-sm font-medium text-red-700 md:col-span-2">
                      {overrideError}
                    </p>
                  )}

                  {overrideSuccess && (
                    <p className="text-sm font-medium text-green-700 md:col-span-2">
                      {overrideSuccess}
                    </p>
                  )}

                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      disabled={overrideSaving}
                      className={buttonClass}
                    >
                      {overrideSaving ? "Saving..." : "Save Date Override"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Saved date overrides */}
              <div className={cardClass}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-extrabold text-slate-950">
                    Saved date overrides
                  </h3>

                  <button
                    type="button"
                    onClick={loadOverrides}
                    disabled={overrideLoading}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                  >
                    {overrideLoading ? "Loading..." : "Refresh"}
                  </button>
                </div>

                {overrideLoading ? (
                  <p className="mt-4 text-sm text-slate-500">
                    Loading date overrides...
                  </p>
                ) : overrides.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    No date overrides found.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {overrides.map((override) => (
                      <div
                        key={override.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"
                      >
                        <p className="font-semibold text-slate-900">
                          {override.overrideDate}
                        </p>

                        <p className="text-sm font-medium text-slate-600">
                          {override.isAvailable
                            ? `Available · ${override.startTime} – ${override.endTime}`
                            : "Unavailable · Holiday"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Bookings */}
          {activeSection === "Bookings" && (
            <section className="mt-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-950">
                    All bookings
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    View your guest appointments and booking status.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadBookings}
                  disabled={bookingsLoading}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                >
                  {bookingsLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              {bookingsError && (
                <p className="mt-4 text-sm text-red-700">
                  {bookingsError}
                </p>
              )}

              {bookingsLoading && bookings.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  Loading bookings...
                </p>
              ) : bookings.length === 0 ? (
                <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                  No bookings found.
                </p>
              ) : (
                <>
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className={cardClass}>
                      <p className="text-sm font-semibold text-slate-500">
                        Total bookings
                      </p>
                      <p className="mt-3 text-3xl font-extrabold text-slate-950">
                        {bookings.length}
                      </p>
                    </div>

                    <div className={cardClass}>
                      <p className="text-sm font-semibold text-slate-500">
                        Confirmed
                      </p>
                      <p className="mt-3 text-3xl font-extrabold text-green-700">
                        {bookings.filter((b) => b.status === "confirmed").length}
                      </p>
                    </div>

                    <div className={cardClass}>
                      <p className="text-sm font-semibold text-slate-500">
                        Cancelled
                      </p>
                      <p className="mt-3 text-3xl font-extrabold text-red-700">
                        {bookings.filter((b) => b.status === "cancelled").length}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {bookings.map((booking) => (
                      <article
                        key={booking.id}
                        className={`${cardClass} transition-all duration-200 hover:shadow-md`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-slate-950">
                              {booking.guestName}
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">
                              {booking.guestEmail}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              booking.status === "confirmed"
                                ? "bg-green-50 text-green-800"
                                : "bg-red-50 text-red-800"
                            }`}
                          >
                            {booking.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Event
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {booking.eventName} · {booking.duration} minutes
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Appointment
                            </p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {new Date(booking.slotStart).toLocaleString(
                                "en-IN",
                                {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                  timeZone: "Asia/Kolkata",
                                }
                              )}
                            </p>
                            <p className="text-xs text-slate-500">
                              Asia/Kolkata
                            </p>
                          </div>
                        </div>

                        {booking.cancellationReason && (
                          <p className="mt-3 text-sm text-red-700">
                            Cancellation reason: {booking.cancellationReason}
                          </p>
                        )}

                        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                          Booking ID: {booking.id}
                        </p>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* Notifications */}
          {activeSection === "Notifications" && (
            <section className="mt-10 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-950">
                    Notifications
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    View and process booking notifications.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={loadNotifications}
                    disabled={notificationsLoading}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                  >
                    Refresh
                  </button>

                  <button
                    onClick={processNotifications}
                    disabled={processingNotifications}
                    className={buttonClass}
                  >
                    {processingNotifications
                      ? "Processing..."
                      : "Process Pending"}
                  </button>
                </div>
              </div>

              {notificationsError && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {notificationsError}
                </p>
              )}

              {notificationSuccess && (
                <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                  {notificationSuccess}
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className={cardClass}>
                  <p className="text-sm font-semibold text-slate-500">
                    Total Notifications
                  </p>
                  <p className="mt-3 text-3xl font-extrabold text-slate-950">
                    {notifications.length}
                  </p>
                </div>

                <div className={cardClass}>
                  <p className="text-sm font-semibold text-slate-500">
                    Delivered
                  </p>
                  <p className="mt-3 text-3xl font-extrabold text-green-700">
                    {notifications.filter((n) => n.deliveredAt).length}
                  </p>
                </div>

                <div className={cardClass}>
                  <p className="text-sm font-semibold text-slate-500">
                    Pending
                  </p>
                  <p className="mt-3 text-3xl font-extrabold text-amber-600">
                    {notifications.filter((n) => !n.deliveredAt).length}
                  </p>
                </div>
              </div>

              {notificationsLoading ? (
                <p className="text-sm text-slate-500">
                  Loading notifications...
                </p>
              ) : notifications.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                  No notifications found.
                </p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <article
                      key={notification.id}
                      className={`${cardClass} transition-all duration-200 hover:shadow-md`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-bold capitalize text-slate-950">
                            {notification.type.replaceAll("_", " ")}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {notification.guestName} · {notification.eventName}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            notification.deliveredAt
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {notification.deliveredAt ? "Delivered" : "Pending"}
                        </span>
                      </div>

                      <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                        <p>Booking ID: {notification.bookingId}</p>
                        <p>
                          Created:{" "}
                          {new Date(notification.createdAt).toLocaleString(
                            "en-IN",
                            { timeZone: "Asia/Kolkata" }
                          )}
                        </p>
                        <p>
                          Delivered:{" "}
                          {notification.deliveredAt
                            ? new Date(notification.deliveredAt).toLocaleString(
                                "en-IN",
                                { timeZone: "Asia/Kolkata" }
                              )
                            : "Not delivered yet"}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>
      </div>
    </main>
  );
}