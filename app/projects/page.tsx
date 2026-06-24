import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function ProjectsPage() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Projects
        </h1>
        <p className="text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-primary">
            {session?.user?.email}
          </span>
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}
