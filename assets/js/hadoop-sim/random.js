export function createSeededRng(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function randomInt(min, max, rng = Math.random) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(rng() * (high - low + 1)) + low;
}

export function randomFloat(min, max, rng = Math.random) {
  return rng() * (max - min) + min;
}

export function pick(items, rng = Math.random) {
  if (!items || items.length === 0) {
    return null;
  }
  return items[Math.floor(rng() * items.length)];
}

export function shuffle(items, rng = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
