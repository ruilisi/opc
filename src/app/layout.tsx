import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/shared/ThemeProvider'
import { I18nProvider } from '@/lib/i18n'
import { ApiBaseProvider } from '@/components/shared/ApiBaseProvider'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OPC — Project Management',
  description: 'Kanban project management for small teams',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <I18nProvider>
          <ApiBaseProvider>
            <ThemeProvider>
              {children}
              <Toaster />
            </ThemeProvider>
          </ApiBaseProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
