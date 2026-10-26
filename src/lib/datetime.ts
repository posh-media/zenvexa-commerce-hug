/** Shared “ends tonight” target for flash sale surfaces (server + client safe). */
export function endOfTodayISO() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}
