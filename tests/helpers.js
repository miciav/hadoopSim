export function seedRandom() {
  let seed = 42;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export async function getNumberFromText(page, selector) {
  const text = await page.locator(selector).innerText();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    throw new Error(`No numeric value found for ${selector}: ${text}`);
  }
  return Number(match[0]);
}

export async function getPercent(page, selector) {
  const text = await page.locator(selector).innerText();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    throw new Error(`No percent value found for ${selector}: ${text}`);
  }
  return Number(match[0]);
}

export async function getClusterSnapshot(page, globalName = 'cluster') {
  return page.evaluate((name) => {
    const value = globalThis[name];
    return JSON.parse(JSON.stringify(value));
  }, globalName);
}
