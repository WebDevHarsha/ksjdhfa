import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wind forecast desk | Meridian",
  description:
    "Review UK day-ahead wind generation forecasts against Elexon actuals, with transparent vintage and coverage reporting.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
