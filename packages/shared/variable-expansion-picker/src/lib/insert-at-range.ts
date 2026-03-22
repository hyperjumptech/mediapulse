/**
 * Returns the next value after inserting text at the given range.
 * Caller should set the input value and then restore selection in a requestAnimationFrame or after onChange.
 *
 * @param current - Current string value.
 * @param start - Selection start index.
 * @param end - Selection end index.
 * @param inserted - Text to insert.
 * @returns New string with inserted text at the range.
 */
export const insertAtRange = (
  current: string,
  start: number,
  end: number,
  inserted: string,
): string => {
  return current.slice(0, start) + inserted + current.slice(end);
};
