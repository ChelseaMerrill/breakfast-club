import type { Metadata } from "next";
import { Fredoka, Titan_One } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const titanOne = Titan_One({
  variable: "--font-titan-one",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Breakfast Club",
  description: "Thursdays at 108 State — menu, sponsors, RSVPs and orders.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${titanOne.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
