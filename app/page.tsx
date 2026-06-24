import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Login from "@/components/ui-elements/auth/login";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/projects");
  }

  return <Login />;
}
