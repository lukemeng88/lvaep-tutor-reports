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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStudent, type StudentFields } from "@/lib/actions/students";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Adds a new student. Once a student exists, their name and site are edited
// in place in the header of their page; days and times come from sessions.
export function StudentFormDialog({ open, onOpenChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields: StudentFields = {
      fullName: String(form.get("fullName") ?? ""),
      tutoringSite: String(form.get("tutoringSite") ?? ""),
    };
    setError(null);
    startTransition(async () => {
      const result = await createStudent(fields);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Student added.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>Add student</DialogTitle>
            <DialogDescription>Add a learner you are tutoring. You can change these details later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="student-fullName">Full name</Label>
              <Input
                id="student-fullName"
                name="fullName"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="student-tutoringSite">Tutoring site</Label>
              <Input
                id="student-tutoringSite"
                name="tutoringSite"
                placeholder="Bloomfield Public Library"
                required
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
            <Button type="submit" disabled={pending}>
              {pending ? "Saving" : "Add student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
