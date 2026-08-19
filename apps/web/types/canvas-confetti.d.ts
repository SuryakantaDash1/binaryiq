declare module 'canvas-confetti' {
  interface Options {
    particleCount?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
    [key: string]: unknown;
  }
  function confetti(options?: Options): Promise<null> | null;
  export default confetti;
}
