"use client";

import { ArrowUpRightIcon, XIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";

import { DateTime } from "@/components/date-time/date-time";

import type { GraphNodeDetail } from "../detail-block-graph-model";

import type { GraphSceneNode } from "./build-graph-scene";
import { GRAPH_SLOT_COLOR } from "./graph-presentation";

export type GraphNodeDetailsProps = {
  node: GraphSceneNode;
  connections: readonly GraphSceneNode[];
  onSelectNode: (id: string) => void;
  onClose: () => void;
};

const toSafeHttpUrl = (value: string): string | undefined => {
  try {
    const url = new URL(value);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";

    return isHttp ? value : undefined;
  } catch {
    return undefined;
  }
};

const formatDetailNumber = (value: string): string => {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : value;
};

const GraphNodeDetailValue = ({ detail }: { detail: GraphNodeDetail }) => {
  if (detail.format === "url") {
    const href = toSafeHttpUrl(detail.value);
    if (href !== undefined) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary break-all underline underline-offset-4"
        >
          {detail.value}
        </a>
      );
    }
  }
  if (detail.format === "number") {
    return (
      <span className="tabular-nums">{formatDetailNumber(detail.value)}</span>
    );
  }
  if (detail.format === "date-time") {
    return <DateTime value={detail.value} style="datetime" />;
  }

  return <span className="break-words">{detail.value}</span>;
};

const GraphNodeSwatch = ({ node }: { node: GraphSceneNode }) => (
  <span
    aria-hidden="true"
    className="inline-block size-2 shrink-0 rounded-full"
    style={{ background: GRAPH_SLOT_COLOR[node.slot] }}
  />
);

const GraphNodeDetailsBody = ({
  node,
  connections,
  onSelectNode,
}: Omit<GraphNodeDetailsProps, "onClose">) => {
  const externalLinkProps = node.external
    ? {
        target: "_blank",
        rel: "noopener noreferrer",
        "aria-label": "Open (opens in a new tab)",
      }
    : {};

  return (
    <div className="flex min-w-0 flex-col gap-3 text-sm">
      {node.group ? (
        <Badge variant="outline" className="gap-1.5">
          <GraphNodeSwatch node={node} />
          {node.group}
        </Badge>
      ) : null}
      {node.tooltip ? (
        <p className="text-muted-foreground break-words">{node.tooltip}</p>
      ) : null}
      {node.details.length > 0 ? (
        <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
          {node.details.map((detail) => (
            <div key={`${detail.label}:${detail.value}`} className="contents">
              <dt className="text-muted-foreground">{detail.label}</dt>
              <dd className="min-w-0">
                <GraphNodeDetailValue detail={detail} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-muted-foreground text-xs font-medium">
          {`Connections (${String(connections.length)})`}
        </p>
        {connections.length > 0 ? (
          <ul className="flex min-w-0 flex-col">
            {connections.map((connection) => (
              <li key={connection.id} className="min-w-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full min-w-0 justify-start px-2 py-1.5 text-left font-normal"
                  onClick={() => onSelectNode(connection.id)}
                >
                  <GraphNodeSwatch node={connection} />
                  <span className="min-w-0 truncate">{connection.label}</span>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {node.href ? (
        <Button asChild size="sm" variant="outline" className="self-start">
          <Link href={node.href} {...externalLinkProps}>
            Open
            <ArrowUpRightIcon aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
};

export const GraphNodeDetails = ({
  node,
  connections,
  onSelectNode,
  onClose,
}: GraphNodeDetailsProps) => {
  const isMobile = useIsMobile();

  return (
    <>
      <Card
        data-slot="graph-node-details"
        aria-label={`${node.label} details`}
        role="region"
        className="absolute top-2 right-2 z-10 hidden max-h-[calc(100%-1rem)] w-72 gap-3 overflow-y-auto px-4 py-4 shadow-md md:flex"
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 text-sm leading-snug font-semibold break-words">
            {node.label}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="-mt-0.5 -mr-1"
            aria-label="Close details"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>
        <GraphNodeDetailsBody
          node={node}
          connections={connections}
          onSelectNode={onSelectNode}
        />
      </Card>
      <Sheet
        open={isMobile}
        onOpenChange={(open) => {
          if (!open) {
            onClose();
          }
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[80vh] gap-0 overflow-y-auto"
        >
          <SheetHeader className="pr-10">
            <SheetTitle className="break-words">{node.label}</SheetTitle>
            <SheetDescription className="sr-only">
              Details and connections for the selected node.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <GraphNodeDetailsBody
              node={node}
              connections={connections}
              onSelectNode={onSelectNode}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
