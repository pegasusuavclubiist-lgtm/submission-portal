/** The pre-configured submission deadline (SUBMISSION_DEADLINE, ISO 8601 with offset). */
export function getDeadline(): Date {
  const raw = process.env.SUBMISSION_DEADLINE;
  if (!raw) {
    throw new Error("SUBMISSION_DEADLINE is not set");
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `SUBMISSION_DEADLINE is not a valid date: "${raw}". Use ISO 8601, e.g. 2026-10-12T18:00:00+05:30`
    );
  }
  return date;
}

/** Display-only time zone. The late logic always compares absolute instants. */
export function eventTimeZone(): string {
  return process.env.EVENT_TIMEZONE || "UTC";
}

export function formatDateTime(value: Date | string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: eventTimeZone(),
  }).format(new Date(value));
}
