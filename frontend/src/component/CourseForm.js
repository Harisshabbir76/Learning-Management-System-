'use client';
import { useState, useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export default function CourseForm({ course, onSubmit, onCancel, schoolId }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    teacherId: '',
    school: schoolId,
  });
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (course) {
      setFormData({
        name: course.name,
        description: course.description || '',
        teacherId: course.teacher?._id || '',
        school: course.school?._id || schoolId,
      });
    }

    const fetchTeachers = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/users`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Failed to fetch teachers');

        const data = await response.json();
        const schoolTeachers = data.users.filter(
          user => user.role === 'teacher' && user.school === schoolId
        );
        setTeachers(schoolTeachers);
      } catch (err) {
        console.error('Error fetching teachers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeachers();
  }, [course, schoolId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {course ? 'Edit Course' : 'Create New Course'}
          </h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Course Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="teacherId" className="block text-sm font-medium text-gray-700 mb-1">
              Teacher
            </label>
            <select
              id="teacherId"
              name="teacherId"
              value={formData.teacherId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a teacher</option>
              {loading ? (
                <option disabled>Loading teachers...</option>
              ) : teachers.length > 0 ? (
                teachers.map(teacher => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))
              ) : (
                <option disabled>No teachers available</option>
              )}
            </select>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {course ? 'Update Course' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}