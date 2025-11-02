"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  marks?: number;
}

interface RetakePolicy {
  allowRetake: boolean;
  minScoreToPass: number;
  daysBetweenAttempts: number;
}

export default function CreateQuizPage() {
  const { courseId } = useParams();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalMarks, setTotalMarks] = useState(100);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [visibleUntil, setVisibleUntil] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [retakePolicy, setRetakePolicy] = useState<RetakePolicy>({
    allowRetake: false,
    minScoreToPass: 60,
    daysBetweenAttempts: 1
  });
  const [questions, setQuestions] = useState<Question[]>([
    { question: "", options: ["", "", "", ""], correctAnswer: 0, marks: 10 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-set retake policy based on max attempts
  const handleMaxAttemptsChange = (value: number) => {
    setMaxAttempts(value);
    // If max attempts > 1, automatically allow retakes
    if (value > 1) {
      setRetakePolicy(prev => ({
        ...prev,
        allowRetake: true
      }));
    } else {
      setRetakePolicy(prev => ({
        ...prev,
        allowRetake: false
      }));
    }
  };

  // Get current Pakistan time in ISO format for datetime-local input
  const getCurrentPakistanTime = () => {
    const now = new Date();
    // Pakistan is UTC+5
    const offset = 5 * 60; // 5 hours in minutes
    const localTime = new Date(now.getTime() + offset * 60 * 1000);
    return localTime.toISOString().slice(0, 16);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { question: "", options: ["", "", "", ""], correctAnswer: 0, marks: 10 },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) {
      toast.error("Quiz must have at least one question");
      return;
    }
    const newQuestions = [...questions];
    newQuestions.splice(index, 1);
    setQuestions(newQuestions);
  };

  const addOption = (qIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[qIndex].options.push("");
    setQuestions(newQuestions);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const newQuestions = [...questions];
    if (newQuestions[qIndex].options.length <= 2) {
      toast.error("Each question must have at least 2 options");
      return;
    }
    newQuestions[qIndex].options.splice(oIndex, 1);
    
    // Adjust correct answer if needed
    if (newQuestions[qIndex].correctAnswer >= oIndex) {
      newQuestions[qIndex].correctAnswer = Math.max(0, newQuestions[qIndex].correctAnswer - 1);
    }
    
    setQuestions(newQuestions);
  };

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      toast.error("Quiz title is required");
      return;
    }
    
    if (questions.length === 0) {
      toast.error("Quiz must have at least one question");
      return;
    }
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        toast.error(`Question ${i + 1} is required`);
        return;
      }
      
      if (q.options.filter(opt => opt.trim()).length < 2) {
        toast.error(`Question ${i + 1} must have at least 2 options`);
        return;
      }
      
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j].trim()) {
          toast.error(`Option ${j + 1} in Question ${i + 1} is required`);
          return;
        }
      }
      
      if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
        toast.error(`Please select a valid correct answer for Question ${i + 1}`);
        return;
      }
    }
    
    // Validate end date is in the future if provided
    if (visibleUntil) {
      const endDate = new Date(visibleUntil);
      const now = new Date();
      if (endDate <= now) {
        toast.error("End date must be in the future");
        return;
      }
    }

    // Validate max attempts
    if (maxAttempts < 1) {
      toast.error("Maximum attempts must be at least 1");
      return;
    }

    // Validate retake settings only if retakes are allowed
    if (retakePolicy.allowRetake) {
      if (retakePolicy.minScoreToPass < 0 || retakePolicy.minScoreToPass > 100) {
        toast.error("Minimum pass score must be between 0-100%");
        return;
      }

      if (retakePolicy.daysBetweenAttempts < 0) {
        toast.error("Days between attempts cannot be negative");
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/quizzes/${courseId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            title, 
            description,
            questions,
            totalMarks,
            durationMinutes,
            visibleUntil: visibleUntil || null,
            isPublished: true, // Always publish immediately
            maxAttempts,
            retakePolicy: maxAttempts > 1 ? retakePolicy : {
              allowRetake: false,
              minScoreToPass: 60,
              daysBetweenAttempts: 1
            }
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success("Quiz created successfully!");
        router.push(`/dashboard/courses/${courseId}/quizzes`);
      } else {
        toast.error(data.message || "Failed to create quiz");
      }
    } catch (error) {
      console.error("Error creating quiz:", error);
      toast.error("Error creating quiz");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Quiz</h1>
            <p className="text-gray-600">Design your quiz with questions, options, and settings</p>
          </div>
          
          {/* Basic Quiz Info */}
          <div className="mb-8">
            

            <h2 className="text-xl font-semibold text-gray-800 mb-6 pb-2 border-b">Quiz Information</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quiz Title *</label>
                <input
                  type="text"
                  placeholder="Enter quiz title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea
                  placeholder="Enter quiz description "
                  value={description}
                  required
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Total Marks *</label>
                  <input
                    type="number"
                    min="1"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-1">Set to 0 for no time limit</p>
                </div>
              </div>

              {/* Attempt Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Maximum Attempts *</label>
                  <select
                    value={maxAttempts}
                    onChange={(e) => handleMaxAttemptsChange(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value={1}>1 attempt</option>
                    <option value={2}>2 attempts</option>
                    <option value={3}>3 attempts</option>
                    <option value={5}>5 attempts</option>
                    <option value={10}>10 attempts</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {maxAttempts > 1 
                      ? `Students can take this quiz ${maxAttempts} times` 
                      : 'Students can take this quiz only once'
                    }
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">End Date & Time (Optional)</label>
                  <input
                    type="datetime-local"
                    value={visibleUntil}
                    onChange={(e) => setVisibleUntil(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    min={getCurrentPakistanTime()}
                  />
                  <p className="text-xs text-gray-500 mt-1">Pakistan Time (UTC+5)</p>
                </div>
              </div>
              
              {/* Retake Settings - Only show if max attempts > 1 */}
              {maxAttempts > 1 && (
                <div className="border border-gray-200 rounded-lg p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Retake Settings
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Score to Pass (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={retakePolicy.minScoreToPass}
                        onChange={(e) => setRetakePolicy({
                          ...retakePolicy,
                          minScoreToPass: Number(e.target.value)
                        })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        Students scoring below {retakePolicy.minScoreToPass}% can retake the quiz
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Days Between Attempts
                      </label>
                      <select
                        value={retakePolicy.daysBetweenAttempts}
                        onChange={(e) => setRetakePolicy({
                          ...retakePolicy,
                          daysBetweenAttempts: Number(e.target.value)
                        })}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      >
                        <option value={0}>No waiting period</option>
                        <option value={1}>1 day</option>
                        <option value={2}>2 days</option>
                        <option value={3}>3 days</option>
                        <option value={7}>1 week</option>
                      </select>
                      <p className="text-xs text-gray-600 mt-1">
                        {retakePolicy.daysBetweenAttempts === 0 
                          ? 'Students can retake immediately' 
                          : `Students must wait ${retakePolicy.daysBetweenAttempts} day(s) between attempts`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Questions Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Questions</h2>
              <button
                onClick={addQuestion}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Question
              </button>
            </div>
            
            <div className="space-y-6">
              {questions.map((q, qIndex) => (
                <div key={qIndex} className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-800 text-lg">Question {qIndex + 1}</h3>
                    <button
                      onClick={() => removeQuestion(qIndex)}
                      className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="Remove question"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Question Text *</label>
                    <input
                      type="text"
                      placeholder="Enter your question here..."
                      value={q.question}
                      onChange={(e) => {
                        const newQ = [...questions];
                        newQ[qIndex].question = e.target.value;
                        setQuestions(newQ);
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-semibold text-gray-700">Options *</label>
                      <button
                        onClick={() => addOption(qIndex)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Option
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {q.options.map((opt, oIndex) => (
                        <div key={oIndex} className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-600 w-6">{oIndex + 1}.</span>
                          <input
                            type="text"
                            placeholder={`Option ${oIndex + 1}`}
                            value={opt}
                            onChange={(e) => {
                              const newQ = [...questions];
                              newQ[qIndex].options[oIndex] = e.target.value;
                              setQuestions(newQ);
                            }}
                            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          />
                          <button
                            onClick={() => removeOption(qIndex, oIndex)}
                            className="p-2 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50 transition-colors"
                            title="Remove option"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Correct Answer *</label>
                      <select
                        value={q.correctAnswer}
                        onChange={(e) => {
                          const newQ = [...questions];
                          newQ[qIndex].correctAnswer = Number(e.target.value);
                          setQuestions(newQ);
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      >
                        {q.options.map((_, oIndex) => (
                          <option key={oIndex} value={oIndex}>
                            Option {oIndex + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Marks</label>
                      <input
                        type="number"
                        min="1"
                        value={q.marks || 10}
                        onChange={(e) => {
                          const newQ = [...questions];
                          newQ[qIndex].marks = Number(e.target.value);
                          setQuestions(newQ);
                        }}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t border-gray-200">
            <button
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Quiz...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Create Quiz
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}