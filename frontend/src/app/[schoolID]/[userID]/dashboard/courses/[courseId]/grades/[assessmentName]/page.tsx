'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Student {
  _id: string;
  name: string;
  userId: number;
  email: string;
}

interface Grade {
  _id?: string;
  student: Student;
  marksObtained: number;
}

interface Assessment {
  _id: string;
  title: string;
  type: string;
  totalMarks: number;
}

export default function AssessmentGradesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Extract parameters
  const courseId = Array.isArray(params.courseId) ? params.courseId[0] : params.courseId;
  const assessmentId = searchParams.get('id');
  
  const [grades, setGrades] = useState<Grade[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [editable, setEditable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Route Parameters:', params);
    console.log('Query Parameters:', searchParams.toString());
    console.log('Assessment ID from query:', assessmentId);
    console.log('Course ID:', courseId);
    
    const fetchData = async () => {
      try {
        if (!assessmentId || !courseId) {
          console.error('Missing required parameters:', { assessmentId, courseId });
          setLoading(false);
          return;
        }

        const token = localStorage.getItem('token');
        if (!token) {
          toast.error('Please log in again');
          setLoading(false);
          return;
        }

        // Fetch assessment details
        const assessmentRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/assessments/${assessmentId}`,
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
            } 
          }
        );
        
        if (assessmentRes.ok) {
          const assessmentData = await assessmentRes.json();
          console.log('Assessment response:', assessmentData);
          if (assessmentData.success) {
            setAssessment(assessmentData.data);
          }
        } else {
          console.warn('Assessment fetch failed, continuing without assessment details');
        }

        // Fetch course details to get students (same approach as course detail page)
        const courseRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}`,
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
            } 
          }
        );
        
        console.log('Course API response status:', courseRes.status);
        if (courseRes.ok) {
          const courseData = await courseRes.json();
          console.log('Course response:', courseData);
          
          if (courseData.success && courseData.data) {
            // Extract students from course data - handle both populated and unpopulated cases
            let courseStudents: Student[] = [];
            
            if (courseData.data.students && courseData.data.students.length > 0) {
              // Check if students are populated objects or just IDs
              if (typeof courseData.data.students[0] === 'object') {
                // Students are already populated objects
                courseStudents = courseData.data.students;
              } else {
                // Students are IDs, we need to fetch their details
                const studentIds = courseData.data.students;
                const studentDetailsRes = await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL}/api/users?role=student&ids=${studentIds.join(',')}`,
                  { 
                    headers: { 
                      Authorization: `Bearer ${token}`,
                    } 
                  }
                );
                
                if (studentDetailsRes.ok) {
                  const studentDetailsData = await studentDetailsRes.json();
                  if (studentDetailsData.success && studentDetailsData.data) {
                    courseStudents = studentDetailsData.data;
                  }
                }
              }
            }
            
            setStudents(courseStudents);
            console.log('Final students data:', courseStudents);
          }
        } else {
          console.error('Course fetch failed:', courseRes.status);
        }

        // Fetch grades for this assessment
        const gradesRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/assessments/${assessmentId}/grades`,
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
            } 
          }
        );
        
        let existingGrades: Grade[] = [];
        if (gradesRes.ok) {
          const gradesData = await gradesRes.json();
          console.log('Grades response:', gradesData);
          if (gradesData.success && gradesData.data) {
            existingGrades = gradesData.data;
          }
        }

        // Initialize grades for all students
        const initialGrades = students.map((student: Student) => {
          const existingGrade = existingGrades.find((g: Grade) => 
            g.student && student._id && g.student._id === student._id
          );
          return existingGrade || { student, marksObtained: 0 };
        });
        
        setGrades(initialGrades);
        
      } catch (error: any) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load assessment data');
      } finally {
        setLoading(false);
      }
    };

    if (assessmentId && courseId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [assessmentId, courseId, params, searchParams]);

  // Debug: Log students whenever they change
  useEffect(() => {
    console.log('Students state updated:', students);
  }, [students]);

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Please log in again');
        return;
      }

      for (const grade of grades) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/assessments/${assessmentId}/grade/${grade.student._id}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ marksObtained: grade.marksObtained })
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to save grade for ${grade.student.name}`);
        }
      }
      
      toast.success("Grades updated successfully");
      setEditable(false);
    } catch (error: any) {
      console.error('Error saving grades:', error);
      toast.error(error.message || "Failed to update grades");
    }
  };

  const handleCancel = () => {
    setEditable(false);
    // Reload original grades
    const reloadGrades = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/assessments/${assessmentId}/grades`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (res.ok) {
          const data = await res.json();
          const existingGrades = data.success ? data.data : [];
          const updatedGrades = students.map((student: Student) => {
            const existingGrade = existingGrades.find((g: Grade) => 
              g.student && student._id && g.student._id === student._id
            );
            return existingGrade || { student, marksObtained: 0 };
          });
          setGrades(updatedGrades);
        }
      } catch (error) {
        console.error("Error reloading grades:", error);
      }
    };
    reloadGrades();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading assessment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {assessment?.title || 'Assessment Grades'}
          </h1>
          {assessment && (
            <p className="text-sm text-gray-600 mt-1">
              Type: {assessment.type} | Total Marks: {assessment.totalMarks}
            </p>
          )}
        </div>
        
        {students.length > 0 && (
          <div className="flex space-x-2">
            {editable ? (
              <>
                <button 
                  onClick={handleSave}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Save
                </button>
                <button 
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button 
                onClick={() => setEditable(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Edit Grades
              </button>
            )}
          </div>
        )}
      </div>

      {students.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <div className="text-gray-400 text-4xl mb-4">👥</div>
          <p className="text-gray-600 text-lg mb-2">No students enrolled in this course</p>
          <p className="text-gray-500 text-sm mb-4">
            Students need to be enrolled in the course before you can assign grades.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mt-4">
            <p className="text-yellow-800 text-sm">
              <strong>Debug Info:</strong> Check browser console for API response details.
              Make sure your course API endpoint returns students data.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border-b text-left font-semibold">Student ID</th>
                <th className="p-3 border-b text-left font-semibold">Name</th>
                <th className="p-3 border-b text-left font-semibold">Email</th>
                <th className="p-3 border-b text-left font-semibold">Marks Obtained</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, idx) => {
                const grade = grades.find(g => g.student._id === student._id) || { student, marksObtained: 0 };
                
                return (
                  <tr key={student._id} className="hover:bg-gray-50">
                    <td className="p-3 border-b">{student.userId || 'N/A'}</td>
                    <td className="p-3 border-b">{student.name || 'Unknown Student'}</td>
                    <td className="p-3 border-b">{student.email || 'N/A'}</td>
                    <td className="p-3 border-b">
                      {editable ? (
                        <input 
                          type="number"
                          min="0"
                          max={assessment?.totalMarks || 100}
                          value={grade.marksObtained}
                          onChange={e => {
                            const newGrades = [...grades];
                            const gradeIndex = newGrades.findIndex(g => g.student._id === student._id);
                            
                            if (gradeIndex >= 0) {
                              newGrades[gradeIndex].marksObtained = Number(e.target.value);
                            } else {
                              newGrades.push({ student, marksObtained: Number(e.target.value) });
                            }
                            
                            setGrades(newGrades);
                          }}
                          className="w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span className={grade.marksObtained ? "font-medium" : "text-gray-400"}>
                          {grade.marksObtained || "-"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}