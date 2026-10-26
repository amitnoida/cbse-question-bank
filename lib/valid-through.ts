const indiaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const indiaDate = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric",
});

/** Display the last valid day, rather than a midnight expiry boundary. */
export function formatValidThrough(value: string | null | undefined): string {
  if (!value) return "—";
  const expiry = new Date(value);
  if (!Number.isFinite(expiry.getTime())) return "—";
  // An expiry at the start of an Indian calendar day ends the preceding day.
  // Rolling coupons that expire during the day retain their actual expiry date.
  const isMidnight = indiaTime.format(expiry) === "00:00:00" && expiry.getUTCMilliseconds() === 0;
  return indiaDate.format(isMidnight ? new Date(expiry.getTime() - 1) : expiry);
}
