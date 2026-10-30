import type { Metadata } from "next";
import "./helpdesk-clean-v5.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "Helpdesk — ប្រព័ន្ធគ្រប់គ្រងសំណើជំនួយបច្ចេកទេស",
  description:
    "ប្រព័ន្ធគ្រប់គ្រងសំណើជំនួយបច្ចេកទេស អ្នកប្រើប្រាស់ និងការងារ IT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="km">
      <body className="antialiased selection:bg-slate-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
