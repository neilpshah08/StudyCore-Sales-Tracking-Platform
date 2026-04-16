import { requireAuth } from "@/lib/auth";
import { AuthProvider } from "@/lib/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();

  const userData = {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    status: profile.status,
  };

  return (
    <AuthProvider user={userData}>
      <div className="min-h-screen bg-gray-50">
        <Sidebar user={userData} />
        <div className="lg:pl-64">
          <TopBar title="" user={userData} />
          <main className="p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
