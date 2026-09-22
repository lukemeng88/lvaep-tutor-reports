"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatLongDate } from "@/lib/format";
import type { Scope } from "./session-editor";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  iso: string;
  recurring: boolean;
  pending: boolean;
  onConfirm: (scope: Scope) => void;
};

export function DeleteSessionDialog({ open, onOpenChange, iso, recurring, pending, onConfirm }: Props) {
  const [scope, setScope] = useState<Scope>("this");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete the session on {formatLongDate(iso)}?</DialogTitle>
          <DialogDescription>
            {recurring
              ? "This day is part of a weekly schedule. Choose whether to remove only this day or this day and every later one."
              : "This removes the session from the calendar. This cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        {recurring ? (
          <fieldset className="space-y-1.5">
            <legend className="sr-only">Which days to delete</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="delete-scope"
                checked={scope === "this"}
                onChange={() => setScope("this")}
                className="accent-primary"
              />
              This day only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="delete-scope"
                checked={scope === "future"}
                onChange={() => setScope("future")}
                className="accent-primary"
              />
              This and future days (ends the weekly schedule)
            </label>
          </fieldset>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={() => onConfirm(scope)} disabled={pending}>
            {pending ? "Deleting" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
