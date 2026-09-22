"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StudentFormDialog } from "./student-form-dialog";

export function AddStudentButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add student</Button>
      <StudentFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
