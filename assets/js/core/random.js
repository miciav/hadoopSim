export function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randomFloat(min, max, rng = Math.random) {
  return rng() * (max - min) + min;
}

export function createColorCycle(colors) {
  let index = 0;
  return () => {
    const color = colors[index % colors.length];
    index += 1;
    return color;
  };
}
