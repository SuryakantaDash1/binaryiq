import { randomInt } from 'node:crypto';

export const RNG_TOKEN = 'RNG_TOKEN';

export type Rng = () => number;

export const cryptoRng: Rng = () => randomInt(0, 1_000_000) / 1_000_000;

export const RngProvider = {
  provide: RNG_TOKEN,
  useValue: cryptoRng,
};
