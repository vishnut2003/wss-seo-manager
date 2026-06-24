import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjectNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-purple-900 text-white shadow-lg shadow-primary/30">
        <FileQuestion className="size-7" />
      </div>

      <div className="max-w-sm">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Project not found
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The project you&apos;re looking for doesn&apos;t exist or may have
          been deleted.
        </p>
      </div>

      <Button
        asChild
        className="h-11 gap-2 rounded-xl border-0 bg-linear-to-r from-primary to-purple-900 px-6 text-sm font-semibold text-white"
      >
        <Link href="/projects">
          <ArrowLeft className="size-4" />
          Back to projects
        </Link>
      </Button>
    </div>
  );
}
