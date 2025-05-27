// sfms/app/layout.tsx
//import './globals.css';
import './dist/tailwind-output.css';
import { AuthProvider } from '@/components/AuthContext'; // Adjust path if needed
import { Toaster } from 'sonner';

export const metadata = {
  title: 'School Fee Manager',
  description: 'Efficiently manage school fees and records.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-800">
        <AuthProvider>
          {children}
          <Toaster
            richColors
            position="top-right"
            closeButton
            duration={3000}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
