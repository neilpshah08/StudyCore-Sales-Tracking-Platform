export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
