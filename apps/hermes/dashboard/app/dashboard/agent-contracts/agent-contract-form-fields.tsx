"use client";

import type { ChangeEvent } from "react";

import { cn } from "@workspace/ui/lib/utils";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

const BRIEF_TEXTAREA_CLASS = cn(
  "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
);

type AgentContractFormFieldsProps = {
  name: string;
  description: string;
  brief: string;
  version: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBriefChange: (value: string) => void;
  onVersionChange: (value: string) => void;
  disabled?: boolean;
};

export const AgentContractFormFields = ({
  name,
  description,
  brief,
  version,
  onNameChange,
  onDescriptionChange,
  onBriefChange,
  onVersionChange,
  disabled = false,
}: AgentContractFormFieldsProps) => {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="contract-name">Name</Label>
        <Input
          id="contract-name"
          value={name}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onNameChange(e.target.value)
          }
          placeholder="e.g. Weekly newsletter brief"
          disabled={disabled}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contract-description">Description</Label>
        <Input
          id="contract-description"
          value={description}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onDescriptionChange(e.target.value)
          }
          placeholder="Optional short description"
          disabled={disabled}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contract-version">Version</Label>
        <Input
          id="contract-version"
          value={version}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onVersionChange(e.target.value)
          }
          placeholder="e.g. 1.0"
          disabled={disabled}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contract-brief">Brief</Label>
        <textarea
          id="contract-brief"
          value={brief}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
            onBriefChange(e.target.value)
          }
          placeholder="Describe the end product: its purpose, sections, audience, and tone. Agents will receive this as context."
          rows={10}
          disabled={disabled}
          required
          className={BRIEF_TEXTAREA_CLASS}
        />
      </div>
    </>
  );
};
