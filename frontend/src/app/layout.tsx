"use client";
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import NotificationPopup from '../component/NotificationPopup';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NotificationProvider>
            {children}
            <NotificationPopup />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
