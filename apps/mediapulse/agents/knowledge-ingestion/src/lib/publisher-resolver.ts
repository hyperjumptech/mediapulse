import {
  isRegistrableDomain,
  type OrganonIngestionClient,
} from "@mediapulse/knowledge-graph";

export type PublisherLookup = {
  iri: string | null;
  created: boolean;
  error?: string;
};

export type ResolvePublisher = (
  registrableDomain: string,
) => Promise<PublisherLookup>;

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const createPublisherResolver = (
  client: Pick<OrganonIngestionClient, "findPublisherIri" | "createPublisher">,
): ResolvePublisher => {
  const byDomain = new Map<string, Promise<PublisherLookup>>();

  const lookUp = async (
    registrableDomain: string,
  ): Promise<PublisherLookup> => {
    if (!isRegistrableDomain(registrableDomain)) {
      return { iri: null, created: false };
    }
    try {
      const found = await client.findPublisherIri(registrableDomain);
      if (found) {
        return { iri: found, created: false };
      }
      const iri = await client.createPublisher({
        registrableDomain,
        label: registrableDomain,
      });

      return { iri, created: true };
    } catch (error) {
      return { iri: null, created: false, error: describeError(error) };
    }
  };

  return (registrableDomain) => {
    const known = byDomain.get(registrableDomain);
    if (known) {
      return known;
    }
    const lookup = lookUp(registrableDomain);
    byDomain.set(registrableDomain, lookup);

    return lookup;
  };
};
