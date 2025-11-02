'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Assessment {
  _id: string;
  title: string;
  type: string;
  totalMarks: number;
}

export default function GradesPage() {
  const { schoolID, userID, courseId } = useParams();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: 'quiz',
    totalMarks: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAssessments();
  }, [courseId]);

  const fetchAssessments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/assessments/${courseId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (res.ok) setAssessments(data.data || []);
      else toast.error(data.message || 'Failed to load assessments');
    } catch (err) {
      toast.error('Error fetching assessments');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/assessments/${courseId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: formData.title,
            type: formData.type,
            totalMarks: Number(formData.totalMarks)
          }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        toast.success('Assessment created successfully!');
        setShowCreateModal(false);
        setFormData({ title: '', type: 'quiz', totalMarks: '' });
        fetchAssessments(); // Refresh the list
      } else {
        toast.error(data.message || 'Failed to create assessment');
      }
    } catch (err) {
      toast.error('Error creating assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Function to create a URL-friendly assessment name
  const createAssessmentSlug = (title: string, id: string) => {
    // Create a slug from the title (lowercase, replace spaces with hyphens, remove special chars)
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Append the ID to ensure uniqueness
    return `${slug}-${id}`;
  };

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Assessments</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create New Assessment
        </button>
      </div>

      {assessments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-lg mb-4">No assessments yet.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Assessment
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assessments.map((a) => {
            // Create the assessment name slug for the URL
            const assessmentName = createAssessmentSlug(a.title, a._id);
            
            return (
              <Link
                key={a._id}
                href={`/${schoolID}/${userID}/dashboard/courses/${courseId}/grades/${encodeURIComponent(assessmentName)}?id=${a._id}`}
                className="block p-6 border rounded-lg hover:shadow-md transition-shadow bg-white"
              >
                <h3 className="font-semibold text-lg mb-2">
                  {a.title}
                </h3>
                <div className="flex justify-between items-center mb-2">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full capitalize">
                    {a.type}
                  </span>
                  <span className="text-gray-600 font-medium">
                    {a.totalMarks} marks
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Click to view/edit grades
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Assessment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Create New Assessment</h2>
            
            <form onSubmit={handleCreateAssessment}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Assessment Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter assessment title"
                  />
                </div>

                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                    Assessment Type *
                  </label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="quiz">Quiz</option>
                    <option value="assignment">Assignment</option>
                    <option value="project">Project</option>
                    <option value="midterm">Midterm</option>
                    <option value="final">Final</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="totalMarks" className="block text-sm font-medium text-gray-700 mb-1">
                    Total Marks *
                  </label>
                  <input
                    type="number"
                    id="totalMarks"
                    name="totalMarks"
                    value={formData.totalMarks}
                    onChange={handleInputChange}
                    required
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter total marks"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}