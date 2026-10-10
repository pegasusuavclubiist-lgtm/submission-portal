import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orion Hackathon · Submit your project",
  description: "Submit your project for the Orion hackathon.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans text-slate-200 antialiased">
        <div aria-hidden className="orion-bg pointer-events-none fixed inset-0 -z-10" />
        {children}
      </body>
    </html>
  );
}
