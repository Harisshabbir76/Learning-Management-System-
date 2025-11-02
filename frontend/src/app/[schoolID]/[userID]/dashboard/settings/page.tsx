// pages/profile/index.js
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('user');
  const [userData, setUserData] = useState(null);
  const [schoolData, setSchoolData] = useState(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Helper function to get school ID from user object
  const getSchoolId = () => {
    if (!user?.school) return null;
    if (typeof user.school === 'string') return user.school;
    if (typeof user.school === 'object') return user.school._id || user.school.id;
    return null;
  };

  // Fetch user and school data
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Use the user data from auth context directly
        setUserData(user);
        
        // Get the school ID correctly
        const schoolId = getSchoolId();
        
        if (!schoolId) {
          console.error('User does not have a school ID');
          setMessage({ type: 'error', text: 'User is not associated with any school' });
          return;
        }

        console.log('Fetching school with ID:', schoolId);
        
        // Fetch school details using the school ID string
        const schoolRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/schools/${schoolId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        console.log('School fetch status:', schoolRes.status);

        if (schoolRes.ok) {
          const schoolDataResponse = await schoolRes.json();
          console.log('School fetch response:', schoolDataResponse);
          
          if (schoolDataResponse.success) {
            setSchoolData(schoolDataResponse.data);
          } else {
            console.error('Failed to fetch school data:', schoolDataResponse.message);
            setMessage({ type: 'error', text: schoolDataResponse.message || 'Failed to fetch school data' });
          }
        } else {
          const errorText = await schoolRes.text();
          console.error('Failed to fetch school:', schoolRes.status, errorText);
          setMessage({ type: 'error', text: `Failed to fetch school data: ${schoolRes.status}` });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setMessage({ type: 'error', text: 'Failed to load data' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);

  const handleUserUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const formData = new FormData(e.target);
      const updateData = {
        name: formData.get('name'),
        email: formData.get('email')
        // Don't include userId - backend should get it from auth token
      };
      
      console.log('Sending user update:', updateData);
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });
      
      const responseData = await res.json();
      
      console.log('User update response:', responseData);
      
      if (res.ok) {
        setUserData(responseData.user);
        setIsEditingUser(false);
        setMessage({ type: 'success', text: 'User information updated successfully' });
        
        // Refresh auth context to get updated user data
        await refreshUser();
      } else {
        // More detailed error handling
        let errorMessage = 'Failed to update user information';
        if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.errors && responseData.errors.length > 0) {
          errorMessage = responseData.errors.join(', ');
        } else if (responseData.missingFields) {
          errorMessage = `Missing fields: ${responseData.missingFields.join(', ')}`;
        }
        
        setMessage({ 
          type: 'error', 
          text: errorMessage
        });
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setMessage({ type: 'error', text: 'Failed to update user information' });
    } finally {
      setSaving(false);
    }
  };

  const handleSchoolUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      const formData = new FormData(e.target);
      
      // Ensure all required fields are included
      const updateData = {
        name: formData.get('name') || schoolData?.name,
        displayName: formData.get('displayName') || schoolData?.displayName,
        email: formData.get('email') || schoolData?.email,
        phone: formData.get('phone') || schoolData?.phone || '',
        address: formData.get('address') || schoolData?.address,
        website: formData.get('website') || schoolData?.website || '',
        themeColor: formData.get('themeColor') || schoolData?.themeColor || '#3b82f6',
        description: formData.get('description') || schoolData?.description || '',
        establishedYear: formData.get('establishedYear') || schoolData?.establishedYear
      };
      
      // Convert establishedYear to number if it exists
      if (updateData.establishedYear) {
        updateData.establishedYear = parseInt(updateData.establishedYear);
      }
      
      console.log('Sending school update:', updateData);
      
      // Check if we have a valid school ID
      if (!schoolData?._id) {
        setMessage({ type: 'error', text: 'School ID not available' });
        return;
      }
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/schools/${schoolData._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });
      
      const responseData = await res.json();
      
      console.log('School update response:', responseData);
      
      if (res.ok) {
        setSchoolData(responseData.data);
        setIsEditingSchool(false);
        setMessage({ type: 'success', text: 'School information updated successfully' });
      } else {
        // More detailed error handling
        let errorMessage = 'Failed to update school information';
        if (responseData.message) {
          errorMessage = responseData.message;
        } else if (responseData.errors && responseData.errors.length > 0) {
          errorMessage = responseData.errors.join(', ');
        } else if (responseData.missingFields) {
          errorMessage = `Missing fields: ${responseData.missingFields.join(', ')}`;
        }
        
        setMessage({ 
          type: 'error', 
          text: errorMessage
        });
      }
    } catch (error) {
      console.error('Error updating school:', error);
      setMessage({ type: 'error', text: 'Failed to update school information' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('user')}
                className={`ml-8 py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'user'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                User Information
              </button>
              <button
                onClick={() => setActiveTab('school')}
                className={`py-4 px-1 text-center border-b-2 font-medium text-sm ${
                  activeTab === 'school'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                School Information
              </button>
            </nav>
          </div>

          {/* Message Alert */}
          {message.text && (
            <div className={`p-4 m-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          {/* User Information Tab */}
          {activeTab === 'user' && userData && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">User Information</h2>
                {!isEditingUser && (
                  <button
                    onClick={() => setIsEditingUser(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditingUser ? (
                <form onSubmit={handleUserUpdate}>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Full Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        defaultValue={userData.name}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email Address
                      </label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        defaultValue={userData.email}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                        User ID
                      </label>
                      <input
                        type="text"
                        name="userId"
                        id="userId"
                        defaultValue={userData.userId}
                        disabled
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                        Role
                      </label>
                      <input
                        type="text"
                        name="role"
                        id="role"
                        defaultValue={userData.role}
                        disabled
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsEditingUser(false)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{userData.name}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Email Address</dt>
                      <dd className="mt-1 text-sm text-gray-900">{userData.email}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">User ID</dt>
                      <dd className="mt-1 text-sm text-gray-900">{userData.userId}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Role</dt>
                      <dd className="mt-1 text-sm text-gray-900 capitalize">{userData.role}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">School</dt>
                      <dd className="mt-1 text-sm text-gray-900">{schoolData?.name || 'Loading...'}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          )}

          {/* School Information Tab */}
          {activeTab === 'school' && schoolData && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">School Information</h2>
                {!isEditingSchool && (
                  <button
                    onClick={() => setIsEditingSchool(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditingSchool ? (
                <form onSubmit={handleSchoolUpdate}>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        School Name
                      </label>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        defaultValue={schoolData.name}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                        Display Name
                      </label>
                      <input
                        type="text"
                        name="displayName"
                        id="displayName"
                        defaultValue={schoolData.displayName}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email Address
                      </label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        defaultValue={schoolData.email}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        defaultValue={schoolData.phone}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                        Address
                      </label>
                      <textarea
                        name="address"
                        id="address"
                        rows={3}
                        defaultValue={schoolData.address}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                        Website
                      </label>
                      <input
                        type="url"
                        name="website"
                        id="website"
                        defaultValue={schoolData.website}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="themeColor" className="block text-sm font-medium text-gray-700">
                        Theme Color
                      </label>
                      <div className="flex items-center mt-1">
                        <input
                          type="color"
                          name="themeColor"
                          id="themeColor"
                          defaultValue={schoolData.themeColor || '#3b82f6'}
                          className="block h-10 w-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <input
                          type="text"
                          id="themeColorText"
                          defaultValue={schoolData.themeColor || '#3b82f6'}
                          className="ml-2 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          onChange={(e) => {
                            document.getElementById('themeColor').value = e.target.value;
                          }}
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        name="description"
                        id="description"
                        rows={4}
                        defaultValue={schoolData.description}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="establishedYear" className="block text-sm font-medium text-gray-700">
                        Established Year
                      </label>
                      <input
                        type="number"
                        name="establishedYear"
                        id="establishedYear"
                        defaultValue={schoolData.establishedYear}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsEditingSchool(false)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-70 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">School Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{schoolData.name}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Display Name</dt>
                      <dd className="mt-1 text-sm text-gray-900">{schoolData.displayName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Email Address</dt>
                      <dd className="mt-1 text-sm text-gray-900">{schoolData.email}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
                      <dd className="mt-1 text-sm text-gray-900">{schoolData.phone || 'Not provided'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Address</dt>
                      <dd className="mt-1 text-sm text-gray-900">{schoolData.address}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Website</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {schoolData.website ? (
                          <a href={schoolData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                            {schoolData.website}
                          </a>
                        ) : (
                          'Not provided'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Theme Color</dt>
                      <dd className="mt-1 flex items-center">
                        <span 
                          className="w-6 h-6 rounded-full mr-2 border border-gray-300"
                          style={{ backgroundColor: schoolData.themeColor || '#3b82f6' }}
                        ></span>
                        <span className="text-sm text-gray-900">{schoolData.themeColor || '#3b82f6'}</span>
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Description</dt>
                      <dd className="mt-1 text-sm text-gray-900">{schoolData.description || 'No description provided'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Established Year</dt>
                      <dd className="mt-1 text-sm text-gray-900">{schoolData.establishedYear}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Created By</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {schoolData.createdBy ? schoolData.createdBy.name : 'System'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}