"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";

interface Student {
  _id: string;
  name: string;
  userNumericId?: number;
  email?: string;
  userId?: string;
}

interface Answer {
  questionIndex: number;
  selectedOption: number;
  marksAwarded?: number;
  isCorrect?: boolean;
  questionText?: string;
  options?: string[];
  correctAnswer?: number;
  questionMarks?: number;
}

interface Submission {
  _id: string;
  student: Student;
  score: number;
  marks?: number;
  totalScore?: number;
  obtainedMarks?: number;
  percentage?: number;
  totalMarks?: number;
  submittedAt: string;
  answers: Answer[];
  attemptNumber: number;
  quiz?: {
    totalMarks: number;
    questions: any[];
  };
}

interface QuizDetails {
  _id: string;
  title?: string;
  totalMarks: number;
  questions: any[];
  course: string;
  visibleUntil?: string;
  isExpired?: boolean;
}

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
  students?: Student[];
}

interface QuizStats {
  totalEnrolledStudents: number;
  submittedCount: number;
  pendingCount: number;
  averageScore: number;
  passRate: number;
}

// Utility function for safe fetch with JSON validation
const fetchWithValidation = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, options);
  
  // Check content type
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const errorText = await response.text();
    console.error("Non-JSON response:", errorText);
    throw new Error(`Server returned non-JSON response (${response.status} ${response.statusText})`);
  }
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }
  
  return data;
};

export default function QuizSubmissionsPage() {
  const { courseId, quizId } = useParams();
  const [subs, setSubs] = useState<Submission[]>([]);
  const [quizDetails, setQuizDetails] = useState<QuizDetails | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QuizStats>({
    totalEnrolledStudents: 0,
    submittedCount: 0,
    pendingCount: 0,
    averageScore: 0,
    passRate: 0
  });
  const [quizExpired, setQuizExpired] = useState(false);

  // Debug: Log submission data to see what's in the score field
  useEffect(() => {
    if (subs.length > 0) {
      console.log('=== DEBUG: Submission Data ===');
      subs.forEach((sub, index) => {
        console.log(`Submission ${index}:`, {
          id: sub._id,
          studentName: sub.student.name,
          rawScore: sub.score,
          scoreType: typeof sub.score,
          answers: sub.answers?.map(a => ({ 
            marksAwarded: a.marksAwarded, 
            isCorrect: a.isCorrect 
          })),
          totalFromAnswers: sub.answers?.reduce((sum, a) => sum + (a.marksAwarded || 0), 0)
        });
      });
    }
  }, [subs]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          toast.error("Please log in first");
          return;
        }

        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        // Fetch quiz and submissions data in parallel
        const [quizData, submissionsData] = await Promise.allSettled([
          fetchWithValidation(
            `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/quiz/${quizId}`,
            { headers }
          ).catch(error => {
            // Handle quiz fetch errors gracefully
            console.warn('Quiz fetch error (may be expired):', error);
            return { success: false, data: null, error: error.message };
          }),
          fetchWithValidation(
            `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${quizId}/submissions`,
            { headers }
          ).catch(error => {
            // Handle submissions fetch errors gracefully
            console.warn('Submissions fetch error:', error);
            return { success: false, data: [], error: error.message };
          })
        ]);

        // Handle quiz data - don't throw error if quiz is expired
        if (quizData.status === "fulfilled" && quizData.value && quizData.value.success !== false) {
          const quiz = quizData.value.data;
          // Check if quiz is expired
          if (quiz.visibleUntil && new Date(quiz.visibleUntil) < new Date()) {
            setQuizExpired(true);
            quiz.isExpired = true;
          }
          setQuizDetails(quiz);
        } else {
          console.warn("Quiz data may be expired or unavailable:", quizData.reason || quizData.value?.error);
          // Don't show error toast for expired quizzes
          if (quizData.value?.error && !quizData.value.error.includes('expired')) {
            toast.error("Failed to load quiz details");
          }
        }

        // Handle submissions data
        if (submissionsData.status === "fulfilled" && submissionsData.value) {
          const submissions = submissionsData.value.data || [];
          console.log('Raw submissions from API:', submissions);
          setSubs(submissions);
        } else {
          console.warn("Submissions data may be unavailable:", submissionsData.reason);
          // Don't show error for submissions if quiz is expired
          if (!quizExpired) {
            toast.error("Failed to load submissions");
          }
        }

        // Fetch course details to get section information
        try {
          const courseRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}`,
            { headers }
          );
          
          if (courseRes.ok) {
            const courseContentType = courseRes.headers.get("content-type");
            if (courseContentType && courseContentType.includes("application/json")) {
              const courseData = await courseRes.json();
              const course = courseData.data || courseData;
              
              if (course.section && typeof course.section === 'object') {
                setSection(course.section);
              } else if (course.section && typeof course.section === 'string') {
                const sectionRes = await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL}/api/sections/${course.section}`,
                  { headers }
                );
                if (sectionRes.ok) {
                  const sectionData = await sectionRes.json();
                  setSection(sectionData.data || sectionData);
                }
              }
            }
          }
        } catch (courseError) {
          console.warn("Course details fetch failed:", courseError);
        }

      } catch (error) {
        console.error("Unexpected error:", error);
        // Don't show error toast for expired quizzes
        if (!quizExpired) {
          toast.error("An unexpected error occurred while fetching data");
        }
      } finally {
        setLoading(false);
      }
    };
    
    if (quizId && courseId) {
      fetchData();
    }
  }, [courseId, quizId, quizExpired]);

  // Safe function to get the actual score (handles any data issues)
  const getSafeScore = (submission: Submission): number => {
    // First, try to get score from the score field
    let scoreValue = submission.score;
    
    console.log('Processing score for submission:', submission._id, 'Raw score value:', scoreValue);
    
    // If score is already a valid number, return it
    if (typeof scoreValue === 'number' && !isNaN(scoreValue)) {
      console.log('Score is valid number:', scoreValue);
      return scoreValue;
    }
    
    // If score is a string, try to parse it
    if (typeof scoreValue === 'string') {
      console.log('Score is string, attempting to parse:', scoreValue);
      
      // If it looks like a date, calculate from answers instead
      if (scoreValue.includes('-')) {
        console.log('Score appears to be a date, calculating from answers...');
        return calculateScoreFromAnswers(submission);
      }
      
      // Try to parse as number
      const parsed = parseFloat(scoreValue);
      if (!isNaN(parsed)) {
        console.log('Parsed score from string:', parsed);
        return parsed;
      }
      
      // If parsing failed, calculate from answers
      console.log('String parsing failed, calculating from answers');
      return calculateScoreFromAnswers(submission);
    }
    
    // If score is not a number or string, calculate from answers
    console.log('Score is not number or string, calculating from answers');
    return calculateScoreFromAnswers(submission);
  };

  // Calculate score from answers as fallback
  const calculateScoreFromAnswers = (submission: Submission): number => {
    if (!submission.answers || submission.answers.length === 0) {
      console.log('No answers available, returning 0');
      return 0;
    }
    
    const calculatedScore = submission.answers.reduce((total, answer) => {
      return total + (answer.marksAwarded || 0);
    }, 0);
    
    console.log('Calculated score from answers:', calculatedScore);
    return calculatedScore;
  };

  // Calculate correct and incorrect answers for a submission
  const calculateResults = (submission: Submission) => {
    if (!submission.answers || submission.answers.length === 0) {
      return { correct: 0, incorrect: 0 };
    }
    
    let correct = 0;
    let incorrect = 0;
    
    // First try to use isCorrect flag from answers
    submission.answers.forEach(answer => {
      if (answer.isCorrect === true) {
        correct++;
      } else if (answer.isCorrect === false) {
        incorrect++;
      }
    });
    
    // If we couldn't determine from isCorrect flag, try using quiz details
    if (correct === 0 && incorrect === 0 && quizDetails) {
      submission.answers.forEach(answer => {
        const question = quizDetails.questions[answer.questionIndex];
        if (question && question.correctAnswer === answer.selectedOption) {
          correct++;
        } else {
          incorrect++;
        }
      });
    }
    
    // Final fallback - if still no results, assume all incorrect
    if (correct === 0 && incorrect === 0) {
      incorrect = submission.answers.length;
    }
    
    return { correct, incorrect };
  };

  // Calculate stats when data changes
  useEffect(() => {
    const totalEnrolledStudents = section?.students?.length || 0;
    
    // Filter to get only latest attempt per student
    const studentMap = new Map();
    subs.forEach(sub => {
      const studentId = sub.student._id;
      if (!studentMap.has(studentId) || sub.attemptNumber > studentMap.get(studentId).attemptNumber) {
        studentMap.set(studentId, sub);
      }
    });
    const latestSubmissions = Array.from(studentMap.values());
    
    const submittedCount = latestSubmissions.length;
    const pendingCount = Math.max(0, totalEnrolledStudents - submittedCount);
    
    let totalScore = 0;
    let passedCount = 0;
    
    latestSubmissions.forEach(submission => {
      const safeScore = getSafeScore(submission);
      totalScore += safeScore;
      
      const quizTotalMarks = quizDetails?.totalMarks || submission.totalMarks || submission.quiz?.totalMarks || 1;
      if (safeScore >= (quizTotalMarks * 0.6)) {
        passedCount++;
      }
    });
    
    const averageScore = latestSubmissions.length > 0 ? totalScore / latestSubmissions.length : 0;
    const passRate = latestSubmissions.length > 0 ? (passedCount / latestSubmissions.length) * 100 : 0;
    
    setStats({
      totalEnrolledStudents,
      submittedCount,
      pendingCount,
      averageScore,
      passRate
    });
  }, [section, subs, quizDetails]);

  // Get only latest submission per student
  const getLatestSubmissions = () => {
    const studentMap = new Map();
    subs.forEach(sub => {
      const studentId = sub.student._id;
      if (!studentMap.has(studentId) || sub.attemptNumber > studentMap.get(studentId).attemptNumber) {
        studentMap.set(studentId, sub);
      }
    });
    return Array.from(studentMap.values()).sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  };

  // Get proper student ID - Use userId field instead of userNumericId
  const getStudentId = (student: Student) => {
    return student.userId || student._id;
  };

  // Calculate percentage safely
  const getPercentage = (submission: Submission) => {
    const safeScore = getSafeScore(submission);
    const quizTotalMarks = quizDetails?.totalMarks || submission.totalMarks || submission.quiz?.totalMarks || 1;
    
    if (quizTotalMarks > 0) {
      const percentage = (safeScore / quizTotalMarks) * 100;
      return percentage.toFixed(1);
    }
    return "0.0";
  };

  // Fallback frontend CSV export - Updated to separate Obtained Marks and Total Marks
  const exportToCSVFrontend = () => {
    if (!quizDetails || !subs.length) return;
    
    const headers = ['Student Name', 'Student ID', 'Email', 'Obtained Marks', 'Total Marks', 'Percentage', 'Correct Answers', 'Incorrect Answers', 'Total Questions', 'Submitted At'];
    const csvData = getLatestSubmissions().map(sub => {
      const { correct, incorrect } = calculateResults(sub);
      const safeScore = getSafeScore(sub);
      const percentage = getPercentage(sub);
      const totalQuestions = quizDetails.questions.length;
      const quizTotalMarks = quizDetails.totalMarks;
      
      // Split into two separate columns
      return [
        sub.student.name,
        getStudentId(sub.student),
        sub.student.email || 'N/A',
        safeScore, // Obtained Marks
        quizTotalMarks, // Total Marks
        `${percentage}%`,
        correct,
        incorrect,
        totalQuestions,
        new Date(sub.submittedAt).toLocaleString()
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-submissions-${quizDetails.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'quiz'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('CSV exported successfully!');
  };

  // Enhanced export function that ensures consistent format
  const exportToCSV = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please log in first");
        return;
      }

      // Try backend export first
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${quizId}/export`,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
          } 
        }
      );

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        
        // Check if backend export returns the correct format by examining the content
        if (contentType && contentType.includes("text/csv")) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `quiz-submissions-${quizDetails?.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'quiz'}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
          toast.success('CSV exported successfully!');
          return;
        }
      }
      
      // If backend export fails or returns wrong format, use frontend export
      console.log('Using frontend export for consistent formatting');
      exportToCSVFrontend();
      
    } catch (error) {
      console.error('Export error, using frontend export:', error);
      exportToCSVFrontend();
    }
  };

  const displaySubs = getLatestSubmissions();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header Section */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Submissions</h1>
          <p className="text-gray-600 text-lg">Student performance overview</p>
        </div>

        {/* Expired Quiz Notice */}
        {quizExpired && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-yellow-800 font-medium">Note: This quiz has expired</span>
            </div>
            <p className="text-yellow-700 text-sm mt-1">
              You can still view existing submissions and export results, but no new submissions are being accepted.
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:shadow-md transition-shadow">
            <div className="text-2xl font-bold text-blue-600 mb-2">{stats.totalEnrolledStudents}</div>
            <div className="text-sm text-gray-600">Total Enrolled</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:shadow-md transition-shadow">
            <div className="text-2xl font-bold text-green-600 mb-2">{stats.submittedCount}</div>
            <div className="text-sm text-gray-600">Submitted</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:shadow-md transition-shadow">
            <div className="text-2xl font-bold text-amber-600 mb-2">{stats.pendingCount}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center hover:shadow-md transition-shadow">
            <div className="text-2xl font-bold text-purple-600 mb-2">
              {stats.averageScore > 0 ? stats.averageScore.toFixed(1) : '0'}
            </div>
            <div className="text-sm text-gray-600">Average Obtained Marks</div>
            <div className="text-xs text-gray-500">out of {quizDetails?.totalMarks || 'N/A'}</div>
          </div>
        </div>

        {/* Quiz Info */}
        {quizDetails && (
          <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">{quizDetails.totalMarks}</div>
                <div className="text-sm text-gray-600">Total Marks</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">{quizDetails.questions.length}</div>
                <div className="text-sm text-gray-600">Questions</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {stats.totalEnrolledStudents > 0 
                    ? `${((stats.submittedCount / stats.totalEnrolledStudents) * 100).toFixed(1)}%` 
                    : '0%'
                  }
                </div>
                <div className="text-sm text-gray-600">Submission Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">
                  {stats.averageScore > 0 ? stats.averageScore.toFixed(1) : '0'}
                </div>
                <div className="text-sm text-gray-600">Avg Obtained Marks</div>
              </div>
            </div>
            {/* Expired quiz info */}
            {quizExpired && quizDetails.visibleUntil && (
              <div className="mt-4 p-3 bg-gray-100 rounded-md">
                <p className="text-sm text-gray-600">
                  <strong>Quiz ended:</strong> {new Date(quizDetails.visibleUntil).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Submissions Table */}
        {displaySubs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {quizExpired ? "No Submissions Received" : "No Submissions Yet"}
              </h3>
              <p className="text-gray-600">
                {quizExpired 
                  ? "This quiz expired without any submissions from enrolled students."
                  : stats.totalEnrolledStudents > 0 
                    ? `${stats.totalEnrolledStudents} enrolled students haven't submitted this quiz yet.`
                    : 'No students are enrolled in this course yet.'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Student Submissions</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Showing latest attempt for {displaySubs.length} students
                    {quizExpired && " (Quiz Expired)"}
                  </p>
                </div>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Obtained Marks</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Marks</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Performance</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Results</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displaySubs.map((submission) => {
                    const safeScore = getSafeScore(submission);
                    const percentage = getPercentage(submission);
                    const { correct, incorrect } = calculateResults(submission);
                    const totalQuestions = quizDetails ? quizDetails.questions.length : submission.answers?.length || 0;
                    const quizTotalMarks = quizDetails?.totalMarks || submission.totalMarks || submission.quiz?.totalMarks || 1;

                    const performanceColor = Number(percentage) >= 80 ? 'text-green-700 bg-green-100' :
                      Number(percentage) >= 60 ? 'text-yellow-700 bg-yellow-100' :
                      Number(percentage) >= 40 ? 'text-orange-700 bg-orange-100' : 'text-red-700 bg-red-100';

                    return (
                      <tr key={submission._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                {submission.student.name.charAt(0).toUpperCase()}
                              </div>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{submission.student.name}</div>
                              <div className="text-sm text-gray-500">
                                ID: {getStudentId(submission.student)}
                                {submission.student.email && ` • ${submission.student.email}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Separate columns for Obtained Marks and Total Marks */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">
                            {safeScore}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">
                            {quizTotalMarks}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${performanceColor}`}>
                            {Number(percentage) >= 60 ? 'Pass' : 'Fail'}
                          </span>
                          <div className="text-sm text-gray-500 mt-1">{percentage}%</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className="text-green-600 font-bold">{correct}</div>
                              <div className="text-xs text-gray-500">Correct</div>
                            </div>
                            <div className="text-center">
                              <div className="text-red-600 font-bold">{incorrect}</div>
                              <div className="text-xs text-gray-500">Incorrect</div>
                            </div>
                            <div className="text-center">
                              <div className="text-gray-600 font-bold">{totalQuestions}</div>
                              <div className="text-xs text-gray-500">Total</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {new Date(submission.submittedAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(submission.submittedAt).toLocaleTimeString()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}