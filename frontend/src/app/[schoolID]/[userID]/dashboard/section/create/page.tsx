'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Teacher {
  _id: string;
  name: string;
  email: string;
  userId: number;
}

export default function CreateSectionPage() {
  const router = useRouter();
  const { schoolID, userID } = useParams();
  const [formData, setFormData] = useState({
    name: '',
    sectionCode: '',
    description: '',
    capacity: 30,
    sessionStartDate: '',
    sessionEndDate: '',
    teacher: ''
  });
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchTeachers();
    
    // Set default dates (today and 6 months from today)
    const today = new Date();
    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(today.getMonth() + 6);
    
    setFormData(prev => ({
      ...prev,
      sessionStartDate: formatDateForInput(today),
      sessionEndDate: formatDateForInput(sixMonthsLater)
    }));
  }, []);

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch user profile');
      
      const data = await res.json();
      const user = data.user || data.data;
      setCurrentUser(user);

      if (!hasSectionManagementPermission(user)) {
        setUnauthorized(true);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setUnauthorized(true);
    } finally {
      setPageLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users?role=teacher`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch teachers');
      
      const data = await response.json();
      if (data.success && data.data) {
        setTeachers(data.data);
        if (data.data.length > 0) {
          setFormData(prev => ({ ...prev, teacher: data.data[0]._id }));
        }
      }
    } catch (err) {
      console.error('Error fetching teachers:', err);
    }
  };

  const hasSectionManagementPermission = (user: any) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'faculty' && user.permissions?.includes('student_affairs')) return true;
    return false;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ 
      ...formData, 
      [name]: name === 'sectionCode' ? value.toUpperCase() : value 
    });
  };

  const validateDates = () => {
    const startDate = new Date(formData.sessionStartDate);
    const endDate = new Date(formData.sessionEndDate);
    const today = new Date();
    
    if (startDate >= endDate) {
      return 'End date must be after start date';
    }
    
    if (startDate < today) {
      return 'Start date cannot be in the past';
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Frontend validation
    if (!formData.name || !formData.sectionCode || !formData.sessionStartDate || !formData.sessionEndDate || !formData.teacher) {
      setError('All fields are required');
      setLoading(false);
      return;
    }

    const dateError = validateDates();
    if (dateError) {
      setError(dateError);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          sessionStartDate: new Date(formData.sessionStartDate).toISOString(),
          sessionEndDate: new Date(formData.sessionEndDate).toISOString()
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create section');

      setSuccess('Section created successfully!');
      setFormData({
        name: '',
        sectionCode: '',
        description: '',
        capacity: 30,
        sessionStartDate: '',
        sessionEndDate: '',
        teacher: teachers.length > 0 ? teachers[0]._id : ''
      });

      setTimeout(() => {
        router.push(`/${schoolID}/${userID}/dashboard/section`);
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
              <p className="mt-1 text-sm text-red-700">
                {currentUser?.role === 'faculty' 
                  ? 'Faculty members require "student_affairs" permission to access this page.'
                  : 'Administrator privileges or student_affairs permission are required to access this page.'
                }
              </p>
              <div className="mt-4">
                <Link
                  href={`/${currentUser?.school?._id || 'school'}/${currentUser?.userId || 'user'}/dashboard`}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center mb-6">
        <Link 
          href={`/${schoolID}/${userID}/dashboard/section`}
          className="mr-4 p-2 rounded hover:bg-gray-100 transition-colors"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Create New Section</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-200">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded border border-green-200">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {success}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
        <div>
          <label className="block mb-1 font-medium">Section Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            required
            placeholder="e.g., Morning Batch, Grade 10-A"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Section Code *</label>
          <input
            type="text"
            name="sectionCode"
            value={formData.sectionCode}
            onChange={handleChange}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors uppercase"
            required
            placeholder="e.g., MORNING-A, G10-A"
          />
          <p className="text-sm text-gray-600 mt-1">Unique code for this section (will be converted to uppercase)</p>
        </div>

        <div>
          <label className="block mb-1 font-medium">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            rows="3"
            placeholder="Optional description of the section"
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Teacher *</label>
          <select
            name="teacher"
            value={formData.teacher}
            onChange={handleChange}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            required
          >
            {teachers.map(teacher => (
              <option key={teacher._id} value={teacher._id}>
                {teacher.name} (ID: {teacher.userId})
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-600 mt-1">Select the teacher for this section</p>
        </div>

        <div>
          <label className="block mb-1 font-medium">Capacity</label>
          <input
            type="number"
            name="capacity"
            value={formData.capacity}
            onChange={handleChange}
            min="1"
            max="100"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
          />
          <p className="text-sm text-gray-600 mt-1">Maximum number of students in this section</p>
        </div>

        <div>
          <label className="block mb-1 font-medium">Session Start Date *</label>
          <input
            type="date"
            name="sessionStartDate"
            value={formData.sessionStartDate}
            onChange={handleChange}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            required
            min={new Date().toISOString().split('T')[0]}
          />
          <p className="text-sm text-gray-600 mt-1">When the session begins</p>
        </div>

        <div>
          <label className="block mb-1 font-medium">Session End Date *</label>
          <input
            type="date"
            name="sessionEndDate"
            value={formData.sessionEndDate}
            onChange={handleChange}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            required
            min={formData.sessionStartDate || new Date().toISOString().split('T')[0]}
          />
          <p className="text-sm text-gray-600 mt-1">When the session ends</p>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={() => router.push(`/${schoolID}/${userID}/dashboard/section`)}
            className="px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : 'Create Section'}
          </button>
        </div>
      </form>
    </div>
  );
}