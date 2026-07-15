"use client";

import {
  resolvePath,
  type DetailBlockStatCards,
} from "@hermes/domain-contract";
import { CircleHelp } from "lucide-react";

import { Card } from "@workspace/ui/components/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";

import { DetailBlockSectionHeader } from "./detail-block-section-header";

const asText = (value: unknown): string =>
  value === null || value === undefined || value === "" ? "—" : String(value);

const asOptionalText = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const VALUE_COLOR_BY_VARIANT: Record<string, string> = {
  success: "text-green-600 dark:text-green-500",
  warning: "text-amber-600 dark:text-amber-500",
  destructive: "text-red-600 dark:text-red-500",
  muted: "text-muted-foreground",
};

/**
 * Renders a `statCards` detail block — a responsive row of KPI cards, each with a label, a prominent
 * value, and an optional help icon whose tooltip reveals a breakdown.
 *
 * @param props.block - Manifest definition.
 * @param props.data - Detail response object.
 */
export const DetailBlockStatCardsView = ({
  block,
  data,
}: {
  block: DetailBlockStatCards;
  data: unknown;
}) => (
  <section className="flex flex-col gap-3">
    <DetailBlockSectionHeader
      label={block.label}
      sectionRule={block.sectionRule}
      data={data}
    />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <Card
            key={`${card.label}-${String(index)}`}
            className="gap-1 p-4 shadow-none"
          >
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {card.label}
              {tooltipText ? (
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    aria-label={`${card.label} breakdown`}
                    className="cursor-help text-muted-foreground/70 hover:text-foreground"
                  >
                    <CircleHelp className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent>{tooltipText}</TooltipContent>
                </Tooltip>
              ) : null}
            </span>
            <span
              className={`text-lg font-semibold ${colorClass ?? "text-foreground"}`}
            >
              {asText(resolvePath(data, card.field))}
            </span>
          </Card>
        );
      })}
    </div>
  </section>
);
