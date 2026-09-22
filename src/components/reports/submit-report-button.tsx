"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitReportDialog } from "./submit-report-dialog";

export function SubmitReportButton({
  studentId,
  studentName,
  size = "default",
  variant = "default",
}: {
  studentId: string;
  studentName: string;
  size?: "default" | "sm";
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        Submit report
      </Button>
      {open ? (
        <SubmitReportDialog open={open} onOpenChange={setOpen} studentId={studentId} studentName={studentName} />
      ) : null}
    </>
  );
}
