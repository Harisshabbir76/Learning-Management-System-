"use client";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const fetchQuizAndAttemptInfo = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Please log in first");
          router.push("/login");
          return;
        }

        setLoading(true);
        setApiError(null);

        // Fetch quiz details
        const quizRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/quiz/${quizId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (!quizRes.ok) {
          const errorData = await quizRes.json();
          toast.error(errorData.message || "Failed to load quiz");
          return;
        }

        const quizData = await quizRes.json();
        setQuiz(quizData.data);
        setAnswers(new Array(quizData.data.questions.length).fill(-1));

        // Fetch attempt information
        const attemptInfoData = await fetchAttemptInfo(token);
        if (attemptInfoData) {
          setAttemptInfo(attemptInfoData);
        } else {
          setAttemptInfo({
            attemptsUsed: quizData.data.maxAttempts,
            attemptsRemaining: 0,
            canRetake: false,
            retakeMessage: "Failed to load attempt information",
            maxAttempts: quizData.data.maxAttempts
          });
        }

      } catch (error) {
        console.error("Error fetching quiz:", error);
        toast.error("Error fetching quiz");
        setApiError("Failed to load quiz. Please try again.");
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
        toast.error("Please log in first");
        router.push("/login");
        return;
      }

      setIsSubmitting(true);
      setApiError(null);
      
      // Validate all questions are answered
      const unansweredQuestions = answers.filter(answer => answer === -1).length;
      if (unansweredQuestions > 0) {
        toast.error(`Please answer all questions before submitting. ${unansweredQuestions} question(s) unanswered.`);
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
        toast.success(`Quiz submitted successfully! You scored ${data.score}/${data.total}`);
        
        // Refresh attempt info to get latest state
        await refreshAttemptInfo();
        
        // Redirect after success
        setTimeout(() => {
          router.push(`/dashboard/courses/${courseId}/quizzes`);
        }, 2000);
      } else {
        const errorMessage = data.message || "Failed to submit quiz";
        setApiError(errorMessage);
        
        // Refresh attempt info to sync with backend
        await refreshAttemptInfo();
        
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      toast.error("Network error. Please check your connection and try again.");
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
            onClick={() => router.push(`/dashboard/courses/${courseId}/quizzes`)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  // Check if user can attempt the quiz
  const canAttempt = attemptInfo?.canRetake && attemptInfo.attemptsRemaining > 0;

  if (!canAttempt || apiError) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">{quiz.title}</h1>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <svg className="w-8 h-8 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-xl font-semibold text-red-800">Cannot Attempt Quiz</h2>
              </div>
              
              <p className="text-gray-700 mb-4">
                {apiError || attemptInfo?.retakeMessage || "You have used all available attempts for this quiz."}
              </p>
              
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <p><strong>Attempts used:</strong> {attemptInfo?.attemptsUsed} / {attemptInfo?.maxAttempts}</p>
                <p><strong>Attempts remaining:</strong> {attemptInfo?.attemptsRemaining}</p>
                <p><strong>Current attempt:</strong> {attemptInfo ? attemptInfo.attemptsUsed + 1 : 1}</p>
              </div>
              
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-yellow-800 text-sm font-medium mb-2">Possible reasons:</p>
                <ul className="text-yellow-700 text-sm list-disc list-inside space-y-1">
                  <li>Time restrictions between attempts</li>
                  <li>Quiz expiration</li>
                  <li>Already achieving passing score</li>
                  <li>Backend validation rules</li>
                </ul>
              </div>
              
              <div className="mt-6 flex gap-4 flex-wrap">
                <button
                  onClick={() => router.push(`/dashboard/courses/${courseId}/quizzes`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Back to Quizzes
                </button>
                <button
                  onClick={refreshAttemptInfo}
                  disabled={isRefreshingAttemptInfo}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 flex items-center transition-colors"
                >
                  {isRefreshingAttemptInfo ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Refreshing...
                    </>
                  ) : (
                    "Refresh Status"
                  )}
                </button>
              </div>
            </div>
          </div>
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
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 min-w-[250px]">
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-2">Attempt Information</p>
                <div className="space-y-1">
                  <p>Attempt: {attemptInfo.attemptsUsed + 1} of {attemptInfo.maxAttempts}</p>
                  <p>{attemptInfo.attemptsRemaining} attempt(s) remaining</p>
                  {attemptInfo.retakeMessage && (
                    <p className="text-xs mt-1 italic">{attemptInfo.retakeMessage}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Retake Notice */}
          {attemptInfo.attemptsUsed > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-yellow-800 font-medium">Retake Attempt</span>
              </div>
              <p className="text-yellow-700 text-sm mt-1">
                This is your attempt #{attemptInfo.attemptsUsed + 1}. Your previous scores will be preserved.
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-green-800 font-medium">Instructions</span>
            </div>
            <ul className="text-green-700 text-sm list-disc list-inside space-y-1">
              <li>Answer all questions before submitting</li>
              <li>You cannot change answers after submission</li>
              <li>Each question has equal marks unless specified</li>
              <li>Current attempt: #{attemptInfo.attemptsUsed + 1}</li>
              <li>Use the navigation to move between questions</li>
            </ul>
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
                      router.back();
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