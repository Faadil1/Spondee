import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spondee",
  description: "Agents, measured by what they deliver.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
