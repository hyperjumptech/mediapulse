/**
 * Returns true when the error is a Prisma unique-constraint violation (P2002).
 *
 * @param error - Caught unknown from a Prisma write.
 */
export const isPrismaUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: string }).code === "P2002";
