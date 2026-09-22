import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// End to end pass against a running app and a real Supabase project. It
// creates its own tutor, staff and second tutor accounts and removes them
// afterwards when SUPABASE_SERVICE_ROLE_KEY is available. Every user facing
// flow is exercised once, in the order a tutor and then a staff member would
// meet them.

test.describe.configure({ mode: "serial" });
test.setTimeout(360_000);

const unique = Date.now();
const password = "Smoke1234!";
const tutor = { name: `Smoke Tutor ${unique}`, email: `smoke-tutor-${unique}@lvaep.demo` };
const otherTutor = { name: `Smoke Other ${unique}`, email: `smoke-other-${unique}@lvaep.demo` };
const staff = { name: `Smoke Staff ${unique}`, email: `smoke-staff-${unique}@lvaep.demo` };
const studentName = `Smoke Student ${unique}`;
const renamedStudent = `${studentName} Jr`;

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth() + 1;
const dayOfMonth = today.getDate();
const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
const monthName = today.toLocaleString("en-US", { month: "long" });
const day = (n: number) => `${monthPrefix}-${String(n).padStart(2, "0")}`;
const daysInMonth = new Date(year, month, 0).getDate();

/** formatHours as the app prints it: no trailing zeros. */
function fmt(value: number): string {
  const rounded = Math.round(value * 4) / 4;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, "");
}

/** What the month holds once every calendar step has run: day -> hours or code. */
const FINAL_MONTH: Record<number, number | "TA" | "SA" | "H"> = {
  1: 1.5, // single session
  2: 1, // first weekly day
  3: "TA", // palette
  4: "SA", // palette
  5: "H", // popover
  9: "H", // 2 hours, replaced through the palette
  16: 1.5, // this and future edit
};
const hoursUpToToday = Object.entries(FINAL_MONTH)
  .filter(([d, v]) => Number(d) <= dayOfMonth && typeof v === "number")
  .reduce((sum, [, v]) => sum + (v as number), 0);
const monthTotal = Object.values(FINAL_MONTH).reduce<number>((sum, v) => sum + (typeof v === "number" ? v : 0), 0);

async function signUp(page: Page, who: { name: string; email: string }, role: "tutor" | "staff") {
  await page.goto("/signup");
  await page.fill("#fullName", who.name);
  await page.fill("#email", who.email);
  await page.fill("#password", password);
  await page.check(`input[value=${role}]`);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === (role === "staff" ? "/staff" : "/home"));
}

async function signIn(page: Page, who: { email: string }, role: "tutor" | "staff") {
  await page.goto("/login");
  await page.fill("#email", who.email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === (role === "staff" ? "/staff" : "/home"));
}

async function signOut(page: Page) {
  await page.click("button:has-text('Sign out')");
  await page.waitForURL((u) => u.pathname === "/login");
}

/** A day just written shows a faded chip until the server confirms it; wait for that. */
async function settled(page: Page, iso: string) {
  await expect(page.locator(`button[data-iso="${iso}"] span.opacity-60`)).toHaveCount(0);
}

/** Opens a day's popover and returns once its form is showing. */
async function openDay(page: Page, iso: string) {
  await settled(page, iso);
  await page.click(`button[data-iso="${iso}"]`);
  await expect(page.locator("#session-code")).toBeVisible();
}

/** Clicks a day while a palette code is selected, once the day has settled. */
async function paint(page: Page, iso: string) {
  await settled(page, iso);
  await page.click(`button[data-iso="${iso}"]`);
}

// The modal dialog itself, not a popover that is still fading out.
const MODAL = "[data-slot=dialog-content]";
const dialog = (page: Page) => page.locator(MODAL);

test.afterAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) {
    if ([tutor.email, otherTutor.email, staff.email].includes(user.email ?? "")) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
});

test("a tutor records a month, submits it twice, and staff reads the record", async ({ page }) => {
  // Staff signs up first, is kept off tutor pages, and signs out.
  await test.step("staff signs up and is redirected away from tutor routes", async () => {
    await signUp(page, staff, "staff");
    await page.goto("/home");
    await page.waitForURL((u) => u.pathname === "/staff");
    await page.goto(`/students/00000000-0000-4000-8000-000000000000`);
    await page.waitForURL((u) => u.pathname === "/staff");
    await signOut(page);
  });

  await test.step("tutor signs up and is redirected away from /staff", async () => {
    await signUp(page, tutor, "tutor");
    await expect(page.locator("h1")).toContainText(tutor.name);
    await page.goto("/staff");
    await page.waitForURL((u) => u.pathname === "/home");
  });

  await test.step("adds a student", async () => {
    await page.click("button:has-text('Add student')");
    await expect(dialog(page).locator("#student-defaultDays")).toHaveCount(0);
    await page.fill("#student-fullName", studentName);
    await page.fill("#student-tutoringSite", "Bloomfield Public Library");
    await page.click(`${MODAL} button[type=submit]:has-text('Add student')`);
    await expect(page.locator(`a:has-text("${studentName}")`)).toBeVisible();
    // The card's Edit button goes to the student page and there is no Open button.
    await expect(page.locator("[data-student-card] a:has-text('Open')")).toHaveCount(0);
    await page.click(`[data-student-card] a:has-text("Edit")`);
    await page.waitForURL((u) => u.pathname.startsWith("/students/"));
  });

  await test.step("edits the name and site in place", async () => {
    const name = page.locator("input[aria-label='Student']");
    await name.fill(renamedStudent);
    await name.press("Tab");
    const site = page.locator("input[aria-label='Tutoring site']");
    await site.fill("Montclair Public Library");
    await site.press("Tab");
    await expect(page.getByText("Saved", { exact: false }).first()).toBeVisible();
    await page.reload();
    await expect(page.locator("input[aria-label='Student']")).toHaveValue(renamedStudent);
    await expect(page.locator("input[aria-label='Tutoring site']")).toHaveValue("Montclair Public Library");
  });

  await test.step("adds a single session with a start and end time", async () => {
    await openDay(page, day(1));
    await page.fill("#session-start", "10:00");
    await page.fill("#session-end", "11:30");
    await expect(page.getByTestId("session-hours")).toHaveText("1.5 hours");
    await page.click("button[type=submit]:has-text('Add')");
    await expect(page.getByText("Session added.")).toBeVisible();
    await expect(page.locator(`button[data-iso="${day(1)}"]`)).toContainText("1.5 h");
  });

  await test.step("rejects an end before the start and a session over twelve hours", async () => {
    await openDay(page, day(7));
    await page.fill("#session-start", "11:00");
    await page.fill("#session-end", "10:00");
    await expect(page.getByTestId("session-hours")).toContainText("after the start time");
    await page.click("button[type=submit]:has-text('Add')");
    await expect(page.locator("p[role=alert]")).toContainText("after the start time");
    await page.fill("#session-start", "06:00");
    await page.fill("#session-end", "18:15");
    await page.click("button[type=submit]:has-text('Add')");
    await expect(page.locator("p[role=alert]")).toContainText("longer than 12 hours");
    await page.click("button:has-text('Cancel')");
  });

  await test.step("adds a weekly recurring session", async () => {
    await openDay(page, day(2));
    await page.fill("#session-start", "10:00");
    await page.fill("#session-end", "11:00");
    await page.check("input[type=checkbox]");
    await page.click("button[type=submit]:has-text('Add')");
    await expect(page.getByText(/Added \d+ weekly sessions?/)).toBeVisible();
    await expect(page.locator(`button[data-iso="${day(9)}"]`)).toContainText("1 h");
    await expect(page.locator(`button[data-iso="${day(16)}"]`)).toContainText("1 h");
  });

  await test.step("edits one occurrence only", async () => {
    await openDay(page, day(9));
    await expect(page.getByText(/Weekly session, every/)).toBeVisible();
    await page.fill("#session-end", "12:00");
    await expect(page.getByTestId("session-hours")).toHaveText("2 hours");
    await page.check("input[name=scope][value=this]");
    await page.click("button[type=submit]:has-text('Save')");
    await expect(page.getByText("Session updated.")).toBeVisible();
    await expect(page.locator(`button[data-iso="${day(9)}"]`)).toContainText("2 h");
    await expect(page.locator(`button[data-iso="${day(16)}"]`)).toContainText("1 h");
  });

  await test.step("edits this and future occurrences", async () => {
    await openDay(page, day(16));
    await page.fill("#session-end", "11:30");
    await page.check("input[name=scope][value=future]");
    await page.click("button[type=submit]:has-text('Save')");
    await expect(page.getByText(/Updated \d+ sessions\./)).toBeVisible();
    await expect(page.locator(`button[data-iso="${day(16)}"]`)).toContainText("1.5 h");
    await expect(page.locator(`button[data-iso="${day(23)}"]`)).toContainText("1.5 h");
    await expect(page.locator(`button[data-iso="${day(9)}"]`)).toContainText("2 h");
  });

  await test.step("deletes a future series", async () => {
    await openDay(page, day(23));
    await page.click("button:has-text('Delete')");
    await page.locator("input[name=delete-scope]").nth(1).check();
    await page.click(`${MODAL} button:has-text('Delete')`);
    await expect(page.getByText(/Deleted \d+ sessions\./)).toBeVisible();
    await expect(page.locator(`button[data-iso="${day(23)}"]`)).not.toContainText("h");
    if (daysInMonth >= 30) await expect(page.locator(`button[data-iso="${day(30)}"]`)).not.toContainText("h");
    await expect(page.locator(`button[data-iso="${day(16)}"]`)).toContainText("1.5 h");
  });

  await test.step("marks TA and SA through the palette", async () => {
    await page.click("button:has-text('TA: Tutor absent')");
    await expect(page.locator("p[role=status]")).toContainText("Click any day to mark it as Tutor absent");
    await paint(page, day(3));
    await expect(page.getByText(/Marked .* as Tutor absent\./)).toBeVisible();
    await expect(page.locator(`button[data-iso="${day(3)}"]`)).toContainText("TA");
    await page.click("button:has-text('SA: Student absent')");
    await paint(page, day(4));
    await expect(page.locator(`button[data-iso="${day(4)}"]`)).toContainText("SA");
    // The same code again clears the day, and marking it back restores it.
    await paint(page, day(4));
    await expect(page.getByText(/Cleared Student absent from/)).toBeVisible();
    await expect(page.locator(`button[data-iso="${day(4)}"]`)).not.toContainText("SA");
    await paint(page, day(4));
    await expect(page.locator(`button[data-iso="${day(4)}"]`)).toContainText("SA");
    await settled(page, day(4));
    await page.keyboard.press("Escape");
    await expect(page.locator("button:has-text('Hours tutored')")).toHaveAttribute("aria-pressed", "true");
  });

  await test.step("marks H through the popover", async () => {
    await openDay(page, day(5));
    await page.selectOption("#session-code", "H");
    await expect(page.locator("#session-start")).toHaveCount(0);
    await expect(page.getByTestId("session-hours")).toHaveText("0 hours");
    await page.click("button[type=submit]:has-text('Add')");
    await expect(page.locator(`button[data-iso="${day(5)}"]`)).toContainText("H");
  });

  await test.step("replaces an hours day with a code after confirming", async () => {
    await page.click("button:has-text('H: Holiday')");
    await paint(page, day(9));
    await expect(dialog(page)).toContainText("Replace 2 hours with Holiday?");
    await page.click(`${MODAL} button:has-text('Cancel')`);
    await expect(page.locator(`button[data-iso="${day(9)}"]`)).toContainText("2 h");
    await paint(page, day(9));
    await page.click(`${MODAL} button:has-text('Replace')`);
    await expect(page.locator(`button[data-iso="${day(9)}"]`)).toContainText("H");
    await page.keyboard.press("Escape");
  });

  await test.step("the calendar strip totals the month", async () => {
    await expect(page.locator("dl").filter({ hasText: `Hours in ${monthName}` })).toContainText(fmt(hoursUpToToday));
  });

  await test.step("attains two goals including an Other goal", async () => {
    await page.click("button[role=tab]:has-text('Goals')");
    await page.check("#goal-A1");
    await expect(page.locator("#goal-A1-date")).toBeVisible();
    // Category E is closed until opened.
    await page.click("button:has-text('E. Other')");
    await page.check("#goal-E1");
    await page.fill("#goal-E1-text", "Read a bus schedule");
    await expect(page.getByText("Saved", { exact: false }).first()).toBeVisible();
    await page.waitForTimeout(1200);
    await page.reload();
    await page.click("button[role=tab]:has-text('Goals')");
    await expect(page.locator("#goal-A1")).toBeChecked();
    await page.click("button:has-text('E. Other')");
    await expect(page.locator("#goal-E1")).toBeChecked();
    await expect(page.locator("#goal-E1-text")).toHaveValue("Read a bus schedule");
  });

  await test.step("the home card and the hours page agree on the totals", async () => {
    await page.goto("/home");
    const card = page.locator("section[aria-labelledby=total-hours-heading]");
    await expect(card.locator("dd").first()).toHaveText(fmt(hoursUpToToday));
    await expect(card.locator("dd").nth(2)).toHaveText(fmt(hoursUpToToday));
    const studentCard = page.locator(`[data-student-card]`, { hasText: renamedStudent });
    await expect(studentCard.locator("dd").nth(0)).toContainText(fmt(hoursUpToToday));
    await expect(studentCard.locator("dd").nth(2)).toHaveText("2");
    await page.goto("/hours");
    await expect(page.getByText("Total:").locator("..")).toContainText(fmt(hoursUpToToday));
    await expect(page.locator("tbody th", { hasText: renamedStudent })).toBeVisible();
  });

  await test.step("a month with no sessions cannot be submitted", async () => {
    await page.goto("/home");
    await page.click(`[data-student-card]:has-text("${renamedStudent}") button:has-text("Submit report")`);
    await page.waitForSelector(`${MODAL} input[name=report-month]`);
    await dialog(page).locator("label", { hasText: "0 days" }).first().click();
    await page.click(`${MODAL} button:has-text('Continue')`);
    await expect(dialog(page)).toContainText("cannot be submitted yet");
    await expect(dialog(page)).toContainText("There are no tutoring days in this month");
    await page.click(`${MODAL} button:has-text('Back')`);
    await page.click(`${MODAL} button:has-text('Cancel')`);
  });

  await test.step("submits the month, then resubmits as version 2", async () => {
    await page.click(`[data-student-card]:has-text("${renamedStudent}") button:has-text("Submit report")`);
    await page.waitForSelector(`${MODAL} input[name=report-month]`);
    await page.check(`${MODAL} input[name=report-month][value="${month}"]`);
    await page.click(`${MODAL} button:has-text('Continue')`);
    await expect(dialog(page)).toContainText("Are you sure you want to submit");
    await expect(dialog(page)).toContainText(`${fmt(monthTotal)} hours tutored`);
    await page.click(`${MODAL} button:has-text('Submit')`);
    await expect(page.getByText(/Report submitted for .* \(version 1\)/)).toBeVisible();

    await page.click(`[data-student-card]:has-text("${renamedStudent}") button:has-text("Submit report")`);
    await page.waitForSelector(`${MODAL} input[name=report-month]`);
    await expect(dialog(page).locator("label", { hasText: `${monthName} ${year}` })).toContainText("Submitted (v1)");
    await page.check(`${MODAL} input[name=report-month][value="${month}"]`);
    await page.click(`${MODAL} button:has-text('Continue')`);
    await expect(dialog(page)).toContainText("This creates a new version");
    await page.click(`${MODAL} button:has-text('Submit')`);
    await expect(page.getByText(/Report submitted for .* \(version 2\)/)).toBeVisible();
  });

  await test.step("marks the student as stopped with a reason, then reactivates", async () => {
    await page.click(`[data-student-card]:has-text("${renamedStudent}") button:has-text("Mark as stopped")`);
    await page.fill("#stop-reason", "Moved out of the area");
    await page.click(`${MODAL} button[type=submit]:has-text('Mark as stopped')`);
    await expect(page.getByText(`${renamedStudent} is marked as stopped.`)).toBeVisible();
    const stoppedSection = page.locator("section[aria-labelledby=stopped-heading]");
    await expect(stoppedSection).toContainText(renamedStudent);
    await expect(stoppedSection).toContainText("Moved out of the area");
    await stoppedSection.locator(`[data-student-card]:has-text("${renamedStudent}") button:has-text("Reactivate")`).click();
    await page.click(`${MODAL} button:has-text('Reactivate')`);
    await expect(page.locator("section[aria-labelledby=active-heading]")).toContainText(renamedStudent);
    await expect(page.locator("section[aria-labelledby=stopped-heading]")).toHaveCount(0);
  });

  await signOut(page);

  await test.step("staff signs in, finds the tutor and student", async () => {
    await signIn(page, staff, "staff");
    await page.fill("input[aria-label='Search tutors']", tutor.name);
    await page.click(`section[aria-labelledby=tutors-heading] button:has-text("${tutor.name}")`);
    await page.click(`section[aria-labelledby=students-heading] a:has-text("${renamedStudent}")`);
    await page.waitForURL((u) => u.pathname.startsWith("/staff/students/"));
    await expect(page.locator("h1")).toHaveText(renamedStudent);
  });

  const grid = page.locator("table[aria-label='Hours tutored by day and month']");
  const monthColumn = () => grid.locator("thead th", { hasText: monthName.slice(0, 3) });
  const cell = (d: number) => grid.locator("tbody tr").nth(d - 1).locator("td").filter({ hasText: /\S/ });

  await test.step("the year grid shows the submitted hours and codes", async () => {
    await expect(monthColumn()).toContainText("v2");
    await expect(cell(1)).toHaveText("1.5");
    await expect(cell(2)).toHaveText("1");
    await expect(cell(3)).toHaveText("TA");
    await expect(cell(4)).toHaveText("SA");
    await expect(cell(5)).toHaveText("H");
    await expect(cell(9)).toHaveText("H");
    await expect(cell(16)).toHaveText("1.5");
    await expect(page.getByText("Total hours for the year:").locator("..")).toContainText(fmt(monthTotal));
    // Day(s) and Time(s) come from the schedule and the sessions.
    const form = page.locator("#record-form");
    await expect(form).toContainText("10:00 am to");
  });

  await test.step("submission history lists both versions and shows version 1 on request", async () => {
    const history = page.locator("section[aria-labelledby=history-heading]");
    await expect(history).toContainText("Version 2");
    await expect(history).toContainText("Version 1");
    await history.locator("a:has-text('View this version')").click();
    await expect(page.locator("div[role=status]", { hasText: "Showing version 1" })).toContainText(`Showing version 1 of ${monthName}`);
    await expect(monthColumn()).toContainText("v1");
    await page.click("a:has-text('Back to the latest versions')");
    await expect(monthColumn()).toContainText("v2");
  });

  await test.step("live view toggles on and off", async () => {
    await page.click("a:has-text('Live view')");
    await expect(page.locator("div[role=status]", { hasText: "Live view." })).toBeVisible();
    await expect(monthColumn()).toContainText("live");
    await expect(cell(1)).toHaveText("1.5");
    await page.click("a:has-text('Live view on')");
    await expect(monthColumn()).toContainText("v2");
  });

  await test.step("downloads the CSV", async () => {
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("a:has-text('Download CSV')")]);
    expect(download.suggestedFilename()).toMatch(/sessions-\d{4}-\d{4}\.csv$/);
    const path = await download.path();
    const text = path ? await (await import("node:fs/promises")).readFile(path, "utf8") : "";
    expect(text.split("\n")[0]).toBe("date,student,tutor,start_time,end_time,hours,code,source");
    expect(text).toContain(`${day(1)},${renamedStudent},${tutor.name},10:00,11:30,1.5,,submitted v2`);
    expect(text).toContain(`${day(3)},${renamedStudent},${tutor.name},,,0,TA,submitted v2`);
  });

  await signOut(page);
});

test("a second tutor cannot see the first tutor's students through the API", async ({ page }) => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  test.skip(!url || !anonKey, "Supabase URL and anon key are needed for the API check");

  await signUp(page, otherTutor, "tutor");
  await signOut(page);

  const supabase = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: otherTutor.email, password });
  expect(signInError).toBeNull();

  const byName = await supabase.from("students").select("id, full_name").ilike("full_name", `Smoke Student ${unique}%`);
  expect(byName.error).toBeNull();
  expect(byName.data).toEqual([]);

  const all = await supabase.from("students").select("id");
  expect(all.error).toBeNull();
  expect(all.data).toEqual([]);

  const sessions = await supabase.from("sessions").select("id");
  expect(sessions.error).toBeNull();
  expect(sessions.data).toEqual([]);
});
