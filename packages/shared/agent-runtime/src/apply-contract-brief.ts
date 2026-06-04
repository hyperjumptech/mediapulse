/**
 * Appends a fenced "Product contract" block to a system prompt when a contract brief is present.
 * Returns systemContent unchanged when no brief is supplied, so the no-contract path is
 * byte-for-byte identical to current behaviour.
 *
 * @param systemContent - Existing system prompt text.
 * @param contract - Optional contract carrying the brief to append.
 * @returns System prompt with the brief block appended, or the original string if absent.
 */
export const applyContractBrief = (
  systemContent: string,
  contract?: { brief: string },
): string => {
  if (contract === undefined || contract.brief.trim() === "") {
    return systemContent;
  }
  return `${systemContent}\n\n<product_contract>\n${contract.brief.trim()}\n</product_contract>`;
};
