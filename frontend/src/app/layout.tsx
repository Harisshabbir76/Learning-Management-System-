import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { NotificationProvider } from '../context/NotificationContext';
import NotificationPopup from '../component/NotificationPopup';
import { Toaster } from 'react-hot-toast';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased selection:bg-primary/30 selection:text-primary min-h-screen">
        <AuthProvider>
          <NotificationProvider>
            <div className="relative isolate min-h-screen">
              {/* Global Decorative Background */}
              <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] animate-blob"></div>
                <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] rounded-full bg-purple-500/5 blur-[100px] animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-[10%] left-[20%] w-[35%] h-[35%] rounded-full bg-blue-500/5 blur-[110px] animate-blob animation-delay-4000"></div>
              </div>
              
              {children}
            </div>
            <Toaster position="top-right" gutter={8} toastOptions={{
              className: 'glass !rounded-2xl !shadow-2xl !border-white/20 !text-foreground',
              duration: 4000,
            }} />
            <NotificationPopup />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
