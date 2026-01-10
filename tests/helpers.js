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
  const snapshot = await page.evaluate((name) => {
    let value;
    if (typeof globalThis[name] !== 'undefined') {
      value = globalThis[name];
    }
    if (!value && name === 'cluster' && typeof cluster !== 'undefined') {
      value = cluster;
    }
    if (!value) {
      return null;
    }
    return JSON.parse(JSON.stringify(value));
  }, globalName);

  if (!snapshot) {
    throw new Error(`Global \"${globalName}\" is not available in page context`);
  }
  return snapshot;
}
