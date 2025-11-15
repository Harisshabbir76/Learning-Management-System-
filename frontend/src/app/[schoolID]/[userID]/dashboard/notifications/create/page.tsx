"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { FiUsers, FiBook, FiHome, FiUser, FiBriefcase } from 'react-icons/fi';

const CreateNotificationPage = ({ params }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [recipientType, setRecipientType] = useState('all_students');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('general');
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();
  const router = useRouter();
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const recipientTypes = [
    { value: 'all_students', label: 'All Students', icon: FiUsers, description: 'Send to all students in the system' },
    { value: 'all_teachers', label: 'All Teachers', icon: FiUser, description: 'Send to all teachers' },
    { value: 'all_employees', label: 'All Employees', icon: FiBriefcase, description: 'Send to all staff and faculty' },
    { value: 'course_students', label: 'Course Students', icon: FiBook, description: 'Send to students in specific course' },
    { value: 'class_students', label: 'Class Students', icon: FiHome, description: 'Send to students in specific class' },
    { value: 'specific_user', label: 'Specific User', icon: FiUser, description: 'Send to specific user(s)' },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      try {
        if (recipientType === 'specific_user') {
          const res = await axios.get(`${API_URL}/api/users`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUsers(Array.isArray(res.data) ? res.data : []);
        } else if (recipientType === 'course_students') {
          const res = await axios.get(`${API_URL}/api/courses`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setCourses(Array.isArray(res.data) ? res.data : []);
        } else if (recipientType === 'class_students') {
          const res = await axios.get(`${API_URL}/api/sections`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setSections(Array.isArray(res.data) ? res.data : []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load recipient data');
      }
    };
    
    fetchData();
  }, [recipientType, API_URL]);

  const handleRecipientSelection = (id) => {
    setSelectedRecipients(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }

    if ((recipientType === 'course_students' || recipientType === 'class_students' || recipientType === 'specific_user') && 
        selectedRecipients.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/notifications/send`,
        { 
          title, 
          message, 
          recipientType, 
          recipientIds: selectedRecipients,
          priority,
          category
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Notification sent successfully!');
        router.push(`/${params.schoolID}/${params.userID}/dashboard/notifications`);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error(error.response?.data?.message || 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const getRecipientSelectionComponent = () => {
    switch (recipientType) {
      case 'course_students':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Select Course</label>
            <div className="grid gap-2 max-h-60 overflow-y-auto">
              {courses.map((course) => (
                <label key={course._id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRecipients.includes(course._id)}
                    onChange={() => handleRecipientSelection(course._id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium">{course.name}</div>
                    <div className="text-sm text-gray-500">{course.code}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case 'class_students':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Select Class</label>
            <div className="grid gap-2 max-h-60 overflow-y-auto">
              {sections.map((section) => (
                <label key={section._id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRecipients.includes(section._id)}
                    onChange={() => handleRecipientSelection(section._id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium">{section.name}</div>
                    <div className="text-sm text-gray-500">Grade {section.gradeLevel}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      case 'specific_user':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Select Users</label>
            <div className="grid gap-2 max-h-60 overflow-y-auto">
              {users.map((user) => (
                <label key={user._id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRecipients.includes(user._id)}
                    onChange={() => handleRecipientSelection(user._id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-500 capitalize">{user.role}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              This notification will be sent to all {recipientType.replace('all_', '')} in the system.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create Notification</h1>
            <p className="text-gray-600 mt-1">Send a notification to users in the system</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter notification title"
                required
                maxLength={200}
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {title.length}/200
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={6}
                placeholder="Enter notification message"
                required
                maxLength={1000}
              />
              <div className="text-xs text-gray-500 mt-1 text-right">
                {message.length}/1000
              </div>
            </div>

            {/* Priority and Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="general">General</option>
                  <option value="academic">Academic</option>
                  <option value="administrative">Administrative</option>
                  <option value="emergency">Emergency</option>
                  <option value="event">Event</option>
                </select>
              </div>
            </div>

            {/* Recipient Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Send To *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {recipientTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <label
                      key={type.value}
                      className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        recipientType === type.value
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="recipientType"
                        value={type.value}
                        checked={recipientType === type.value}
                        onChange={(e) => {
                          setRecipientType(e.target.value);
                          setSelectedRecipients([]);
                        }}
                        className="sr-only"
                      />
                      <Icon className={`h-6 w-6 mb-2 ${
                        recipientType === type.value ? 'text-blue-600' : 'text-gray-400'
                      }`} />
                      <span className="font-medium text-sm">{type.label}</span>
                      <span className="text-xs text-gray-500 mt-1">{type.description}</span>
                    </label>
                  );
                })}
              </div>

              {/* Recipient Selection */}
              {getRecipientSelectionComponent()}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateNotificationPage;