/**
 * Generates a deterministic shuffled arrangement of numbers 1..100 for a team and round.
 * Uses a pure 32-bit Mulberry32 PRNG seeded from a string or numeric hash.
 */

function stringToSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createMulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateShuffledPalette(seedInput: string | number): number[] {
  const seed = typeof seedInput === 'number' ? seedInput >>> 0 : stringToSeed(seedInput);
  const random = createMulberry32(seed);

  const numbers = Array.from({ length: 100 }, (_, i) => i + 1);

  // Fisher-Yates shuffle
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = numbers[i];
    numbers[i] = numbers[j];
    numbers[j] = temp;
  }

  return numbers;
}
