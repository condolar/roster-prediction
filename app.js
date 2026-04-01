document.addEventListener("DOMContentLoaded", () => {
  // ==========================
  // 20-week roster pattern
  // ==========================
  // Pattern: [week][day] where day = 0..6 for Mon..Sun
  const pattern = [
    ["Work","Work","Work","Work","Work","FRD","FDO"], // 1
    ["FDO","FDO","Work","Work","Work","Work","Work"], // 2
    ["FDO","FDO","Work","Work","Work","Work","Work"], // 3
    ["FRD","FDO","FDO","FDO","Work","Work","Work"],   // 4
    ["Work","Work","FDO","FDO","FDO","Work","Work"],  // 5
    ["Work","Work","Work","FRD","FDO","FDO","FDO"],   // 6
    ["Work","Work","Work","Work","Work","FDO","FDO"], // 7
    ["FDO","Work","Work","Work","Work","Work","FDO"], // 8
    ["FDO","FDO","Work","Work","Work","Work","Work"], // 9
    ["FDO","FDO","FDO","Work","Work","Work","Work"],  // 10
    ["Work","FRD","FDO","FDO","FDO","Work","Work"],   // 11
    ["Work","Work","Work","FDO","FDO","FDO","Work"],  // 12
    ["Work","Work","Work","Work","FRD","FDO","FDO"],  // 13
    ["FDO","Work","Work","Work","Work","Work","FRD"], // 14
    ["FDO","FDO","FDO","Work","Work","Work","Work"],  // 15
    ["Work","FDO","FDO","Work","Work","Work","Work"], // 16
    ["Work","FDO","FDO","FDO","Work","Work","Work"],  // 17
    ["Work","Work","FDO","FDO","Work","Work","Work"], // 18
    ["Work","Work","FRD","FDO","FDO","FDO","Work"],   // 19
    ["Work","Work","Work","Work","FDO","FDO","FDO"],  // 20
  ];

  const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // ==========================
  // DOM elements
  // ==========================
  const startDateEl = document.getElementById("startDate");
  const startWeekEl = document.getElementById("startWeek");
  const monthsEl = document.getElementById("months");
  const icsBtn = document.getElementById("icsBtn");
  const daysOffBtn = document.getElementById("daysOffBtn");
  const errEl = document.getElementById("err");
  const summaryEl = document.getElementById("summary");
  const calendarEl = document.getElementById("calendar");

  // If the old "Show projection" button still exists, hide it (no longer needed)
  const renderBtn = document.getElementById("renderBtn");
  if (renderBtn) renderBtn.style.display = "none";

  // Populate week dropdown (1..20)
  startWeekEl.innerHTML = "";
  for (let i = 1; i <= 20; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `Week ${i}`;
    startWeekEl.appendChild(opt);
  }

  // ==========================
  // UI error helpers
  // ==========================
  function showError(msg) {
    if (!msg) {
      errEl.style.display = "none";
      errEl.textContent = "";
      return;
    }
    errEl.style.display = "block";
    errEl.textContent = msg;
  }

  // Surface runtime errors on the page (helps iPhone debugging)
  window.addEventListener("error", (e) => {
    showError(`Error: ${e.message}`);
  });

  // ==========================
  // Date helpers (local time)
  // ==========================
  function parseDateLocal(yyyyMmDd) {
    const [y, m, d] = yyyyMmDd.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  // Monday-based weekday index: Mon=0..Sun=6
  function monIndex(date) {
    // JS: Sun=0..Sat=6 -> convert to Mon=0..Sun=6
    return (date.getDay() + 6) % 7;
  }

  function startOfWeekMonday(date) {
    return addDays(date, -monIndex(date));
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 0, 0, 0, 0);
  }

  function addMonths(date, n) {
    // Use day=1 to avoid month rollover issues
    return new Date(date.getFullYear(), date.getMonth() + n, 1, 0, 0, 0, 0);
  }

  function monthLabel(d) {
    // e.g. Jan 2026
    return `${monthNames[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  }

  // Proper modulo for negatives
  function mod(n, m) {
    return ((n % m) + m) % m;
  }

  // ==========================
  // Roster lookup (works backwards too)
  // ==========================
  function getStatus(anchorMonday, startWeek1to20, date) {
    const diffDays = Math.floor((date - anchorMonday) / (24 * 60 * 60 * 1000));

    const weekOffset = Math.floor(diffDays / 7);
    const weekIndex = mod((startWeek1to20 - 1) + weekOffset, 20); // 0..19
    const dayIndex = mod(diffDays, 7); // 0..6

    return {
      weekNumber: weekIndex + 1,
      dayIndex,
      status: pattern[weekIndex][dayIndex],
    };
  }

  function badgeClass(status) {
    if (status === "Work") return "badge work";
    if (status === "FDO") return "badge fdo";
    return "badge frd";
  }

  // ==========================
  // Render calendar preview
  // ==========================
  function buildCalendar() {
    try {
      showError("");

      if (!startDateEl.value) {
        summaryEl.textContent = "";
        calendarEl.innerHTML = "";
        showError("Please pick a start week date.");
        return;
      }

      const selectedDate = parseDateLocal(startDateEl.value);
      const startWeek = Number(startWeekEl.value);
      const months = Number(monthsEl.value);

      const anchorMonday = startOfWeekMonday(selectedDate);

      // Display: from month containing the anchor Monday, for N months
      const displayStart = startOfMonth(anchorMonday);
      const displayEndExclusive = addMonths(displayStart, months);
      const displayEnd = addDays(displayEndExclusive, -1);

      summaryEl.textContent = `Displaying ${months} month${months === 1 ? "" : "s"}: ${monthLabel(displayStart)} – ${monthLabel(displayEnd)}`;

      calendarEl.innerHTML = "";

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let m = 0; m < months; m++) {
        const monthStart = addMonths(displayStart, m);
        const monthEnd = endOfMonth(monthStart);

        const monthCard = document.createElement("div");
        monthCard.className = "card";
        monthCard.style.marginBottom = "0";

        const title = document.createElement("div");
        title.className = "monthTitle";
        title.textContent = `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
        monthCard.appendChild(title);

        const table = document.createElement("table");
        table.className = "cal";

        const thead = document.createElement("thead");
        const trHead = document.createElement("tr");
        for (const dn of dayNames) {
          const th = document.createElement("th");
          th.textContent = dn;
          trHead.appendChild(th);
        }
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        // Grid starts at the Monday on/before the 1st of the month
        const gridStart = startOfWeekMonday(monthStart);
        let cursor = new Date(gridStart);

        for (let row = 0; row < 6; row++) {
          const tr = document.createElement("tr");

          for (let col = 0; col < 7; col++) {
            const td = document.createElement("td");

            const outside = cursor.getMonth() !== monthStart.getMonth();
            if (outside) td.classList.add("outside");
            if (sameDay(cursor, today)) td.classList.add("todayRing");

            const top = document.createElement("div");
            top.className = "cellTop";

            const dayNum = document.createElement("div");
            dayNum.className = "dayNum";
            dayNum.textContent = cursor.getDate();

            const s = getStatus(anchorMonday, startWeek, cursor);

            const badge = document.createElement("span");
            badge.className = badgeClass(s.status);
            badge.textContent = s.status;

            top.appendChild(dayNum);
            top.appendChild(badge);

            td.appendChild(top);
            tr.appendChild(td);

            cursor = addDays(cursor, 1);
          }

          tbody.appendChild(tr);

          // Stop early once we're beyond the end of the month and aligned back to Monday
          if (cursor > monthEnd && monIndex(cursor) === 0) break;
        }

        table.appendChild(tbody);
        monthCard.appendChild(table);
        calendarEl.appendChild(monthCard);
      }
    } catch (e) {
      showError(`Error: ${e.message}`);
    }
  }

  // ==========================
  // ICS download
  // ==========================
  function icsDate(d) { return fmtDate(d).replace(/-/g, ""); }

  function escapeICS(text) {
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function downloadICS() {
    try {
      showError("");

      if (!startDateEl.value) {
        showError("Please pick a start week date first.");
        return;
      }

      const selectedDate = parseDateLocal(startDateEl.value);
      const startWeek = Number(startWeekEl.value);
      const months = Number(monthsEl.value);

      const anchorMonday = startOfWeekMonday(selectedDate);
      const exportStart = startOfMonth(anchorMonday);
      const exportEndExclusive = addMonths(exportStart, months);

      const now = new Date();
      const dtstamp =
        `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}` +
        `T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;

      const calName = `Roster (${months}m ${monthLabel(exportStart)}–${monthLabel(addDays(exportEndExclusive, -1))})`;

      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//RosterProjection//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:" + escapeICS(calName),
        "X-WR-TIMEZONE:Europe/London",
      ];

      let cursor = new Date(exportStart);
      while (cursor < exportEndExclusive) {
        const s = getStatus(anchorMonday, startWeek, cursor);

        const dtStart = icsDate(cursor);
        const dtEnd = icsDate(addDays(cursor, 1)); // all-day end is exclusive
        const uid = `roster-${dtStart}-w${s.weekNumber}@rosterprojection`;

        lines.push(
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART;VALUE=DATE:${dtStart}`,
          `DTEND;VALUE=DATE:${dtEnd}`,
          `SUMMARY:${escapeICS(s.status)}`,
          `DESCRIPTION:${escapeICS(`Roster Week ${s.weekNumber} • ${dayNames[s.dayIndex]} • ${fmtDate(cursor)}`)}`,
          "END:VEVENT"
        );

        cursor = addDays(cursor, 1);
      }

      lines.push("END:VCALENDAR");

      const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "roster.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (e) {
      showError(`Error: ${e.message}`);
    }
  }

  // ==========================
  // Days off ICS download
  // ==========================
  function downloadDaysOffICS() {
    try {
      showError("");

      if (!startDateEl.value) {
        showError("Please pick a start week date first.");
        return;
      }

      const selectedDate = parseDateLocal(startDateEl.value);
      const startWeek = Number(startWeekEl.value);
      const months = Number(monthsEl.value);

      const anchorMonday = startOfWeekMonday(selectedDate);
      const exportStart = startOfMonth(anchorMonday);
      const exportEndExclusive = addMonths(exportStart, months);

      const now = new Date();
      const dtstamp =
        `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}` +
        `T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;

      const calName = `Days Off (${months}m ${monthLabel(exportStart)}–${monthLabel(addDays(exportEndExclusive, -1))})`;

      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//RosterProjection//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:" + escapeICS(calName),
        "X-WR-TIMEZONE:Europe/London",
      ];

      let cursor = new Date(exportStart);
      while (cursor < exportEndExclusive) {
        const s = getStatus(anchorMonday, startWeek, cursor);

        // Only include days off (FDO and FRD, exclude Work days)
        if (s.status !== "Work") {
          const dtStart = icsDate(cursor);
          const dtEnd = icsDate(addDays(cursor, 1)); // all-day end is exclusive
          const uid = `roster-${dtStart}-w${s.weekNumber}@rosterprojection`;

          lines.push(
            "BEGIN:VEVENT",
            `UID:${uid}`,
            `DTSTAMP:${dtstamp}`,
            `DTSTART;VALUE=DATE:${dtStart}`,
            `DTEND;VALUE=DATE:${dtEnd}`,
            `SUMMARY:${escapeICS(s.status)}`,
            `DESCRIPTION:${escapeICS(`Roster Week ${s.weekNumber} • ${dayNames[s.dayIndex]} • ${fmtDate(cursor)}`)}`,
            "END:VEVENT"
          );
        }

        cursor = addDays(cursor, 1);
      }

      lines.push("END:VCALENDAR");

      const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "roster-days-off.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (e) {
      showError(`Error: ${e.message}`);
    }
  }

  // ==========================
  // Auto-update wiring
  // ==========================
  startDateEl.addEventListener("change", buildCalendar);
  startWeekEl.addEventListener("change", buildCalendar);
  monthsEl.addEventListener("change", buildCalendar);

  icsBtn.addEventListener("click", downloadICS);
  daysOffBtn.addEventListener("click", downloadDaysOffICS);

  // Default: today
  startDateEl.value = fmtDate(new Date());

  // Initial render
  buildCalendar();
});
