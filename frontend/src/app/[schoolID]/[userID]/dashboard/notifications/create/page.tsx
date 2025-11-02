'use client';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

const NotificationCreateForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    priority: 'medium',
    targetType: 'all',
    targetRoles: [],
    specificUsers: [],
    sections: [],
    courses: [],
    deliveryMethods: {
      inApp: true,
      push: false,
      email: false
    },
    scheduledFor: '',
    expiresAt: ''
  });

  const [users, setUsers] = useState([]);
  const [sections, setSections] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [courseSearchTerm, setCourseSearchTerm] = useState('');
  const [sectionSearchTerm, setSectionSearchTerm] = useState('');
  const router = useRouter();

  // Get schoolId and userId from the current URL path
  const getCurrentIds = () => {
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const schoolId = pathParts[0];
      const userId = pathParts[1];
      
      return {
        schoolId: schoolId,
        userId: userId
      };
    }
    return { schoolId: '', userId: '' };
  };

  // Get API base URL and auth token
  const getAuthConfig = () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      return {
        baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };
    }
    return {
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
      headers: {}
    };
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const config = getAuthConfig();
      
      const [usersRes, sectionsRes, coursesRes] = await Promise.all([
        axios.get('/api/users?includeRoleData=true', config),
        axios.get('/api/sections', config),
        axios.get('/api/courses?populate=section', config)
      ]);

      setUsers(usersRes.data.data || []);
      setSections(sectionsRes.data.data || []);
      setCourses(coursesRes.data.data || []);
    } catch (err) {
      console.error('Error fetching options:', err);
      setError('Failed to load options. Please refresh the page.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const config = getAuthConfig();
      
      // Prepare data for API
      const apiData = {
        ...formData,
        // Convert empty strings to null for dates
        scheduledFor: formData.scheduledFor || null,
        expiresAt: formData.expiresAt || null
      };

      const response = await axios.post('/api/notifications', apiData, config);
      
      setSuccess('Notification created successfully!');
      
      if (onSuccess) {
        onSuccess(response.data.data);
      }
      
      // Redirect to notifications page after a short delay
      setTimeout(() => {
        const { schoolId, userId } = getCurrentIds();
        if (schoolId && userId) {
          router.push(`/${schoolId}/${userId}/dashboard/notifications`);
        } else {
          // Fallback if IDs are not available
          router.push('/notifications');
        }
      }, 1500); // 1.5 second delay to show success message
      
    } catch (err) {
      console.error('Error creating notification:', err);
      setError(err.response?.data?.message || 'Error creating notification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDeliveryMethodChange = (method, value) => {
    setFormData(prev => ({
      ...prev,
      deliveryMethods: {
        ...prev.deliveryMethods,
        [method]: value
      }
    }));
  };

  const handleMultiSelect = (field, value, isChecked) => {
    setFormData(prev => ({
      ...prev,
      [field]: isChecked 
        ? [...prev[field], value]
        : prev[field].filter(item => item !== value)
    }));
  };

  // Clear dates function
  const clearDates = () => {
    setFormData(prev => ({
      ...prev,
      scheduledFor: '',
      expiresAt: ''
    }));
  };

  // Helper function to get type icon
  const getTypeIcon = (type) => {
    switch (type) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'error': return '❌';
      case 'announcement': return '📢';
      case 'reminder': return '⏰';
      default: return 'ℹ️';
    }
  };

  // Helper function to get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return '#6c757d';
      case 'medium': return '#17a2b8';
      case 'high': return '#fd7e14';
      case 'urgent': return '#dc3545';
      default: return '#17a2b8';
    }
  };

  // Filter users based on search term (search by userId or name)
  const filteredUsers = users.filter(user => {
    if (!userSearchTerm) return true;
    
    const searchTerm = userSearchTerm.toLowerCase();
    return (
      user.userId?.toString().includes(searchTerm) ||
      user.name?.toLowerCase().includes(searchTerm) ||
      user.email?.toLowerCase().includes(searchTerm)
    );
  });

  // Filter courses based on search term (search by name, code, or section name)
  const filteredCourses = courses.filter(course => {
    if (!courseSearchTerm) return true;
    
    const searchTerm = courseSearchTerm.toLowerCase();
    return (
      course.name?.toLowerCase().includes(searchTerm) ||
      course.code?.toLowerCase().includes(searchTerm) ||
      course.section?.name?.toLowerCase().includes(searchTerm) ||
      course.section?.sectionCode?.toLowerCase().includes(searchTerm)
    );
  });

  // Filter sections based on search term
  const filteredSections = sections.filter(section => {
    if (!sectionSearchTerm) return true;
    
    const searchTerm = sectionSearchTerm.toLowerCase();
    return (
      section.name?.toLowerCase().includes(searchTerm) ||
      section.sectionCode?.toLowerCase().includes(searchTerm)
    );
  });

  return (
    <div className="notification-create-form">
      <div className="form-header">
        <h2>Create New Notification</h2>
        <p>Send messages to users based on roles, courses, or specific criteria</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span className="alert-icon">✅</span>
          <div className="alert-content">
            <strong>Success:</strong> {success}
            <div className="alert-subtext">Redirecting to notifications page...</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="notification-form">
        {/* Basic Information Section */}
        <div className="form-section">
          <div className="section-header">
            <h3>Basic Information</h3>
            <div className="section-divider"></div>
          </div>
          
          <div className="form-group">
            <label className="form-label">
              Title <span className="required">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required
              className="form-input"
              placeholder="Enter a clear and concise title"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Message <span className="required">*</span>
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => handleChange('message', e.target.value)}
              required
              rows={4}
              className="form-textarea"
              placeholder="Write your notification message here..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Type
              </label>
              <div className="select-wrapper">
                <select
                  value={formData.type}
                  onChange={(e) => handleChange('type', e.target.value)}
                  className="form-select"
                >
                  <option value="info">Information ℹ️</option>
                  <option value="warning">Warning ⚠️</option>
                  <option value="success">Success ✅</option>
                  <option value="error">Error ❌</option>
                  <option value="announcement">Announcement 📢</option>
                  <option value="reminder">Reminder ⏰</option>
                </select>
                <div className="select-arrow">▼</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Priority
              </label>
              <div className="select-wrapper">
                <select
                  value={formData.priority}
                  onChange={(e) => handleChange('priority', e.target.value)}
                  className="form-select"
                  style={{ borderLeft: `4px solid ${getPriorityColor(formData.priority)}` }}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
                <div className="select-arrow">▼</div>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Methods Section */}
        <div className="form-section">
          <div className="section-header">
            <h3>Delivery Methods</h3>
            <div className="section-divider"></div>
          </div>

          <div className="form-group">
            <label className="form-label">
              How should this notification be delivered?
            </label>
            <div className="delivery-methods">
              <label className="checkbox-label delivery-method">
                <input
                  type="checkbox"
                  checked={formData.deliveryMethods.inApp}
                  onChange={(e) => handleDeliveryMethodChange('inApp', e.target.checked)}
                  className="checkbox-input"
                />
                <span className="checkbox-custom"></span>
                <div className="delivery-method-info">
                  <span className="delivery-method-name">In-App Notification</span>
                  <span className="delivery-method-desc">Show notification within the application</span>
                </div>
              </label>

              <label className="checkbox-label delivery-method">
                <input
                  type="checkbox"
                  checked={formData.deliveryMethods.push}
                  onChange={(e) => handleDeliveryMethodChange('push', e.target.checked)}
                  className="checkbox-input"
                />
                <span className="checkbox-custom"></span>
                <div className="delivery-method-info">
                  <span className="delivery-method-name">Push Notification</span>
                  <span className="delivery-method-desc">Send real-time push notification to devices</span>
                </div>
              </label>

              <label className="checkbox-label delivery-method">
                <input
                  type="checkbox"
                  checked={formData.deliveryMethods.email}
                  onChange={(e) => handleDeliveryMethodChange('email', e.target.checked)}
                  className="checkbox-input"
                />
                <div className="delivery-method-info">
                  <span className="delivery-method-name">Email</span>
                  <span className="delivery-method-desc">Send email notification to recipients</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Target Audience Section */}
        <div className="form-section">
          <div className="section-header">
            <h3>Target Audience</h3>
            <div className="section-divider"></div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Target Type
            </label>
            <div className="select-wrapper">
              <select
                value={formData.targetType}
                onChange={(e) => handleChange('targetType', e.target.value)}
                className="form-select"
              >
                <option value="all">All Users</option>
                <option value="role">By Role</option>
                <option value="specific">Specific Users</option>
                <option value="section">By Section</option>
                <option value="course">By Course</option>
              </select>
              <div className="select-arrow">▼</div>
            </div>
          </div>

          {formData.targetType === 'role' && (
            <div className="form-group">
              <label className="form-label">
                Select Roles:
              </label>
              <div className="checkbox-grid">
                {['student', 'teacher', 'parent', 'faculty', 'admin'].map((role) => (
                  <label key={role} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.targetRoles.includes(role)}
                      onChange={(e) => handleMultiSelect('targetRoles', role, e.target.checked)}
                      className="checkbox-input"
                    />
                    <span className="checkbox-custom"></span>
                    <span className="checkbox-text">{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {formData.targetType === 'specific' && users.length > 0 && (
            <div className="form-group">
              <label className="form-label">
                Select Users
              </label>
              
              {/* User Search Input */}
              <div className="search-container">
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="search-input"
                  placeholder="Search by user ID, name, or email..."
                />
                {userSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setUserSearchTerm('')}
                    className="search-clear"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              <div className="select-wrapper">
                <select
                  multiple
                  value={formData.specificUsers}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    handleChange('specificUsers', selected);
                  }}
                  className="form-select multi-select"
                >
                  {filteredUsers.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.name} (ID: {user.userId}, {user.role})
                    </option>
                  ))}
                </select>
              </div>
              
              {filteredUsers.length === 0 && userSearchTerm && (
                <div className="no-results">
                  No users found matching "{userSearchTerm}"
                </div>
              )}
              
              <div className="selection-count">
                Selected: {formData.specificUsers.length} users
                {userSearchTerm && filteredUsers.length > 0 && (
                  <span className="filtered-count">
                    ({filteredUsers.length} matching results)
                  </span>
                )}
              </div>
            </div>
          )}

          {formData.targetType === 'section' && sections.length > 0 && (
            <div className="form-group">
              <label className="form-label">
                Select Sections
              </label>
              
              {/* Section Search Input */}
              <div className="search-container">
                <input
                  type="text"
                  value={sectionSearchTerm}
                  onChange={(e) => setSectionSearchTerm(e.target.value)}
                  className="search-input"
                  placeholder="Search by section name or code..."
                />
                {sectionSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setSectionSearchTerm('')}
                    className="search-clear"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              <div className="select-wrapper">
                <select
                  multiple
                  value={formData.sections}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    handleChange('sections', selected);
                  }}
                  className="form-select multi-select"
                >
                  {filteredSections.map((section) => (
                    <option key={section._id} value={section._id}>
                      {section.name} ({section.sectionCode})
                    </option>
                  ))}
                </select>
              </div>
              
              {filteredSections.length === 0 && sectionSearchTerm && (
                <div className="no-results">
                  No sections found matching "{sectionSearchTerm}"
                </div>
              )}
              
              <div className="selection-count">
                Selected: {formData.sections.length} sections
                {sectionSearchTerm && filteredSections.length > 0 && (
                  <span className="filtered-count">
                    ({filteredSections.length} matching results)
                  </span>
                )}
              </div>
            </div>
          )}

          {formData.targetType === 'course' && courses.length > 0 && (
            <div className="form-group">
              <label className="form-label">
                Select Courses
              </label>
              
              {/* Course Search Input */}
              <div className="search-container">
                <input
                  type="text"
                  value={courseSearchTerm}
                  onChange={(e) => setCourseSearchTerm(e.target.value)}
                  className="search-input"
                  placeholder="Search by course name, code, or section..."
                />
                {courseSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setCourseSearchTerm('')}
                    className="search-clear"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              <div className="select-wrapper">
                <select
                  multiple
                  value={formData.courses}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    handleChange('courses', selected);
                  }}
                  className="form-select multi-select"
                >
                  {filteredCourses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.name} ({course.code}) - Section: {course.section?.name || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>
              
              {filteredCourses.length === 0 && courseSearchTerm && (
                <div className="no-results">
                  No courses found matching "{courseSearchTerm}"
                </div>
              )}
              
              <div className="selection-count">
                Selected: {formData.courses.length} courses
                {courseSearchTerm && filteredCourses.length > 0 && (
                  <span className="filtered-count">
                    ({filteredCourses.length} matching results)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scheduling Section */}
        <div className="form-section">
          <div className="section-header">
            <h3>Scheduling (Optional)</h3>
            <div className="section-divider"></div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                Schedule Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledFor}
                onChange={(e) => handleChange('scheduledFor', e.target.value)}
                className="form-input"
              />
              <div className="input-help">
                Leave empty to send immediately
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Expiration Date & Time
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt}
                onChange={(e) => handleChange('expiresAt', e.target.value)}
                className="form-input"
              />
              <div className="input-help">
                Leave empty for no expiration
              </div>
            </div>
          </div>

          <div className="quick-actions">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const in30Mins = new Date(now.getTime() + 30 * 60000);
                handleChange('scheduledFor', in30Mins.toISOString().slice(0, 16));
              }}
              className="quick-action-btn"
            >
              Schedule for 30 mins
            </button>

            <button
              type="button"
              onClick={() => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
                handleChange('scheduledFor', tomorrow.toISOString().slice(0, 16));
              }}
              className="quick-action-btn"
            >
              Schedule for tomorrow 9 AM
            </button>

            <button
              type="button"
              onClick={clearDates}
              className="quick-action-btn danger"
            >
              Clear dates
            </button>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Creating...
              </>
            ) : (
              'Create Notification'
            )}
          </button>
          
          <button
            type="button"
            onClick={() => {
              const { schoolId, userId } = getCurrentIds();
              if (schoolId && userId) {
                router.push(`/${schoolId}/${userId}/dashboard/notifications`);
              } else {
                router.back();
              }
            }}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>

      <style jsx>{`
        .notification-create-form {
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin: 1.5rem 0;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }
        
        .form-header {
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #eaeaea;
        }
        
        .form-header h2 {
          margin: 0 0 0.5rem 0;
          color: #2d3748;
          font-size: 1.75rem;
          font-weight: 600;
        }
        
        .form-header p {
          margin: 0;
          color: #718096;
          font-size: 1rem;
        }
        
        .alert {
          display: flex;
          align-items: flex-start;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }
        
        .alert-error {
          background-color: #fed7d7;
          color: #c53030;
          border: 1px solid #feb2b2;
        }
        
        .alert-success {
          background-color: #c6f6d5;
          color: #2f855a;
          border: 1px solid #9ae6b4;
        }
        
        .alert-icon {
          margin-right: 0.75rem;
          font-size: 1.25rem;
        }
        
        .alert-content {
          flex: 1;
        }
        
        .alert-subtext {
          font-size: 0.875rem;
          margin-top: 0.25rem;
          opacity: 0.8;
        }
        
        .form-section {
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        
        .section-header {
          margin-bottom: 1.5rem;
        }
        
        .section-header h3 {
          margin: 0 0 0.5rem 0;
          color: #2d3748;
          font-size: 1.25rem;
          font-weight: 600;
        }
        
        .section-divider {
          height: 2px;
          background: linear-gradient(to right, #4299e1, transparent);
          width: 50px;
        }
        
        .form-group {
          margin-bottom: 1.5rem;
        }
        
        .form-label {
          display: block;
          margin-bottom: 0.5rem;
          color: #4a5568;
          font-weight: 500;
        }
        
        .required {
          color: #e53e3e;
        }
        
        .form-input, .form-textarea, .form-select {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          font-size: 1rem;
          transition: all 0.2s;
          background: white;
        }
        
        .form-input:focus, .form-textarea:focus, .form-select:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
        }
        
        .form-textarea {
          resize: vertical;
          min-height: 120px;
        }
        
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        
        .select-wrapper {
          position: relative;
        }
        
        .select-arrow {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #718096;
        }
        
        .multi-select {
          height: 120px;
        }
        
        .checkbox-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.75rem;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 6px;
          transition: background 0.2s;
        }
        
        .checkbox-label:hover {
          background: #edf2f7;
        }
        
        .checkbox-input {
          position: absolute;
          opacity: 0;
          cursor: pointer;
        }
        
        .checkbox-custom {
          height: 20px;
          width: 20px;
          background-color: white;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          margin-right: 0.75rem;
          position: relative;
          transition: all 0.2s;
        }
        
        .checkbox-input:checked ~ .checkbox-custom {
          background-color: #4299e1;
          border-color: #4299e1;
        }
        
        .checkbox-input:checked ~ .checkbox-custom::after {
          content: '';
          position: absolute;
          left: 6px;
          top: 2px;
          width: 5px;
          height: 10px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        
        .delivery-methods {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        
        .delivery-method {
          display: flex;
          align-items: flex-start;
          padding: 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          transition: all 0.2s;
        }
        
        .delivery-method:hover {
          border-color: #4299e1;
          background: #f7fafc;
        }
        
        .delivery-method-info {
          display: flex;
          flex-direction: column;
        }
        
        .delivery-method-name {
          font-weight: 500;
          color: #2d3748;
          margin-bottom: 0.25rem;
        }
        
        .delivery-method-desc {
          font-size: 0.875rem;
          color: #718096;
        }
        
        .selection-count {
          margin-top: 0.5rem;
          font-size: 0.875rem;
          color: #718096;
        }
        
        .filtered-count {
          margin-left: 0.5rem;
          font-style: italic;
        }
        
        .search-container {
          position: relative;
          margin-bottom: 0.75rem;
        }
        
        .search-input {
          width: 100%;
          padding: 0.75rem 2.5rem 0.75rem 1rem;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        
        .search-input:focus {
          outline: none;
          border-color: #4299e1;
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.15);
        }
        
        .search-clear {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #718096;
          cursor: pointer;
          font-size: 1rem;
          padding: 0.25rem;
        }
        
        .search-clear:hover {
          color: #4a5568;
        }
        
        .no-results {
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 4px;
          color: #718096;
          font-size: 0.875rem;
          text-align: center;
          margin-top: 0.5rem;
        }
        
        .input-help {
          margin-top: 0.5rem;
          font-size: 0.875rem;
          color: #718096;
        }
        
        .quick-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: 1rem;
        }
        
        .quick-action-btn {
          padding: 0.5rem 1rem;
          background: white;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .quick-action-btn:hover {
          background: #edf2f7;
          border-color: #a0aec0;
        }
        
        .quick-action-btn.danger {
          color: #e53e3e;
          border-color: #fc8181;
        }
        
        .quick-action-btn.danger:hover {
          background: #fed7d7;
        }
        
        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-start;
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #eaeaea;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 160px;
        }
        
        .btn-primary {
          background: #4299e1;
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #3182ce;
        }
        
        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .btn-secondary {
          background: white;
          color: #4a5568;
          border: 1px solid #cbd5e0;
        }
        
        .btn-secondary:hover {
          background: #f7fafc;
          border-color: #a0aec0;
        }
        
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 0.5rem;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .notification-create-form {
            padding: 1.5rem;
            margin: 1rem;
          }
          
          .form-row {
            grid-template-columns: 1fr;
          }
          
          .checkbox-grid {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          }
          
          .form-actions {
            flex-direction: column;
          }
          
          .btn {
            width: 100%;
          }
          
          .quick-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationCreateForm;