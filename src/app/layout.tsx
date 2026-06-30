import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/providers/AppProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LinkPay — Verified USDC payment links",
  description:
    "Create and pay verified USDC payment links with email sign-in, Particle Universal Accounts, Magic, and Arbitrum.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const m = window.matchMedia('(prefers-color-scheme: dark)');
                if (m.matches) document.documentElement.classList.add('dark');
                m.addEventListener('change', (e) => {
                  if (e.matches) document.documentElement.classList.add('dark');
                  else document.documentElement.classList.remove('dark');
                });
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
        suppressHydrationWarning
      >
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
