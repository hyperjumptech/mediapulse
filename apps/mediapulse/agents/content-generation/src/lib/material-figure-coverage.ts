const NUMBER_PATTERN = /\d[\d.,]*/gu;

const MIN_BODY_NUMBERS = 3;

const countNumbers = (text: string): number =>
  (text.match(NUMBER_PATTERN) ?? []).length;

export const pointsOmitStatedFigures = (
  body: string,
  points: readonly string[],
): boolean => {
  if (points.length === 0) {
    return false;
  }
  if (countNumbers(body) < MIN_BODY_NUMBERS) {
    return false;
  }

  return points.every((point) => countNumbers(point) === 0);
};
