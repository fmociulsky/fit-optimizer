"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchCreateBar({
  query,
  onQueryChange,
  placeholder,
  createLabel,
  creating,
  onToggleCreate,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  createLabel: string;
  creating: boolean;
  onToggleCreate: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        className="h-11 flex-1 text-base"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <Button
        type="button"
        className="h-11 px-5"
        variant={creating ? "outline" : "default"}
        onClick={onToggleCreate}
      >
        {creating ? (
          "Cancelar"
        ) : (
          <>
            <Plus data-icon="inline-start" />
            {createLabel}
          </>
        )}
      </Button>
    </div>
  );
}
