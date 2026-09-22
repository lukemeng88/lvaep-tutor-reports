import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// End-to-end smoke test against a running app and a real Supabase project.
// It creates its own tutor and staff accounts and removes them afterwards
// when SUPABASE_SERVICE_ROLE_KEY is available.

const unique = Date.now();
const password = "Smoke1234!";
const tutor = { name: `Smoke Tutor ${unique}`, email: `smoke-tutor-${unique}@lvaep.demo` };
const staff = { name: `Smoke Staff ${unique}`, email: `smoke-staff-${unique}@lvaep.demo` };
const studentName = `Smoke Student ${unique}`;

const today = new Date();
const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
const firstOfMonth = `${monthPrefix}-01`;
const monthName = today.toLocaleString("en-US", { month: "long" });

async function signUp(page: Page, who: { name: string; email: string }, role: "tutor" | "staff") {
  await page.goto("/signup");
  await page.fill("#fullName", who.name);
  await page.fill("#email", who.email);
  await page.fill("#password", password);
  await page.check(`input[value=${role}]`);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === (role === "staff" ? "/staff" : "/home"));
}

async function signOut(page: Page) {
  await page.click("button:has-text('Sign out')");
  await page.waitForURL((u) => u.pathname === "/login");
}

test.afterAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email === tutor.email || user.email === staff.email) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
});

test("tutor records a weekly session and submits a report; staff sees it in the record", async ({ page }) => {
  // Tutor signs up and lands on Home.
  await signUp(page, tutor, "tutor");
  await expect(page.locator("h1")).toContainText(tutor.name);

  // Adds a student.
  await page.click("button:has-text('Add student')");
  await page.fill("#student-fullName", studentName);
  await page.fill("#student-tutoringSite", "Bloomfield Public Library");
  await page.click("[role=dialog] button[type=submit]:has-text('Add student')");
  await expect(page.locator(`a:has-text("${studentName}")`)).toBeVisible();

  // Opens the student and adds a weekly session starting on the 1st of this month.
  await page.click(`a:has-text("${studentName}")`);
  await page.waitForURL((u) => u.pathname.startsWith("/students/"));
  await page.click(`button[data-iso="${firstOfMonth}"]`);
  await page.fill("#session-hours", "1.5");
  await page.check("input[type=checkbox]");
  await page.click("button[type=submit]:has-text('Add')");
  await expect(page.getByText(/Added \d+ weekly session/)).toBeVisible();
  await expect(page.locator(`button[data-iso="${firstOfMonth}"]`)).toContainText("1.5 h");

  // Submits the report for this month.
  await page.click("header button:has-text('Submit report')");
  await page.waitForSelector("[role=dialog] input[name=report-month]");
  await expect(page.locator("[role=dialog] input[name=report-month]:checked")).toHaveValue(String(today.getMonth() + 1));
  await page.click("[role=dialog] button:has-text('Continue')");
  await expect(page.locator("[role=dialog]").getByText("Are you sure you want to submit")).toBeVisible();
  await page.click("[role=dialog] button:has-text('Submit')");
  await expect(page.getByText(/Report submitted for .* \(version 1\)/)).toBeVisible();

  await signOut(page);

  // Staff signs up, finds the tutor and student, and sees the submitted month.
  await signUp(page, staff, "staff");
  await page.fill("input[aria-label='Search tutors']", tutor.name);
  await page.click(`section[aria-labelledby=tutors-heading] button:has-text("${tutor.name}")`);
  await page.click(`section[aria-labelledby=students-heading] a:has-text("${studentName}")`);
  await page.waitForURL((u) => u.pathname.startsWith("/staff/students/"));

  await expect(page.locator("h1")).toHaveText(studentName);
  const monthHeader = page.locator("thead th", { hasText: monthName.slice(0, 3) });
  await expect(monthHeader).toContainText("v1");
  await expect(page.locator("tbody tr").first().locator("td").filter({ hasText: "1.5" })).toHaveCount(1);
  await expect(page.locator("section[aria-labelledby=history-heading]")).toContainText("Version 1");
});
