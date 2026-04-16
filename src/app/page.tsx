import { redirect } from "next/navigation";
import { getAuthUser, getUserProfile } from "@/lib/auth";

export default async function Home() {
  const authUser = await getAuthUser();

  if (authUser) {
    const profile = await getUserProfile();
    if (profile?.role === "admin") redirect("/admin");
    redirect("/dashboard");
  }

  redirect("/login");
}
