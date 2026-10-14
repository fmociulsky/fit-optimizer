import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { AppProvider } from "@/components/app-provider";
import { RoleGate } from "@/components/role-gate";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Enforma — gimnasio, profesores y alumnos",
  description:
    "Administra un gimnasio: profesores, alumnos, horarios y cupo. Cada alumno elige el día dentro del horario de su sucursal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ClerkProvider
          localization={esES}
          appearance={{ theme: shadcn }}
          afterSignOutUrl="/"
        >
          <ThemeProvider>
            <AppProvider>
              <RoleGate>
                {children}
                <Toaster />
              </RoleGate>
            </AppProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
