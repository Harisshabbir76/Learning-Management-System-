"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

interface CreateAssignmentData {
  title: string;
  description: string;
  dueDate: string;
  maxMarks: string;
  file: File | null;
}

export default function CreateAssignmentPage() {
  const { schoolId, userId, courseId } = useParams() as {
    schoolId: string;
    userId: string;
    courseId: string;
  };
  
  const router = useRouter();
  const [formData, setFormData] = useState<CreateAssignmentData>({
    title: "",
    description: "",
    dueDate: "",
    maxMarks: "",
    file: null,
  });
  const [loading, setLoading] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [courseDetails, setCourseDetails] = useState<any>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch current user
        const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (!userRes.ok) throw new Error('Failed to fetch user profile');
        
        const userData = await userRes.json();
        setCurrentUser(userData.user);

        // Check if user is admin or teacher
        const userRole = userData.user?.role;
        
        if (userRole !== 'admin' && userRole !== 'teacher') {
          setUnauthorized(true);
          setPageLoading(false);
          return;
        }

        // Fetch course details to show student count
        const courseRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (courseRes.ok) {
          const courseData = await courseRes.json();
          setCourseDetails(courseData.data);
        }

        setPageLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setUnauthorized(true);
        setPageLoading(false);
      }
    };

    fetchData();
  }, [router, courseId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, file: e.target.files?.[0] || null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.dueDate || !formData.maxMarks) {
      return toast.error("Title, due date, and max marks are required");
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please log in first");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      const formDataToSend = new FormData();
      formDataToSend.append("course", courseId);
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("dueDate", new Date(formData.dueDate).toISOString());
      formDataToSend.append("maxMarks", formData.maxMarks);
      
      if (formData.file) {
        formDataToSend.append("file", formData.file);
      }

      console.log("Submitting assignment creation request...");

      const res = await fetch(`${apiUrl}/api/assignments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      // Check response type
      const contentType = res.headers.get("content-type");
      
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        
        if (res.ok) {
          const studentCount = courseDetails?.students?.length || 0;
          toast.success(`Assignment created successfully! Notification sent to ${studentCount} students.`);
          router.push(`/${schoolId}/${userId}/dashboard/courses/${courseId}/assignments`);
        } else {
          if (res.status === 403) {
            setUnauthorized(true);
            return;
          }
          toast.error(data.message || "Failed to create assignment");
          console.error("Server error:", data);
        }
      } else {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        toast.error("Server returned an unexpected response. Please check the console.");
      }
    } catch (err) {
      console.error("Error creating assignment:", err);
      toast.error("Error creating assignment. Please try again.");
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
                Administrator or teacher privileges are required to access this page.
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
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Create New Assignment</h1>
        {courseDetails && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Course:</strong> {courseDetails.name} ({courseDetails.code})
              {courseDetails.students && (
                <span className="ml-2">
                  • <strong>{courseDetails.students.length}</strong> students will be notified
                </span>
              )}
            </p>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Assignment Title *
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="Enter assignment title"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Enter assignment description (optional)"
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
              Due Date *
            </label>
            <input
              type="datetime-local"
              id="dueDate"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleInputChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="maxMarks" className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Marks *
            </label>
            <input
              type="number"
              id="maxMarks"
              name="maxMarks"
              value={formData.maxMarks}
              onChange={handleInputChange}
              placeholder="100"
              min="0"
              max="1000"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
            Assignment File (Optional)
          </label>
          <input
            type="file"
            id="file"
            name="file"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="w-full p-2 border border-gray-300 rounded-md file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG (Max 10MB)
          </p>
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Notification:</strong> All students enrolled in this course will receive a push notification about this new assignment.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </>
            ) : (
              "Create Assignment"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}