"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Question {
  _id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

interface Quiz {
  _id: string;
  title: string;
  questions: Question[];
  totalMarks: number;
  maxAttempts: number;
  retakePolicy: {
    allowRetake: boolean;
    minScoreToPass: number;
    daysBetweenAttempts: number;
  };
}

interface AttemptInfo {
  attemptsUsed: number;
  attemptsRemaining: number;
  canRetake: boolean;
  retakeMessage: string;
  maxAttempts: number;
}

export default function AttemptQuizPage() {
  const { courseId, quizId } = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [attemptInfo, setAttemptInfo] = useState<AttemptInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isRefreshingAttemptInfo, setIsRefreshingAttemptInfo] = useState(false);
  
  // Add refs to track toast IDs and prevent duplicates
  const toastIdRef = useRef<string | null>(null);
  const hasRedirectedRef = useRef(false);

  // Navigation functions
  const nextQuestion = () => {
    if (currentQuestion < (quiz?.questions.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  // Progress bar component
  const ProgressBar = () => (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>Question {currentQuestion + 1} of {quiz?.questions.length || 0}</span>
        <span>{Math.round(((currentQuestion + 1) / (quiz?.questions.length || 1)) * 100)}% Complete</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentQuestion + 1) / (quiz?.questions.length || 1)) * 100}%` }}
        ></div>
      </div>
    </div>
  );

  const fetchAttemptInfo = async (token: string) => {
    try {
      const attemptsRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${quizId}/attempts-remaining`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const attemptsData = await attemptsRes.json();
      
      if (attemptsRes.ok) {
        return {
          ...attemptsData.data,
          maxAttempts: quiz?.maxAttempts || attemptsData.data.maxAttempts
        };
      } else {
        return {
          attemptsUsed: quiz?.maxAttempts || 1,
          attemptsRemaining: 0,
          canRetake: false,
          retakeMessage: attemptsData.message || "You have already submitted this attempt",
          maxAttempts: quiz?.maxAttempts || 1
        };
      }
    } catch (error) {
      console.error("Error fetching attempt info:", error);
      return null;
    }
  };

  const redirectToQuizzes = () => {
    // Prevent multiple redirects
    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;

    // Get schoolId and userId from localStorage or current URL
    const userData = localStorage.getItem("user");
    let schoolId = "";
    let userId = "";

    if (userData) {
      try {
        const user = JSON.parse(userData);
        schoolId = user.schoolId || user.school || "";
        userId = user.userId || user._id || "";
        
        console.log("User data:", { schoolId, userId, user });
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }

    // Always try to use the full path with schoolId and userId
    if (schoolId && userId) {
      const redirectPath = `/${schoolId}/${userId}/dashboard/courses/${courseId}/quizzes`;
      console.log("Redirecting to:", redirectPath);
      router.push(redirectPath);
    } else {
      // If we don't have schoolId/userId, try to get them from the current URL
      const currentPath = window.location.pathname;
      const pathParts = currentPath.split('/').filter(Boolean);
      
      if (pathParts.length >= 2) {
        // Assume the URL structure is /schoolId/userId/...
        const urlSchoolId = pathParts[0];
        const urlUserId = pathParts[1];
        const redirectPath = `/${urlSchoolId}/${urlUserId}/dashboard/courses/${courseId}/quizzes`;
        console.log("Redirecting using URL parts:", redirectPath);
        router.push(redirectPath);
      } else {
        // Fallback to basic path as last resort
        console.log("Fallback to basic path");
        router.push(`/dashboard/courses/${courseId}/quizzes`);
      }
    }
  };

  // Clean up toast when component unmounts
  useEffect(() => {
    return () => {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchQuizAndAttemptInfo = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          // Use toast.promise to ensure single toast
          toastIdRef.current = toast.error("Please log in first");
          router.push("/login");
          return;
        }

        setLoading(true);
        setApiError(null);
        hasRedirectedRef.current = false; // Reset redirect flag

        // Fetch quiz details
        const quizRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/quiz/${quizId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (!quizRes.ok) {
          const errorData = await quizRes.json();
          // Dismiss any existing toast and show new one
          if (toastIdRef.current) toast.dismiss(toastIdRef.current);
          toastIdRef.current = toast.error(errorData.message || "Failed to load quiz");
          redirectToQuizzes();
          return;
        }

        const quizData = await quizRes.json();
        setQuiz(quizData.data);
        setAnswers(new Array(quizData.data.questions.length).fill(-1));

        // Fetch attempt information
        const attemptInfoData = await fetchAttemptInfo(token);
        if (attemptInfoData) {
          setAttemptInfo(attemptInfoData);
          
          // Check if user can attempt the quiz - if not, redirect immediately
          const canAttempt = attemptInfoData.canRetake && attemptInfoData.attemptsRemaining > 0;
          if (!canAttempt) {
            // Only show toast if we haven't already
            if (!toastIdRef.current) {
              toastIdRef.current = toast.error(
                attemptInfoData.retakeMessage || "Cannot attempt this quiz"
              );
            }
            setTimeout(() => {
              redirectToQuizzes();
            }, 1500);
            return;
          }
        } else {
          // If we can't get attempt info, redirect to quizzes
          if (!toastIdRef.current) {
            toastIdRef.current = toast.error("Failed to load attempt information");
          }
          setTimeout(() => {
            redirectToQuizzes();
          }, 1500);
        }

      } catch (error) {
        console.error("Error fetching quiz:", error);
        if (!toastIdRef.current) {
          toastIdRef.current = toast.error("Error fetching quiz");
        }
        setApiError("Failed to load quiz. Please try again.");
        setTimeout(() => {
          redirectToQuizzes();
        }, 1500);
      } finally {
        setLoading(false);
      }
    };
    
    if (quizId) {
      fetchQuizAndAttemptInfo();
    }
  }, [courseId, quizId, router]);

  const refreshAttemptInfo = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      setIsRefreshingAttemptInfo(true);
      const updatedAttemptInfo = await fetchAttemptInfo(token);
      if (updatedAttemptInfo) {
        setAttemptInfo(updatedAttemptInfo);
        setApiError(null);
        
        // Check if user can still attempt after refresh
        const canAttempt = updatedAttemptInfo.canRetake && updatedAttemptInfo.attemptsRemaining > 0;
        if (!canAttempt) {
          if (!toastIdRef.current) {
            toastIdRef.current = toast.error(
              updatedAttemptInfo.retakeMessage || "Cannot attempt this quiz"
            );
          }
          setTimeout(() => {
            redirectToQuizzes();
          }, 1500);
        }
      }
    } catch (error) {
      console.error("Error refreshing attempt info:", error);
    } finally {
      setIsRefreshingAttemptInfo(false);
    }
  };

  const submitQuiz = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toastIdRef.current = toast.error("Please log in first");
        router.push("/login");
        return;
      }

      setIsSubmitting(true);
      setApiError(null);
      
      // Validate all questions are answered
      const unansweredQuestions = answers.filter(answer => answer === -1).length;
      if (unansweredQuestions > 0) {
        // Dismiss previous toast and show new one
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        toastIdRef.current = toast.error(
          `Please answer all questions before submitting. ${unansweredQuestions} question(s) unanswered.`
        );
        setIsSubmitting(false);
        return;
      }

      // Calculate current attempt number
      const currentAttemptNumber = attemptInfo ? attemptInfo.attemptsUsed + 1 : 1;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${quizId}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            answers,
            attemptNumber: currentAttemptNumber
          }),
        }
      );
      
      const data = await res.json();
      
      if (res.ok) {
        // Clear previous toast and show success
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        toastIdRef.current = toast.success(`Quiz submitted successfully! You scored ${data.score}/${data.total}`);
        
        // Refresh attempt info to get latest state
        await refreshAttemptInfo();
        
        // Redirect after success
        setTimeout(() => {
          redirectToQuizzes();
        }, 2000);
      } else {
        const errorMessage = data.message || "Failed to submit quiz";
        setApiError(errorMessage);
        
        // Refresh attempt info to sync with backend
        await refreshAttemptInfo();
        
        // Show error toast only once
        if (!toastIdRef.current) {
          toastIdRef.current = toast.error(errorMessage);
        }
        
        // If submission failed due to attempt restrictions, redirect
        if (errorMessage.includes("attempt") || errorMessage.includes("passed") || errorMessage.includes("maximum")) {
          setTimeout(() => {
            redirectToQuizzes();
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      if (!toastIdRef.current) {
        toastIdRef.current = toast.error("Network error. Please check your connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 text-lg mb-4">Failed to load quiz</p>
          <button
            onClick={redirectToQuizzes}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  // Check if user can attempt the quiz - if not, show loading while redirecting
  const canAttempt = attemptInfo?.canRetake && attemptInfo.attemptsRemaining > 0;

  if (!canAttempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to quizzes...</p>
          <p className="text-sm text-gray-500 mt-2">You cannot attempt this quiz</p>
          <button
            onClick={redirectToQuizzes}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Go to Quizzes Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800">{quiz.title}</h1>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                <span>Total Marks: {quiz.totalMarks}</span>
                <span>Questions: {quiz.questions.length}</span>
                {quiz.maxAttempts > 1 && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                    {quiz.maxAttempts} Attempts
                  </span>
                )}
              </div>
            </div>
            
            {/* Attempt Info */}
            {attemptInfo && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 min-w-[200px]">
                <div className="text-sm text-blue-800">
                  <div className="font-semibold">Attempt {attemptInfo.attemptsUsed + 1} of {attemptInfo.maxAttempts}</div>
                  <div className="text-xs mt-1">
                    {attemptInfo.attemptsRemaining} attempt(s) remaining
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <ProgressBar />

          {/* Questions */}
          <div className="space-y-6">
            <div key={currentQuestion} className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm">
              <p className="font-semibold text-lg text-gray-800 mb-4">
                {currentQuestion + 1}. {quiz.questions[currentQuestion].question}
              </p>
              <div className="space-y-3">
                {quiz.questions[currentQuestion].options.map((option, optionIndex) => (
                  <label key={optionIndex} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded cursor-pointer transition-colors border border-gray-200">
                    <input
                      type="radio"
                      name={`question-${currentQuestion}`}
                      checked={answers[currentQuestion] === optionIndex}
                      onChange={() => {
                        const newAnswers = [...answers];
                        newAnswers[currentQuestion] = optionIndex;
                        setAnswers(newAnswers);
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700 flex-1">{option}</span>
                  </label>
                ))}
              </div>
              
              {/* Navigation buttons */}
              <div className="flex justify-between mt-6">
                <button
                  onClick={prevQuestion}
                  disabled={currentQuestion === 0}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={nextQuestion}
                  disabled={currentQuestion === quiz.questions.length - 1}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Question navigation dots */}
          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            {quiz.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestion(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentQuestion ? 'bg-blue-600' : 
                  answers[index] !== -1 ? 'bg-green-500' : 'bg-gray-300'
                }`}
                title={`Question ${index + 1}${answers[index] !== -1 ? ' (Answered)' : ''}`}
              />
            ))}
          </div>

          {/* Progress and Submission */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  Answered: <span className="font-semibold">{answers.filter(a => a !== -1).length}</span> / {quiz.questions.length} questions
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Current Attempt: <span className="font-semibold">#{attemptInfo.attemptsUsed + 1}</span>
                </p>
                {answers.includes(-1) && (
                  <p className="text-orange-600 text-sm mt-1 font-medium">
                    Please answer all questions before submitting.
                  </p>
                )}
              </div>
              
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel? Your progress will be lost.')) {
                      redirectToQuizzes();
                    }
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                
                <button
                  onClick={submitQuiz}
                  disabled={answers.includes(-1) || isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center transition-colors min-w-[140px] justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    `Submit Attempt #${attemptInfo.attemptsUsed + 1}`
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Retake Policy Info */}
          {quiz.retakePolicy.allowRetake && (
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
              <p className="text-purple-800 text-sm">
                <strong>Retake Policy:</strong> {
                  quiz.retakePolicy.minScoreToPass > 0 
                    ? `Retakes allowed if score < ${quiz.retakePolicy.minScoreToPass}%`
                    : 'Retakes allowed'
                }
                {quiz.retakePolicy.daysBetweenAttempts > 0 && 
                  ` • Wait ${quiz.retakePolicy.daysBetweenAttempts} day(s) between attempts`
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}