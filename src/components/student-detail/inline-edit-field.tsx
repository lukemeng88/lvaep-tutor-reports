"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { updateStudentField } from "@/lib/actions/students";
import { cn } from "@/lib/utils";

type Field = "full_name" | "tutoring_site" | "default_days" | "default_times";

type Props = {
  studentId: string;
  field: Field;
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  onSaving: <T>(work: () => Promise<T>) => Promise<T>;
  onError: () => void;
};

// A text field that saves itself a moment after the tutor stops typing.
// On failure the previous value comes back and a toast explains.
export function InlineEditField({
  studentId,
  field,
  label,
  value,
  placeholder,
  required,
  className,
  inputClassName,
  onSaving,
  onError,
}: Props) {
  const [draft, setDraft] = useState(value);
  const [lastSaved, setLastSaved] = useState(value);
  const [seenValue, setSeenValue] = useState(value);

  // Accept changes that arrive from the server (for example from the edit
  // dialog) without clobbering text the tutor is still typing.
  if (value !== seenValue) {
    setSeenValue(value);
    if (value !== lastSaved) {
      setLastSaved(value);
      setDraft(value);
    }
  }

  async function save(next: string) {
    const trimmed = next.trim();
    if (trimmed === lastSaved) return;
    if (required && !trimmed) {
      setDraft(lastSaved);
      toast.error(`${label} cannot be empty.`);
      return;
    }
    const previous = lastSaved;
    setLastSaved(trimmed);
    try {
      const result = await onSaving(() => updateStudentField(studentId, { field, value: trimmed }));
      if (!result.ok) throw new Error(result.error);
    } catch (err) {
      setLastSaved(previous);
      setDraft(previous);
      onError();
      toast.error(err instanceof Error ? err.message : "We could not save the change.");
    }
  }

  const { debounced, cancel } = useDebouncedCallback((next: string) => void save(next), 600);

  return (
    <label className={cn("block", className)}>
      <span className="block text-xs text-gray-500">{label}</span>
      <input
        value={draft}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => {
          setDraft(e.target.value);
          debounced(e.target.value);
        }}
        onBlur={() => {
          cancel();
          void save(draft);
        }}
        className={cn(
          "w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 -mx-1 text-gray-900 hover:border-gray-300 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30",
          inputClassName,
        )}
      />
    </label>
  );
}
