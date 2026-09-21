/**
 * Splits items into consecutive groups of at most `size`.
 *
 * @param items - Items to group.
 * @param size - Largest group to produce; anything below 1 is treated as 1.
 * @returns Groups in the original order.
 */
export const chunked = <T>(items: readonly T[], size: number): T[][] => {
  const step = Math.max(1, Math.trunc(size));
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += step) {
    groups.push(items.slice(index, index + step));
  }

  return groups;
};
