import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function StudentNotFound() {
  return (
    <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-gray-900">Student not found</h1>
      <p className="mt-2 text-sm text-gray-600">
        This student does not exist or is not on your list.
      </p>
      <Button className="mt-4" nativeButton={false} render={<Link href="/home" />}>
        Back to Home
      </Button>
    </div>
  );
}
