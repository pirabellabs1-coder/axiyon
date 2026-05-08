import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2.5 text-sm font-semibold"
      >
        <span className="relative size-6 rounded-md bg-grad shadow-[0_0_24px_rgba(91,108,255,.4)]">
          <span className="absolute inset-1 rounded-sm bg-bg" />
          <span className="absolute inset-[7px] rounded-[1px] bg-grad" />
        </span>
        Axion
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
