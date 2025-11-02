// components/JwtExpiredModal.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function JwtExpiredModal() {
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleJwtExpired = () => setShow(true);
    window.addEventListener('jwt-expired', handleJwtExpired);
    return () => window.removeEventListener('jwt-expired', handleJwtExpired);
  }, []);

  const handleLogin = () => {
    localStorage.removeItem('token'); // clear token
    router.push('/login'); // redirect to login
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-md text-center max-w-sm">
        <h2 className="text-xl font-bold mb-4">Session Expired</h2>
        <p className="mb-4">You have been logged out. Please login again.</p>
        <button
          onClick={handleLogin}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Login
        </button>
      </div>
    </div>
  );
}
