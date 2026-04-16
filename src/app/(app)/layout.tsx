import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const userData = {
    id: profile.id,
    full_name: profile.full_name,
    role: profile.role,
    email: profile.email,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={userData} />
      <div className="lg:pl-64">
        <TopBar title="" user={userData} />
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
