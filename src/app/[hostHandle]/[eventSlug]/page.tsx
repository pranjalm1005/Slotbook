
import { notFound } from "next/navigation";
import AvailabilityPicker from "@/components/booking/availability-picker";

export const instant = false;

type PageProps = {
  params: Promise<{
    hostHandle: string;
    eventSlug: string;
  }>;
};

type EventDetails = {
  hostName: string;
  hostHandle: string;
  timezone: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  duration: number;
};

export default async function PublicBookingPage({
  params,
}: PageProps) {
  const { hostHandle, eventSlug } = await params;

  const response = await fetch(
    `http://localhost:3000/api/public/events/${encodeURIComponent(hostHandle)}/${encodeURIComponent(eventSlug)}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    notFound();
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    notFound();
  }

  const event: EventDetails = result.data;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f7fc] px-4 py-8 sm:px-6 lg:px-10">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-violet-200/30 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">

        {/* Brand header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-200">
              S
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Slotbook
            </span>
          </div>

          <span className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-medium text-slate-500 shadow-sm">
            Simple scheduling. Seamless booking.
          </span>
        </header>

        {/* Booking container */}
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_20px_70px_-25px_rgba(30,41,59,0.20)]">

          <div className="grid lg:grid-cols-[0.8fr_1.2fr]">

            {/* Event information panel */}
            <aside className="relative overflow-hidden bg-gradient-to-br from-[#172554] via-[#312e81] to-[#4338ca] p-8 text-white sm:p-10">

              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/10" />

              <div className="relative">
                <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-indigo-100">
                  APPOINTMENT BOOKING
                </span>

                <div className="mt-10">
                  <p className="text-sm font-medium text-indigo-200">
                    Meeting with
                  </p>

                  <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    {event.hostName}
                  </h1>

                  <div className="mt-8 h-px w-full bg-white/15" />

                  <p className="mt-8 text-sm font-medium text-indigo-200">
                    EVENT
                  </p>

                  <h2 className="mt-3 text-3xl font-bold leading-tight tracking-tight">
                    {event.eventName}
                  </h2>

                  <p className="mt-4 max-w-sm text-sm leading-7 text-indigo-100/80">
                    Choose a convenient time from the available slots and reserve your meeting in just a few steps.
                  </p>
                </div>

                <div className="mt-10 space-y-4">
                  <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-xl">
                      ◷
                    </div>
                    <div>
                      <p className="text-xs text-indigo-200">
                        Duration
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {event.duration} minutes
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/10 p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-xl">
                      ◎
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-indigo-200">
                        Time zone
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold">
                        {event.timezone}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 border-t border-white/15 pt-6">
                  <p className="text-sm font-medium text-white">
                    Your time matters.
                  </p>
                  <p className="mt-2 text-xs leading-6 text-indigo-200/80">
                    A simple and reliable way to schedule your next conversation.
                  </p>
                </div>
              </div>
            </aside>

            {/* Availability and booking panel */}
            <div className="min-w-0 p-6 sm:p-9 lg:p-10">
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
                  Schedule your meeting
                </p>

                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                  Select a date & time
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Browse the available dates and choose a time that works best for you.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <AvailabilityPicker
                  eventId={event.eventId}
                  timezone={event.timezone}
                />
              </div>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                <span className="text-indigo-500">✦</span>
                Powered by Slotbook
              </div>
            </div>

          </div>
        </section>

        <footer className="mt-7 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Slotbook. Appointment scheduling made simple.
        </footer>
      </div>
    </main>
  );
}
