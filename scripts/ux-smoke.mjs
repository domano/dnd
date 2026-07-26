import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT = '/opt/cursor/artifacts/ux-smoke';
await mkdir(OUT, { recursive: true });

const character = {
  id: 'smoke-1',
  name: 'Brynn Oak',
  playerName: '',
  alignment: 'Neutral Good',
  xp: 900,
  raceId: 'human',
  backgroundId: 'acolyte',
  classLevels: [{ classId: 'fighter', level: 3 }],
  abilities: {
    strength: 15,
    dexterity: 14,
    constitution: 13,
    intelligence: 10,
    wisdom: 12,
    charisma: 8,
  },
  skillProficiencies: ['Athletics', 'Perception'],
  expertise: [],
  toolProficiencies: [],
  weaponProficiencies: [],
  languageChoices: ['Elvish'],
  otherChoices: {},
  feats: [],
  customFeats: [],
  hp: { current: 22, max: 28, temp: 0 },
  hitDiceUsed: 0,
  inspiration: false,
  deathSaves: { successes: 0, failures: 0 },
  weapons: [],
  inventory: [],
  currency: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 },
  spells: {
    known: [],
    prepared: [],
    alwaysPrepared: [],
    slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  notes: '',
  personality: { traits: '', ideals: '', bonds: '', flaws: '' },
  journal: [],
  quests: [],
  activeConditions: [],
  asiHistory: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const browser = await chromium.launch();
const results = {};

async function seed(page) {
  await page.addInitScript((payload) => {
    localStorage.setItem('dnd5e-sheet-v1', JSON.stringify(payload));
  }, { characters: [character], activeId: 'smoke-1' });
}

for (const vp of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/home-${vp.name}.png` });

  await page.getByRole('button', { name: 'Create Character' }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/create-${vp.name}.png` });
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Compendium' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/compendium-${vp.name}.png` });
  if (vp.name === 'mobile') {
    await page.locator('ul button').first().click();
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/compendium-detail-mobile.png` });
    const back = page.getByRole('button', { name: /Back to list/ });
    results.compendiumDetailBackVisible = await back.isVisible();
    if (results.compendiumDetailBackVisible) await back.click();
  }
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.close();
}

for (const vp of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]) {
  const page = await browser.newPage({ viewport: vp });
  await seed(page);
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open Saved' }).click();
  await page.getByRole('button', { name: /Brynn Oak/ }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/sheet-${vp.name}.png` });

  const combatBar = page.locator('[aria-label="Combat quick stats"]');
  const barVisible = await combatBar.isVisible().catch(() => false);
  results[`combatBar_${vp.name}`] = barVisible;

  if (vp.name === 'mobile') {
    await page.locator('[aria-controls="combat-tray"]').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/combat-tray-mobile.png` });
    const tray = page.locator('#combat-tray');
    results.combatTrayOpen = await tray.evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    await tray.locator('button.btn-ghost', { hasText: '+1' }).click({ force: true });
    await page.waitForTimeout(250);
    await tray.getByRole('button', { name: 'Close', exact: true }).click();
    await page.waitForTimeout(250);
  }

  // Layout areas should exist
  results[`hasAbilities_${vp.name}`] = await page.getByRole('heading', { name: 'Ability scores' }).isVisible();
  results[`hasCombat_${vp.name}`] = await page.getByRole('heading', { name: 'Combat' }).first().isVisible();
  await page.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
