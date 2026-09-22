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
import { createStudent, updateStudent, type StudentFields } from "@/lib/actions/students";
import type { Student } from "@/lib/supabase/database.types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When a student is given the dialog edits it; otherwise it adds a new one.
  student?: Pick<Student, "id" | "full_name" | "tutoring_site" | "default_days" | "default_times">;
};

export function StudentFormDialog({ open, onOpenChange, student }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editing = Boolean(student);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fields: StudentFields = {
      fullName: String(form.get("fullName") ?? ""),
      tutoringSite: String(form.get("tutoringSite") ?? ""),
      defaultDays: String(form.get("defaultDays") ?? ""),
      defaultTimes: String(form.get("defaultTimes") ?? ""),
    };
    setError(null);
    startTransition(async () => {
      const result = student ? await updateStudent(student.id, fields) : await createStudent(fields);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(student ? "Student updated." : "Student added.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit student" : "Add student"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the student's details."
                : "Add a learner you are tutoring. You can change these details later."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="student-fullName">Full name</Label>
              <Input
                id="student-fullName"
                name="fullName"
                defaultValue={student?.full_name ?? ""}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="student-tutoringSite">Tutoring site</Label>
              <Input
                id="student-tutoringSite"
                name="tutoringSite"
                defaultValue={student?.tutoring_site ?? ""}
                placeholder="Bloomfield Public Library"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="student-defaultDays">Usual days (optional)</Label>
                <Input
                  id="student-defaultDays"
                  name="defaultDays"
                  defaultValue={student?.default_days ?? ""}
                  placeholder="Mon, Wed"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="student-defaultTimes">Usual times (optional)</Label>
                <Input
                  id="student-defaultTimes"
                  name="defaultTimes"
                  defaultValue={student?.default_times ?? ""}
                  placeholder="10:00 to 11:30 am"
                />
              </div>
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
              {pending ? "Saving" : editing ? "Save changes" : "Add student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
