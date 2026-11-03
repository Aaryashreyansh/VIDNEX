import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIDNEX | Download what you're allowed to save",
  description: "A clean, fast video link checker and downloader for direct media and creator-authorized downloads.",
  metadataBase: new URL("https://vidnex.netlify.app"),
  openGraph: { title: "VIDNEX", description: "A simpler way to save videos you have permission to download.", type: "website" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}