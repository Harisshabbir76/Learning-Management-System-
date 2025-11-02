"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import AssignmentEdit from "../../../../../../../component/AssignmentEdit"; // Import the edit component

interface Assignment {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  maxMarks: number;
  fileUrl: string;
  createdBy: { name: string; email: string } | string;
  course: { name: string };
}

interface Submission {
  _id: string;
  assignment: string;
  marksObtained: number | null;
  feedback: string;
  submittedAt: string;
  gradedAt: string | null;
}

interface SubmissionStatus {
  [assignmentId: string]: boolean;
}

interface SubmissionWithGrade {
  [assignmentId: string]: Submission;
}

export default function AssignmentsListPage() {
  const { schoolID, userID, courseId } = useParams() as {
    schoolID: string;
    userID: string;
    courseId: string;
  };
  
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({});
  const [submissionGrades, setSubmissionGrades] = useState<SubmissionWithGrade>({});
  
  // State for edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Download handler function
  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please log in first");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const fullUrl = `${apiUrl}${fileUrl}`;
      
      console.log("Attempting to download from:", fullUrl);
      
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
      
      // Check if blob is empty
      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Extract filename from URL or use a default
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

  // Function to open the edit modal
  const handleEditClick = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setIsEditModalOpen(true);
  };

  // Function to close the edit modal
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingAssignment(null);
  };

  // Function to handle successful update
  const handleAssignmentUpdate = (updatedAssignment: Assignment) => {
    setAssignments(prev => 
      prev.map(a => a._id === updatedAssignment._id ? updatedAssignment : a)
    );
    toast.success("Assignment updated successfully!");
  };

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Please log in first");
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

        const res = await fetch(
          `${apiUrl}/api/assignments/course/${courseId}`,
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            } 
          }
        );

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
        }

        const data = await res.json();
        
        if (data.success) {
          setAssignments(data.data);
        } else {
          toast.error(data.message || "Failed to load assignments");
        }

      } catch (err: any) {
        console.error("Error fetching assignments:", err);
        toast.error(err.message || "Error fetching assignments");
      }
    };

    const fetchUserInfo = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        
        const res = await fetch(`${apiUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setRole(data.user?.role || "");
          setUserId(data.user?.id || "");
        }
      } catch (err) {
        console.error("Error fetching user info:", err);
      }
    };

    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchAssignments(), fetchUserInfo()]);
      } catch (err) {
        console.error("Error in fetchData:", err);
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      fetchData();
    }
  }, [courseId]);

  // Fetch submission status and grades after assignments are loaded and user role is known
  useEffect(() => {
    if (assignments.length > 0 && role === "student") {
      fetchSubmissionStatusAndGrades();
    }
  }, [assignments, role]);

  const fetchSubmissionStatusAndGrades = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      // Fetch detailed submission info for all assignments
      const submissionPromises = assignments.map(async (assignment) => {
        try {
          const res = await fetch(
            `${apiUrl}/api/submissions/assignment/${assignment._id}/student`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          
          if (res.ok) {
            const data = await res.json();
            return { 
              assignmentId: assignment._id, 
              submitted: data.submitted,
              submission: data.submission
            };
          }
          return { assignmentId: assignment._id, submitted: false, submission: null };
        } catch (err) {
          console.error(`Error fetching submission for assignment ${assignment._id}:`, err);
          return { assignmentId: assignment._id, submitted: false, submission: null };
        }
      });
      
      const submissionResults = await Promise.all(submissionPromises);
      const statusMap: SubmissionStatus = {};
      const gradeMap: SubmissionWithGrade = {};
      
      submissionResults.forEach(result => {
        if (result) {
          statusMap[result.assignmentId] = result.submitted;
          if (result.submission) {
            gradeMap[result.assignmentId] = result.submission;
          }
        }
      });
      
      setSubmissionStatus(statusMap);
      setSubmissionGrades(gradeMap);
    } catch (err) {
      console.error("Error fetching submission status and grades:", err);
    }
  };

  // Helper function to get creator name
  const getCreatorName = (createdBy: any): string => {
    if (!createdBy) return "Unknown";
    
    if (typeof createdBy === 'string') {
      return createdBy || "Unknown";
    }
    
    if (typeof createdBy === 'object' && createdBy.name) {
      return createdBy.name;
    }
    
    return "Unknown";
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    const now = new Date();
    const timeDiff = date.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    let statusColor = "text-gray-600";
    if (daysDiff < 0) {
      statusColor = "text-red-600";
    } else if (daysDiff <= 2) {
      statusColor = "text-orange-600";
    } else if (daysDiff <= 7) {
      statusColor = "text-yellow-600";
    }
    
    return {
      formatted: `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      status: daysDiff < 0 ? "Overdue" : `Due in ${daysDiff} day${daysDiff !== 1 ? 's' : ''}`,
      statusColor
    };
  };

  const getGradeStatus = (assignmentId: string) => {
    const submission = submissionGrades[assignmentId];
    if (!submission) return null;
    
    if (submission.marksObtained !== null && submission.marksObtained !== undefined) {
      return {
        graded: true,
        marks: submission.marksObtained,
        feedback: submission.feedback,
        gradedAt: submission.gradedAt
      };
    }
    
    return {
      graded: false,
      marks: null,
      feedback: null,
      gradedAt: null
    };
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-gray-600">Loading assignments...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Course Assignments</h1>
          <p className="text-gray-600 mt-1">
            {assignments.length} assignment{assignments.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {(role === "teacher" || role === "admin") && (
          <Link
            href={`/${schoolID}/${userID}/dashboard/courses/${courseId}/assignments/create`}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Assignment
          </Link>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 text-lg mb-2">No assignments yet</p>
          <p className="text-gray-500">
            {(role === "teacher" || role === "admin") 
              ? "Create your first assignment to get started" 
              : "No assignments have been posted yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const dueDateInfo = formatDueDate(assignment.dueDate);
            const isSubmitted = submissionStatus[assignment._id] || false;
            const creatorName = getCreatorName(assignment.createdBy);
            const gradeInfo = getGradeStatus(assignment._id);
            
            return (
              <div
                key={assignment._id}
                className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {assignment.title}
                      </h3>
                      <span className={`text-sm font-medium ${dueDateInfo.statusColor} ml-4`}>
                        {dueDateInfo.status}
                      </span>
                    </div>
                    
                    {assignment.description && (
                      <p className="text-gray-600 mb-3">
                        {assignment.description}
                      </p>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="font-medium">Due Date:</span>
                        <br />
                        {dueDateInfo.formatted}
                      </div>
                      
                      <div>
                        <span className="font-medium">Max Marks:</span>
                        <br />
                        {assignment.maxMarks}
                      </div>
                      
                      <div>
                        <span className="font-medium">Created by:</span>
                        <br />
                        {creatorName}
                      </div>
                    </div>
                    
                    {/* Grade display for students */}
                    {role === "student" && gradeInfo && gradeInfo.graded && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold text-green-800">Graded: {gradeInfo.marks}/{assignment.maxMarks}</span>
                        </div>
                        {gradeInfo.feedback && (
                          <div className="mt-2">
                            <span className="font-medium text-gray-700">Feedback:</span>
                            <p className="text-gray-600 mt-1">{gradeInfo.feedback}</p>
                          </div>
                        )}
                        {gradeInfo.gradedAt && (
                          <div className="mt-1 text-xs text-gray-500">
                            Graded on: {new Date(gradeInfo.gradedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Grade pending notification for students */}
                    {role === "student" && isSubmitted && gradeInfo && !gradeInfo.graded && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium text-blue-800">Submitted - Awaiting Grade</span>
                        </div>
                        <p className="text-sm text-blue-600 mt-1">
                          Your submission has been received and is waiting to be graded by your teacher.
                        </p>
                      </div>
                    )}
                    
                    {assignment.fileUrl && (
                      <div className="mb-4">
                        <button
                          onClick={() => handleDownload(assignment.fileUrl, assignment.title)}
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors cursor-pointer bg-blue-50 px-3 py-2 rounded-md"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download Assignment File
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-6 flex flex-col gap-2 min-w-[150px]">
                    {role === "student" && (
                      <>
                        {isSubmitted ? (
                          <button
                            disabled
                            className="px-4 py-2 bg-gray-400 text-white rounded-md text-center text-sm flex items-center justify-center cursor-not-allowed"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Submitted
                          </button>
                        ) : (
                          <Link
                            href={`/${schoolID}/${userID}/dashboard/courses/${courseId}/assignments/${assignment._id}/submit`}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-center text-sm flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                            </svg>
                            Submit
                          </Link>
                        )}
                      </>
                    )}

                    {(role === "teacher" || role === "admin") && (
                      <Link
                        href={`/${schoolID}/${userID}/dashboard/courses/${courseId}/assignments/${assignment._id}/submissions`}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-center text-sm flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View Submissions
                      </Link>
                    )}
                    
                    {(role === "teacher" || role === "admin") && (
                      <button
                        onClick={() => handleEditClick(assignment)}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-center text-sm flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Assignment Modal */}
      {isEditModalOpen && (
        <AssignmentEdit
          assignment={editingAssignment}
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleAssignmentUpdate}
          schoolID={schoolID}
          userID={userID}
          courseId={courseId}
        />
      )}
    </div>
  );
}