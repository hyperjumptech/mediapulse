"use client";

import {
  resolvePath,
  type DetailBlockStatCard,
  type DetailBlockStatCards,
} from "@hermes/domain-contract";
import { CircleHelp } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

import { DateTime } from "@/components/date-time/date-time";
import { StatTile, StatTileGrid } from "@/components/stat-card";
import { toValidDate } from "@/lib/date-time/format-date-time";

import { DetailBlockSectionHeader } from "./detail-block-section-header";

const asText = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "—" : String(value);

const StatCardValue = ({
  card,
  value,
}: {
  card: DetailBlockStatCard;
  value: unknown;
}) => {
  const date = card.format === "date-time" ? toValidDate(value) : null;
  if (date) {
    return <DateTime value={date} style="datetime" />;
  }
  if (card.format === "number" && typeof value === "number") {
    return <>{value.toLocaleString("en-US")}</>;
  }

  return <>{asText(value)}</>;
};

const asOptionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const VALUE_COLOR_BY_VARIANT: Record<string, string> = {
  success: "text-green-600 dark:text-green-500",
  warning: "text-amber-600 dark:text-amber-500",
  destructive: "text-red-600 dark:text-red-500",
  muted: "text-muted-foreground",
};

export const DetailBlockStatCardsView = ({
  block,
  data,
}: {
  block: DetailBlockStatCards;
  data: unknown;
}) => (
  <section className="flex min-w-0 flex-col gap-4">
    <DetailBlockSectionHeader
      label={block.label}
      sectionRule={block.sectionRule}
      data={data}
    />
    <StatTileGrid>
      {block.cards.map((card, index) => {
        const tooltipText = card.tooltipField
          ? asOptionalText(resolvePath(data, card.tooltipField))
          : undefined;
        const colorVariant = card.colorField
          ? resolvePath(data, card.colorField)
          : undefined;
        const colorClass =
          typeof colorVariant === "string"
            ? VALUE_COLOR_BY_VARIANT[colorVariant]
            : undefined;

        return (
          <StatTile
            key={`${card.label}-${String(index)}`}
            label={card.label}
            labelAddon={
              tooltipText ? (
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    aria-label={`${card.label} breakdown`}
                    className="shrink-0 cursor-help text-muted-foreground/70 hover:text-foreground"
                  >
                    <CircleHelp className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>{tooltipText}</TooltipContent>
                </Tooltip>
              ) : undefined
            }
            value={
              <StatCardValue
                card={card}
                value={resolvePath(data, card.field)}
              />
            }
            valueClassName={colorClass}
          />
        );
      })}
    </StatTileGrid>
  </section>
);
