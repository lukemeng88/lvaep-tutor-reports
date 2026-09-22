"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { stopStudent } from "@/lib/actions/students";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
};

export function StopStudentDialog({ open, onOpenChange, studentId, studentName }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await stopStudent(studentId, { reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`${studentName} is no longer being tutored.`);
      setReason("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>No longer tutoring this student?</DialogTitle>
            <DialogDescription>
              Use this when you are no longer tutoring {studentName}. Their history stays, staff see the
              change in their view, and you can reactivate them later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="stop-reason">Reason</Label>
              <Textarea
                id="stop-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                autoFocus
                placeholder="For example: moved away, schedule conflict, completed goals"
              />
            </div>
            {error ? (
              <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending || !reason.trim()}>
              {pending ? "Saving" : "No longer tutoring"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
