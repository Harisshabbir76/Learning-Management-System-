'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

interface AddStudentToCourseModalProps {
  courseId: string;
  onClose: () => void;
  onSuccess: (updatedCourse: any) => void;
}

interface StudentForm {
  name: string;
  userId: string;
  email: string;
  password: string;
}

export default function AddStudentToCourseModal({
  courseId,
  onClose,
  onSuccess
}: AddStudentToCourseModalProps) {
  const [tab, setTab] = useState<'new' | 'existing'>('new');
  const [form, setForm] = useState<StudentForm>({
    name: '',
    userId: '',
    email: '',
    password: '',
  });
  const [existingId, setExistingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Validate courseId on mount
  useEffect(() => {
    if (!courseId || courseId === 'undefined') {
      setError('Invalid course ID');
      toast.error('Invalid course ID');
      onClose();
    }
  }, [courseId, onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Authentication required');

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Failed to fetch user info');
        
        const data = await res.json();
        if (!data.user) throw new Error('User data not found');
        
        setCurrentUser(data.user);
      } catch (err: any) {
        console.error('Error fetching user info:', err);
        setError(err.message);
      }
    };

    fetchCurrentUser();
  }, []);

  const handleNewStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate courseId again
    if (!courseId || courseId === 'undefined') {
      setError('Invalid course ID');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');
      if (!currentUser) throw new Error('User information not loaded');

      // Validate userId is a number
      const numericUserId = Number(form.userId);
      if (isNaN(numericUserId)) {
        throw new Error('User ID must be a number');
      }

      // Create student
      const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: form.name.trim(),
          userId: numericUserId,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: 'student',
          school: currentUser.school
        })
      });

      if (!userRes.ok) {
        let errorData;
        try {
          errorData = await userRes.json();
        } catch (parseError) {
          throw new Error(`Server error: ${userRes.status} ${userRes.statusText}`);
        }
        throw new Error(errorData.message || errorData.error || 'Failed to create student');
      }

      const userData = await userRes.json();
      
      // Use the numeric userId for enrollment
      const studentUserId = userData.data?.userId || numericUserId;

      // Enroll student in course - CORRECTED FIELD NAME
      const enrollRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}/students`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ studentId: studentUserId }), // ✅ Changed to studentId (singular)
        }
      );

      if (!enrollRes.ok) {
        let errorData;
        try {
          errorData = await enrollRes.json();
        } catch (parseError) {
          throw new Error(`Server error: ${enrollRes.status} ${enrollRes.statusText}`);
        }
        throw new Error(errorData.message || errorData.error || 'Failed to enroll student');
      }

      const enrollData = await enrollRes.json();
      toast.success('Student created and enrolled successfully');
      onSuccess(enrollData.data);
      onClose();
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  const handleExistingStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate courseId again
    if (!courseId || courseId === 'undefined') {
      setError('Invalid course ID');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');
      if (!currentUser) throw new Error('User information not loaded');

      if (!existingId.trim()) throw new Error('Student ID is required');

      // Convert to number to ensure proper type
      const numericStudentId = Number(existingId);
      if (isNaN(numericStudentId)) throw new Error('Student ID must be a number');

      // Enroll student - CORRECTED FIELD NAME
      const enrollRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}/students`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ studentId: numericStudentId }), // ✅ Changed to studentId (singular)
        }
      );

      const responseData = await enrollRes.json();

      if (!enrollRes.ok) {
        throw new Error(responseData.message || responseData.error || 'Failed to enroll student');
      }

      toast.success(responseData.message || 'Student enrolled successfully');
      onSuccess(responseData.data);
      onClose();
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to enroll student');
    } finally {
      setLoading(false);
    }
  };

  // Don't render if courseId is invalid
  if (!courseId || courseId === 'undefined') {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Add Student to Course</h2>
            <button onClick={onClose} disabled={loading} className="text-gray-500 hover:text-gray-700">
              &times;
            </button>
          </div>

          <div className="flex border-b mb-4">
            <button
              onClick={() => setTab('new')}
              className={`py-2 px-4 ${tab === 'new' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
              disabled={loading}
            >
              New Student
            </button>
            <button
              onClick={() => setTab('existing')}
              className={`py-2 px-4 ${tab === 'existing' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
              disabled={loading}
            >
              Existing Student
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded text-sm">
              {error}
            </div>
          )}

          {tab === 'new' ? (
            <form onSubmit={handleNewStudentSubmit} className="space-y-4">
              <div>
                <label className="block mb-1">Full Name *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block mb-1">User ID *</label>
                <input
                  name="userId"
                  type="number"
                  value={form.userId}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                  min="1000"
                  max="999999"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block mb-1">Email *</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block mb-1">Password *</label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {loading ? 'Adding...' : 'Add Student'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleExistingStudentSubmit} className="space-y-4">
              <div>
                <label className="block mb-1">Student ID *</label>
                <input
                  value={existingId}
                  onChange={(e) => setExistingId(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Enter student ID number"
                  required
                  disabled={loading}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {loading ? 'Enrolling...' : 'Enroll Student'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}