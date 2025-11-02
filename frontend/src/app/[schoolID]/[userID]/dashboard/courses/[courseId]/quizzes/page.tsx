"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

interface Quiz {
  _id: string;
  title: string;
  description: string;
  totalMarks: number;
  durationMinutes: number;
  visibleUntil: string;
  isPublished: boolean;
  createdAt: string;
  maxAttempts: number;
  retakePolicy: {
    allowRetake: boolean;
    minScoreToPass: number;
    daysBetweenAttempts: number;
  };
  submissions?: any[];
}

interface Submission {
  _id: string;
  quiz: string;
  score: number;
  percentage: number;
  totalMarks: number;
  submittedAt: string;
  attemptNumber: number;
  answers: Array<{
    questionIndex: number;
    selectedOption: number;
    correctAnswer: number;
    isCorrect: boolean;
    marksAwarded: number;
    questionText: string;
    options: string[];
    questionMarks: number;
  }>;
}

interface QuizDetails {
  _id: string;
  title: string;
  questions: Array<{
    _id: string;
    question: string;
    options: string[];
    correctAnswer: number;
    marks?: number;
    explanation?: string;
  }>;
  totalMarks: number;
}

interface SubmissionStatus {
  [quizId: string]: boolean;
}

interface SubmissionWithGrade {
  [quizId: string]: Submission;
}

interface AttemptsInfo {
  [quizId: string]: {
    attemptsUsed: number;
    attemptsRemaining: number;
    canRetake: boolean;
    retakeMessage: string;
  };
}

export default function QuizListPage() {
  const { schoolID, userID, courseId } = useParams();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({});
  const [submissionGrades, setSubmissionGrades] = useState<SubmissionWithGrade>({});
  const [attemptsInfo, setAttemptsInfo] = useState<AttemptsInfo>({});
  
  // Modal states
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<QuizDetails | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [loadingQuizDetails, setLoadingQuizDetails] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (res.ok) {
          const data = await res.json();
          setRole(data.user?.role || "");
          localStorage.setItem("role", data.user?.role || "");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };

    fetchUserRole();
  }, []);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Please log in first");
          return;
        }

        setLoading(true);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${courseId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const data = await res.json();
        if (res.ok) {
          setQuizzes(data.data || []);
          
          // If teacher/admin, fetch submission counts for each quiz
          const userRole = localStorage.getItem("role");
          if (userRole === "teacher" || userRole === "admin") {
            const quizzesWithSubmissions = await Promise.all(
              data.data.map(async (quiz: Quiz) => {
                try {
                  const submissionsRes = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${quiz._id}/submissions`,
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const submissionsData = await submissionsRes.json();
                  if (submissionsRes.ok) {
                    return { ...quiz, submissions: submissionsData.data };
                  }
                } catch (error) {
                  console.error("Error fetching submissions:", error);
                }
                return quiz;
              })
            );
            setQuizzes(quizzesWithSubmissions);
          }
        } else {
          toast.error(data.message || "Failed to load quizzes");
        }
      } catch {
        toast.error("Error fetching quizzes");
      } finally {
        setLoading(false);
      }
    };
    
    if (courseId) {
      fetchQuizzes();
    }
  }, [courseId]);

  useEffect(() => {
    if (quizzes.length > 0 && role === "student") {
      const fetchStudentData = async () => {
        setLoadingSubmissions(true);
        setLoadingAttempts(true);
        await Promise.all([fetchSubmissionStatusAndGrades(), fetchAttemptsInfo()]);
        setLoadingSubmissions(false);
        setLoadingAttempts(false);
      };
      fetchStudentData();
    }
  }, [quizzes, role]);

  const fetchSubmissionStatusAndGrades = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const submissionPromises = quizzes.map(async (quiz) => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${quiz._id}/my-result`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          if (res.ok) {
            const data = await res.json();
            return { 
              quizId: quiz._id, 
              submitted: data.data !== null,
              submission: data.data
            };
          }
          return { quizId: quiz._id, submitted: false, submission: null };
        } catch (err) {
          console.error(`Error fetching submission for quiz ${quiz._id}:`, err);
          return { quizId: quiz._id, submitted: false, submission: null };
        }
      });
      
      const submissionResults = await Promise.all(submissionPromises);
      const statusMap: SubmissionStatus = {};
      const gradeMap: SubmissionWithGrade = {};
      
      submissionResults.forEach(result => {
        if (result) {
          statusMap[result.quizId] = result.submitted;
          if (result.submission) {
            gradeMap[result.quizId] = result.submission;
          }
        }
      });
      
      setSubmissionStatus(statusMap);
      setSubmissionGrades(gradeMap);
    } catch (err) {
      console.error("Error fetching submission status and grades:", err);
    }
  };

  const fetchAttemptsInfo = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const attemptsPromises = quizzes.map(async (quiz) => {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${quiz._id}/attempts-remaining`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          if (res.ok) {
            const data = await res.json();
            return { quizId: quiz._id, ...data.data };
          }
          return { 
            quizId: quiz._id, 
            attemptsUsed: 0, 
            attemptsRemaining: quiz.maxAttempts,
            canRetake: false,
            retakeMessage: "Unable to fetch attempts info"
          };
        } catch (err) {
          console.error(`Error fetching attempts for quiz ${quiz._id}:`, err);
          return { 
            quizId: quiz._id, 
            attemptsUsed: 0, 
            attemptsRemaining: quiz.maxAttempts,
            canRetake: false,
            retakeMessage: "Error fetching attempts"
          };
        }
      });
      
      const attemptsResults = await Promise.all(attemptsPromises);
      const attemptsMap: AttemptsInfo = {};
      
      attemptsResults.forEach(result => {
        if (result) {
          attemptsMap[result.quizId] = {
            attemptsUsed: result.attemptsUsed,
            attemptsRemaining: result.attemptsRemaining,
            canRetake: result.canRetake,
            retakeMessage: result.retakeMessage
          };
        }
      });
      
      setAttemptsInfo(attemptsMap);
    } catch (err) {
      console.error("Error fetching attempts info:", err);
    }
  };

  // Open result modal with accurate grading display - FIXED VERSION
  const openResultModal = async (quizId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      setLoadingQuizDetails(true);
      
      // Get the submission data first (we already have it from earlier fetch)
      const submission = submissionGrades[quizId];
      
      if (!submission) {
        toast.error("No submission found for this quiz");
        setLoadingQuizDetails(false);
        return;
      }

      // Fetch quiz details with questions
      const quizRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/quiz/${quizId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (quizRes.ok) {
        const quizData = await quizRes.json();
        
        // For student view, we need to manually add correct answers from submission
        const quizWithCorrectAnswers = {
          ...quizData.data,
          questions: quizData.data.questions.map((question: any, index: number) => ({
            ...question,
            // Use the correct answer from submission data since API hides it for students
            correctAnswer: submission.answers[index]?.correctAnswer
          }))
        };
        
        setSelectedQuiz(quizWithCorrectAnswers);
        setSelectedSubmission(submission);
        setIsResultModalOpen(true);
      } else {
        const errorData = await quizRes.json();
        toast.error(errorData.message || "Failed to load quiz details");
      }
    } catch (error) {
      console.error("Error opening result modal:", error);
      toast.error("Error loading quiz result");
    } finally {
      setLoadingQuizDetails(false);
    }
  };

  // Close result modal
  const closeResultModal = () => {
    setIsResultModalOpen(false);
    setSelectedQuiz(null);
    setSelectedSubmission(null);
  };

  // Calculate time remaining until quiz expires
  const getTimeRemaining = (visibleUntil: string) => {
    if (!visibleUntil) return "No deadline";
    
    const now = new Date();
    const until = new Date(visibleUntil);
    const diffMs = until.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Expired";
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) return `${diffDays}d ${diffHours}h left`;
    if (diffHours > 0) return `${diffHours}h left`;
    return "Less than 1h left";
  };

  // Check if quiz is active (not expired and published)
  const isQuizActive = (quiz: Quiz) => {
    const now = new Date();
    const until = quiz.visibleUntil ? new Date(quiz.visibleUntil) : null;
    
    if (!quiz.isPublished) return false;
    if (until && now > until) return false;
    
    return true;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get grade status for a quiz
  const getGradeStatus = (quizId: string) => {
    const submission = submissionGrades[quizId];
    if (!submission) return null;
    
    return {
      graded: true,
      score: submission.score,
      percentage: submission.percentage,
      totalMarks: submission.totalMarks,
      submittedAt: submission.submittedAt,
      attemptNumber: submission.attemptNumber
    };
  };

  // Get attempts info for a quiz
  const getAttemptsInfo = (quizId: string) => {
    return attemptsInfo[quizId] || {
      attemptsUsed: 0,
      attemptsRemaining: 1,
      canRetake: false,
      retakeMessage: ""
    };
  };

  // Get performance message based on percentage
  const getPerformanceMessage = (percentage: number) => {
    if (percentage >= 90) return "Excellent!";
    if (percentage >= 80) return "Very Good!";
    if (percentage >= 70) return "Good!";
    if (percentage >= 60) return "Satisfactory";
    if (percentage >= 50) return "Needs Improvement";
    return "Keep Practicing";
  };

  // Get performance color based on percentage
  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Quizzes</h1>
            <p className="text-gray-600 text-lg">Test your knowledge and track your progress</p>
          </div>
          
          {(role === "teacher" || role === "admin") && (
            <Link
              href={`/${schoolID}/${userID}/dashboard/courses/${courseId}/quizzes/create`}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center gap-2 font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Quiz
            </Link>
          )}
        </div>

        {quizzes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">No Quizzes Yet</h3>
              <p className="text-gray-600 mb-6">Get started by creating your first quiz for this course.</p>
              {(role === "teacher" || role === "admin") && (
                <Link
                  href={`/${schoolID}/${userID}/dashboard/courses/${courseId}/quizzes/create`}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Create Your First Quiz
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {quizzes.map((quiz) => {
              const isSubmitted = submissionStatus[quiz._id] || false;
              const gradeInfo = getGradeStatus(quiz._id);
              const attemptsInfo = getAttemptsInfo(quiz._id);
              const isActive = isQuizActive(quiz);
              const isExpired = quiz.visibleUntil && new Date(quiz.visibleUntil) < new Date();
              
              return (
                <div key={quiz._id} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                  <div className="p-6">
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-xl font-bold text-gray-900">{quiz.title}</h3>
                          <div className="flex gap-2">
                            {!quiz.isPublished && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                                Draft
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                                Expired
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {quiz.description && (
                          <p className="text-gray-600 mb-4 leading-relaxed">{quiz.description}</p>
                        )}
                        
                        {/* Quiz Metadata */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div key="total-marks" className="text-center p-3 bg-blue-50 rounded-lg">
                            <div className="text-lg font-bold text-blue-600">{quiz.totalMarks}</div>
                            <div className="text-xs text-blue-800">Total Marks</div>
                          </div>
                          
                          <div key="duration" className="text-center p-3 bg-green-50 rounded-lg">
                            <div className="text-lg font-bold text-green-600">
                              {quiz.durationMinutes || '∞'}
                            </div>
                            <div className="text-xs text-green-800">Minutes</div>
                          </div>
                          
                          <div key="attempts" className="text-center p-3 bg-purple-50 rounded-lg">
                            <div className="text-lg font-bold text-purple-600">{quiz.maxAttempts}</div>
                            <div className="text-xs text-purple-800">Max Attempts</div>
                          </div>
                          
                          <div key="deadline" className="text-center p-3 bg-orange-50 rounded-lg">
                            <div className={`text-sm font-bold ${isExpired ? 'text-red-600' : 'text-orange-600'}`}>
                              {getTimeRemaining(quiz.visibleUntil)}
                            </div>
                            <div className="text-xs text-orange-800">Deadline</div>
                          </div>
                        </div>

                        {/* Deadline Info */}
                        {quiz.visibleUntil && (
                          <div className="text-sm text-gray-500 mb-4">
                            <span className="font-medium">Closes:</span> {formatDate(quiz.visibleUntil)}
                          </div>
                        )}
                        
                        {/* Grade display for students */}
                        {role === "student" && (
                          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                            {loadingSubmissions ? (
                              <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                                <span className="text-green-600">Loading results...</span>
                              </div>
                            ) : gradeInfo ? (
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div>
                                  <div className="font-bold text-green-800">
                                    Score: {gradeInfo.score}/{gradeInfo.totalMarks} • {gradeInfo.percentage}% • Attempt {gradeInfo.attemptNumber}
                                  </div>
                                  <div className="text-sm text-green-600">
                                    Submitted on {new Date(gradeInfo.submittedAt).toLocaleDateString()}
                                    {attemptsInfo.attemptsRemaining > 0 && !isExpired && (
                                      <span className="ml-2 text-blue-600">
                                        • {attemptsInfo.attemptsRemaining} attempt(s) remaining
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-green-800 font-medium">
                                No submission yet • {quiz.maxAttempts} attempt(s) available
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* For teachers/admins - show submission stats */}
                    {(role === "teacher" || role === "admin") && quiz.submissions && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-semibold">{quiz.submissions.length}</span> submissions
                          <span className="mx-2">•</span>
                          <span>Created {formatDate(quiz.createdAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                      {role === "student" ? (
                        <>
                          <div className="flex-1">
                            {loadingAttempts ? (
                              <div className="flex items-center gap-2 text-gray-600">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                Loading attempts...
                              </div>
                            ) : isExpired ? (
                              <span className="text-red-600 font-medium">Quiz has expired</span>
                            ) : !isActive ? (
                              <span className="text-gray-600">Quiz not available</span>
                            ) : attemptsInfo.attemptsRemaining > 0 ? (
                              <span className="text-green-600 font-medium">
                                {attemptsInfo.attemptsRemaining} attempt(s) available
                              </span>
                            ) : (
                              <span className="text-gray-600">No attempts remaining</span>
                            )}
                          </div>
                          
                          <div className="flex gap-3">
                            {isSubmitted && (
                              <button
                                onClick={() => openResultModal(quiz._id)}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                              >
                                View Result
                              </button>
                            )}
                            
                            {isExpired ? (
                              <button
                                disabled
                                className="px-6 py-2 bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                              >
                                Expired
                              </button>
                            ) : !isActive ? (
                              <button
                                disabled
                                className="px-6 py-2 bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                              >
                                Not Available
                              </button>
                            ) : attemptsInfo.attemptsRemaining > 0 ? (
                              <Link
                                href={`/${schoolID}/${userID}/dashboard/courses/${courseId}/quizzes/${quiz._id}/attempt`}
                                className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                              >
                                {isSubmitted ? "Retake Quiz" : "Start Quiz"}
                              </Link>
                            ) : (
                              <button
                                disabled
                                className="px-6 py-2 bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                              >
                                No Attempts Left
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm text-gray-600">
                            Created on {formatDate(quiz.createdAt)}
                          </div>
                          <Link
                            href={`/${schoolID}/${userID}/dashboard/courses/${courseId}/quizzes/${quiz._id}/submissions`}
                            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {quiz.submissions && quiz.submissions.length > 0 ? (
                              `View Submissions (${quiz.submissions.length})`
                            ) : (
                              'View Submissions'
                            )}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Result Modal */}
        {isResultModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-700 p-6 text-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      {selectedQuiz?.title || "Quiz Result"}
                    </h2>
                    <p className="text-blue-100">
                      Your quiz result - Attempt {selectedSubmission?.attemptNumber || 1}
                    </p>
                  </div>
                  <button
                    onClick={closeResultModal}
                    className="text-white hover:text-blue-200 transition-colors p-2 rounded-full hover:bg-white hover:bg-opacity-20"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {loadingQuizDetails ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading your quiz results...</p>
                    </div>
                  </div>
                ) : selectedQuiz && selectedSubmission ? (
                  <div className="space-y-6">
                    {/* Score Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div key="score" className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-green-600">
                          {selectedSubmission.score}/{selectedSubmission.totalMarks}
                        </div>
                        <div className="text-green-800 font-medium">Score</div>
                      </div>
                      
                      <div key="percentage" className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className={`text-3xl font-bold ${getPerformanceColor(selectedSubmission.percentage)}`}>
                          {selectedSubmission.percentage}%
                        </div>
                        <div className="text-blue-800 font-medium">Percentage</div>
                      </div>
                      
                      <div key="performance" className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                        <div className="text-xl font-bold text-purple-600">
                          {getPerformanceMessage(selectedSubmission.percentage)}
                        </div>
                        <div className="text-purple-800 font-medium">Performance</div>
                      </div>
                    </div>

                    {/* Submission Details */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-3">Submission Details</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Submitted on:</span>
                          <span className="ml-2 font-medium">
                            {new Date(selectedSubmission.submittedAt).toLocaleDateString()} at{" "}
                            {new Date(selectedSubmission.submittedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Attempt Number:</span>
                          <span className="ml-2 font-medium">{selectedSubmission.attemptNumber}</span>
                        </div>
                      </div>
                    </div>

                    {/* Questions and Answers - FIXED DISPLAY */}
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-4">Question Review</h3>
                      <div className="space-y-4">
                        {selectedSubmission.answers.map((answer, index) => {
                          const isCorrect = answer.isCorrect;
                          const studentAnswer = answer.selectedOption;
                          const correctAnswer = answer.correctAnswer;
                          const question = selectedQuiz?.questions?.[index];
                          
                          return (
                            <div key={index} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start justify-between mb-3">
                                <h4 className="font-medium text-gray-900">
                                  {index + 1}. {answer.questionText || question?.question || `Question ${index + 1}`}
                                </h4>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                  isCorrect 
                                    ? 'bg-green-100 text-green-800 border border-green-200' 
                                    : 'bg-red-100 text-red-800 border border-red-200'
                                }`}>
                                  {isCorrect ? 'Correct' : 'Incorrect'} • {answer.marksAwarded}/{answer.questionMarks} pts
                                </span>
                              </div>
                              
                              <div className="space-y-2">
                                {answer.options.map((option, optionIndex) => {
                                  const isStudentAnswer = studentAnswer === optionIndex;
                                  const isCorrectAnswer = optionIndex === correctAnswer;
                                  
                                  return (
                                    <div
                                      key={optionIndex}
                                      className={`p-3 rounded border ${
                                        isCorrectAnswer
                                          ? 'bg-green-50 border-green-200'
                                          : isStudentAnswer && !isCorrectAnswer
                                          ? 'bg-red-50 border-red-200'
                                          : 'bg-gray-50 border-gray-200'
                                      }`}
                                    >
                                      <div className="flex items-center">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 font-semibold ${
                                          isCorrectAnswer
                                            ? 'bg-green-500 text-white'
                                            : isStudentAnswer && !isCorrectAnswer
                                            ? 'bg-red-500 text-white'
                                            : 'bg-gray-300 text-gray-600'
                                        }`}>
                                          {String.fromCharCode(65 + optionIndex)}
                                        </span>
                                        <span className={
                                          isCorrectAnswer ? 'font-medium text-green-800' : 
                                          isStudentAnswer && !isCorrectAnswer ? 'font-medium text-red-800' : 
                                          'text-gray-700'
                                        }>
                                          {option}
                                        </span>
                                        {isCorrectAnswer && (
                                          <span className="ml-auto text-green-600 font-medium text-sm flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Correct Answer
                                          </span>
                                        )}
                                        {isStudentAnswer && !isCorrectAnswer && (
                                          <span className="ml-auto text-red-600 font-medium text-sm flex items-center gap-1">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            Your Answer
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {/* Explanation if available */}
                              {question?.explanation && (
                                <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                                  <span className="font-medium text-blue-800">Explanation:</span>
                                  <p className="text-blue-700 mt-1">{question.explanation}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p>Unable to load quiz result details.</p>
                    <button
                      onClick={closeResultModal}
                      className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={closeResultModal}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                  >
                    Close
                  </button>
                  {selectedQuiz && attemptsInfo[selectedQuiz._id]?.attemptsRemaining > 0 && 
                   !(selectedQuiz.visibleUntil && new Date(selectedQuiz.visibleUntil) < new Date()) && (
                    <Link
                      href={`/${schoolID}/${userID}/dashboard/courses/${courseId}/quizzes/${selectedQuiz._id}/attempt`}
                      className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 font-medium"
                      onClick={closeResultModal}
                    >
                      Retake Quiz
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}