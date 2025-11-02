"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

interface Student {
  _id: string;
  name: string;
  email: string;
  rollNumber?: string;
}

interface Submission {
  _id: string;
  student: Student | null;
  fileUrl: string;
  marksObtained: number | null;
  feedback: string;
  submittedAt: string;
  assignment: { title: string; maxMarks?: number };
}

interface GradingData {
  marksObtained: number | null;
  feedback: string;
}

// Helper function to safely access student data
const getStudentInfo = (student: any) => {
  if (!student) {
    return {
      name: 'Unknown Student',
      email: 'No email available',
      rollNumber: undefined
    };
  }
  
  if (typeof student === 'string') {
    return {
      name: 'Student (Details Not Loaded)',
      email: 'Please check backend population',
      rollNumber: undefined
    };
  }
  
  return {
    name: student.name || 'Unnamed Student',
    email: student.email || 'No email available',
    rollNumber: student.rollNumber
  };
};

// Enhanced download handler function
const handleDownload = async (fileUrl: string, fileName: string) => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please log in first");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const fullUrl = `${apiUrl}${fileUrl}`;
    
    const response = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`File not found. Please check if the file exists at: ${fileUrl}`);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    
    if (blob.size === 0) {
      throw new Error("Downloaded file is empty");
    }
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    const downloadName = fileName || fileUrl.split('/').pop() || 'download';
    a.download = downloadName;
    
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('File downloaded successfully');
  } catch (error: any) {
    console.error('Download failed:', error);
    toast.error(error.message || 'Failed to download file');
  }
};

export default function ViewSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  
  const { schoolId, userId, courseId, assigmentId } = params as {
    schoolId: string;
    userId: string;
    courseId: string;
    assigmentId: string;
  };
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gradingData, setGradingData] = useState<GradingData>({
    marksObtained: null,
    feedback: ""
  });
  const [unauthorized, setUnauthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    const fetchCurrentUser = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (!res.ok) throw new Error('Failed to fetch user profile');
        
        const data = await res.json();
        setCurrentUser(data.user);

        const userRole = data.user?.role;
        
        if (userRole !== 'admin' && userRole !== 'teacher') {
          setUnauthorized(true);
          setPageLoading(false);
          return;
        }

        setPageLoading(false);
      } catch (err) {
        console.error('Error fetching user:', err);
        setUnauthorized(true);
        setPageLoading(false);
      }
    };

    fetchCurrentUser();
  }, [router]);

  useEffect(() => {
    if (unauthorized || !assigmentId || assigmentId === "undefined") {
      setLoading(false);
      return;
    }

    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Please log in first");
          setLoading(false);
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        
        const res = await fetch(
          `${apiUrl}/api/assignments/${assigmentId}/submissions`,
          {
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
          }
        );
        
        if (!res.ok) {
          if (res.status === 403) {
            setUnauthorized(true);
            return;
          }
          toast.error(`Failed to load submissions: ${res.status}`);
          return;
        }

        const data = await res.json();
        
        if (data.success) {
          setSubmissions(data.data);
        } else {
          toast.error(data.message || "Failed to load submissions");
        }
      } catch (err: any) {
        console.error("Error fetching submissions:", err);
        if (!err.message.includes("Access denied")) {
          toast.error(err.message || "Error fetching submissions");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [assigmentId, schoolId, userId, courseId, unauthorized]);

  const handleGrade = async (submissionId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please log in first");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      const res = await fetch(
        `${apiUrl}/api/assignments/submissions/${submissionId}/grade`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            marksObtained: gradingData.marksObtained,
            feedback: gradingData.feedback
          }),
        }
      );

      if (!res.ok) {
        if (res.status === 403) {
          setUnauthorized(true);
          return;
        }
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.message || `Failed to grade: ${res.status}`);
        return;
      }

      const data = await res.json();
      
      if (data.success) {
        toast.success("Graded successfully");
        setSubmissions(prev =>
          prev.map(s => s._id === submissionId ? data.data : s)
        );
        setEditingId(null);
        setGradingData({ marksObtained: null, feedback: "" });
      } else {
        toast.error(data.message || "Failed to grade");
      }
    } catch (err: any) {
      console.error("Error grading submission:", err);
      toast.error(err.message || "Error grading submission");
    }
  };

  const startEditing = (submission: Submission) => {
    setEditingId(submission._id);
    setGradingData({
      marksObtained: submission.marksObtained,
      feedback: submission.feedback || ""
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setGradingData({ marksObtained: null, feedback: "" });
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading submissions...</p>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h3>
            <p className="text-gray-600 mb-6">
              Administrator or teacher privileges are required to access this page.
            </p>
            <Link
              href={`/${currentUser?.school?._id || 'school'}/${currentUser?.userId || 'user'}/dashboard`}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm">
                Assignment Submissions
              </h1>
              <p className="text-gray-600 mt-2 ml-6">
                {submissions.length} submission{submissions.length !== 1 ? 's' : ''} received
              </p>
            </div>
            
            <Link
              href={`/${schoolId}/${userId}/dashboard/courses/${courseId}/assignments`}
              className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-all duration-200 transform hover:scale-105 shadow-lg border border-gray-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Assignments
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading submissions...</p>
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No submissions yet</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Students haven't submitted their work for this assignment. Check back later for new submissions.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {submissions.map((submission) => {
              const student = getStudentInfo(submission.student);
              const isGraded = submission.marksObtained !== null;
              
              return (
                <div key={submission._id} className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden hover:shadow-md transition-all duration-300">
                  {/* Student Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900">
                            {student.name}
                          </h3>
                          <p className="text-gray-600 text-sm">{student.email}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/80 backdrop-blur-sm border border-gray-200/60">
                          <svg className="w-4 h-4 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {new Date(submission.submittedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                      {/* Student Info */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Student Information
                        </h4>
                        <div className="space-y-2 text-sm">
                          {student.rollNumber && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Roll Number:</span>
                              <span className="font-medium text-gray-900">{student.rollNumber}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600">Submitted:</span>
                            <span className="font-medium text-gray-900">
                              {new Date(submission.submittedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Grade Status */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Grading Status
                        </h4>
                        <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
                          isGraded 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {isGraded ? (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Graded: {submission.marksObtained}
                              {submission.assignment.maxMarks && ` / ${submission.assignment.maxMarks}`}
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Awaiting Grade
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Actions
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleDownload(submission.fileUrl, `${student.name}-submission`)}
                            className="inline-flex items-center px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-all duration-200 transform hover:scale-105 shadow-sm"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </button>
                          
                          {!editingId && (
                            <button
                              onClick={() => startEditing(submission)}
                              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-all duration-200 transform hover:scale-105 shadow-sm"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              {isGraded ? 'Edit Grade' : 'Add Grade'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Grading Interface */}
                    {editingId === submission._id && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200/60">
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Grade Submission
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Marks Obtained
                              {submission.assignment.maxMarks && (
                                <span className="text-sm text-gray-500 ml-1">
                                  (out of {submission.assignment.maxMarks})
                                </span>
                              )}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={submission.assignment.maxMarks || 100}
                              value={gradingData.marksObtained ?? ""}
                              onChange={(e) => setGradingData(prev => ({
                                ...prev,
                                marksObtained: e.target.value ? Number(e.target.value) : null
                              }))}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                              placeholder="Enter marks"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Feedback
                            </label>
                            <textarea
                              value={gradingData.feedback}
                              onChange={(e) => setGradingData(prev => ({
                                ...prev,
                                feedback: e.target.value
                              }))}
                              rows={3}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                              placeholder="Provide constructive feedback..."
                            />
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleGrade(submission._id)}
                            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
                          >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Save Grade
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="inline-flex items-center px-6 py-3 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-all duration-200 transform hover:scale-105 shadow-lg"
                          >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Existing Feedback */}
                    {submission.feedback && !editingId && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200/60">
                        <h5 className="font-semibold text-gray-900 mb-2 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          Feedback
                        </h5>
                        <p className="text-gray-700">{submission.feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}