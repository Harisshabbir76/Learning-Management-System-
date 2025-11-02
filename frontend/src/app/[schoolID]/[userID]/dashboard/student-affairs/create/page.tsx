'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
  grade: string;
  capacity: number;
  students: string[];
  isActive: boolean;
}

export default function CreateStudent() {
  const router = useRouter();
  const params = useParams();
  const { schoolID, userID } = params;
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    userId: '',
    role: 'student', // Permanently set to student
    class: '', // This will store the section ID
    fees: '', // Added fees field
  });
  
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Show all sections from the school, regardless of capacity
        const allSections = data.data || [];
        setSections(allSections);
      } else {
        setError('Failed to fetch sections');
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
      setError('Error fetching sections');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle fees as number
    if (name === 'fees') {
      setFormData({
        ...formData,
        [name]: value === '' ? '' : Number(value), // Convert to number or empty string
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      
      // Prepare data for API - ensure fees is sent as number
      const submitData = {
        ...formData,
        fees: formData.fees === '' ? 0 : Number(formData.fees), // Ensure fees is a number
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess('Student created successfully!');
        setFormData({
          name: '',
          email: '',
          password: '',
          userId: '',
          role: 'student',
          class: '',
          fees: '',
        });
        // Redirect to student list after 2 seconds
        setTimeout(() => {
          router.push(`/${schoolID}/${userID}/dashboard/student-affairs`);
        }, 2000);
      } else {
        setError(data.message || 'Failed to create student');
      }
    } catch (err) {
      console.error('Error creating student:', err);
      setError('Error creating student');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if a section is full
  const isSectionFull = (section: Section) => {
    return section.students.length >= section.capacity;
  };

  // Helper function to get section status
  const getSectionStatus = (section: Section) => {
    if (!section.isActive) return 'Inactive';
    if (isSectionFull(section)) return 'Full';
    return 'Available';
  };

  // Helper function to get section status color
  const getSectionStatusColor = (section: Section) => {
    if (!section.isActive) return 'text-red-600';
    if (isSectionFull(section)) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/${schoolID}/${userID}/dashboard/student-affairs`}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-4"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Student Management
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New Student</h1>
          <p className="mt-2 text-sm text-gray-600">
            Fill in the student details and assign them to a section.
          </p>
        </div>

        {/* Success/Error Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 font-medium">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-green-700 font-medium">{success}</span>
            </div>
          </div>
        )}

        {/* Create Student Form */}
        <div className="bg-white shadow rounded-lg">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter student's full name"
                />
              </div>

              {/* Student ID */}
              <div>
                <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                  Student ID *
                </label>
                <input
                  type="number"
                  id="userId"
                  name="userId"
                  value={formData.userId}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter student ID number"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter email address"
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password *
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter password"
                />
              </div>

              {/* Fees */}
              <div>
                <label htmlFor="fees" className="block text-sm font-medium text-gray-700">
                  Fees ($)
                </label>
                <input
                  type="number"
                  id="fees"
                  name="fees"
                  value={formData.fees}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter fees amount"
                />
              </div>

              {/* Role (Hidden but fixed as student) */}
              <div className="hidden">
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role *
                </label>
                <input
                  type="text"
                  id="role"
                  name="role"
                  value="student"
                  readOnly
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 text-gray-500 sm:text-sm"
                />
              </div>

              {/* Section Selection */}
              <div className="sm:col-span-2">
                <label htmlFor="class" className="block text-sm font-medium text-gray-700">
                  Assign to Section *
                </label>
                <select
                  id="class"
                  name="class"
                  value={formData.class}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">Select a section</option>
                  {sections.map((section) => (
                    <option 
                      key={section._id} 
                      value={section._id}
                      disabled={!section.isActive || isSectionFull(section)}
                      className={!section.isActive || isSectionFull(section) ? 'text-gray-400' : ''}
                    >
                      {section.name} ({section.sectionCode}) - {section.grade} 
                      - {section.students.length}/{section.capacity} students
                      {!section.isActive && ' - [Inactive]'}
                      {section.isActive && isSectionFull(section) && ' - [Full]'}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex flex-wrap gap-4 text-xs">
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                    Available
                  </span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mr-1"></div>
                    Full
                  </span>
                  <span className="flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                    Inactive
                  </span>
                </div>
              </div>
            </div>

            {/* Section Summary */}
            {sections.length > 0 && (
              <div className="bg-gray-50 rounded-md p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Section Summary</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="text-center p-2 bg-green-50 rounded border border-green-200">
                    <div className="text-green-700 font-semibold">
                      {sections.filter(s => s.isActive && !isSectionFull(s)).length}
                    </div>
                    <div className="text-green-600">Available</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded border border-orange-200">
                    <div className="text-orange-700 font-semibold">
                      {sections.filter(s => s.isActive && isSectionFull(s)).length}
                    </div>
                    <div className="text-orange-600">Full</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded border border-red-200">
                    <div className="text-red-700 font-semibold">
                      {sections.filter(s => !s.isActive).length}
                    </div>
                    <div className="text-red-600">Inactive</div>
                  </div>
                </div>
              </div>
            )}

            {/* No Sections Warning */}
            {sections.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      No Sections Found
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        There are no sections available in your school. Please create a section first before adding students.
                      </p>
                    </div>
                    <div className="mt-3">
                      <Link
                        href={`/${schoolID}/${userID}/dashboard/section/create`}
                        className="text-sm font-medium text-yellow-800 underline hover:text-yellow-900"
                      >
                        Create New Section →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
              <Link
                href={`/${schoolID}/${userID}/dashboard/student-affairs`}
                className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || sections.length === 0}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </span>
                ) : (
                  'Create Student'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Additional Information */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">About Student Assignment</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Students are automatically enrolled in the selected section</li>
            <li>• Section capacity limits are enforced</li>
            <li>• Only active sections can be selected for new students</li>
            <li>• Full sections are disabled but still visible</li>
            <li>• Students can be reassigned to different sections later if needed</li>
            <li>• Fees information is optional and can be updated later</li>
          </ul>
        </div>
      </div>
    </div>
  );
}