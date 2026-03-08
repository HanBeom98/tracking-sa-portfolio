export function populateYearSelector(yearSelect, startYear, endYear) {
  if (!yearSelect) return;
  for (let year = startYear; year >= endYear; year -= 1) {
    yearSelect.add(new Option(String(year), String(year)));
  }
}

export function populateMonthDaySelectors(monthSelect, daySelect, monthSuffix = "", daySuffix = "") {
  if (!monthSelect || !daySelect) return;

  for (let month = 1; month <= 12; month += 1) {
    monthSelect.add(new Option(`${month}${monthSuffix}`, String(month)));
  }
  for (let day = 1; day <= 31; day += 1) {
    daySelect.add(new Option(`${day}${daySuffix}`, String(day)));
  }
}
