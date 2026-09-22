import type { SaveStatus } from "@/hooks/use-save-status";

export function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return <span className="h-5" aria-hidden="true" />;
  const text = status === "saving" ? "Saving" : status === "saved" ? "Saved" : "Not saved";
  const color =
    status === "saving" ? "text-gray-500" : status === "saved" ? "text-green-700" : "text-red-700";
  return (
    <span role="status" aria-live="polite" className={`text-xs font-medium ${color}`}>
      {text}
    </span>
  );
}
