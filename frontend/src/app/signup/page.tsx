// SignUp.tsx - Complete component with form data handling
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  LockClosedIcon, 
  EnvelopeIcon, 
  AcademicCapIcon, 
  UserIcon, 
  BuildingLibraryIcon,
  PhoneIcon,
  MapPinIcon,
  GlobeAltIcon,
  CalendarIcon,
  SwatchIcon,
  DocumentTextIcon,
  PhotoIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  userId: string;
  schoolName: string;
  displayName: string;
  contactEmail: string;
  phone: string;
  schoolAddress: string;
  website: string;
  establishedYear: string;
  themeColor: string;
  description: string;
}

export default function SignUp() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    userId: '',
    schoolName: '',
    displayName: '',
    contactEmail: '',
    phone: '',
    schoolAddress: '',
    website: '',
    establishedYear: '',
    themeColor: '#3b82f6',
    description: ''
  });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  const toggleConfirmPasswordVisibility = () => {
    setConfirmPasswordVisible(!confirmPasswordVisible);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const nextStep = () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword || !formData.userId) {
        toast.error('Please fill all required fields');
        return;
      }
      
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
      
      if (formData.password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      
      const userIdNum = parseInt(formData.userId);
      if (isNaN(userIdNum) || userIdNum < 1000 || userIdNum > 999999) {
        toast.error('User ID must be a number between 1000 and 999999');
        return;
      }
    }
    
    if (currentStep === 2) {
      if (!formData.schoolName || !formData.displayName || !formData.contactEmail || !formData.phone || !formData.schoolAddress) {
        toast.error('Please fill all required school information');
        return;
      }
    }
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // Final validation
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match!');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters long!');
      setLoading(false);
      return;
    }

    const userIdNum = parseInt(formData.userId);
    if (isNaN(userIdNum) || userIdNum < 1000 || userIdNum > 999999) {
      toast.error('User ID must be a number between 1000 and 999999!');
      setLoading(false);
      return;
    }

    try {
      // Create form data
      const submitData = new FormData();
      
      // Append all form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (value) submitData.append(key, value);
      });
      
      // Append role
      submitData.append('role', 'admin');

      // Append logo file if selected
      if (fileInputRef.current?.files?.[0]) {
        submitData.append('logo', fileInputRef.current.files[0]);
      }

      // Send request to server
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        body: submitData
        // Don't set Content-Type header - browser will set it automatically with boundary
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Account created successfully!');
        // Store token in localStorage
        localStorage.setItem('token', data.token);
        // Redirect to dashboard on success
        router.push(`/${data.school._id}/${data.user.userId}/dashboard`);
      } else {
        toast.error(`Signup failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('An error occurred during signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex justify-center mb-8">
      <div className="flex items-center">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep === step
                  ? 'bg-indigo-600 text-white'
                  : currentStep > step
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}
            >
              {step}
            </div>
            {step < 3 && (
              <div
                className={`w-16 h-1 mx-2 ${
                  currentStep > step ? 'bg-green-500' : 'bg-gray-300'
                }`}
              ></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderStepText = () => {
    const steps = [
      'User Information',
      'School Information',
      'Review & Submit'
    ];
    return (
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">
          Step {currentStep}: {steps[currentStep - 1]}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {currentStep === 1 && 'Enter your personal information'}
          {currentStep === 2 && 'Enter your school details'}
          {currentStep === 3 && 'Review and submit your information'}
        </p>
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Full Name <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <UserIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="John Doe"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email Address <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <EnvelopeIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">
          Password <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LockClosedIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            required
            value={formData.password}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Must be at least 8 characters"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="text-gray-400 hover:text-gray-500"
            >
              {passwordVisible ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LockClosedIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={confirmPasswordVisible ? "text" : "password"}
            required
            value={formData.confirmPassword}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Confirm your password"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              type="button"
              onClick={toggleConfirmPasswordVisibility}
              className="text-gray-400 hover:text-gray-500"
            >
              {confirmPasswordVisible ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
          User ID <span className="text-red-500">*</span>
        </label>
        <div className="mt-1">
          <input
            id="userId"
            name="userId"
            type="number"
            required
            min="1000"
            max="999999"
            value={formData.userId}
            onChange={handleInputChange}
            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Must be between 1000 and 999999"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700">
          School Name <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <BuildingLibraryIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="schoolName"
            name="schoolName"
            type="text"
            required
            value={formData.schoolName}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Your School Name"
          />
        </div>
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
          Display Name <span className="text-red-500">*</span>
        </label>
        <div className="mt-1">
          <input
            id="displayName"
            name="displayName"
            type="text"
            required
            value={formData.displayName}
            onChange={handleInputChange}
            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Display Name"
          />
        </div>
      </div>

      <div>
        <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700">
          School Email <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <EnvelopeIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            value={formData.contactEmail}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="school@example.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <PhoneIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            value={formData.phone}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="+1 (555) 123-4567"
          />
        </div>
      </div>

      <div>
        <label htmlFor="schoolAddress" className="block text-sm font-medium text-gray-700">
          School Address <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 pt-2 flex items-start pointer-events-none">
            <MapPinIcon className="h-5 w-5 text-gray-400" />
          </div>
          <textarea
            id="schoolAddress"
            name="schoolAddress"
            rows={2}
            required
            value={formData.schoolAddress}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Full school address"
          />
        </div>
      </div>

      <div>
        <label htmlFor="website" className="block text-sm font-medium text-gray-700">
          Website
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <GlobeAltIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="website"
            name="website"
            type="url"
            value={formData.website}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="https://yourschool.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="establishedYear" className="block text-sm font-medium text-gray-700">
          Established Year
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="establishedYear"
            name="establishedYear"
            type="number"
            min="1900"
            max="2023"
            value={formData.establishedYear}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="1990"
          />
        </div>
      </div>

      <div>
        <label htmlFor="themeColor" className="block text-sm font-medium text-gray-700">
          Theme Color
        </label>
        <div className="mt-1 relative flex items-center gap-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SwatchIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            id="themeColor"
            name="themeColor"
            type="color"
            value={formData.themeColor}
            onChange={handleInputChange}
            className="appearance-none block w-10 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          <span className="text-sm text-gray-500 ml-2">
            {formData.themeColor}
          </span>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 pt-2 flex items-start pointer-events-none">
            <DocumentTextIcon className="h-5 w-5 text-gray-400" />
          </div>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Brief description about your school"
          />
        </div>
      </div>

      <div>
        <label htmlFor="logo" className="block text-sm font-medium text-gray-700">
          School Logo
        </label>
        <div className="mt-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <PhotoIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            ref={fileInputRef}
            id="logo"
            name="logo"
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Max file size: 5MB. Supported formats: JPG, PNG, GIF</p>
        {logoPreview && (
          <div className="mt-2 flex justify-center">
            <img src={logoPreview} alt="Logo preview" className="h-24 w-24 object-contain border rounded" />
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-md">
        <h4 className="text-lg font-medium text-gray-900 mb-3">User Information</h4>
        <div className="space-y-2">
          <p><span className="font-medium">Name:</span> {formData.name}</p>
          <p><span className="font-medium">Email:</span> {formData.email}</p>
          <p><span className="font-medium">User ID:</span> {formData.userId}</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-md">
        <h4 className="text-lg font-medium text-gray-900 mb-3">School Information</h4>
        <div className="space-y-2">
          <p><span className="font-medium">School Name:</span> {formData.schoolName}</p>
          <p><span className="font-medium">Display Name:</span> {formData.displayName}</p>
          <p><span className="font-medium">Contact Email:</span> {formData.contactEmail}</p>
          <p><span className="font-medium">Phone:</span> {formData.phone}</p>
          <p><span className="font-medium">Address:</span> {formData.schoolAddress}</p>
          {formData.website && <p><span className="font-medium">Website:</span> {formData.website}</p>}
          {formData.establishedYear && <p><span className="font-medium">Established Year:</span> {formData.establishedYear}</p>}
          <p><span className="font-medium">Theme Color:</span> 
            <span 
              className="inline-block w-4 h-4 ml-2 rounded-full"
              style={{ backgroundColor: formData.themeColor }}
            ></span>
          </p>
          {formData.description && <p><span className="font-medium">Description:</span> {formData.description}</p>}
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <AcademicCapIcon className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              By signing up, you'll be created as an Administrator for your school with full privileges.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <AcademicCapIcon className="mx-auto h-12 w-12 text-indigo-600" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your school account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Or{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              sign in to an existing account
            </Link>
          </p>
        </div>

        <div className="bg-white py-8 px-4 shadow rounded-lg sm:px-10">
          {renderStepIndicator()}
          {renderStepText()}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            <div className="flex justify-between">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1 || loading}
                className={`py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  currentStep === 1 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <ArrowLeftIcon className="h-4 w-4 inline mr-1" />
                Previous
              </button>
              
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Next
                  <ArrowRightIcon className="h-4 w-4 inline ml-1" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}