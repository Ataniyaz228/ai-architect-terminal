import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Architect Terminal",
  description: "Intelligent proxy-editor for developers — raw thoughts to structured architectural prompts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', height: '100vh' }}>
        {children}
      </body>
    </html>
  );
}
