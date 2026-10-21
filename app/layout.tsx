import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentLens · 投资回答质量治理",
  description: "让投资 Agent 的每一个结论都有据可查。回答评测、证据核验、人工复核与版本对比工作台。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
