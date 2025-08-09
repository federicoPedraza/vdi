import type { Metadata } from "next";
import "./globals.css";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import RequestSimulator from "@/components/RequestSimulator";

export const metadata: Metadata = {
  title: "Octos",
  description: "Adapters",
  icons: {
    icon: "/svg/doodles/vdi-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne+Mono&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <ConvexClientProvider>
          {children}
          <RequestSimulator />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
