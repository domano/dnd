import { chromium } from "playwright";
import { mkdirSync } from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:5173";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
}

async function clickNamed(page, name) {
  await page.getByRole("button", { name }).first().click();
}

async function pickFirstNCheckboxes(page, n) {
  const boxes = page.locator("label.checkbox:visible input[type='checkbox']");
  let picked = 0;
  for (let i = 0; i < (await boxes.count()) && picked < n; i++) {
    const box = boxes.nth(i);
    if (await box.isChecked()) continue;
    if (await box.isDisabled()) continue;
    await box.check({ force: true });
    picked++;
  }
  return picked;
}

async function pickSpells(page, cantripsNeeded, bookNeeded) {
  const cantripItems = page
    .locator("label[class*='spellItem']:visible")
    .filter({ hasText: /Cantrip ·/i });
  let c = 0;
  for (let i = 0; i < (await cantripItems.count()) && c < cantripsNeeded; i++) {
    const item = cantripItems.nth(i);
    if ((await item.getAttribute("data-selected")) === "true") continue;
    await item.click();
    c++;
  }
  const bookItems = page
    .locator("label[class*='spellItem']:visible")
    .filter({ hasText: /Level 1 ·/i });
  let b = 0;
  for (let i = 0; i < (await bookItems.count()) && b < bookNeeded; i++) {
    const item = bookItems.nth(i);
    if ((await item.getAttribute("data-selected")) === "true") continue;
    if (await item.locator("input").isDisabled().catch(() => false)) continue;
    await item.click();
    b++;
  }
  return { cantrips: c, book: b };
}

async function goNext(page) {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForTimeout(200);
  const err = await page.locator("[class*='error']").allTextContents().catch(() => []);
  if (err.some(Boolean)) console.log("validation:", err.filter(Boolean).join(" | "));
  return err.filter(Boolean);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, "01-home");

  await clickNamed(page, "Open Saved");
  await shot(page, "02-open-saved-empty");
  await clickNamed(page, "Close");

  await clickNamed(page, "Compendium");
  await shot(page, "03-compendium-classes");
  await page.getByRole("tab", { name: "Spells" }).click();
  await page.locator("button").filter({ hasText: "Acid Splash" }).first().click();
  await shot(page, "04-compendium-spell-detail");
  await clickNamed(page, "Back");

  await clickNamed(page, "Create Character");
  await shot(page, "05-create-identity");
  await page.locator("input.input").first().fill("Elara Brightquill");
  await page.locator("select").first().selectOption({ label: "Lawful Neutral" });
  await goNext(page);

  // Race: High Elf + language + racial cantrip
  await page.getByRole("button", { name: /^Elf\b/ }).click();
  await page.getByRole("button", { name: /High Elf/i }).click();
  await page.waitForTimeout(150);
  await pickFirstNCheckboxes(page, 1); // extra language
  // racial cantrip picker may use spellItem labels
  const racialCantrip = page.locator("label[class*='spellItem']:visible").first();
  if (await racialCantrip.count()) await racialCantrip.click();
  await shot(page, "06-create-race");
  let errs = await goNext(page);
  if (errs.length) {
    await pickFirstNCheckboxes(page, 2);
    if (await racialCantrip.count()) await racialCantrip.click();
    await goNext(page);
  }

  await page.getByRole("button", { name: /^Wizard\b/ }).click();
  await page.waitForTimeout(200);
  await pickFirstNCheckboxes(page, 2);
  await shot(page, "07-create-class");
  await goNext(page);

  await pickFirstNCheckboxes(page, 2);
  await shot(page, "08-create-background");
  await goNext(page);

  await shot(page, "09-create-abilities");
  await goNext(page);

  await shot(page, "10-create-details");
  await goNext(page);

  await pickSpells(page, 3, 6);
  await shot(page, "11-create-spells");
  errs = await goNext(page);
  if (errs.length) {
    await pickSpells(page, 3, 6);
    await goNext(page);
  }

  await shot(page, "12-create-review");
  await page.getByRole("button", { name: "Create Character" }).click();
  await page.waitForTimeout(600);
  await shot(page, "13-sheet-overview");
  await page.evaluate(() => window.scrollTo(0, 900));
  await shot(page, "14-sheet-mid");
  await page.evaluate(() => window.scrollTo(0, 2200));
  await shot(page, "15-sheet-lower");
  await page.evaluate(() => window.scrollTo(0, 0));

  await clickNamed(page, "Add Spell");
  await page.waitForTimeout(250);
  await shot(page, "16-spell-browser");
  if (await page.getByRole("button", { name: /Close/i }).count()) {
    await page.getByRole("button", { name: /Close/i }).first().click();
  } else {
    await page.keyboard.press("Escape");
  }

  await clickNamed(page, "Level Up");
  await page.waitForTimeout(350);
  await shot(page, "17-level-up");

  for (let i = 0; i < 8; i++) {
    // Fill required picks on current step before advancing
    const subclassOpt = page.locator("button[class*='option'][data-selected='false'], button[class*='option']").first();
    if (await page.getByText(/Choose a subclass|unlocks your subclass/i).count()) {
      if (await subclassOpt.count()) await subclassOpt.click().catch(() => {});
    }
    if (await page.getByText(/New spellbook|new cantrip|Spellcasting progression/i).count()) {
      await pickSpells(page, 2, 2);
    }
    const avg = page.getByRole("button", { name: /average/i });
    if (await avg.count()) await avg.first().click().catch(() => {});

    const btn = page.getByRole("button", { name: /^(Next|Apply level up)$/ }).first();
    if (!(await btn.count())) break;
    if (await btn.isDisabled()) {
      await pickSpells(page, 2, 2);
      await page.waitForTimeout(100);
    }
    const text = (await btn.innerText()).trim();
    if (/Apply/i.test(text)) {
      await shot(page, "18-level-up-final");
      if (!(await btn.isDisabled())) await btn.click();
      break;
    }
    if (!(await btn.isDisabled())) {
      await btn.click();
      await page.waitForTimeout(250);
      await shot(page, `18-level-up-step-${i + 1}`);
    } else {
      console.log("level-up Next still disabled; dumping errors");
      console.log(await page.locator("[class*='error']").allTextContents());
      await shot(page, `18-level-up-stuck-${i}`);
      break;
    }
  }

  // ensure modal closed
  if (await page.locator("[class*='backdrop']").count()) {
    const close = page.getByRole("button", { name: /Close|Cancel/i });
    if (await close.count()) await close.first().click().catch(() => {});
  }
  await page.waitForTimeout(400);
  await shot(page, "19-sheet-after-level");

  // Fighter path
  await clickNamed(page, "Home");
  await clickNamed(page, "Create Character");
  await page.locator("input.input").first().fill("Borin Ironmantle");
  await goNext(page);
  await page.getByRole("button", { name: /^Dwarf\b/ }).click();
  await page.getByRole("button", { name: /Hill Dwarf/i }).click();
  await goNext(page);
  await page.getByRole("button", { name: /^Fighter\b/ }).click();
  await pickFirstNCheckboxes(page, 2);
  await page.getByRole("button", { name: /^Defense\b/ }).click().catch(async () => {
    await page.getByRole("button", { name: /Dueling/i }).click();
  });
  await goNext(page);
  await pickFirstNCheckboxes(page, 2);
  await goNext(page);
  await goNext(page);
  await goNext(page);
  await shot(page, "22-create-fighter-review");
  await page.getByRole("button", { name: "Create Character" }).click();
  await page.waitForTimeout(500);
  await shot(page, "23-sheet-fighter");

  await page.setViewportSize({ width: 390, height: 844 });
  await clickNamed(page, "Home");
  await shot(page, "20-home-mobile");
  await clickNamed(page, "Open Saved");
  await shot(page, "24-open-saved-filled-mobile");
  await page.getByRole("button", { name: /Elara|Brightquill/i }).first().click();
  await page.waitForTimeout(400);
  await shot(page, "21-sheet-mobile");

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
