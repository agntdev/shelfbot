/** One injectable seam for every library timestamp and subscription decision. */
let clock: () => Date = () => new Date();

export function now(): Date {
  return clock();
}

export function _setClockForTests(next?: () => Date): void {
  clock = next ?? (() => new Date());
}
