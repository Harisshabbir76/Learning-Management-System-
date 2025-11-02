"use client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface Assignment {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  maxMarks: number;
  fileUrl: string;
  course: string;
}

interface AssignmentEditProps {
  assignment: Assignment | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedAssignment: Assignment) => void;
  schoolID: string;
  userID: string;
  courseId: string;
}

export default function AssignmentEdit({
  assignment,
  isOpen,
  onClose,
  onSave,
  schoolID,
  userID,
  courseId
}: AssignmentEditProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    maxMarks: "",
    file: null as File | null
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (assignment) {
      setFormData({
        title: assignment.title || "",
        description: assignment.description || "",
        dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 16) : "",
        maxMarks: assignment.maxMarks?.toString() || "",
        file: null
      });
    }
  }, [assignment]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({
      ...prev,
      file
    }));
  };

  // Enhanced download handler function
  const handleDownloadCurrentFile = async () => {
    if (!assignment?.fileUrl) {
      toast.error("No file available to download");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please log in first");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const fullUrl = `${apiUrl}${assignment.fileUrl}`;
      
      console.log("Attempting to download from:", fullUrl);
      
      const response = await fetch(fullUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`File not found. Please check if the file exists at: ${assignment.fileUrl}`);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      
      // Check if blob is empty
      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Extract filename from URL or use a default
      const downloadName = assignment.title || assignment.fileUrl.split('/').pop() || 'assignment-file';
      a.download = downloadName;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('File downloaded successfully');
    } catch (error: any) {
      console.error('Download failed:', error);
      toast.error(error.message || 'Failed to download file');
      
      // Fallback: try to open the file in a new tab
      try {
        if (assignment?.fileUrl) {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
          const fullUrl = `${apiUrl}${assignment.fileUrl}`;
          window.open(fullUrl, '_blank');
        }
      } catch (fallbackError) {
        console.error("Fallback download also failed:", fallbackError);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assignment) return;

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Please log in first");
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("dueDate", new Date(formData.dueDate).toISOString());
      formDataToSend.append("maxMarks", formData.maxMarks);
      formDataToSend.append("course", courseId);
      
      if (formData.file) {
        formDataToSend.append("file", formData.file);
      }

      // Use the correct endpoint - /api/assignments/:id
      const res = await fetch(
        `${apiUrl}/api/assignments/${assignment._id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            // Don't set Content-Type header when using FormData
            // The browser will set it automatically with the correct boundary
          },
          body: formDataToSend
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success) {
        toast.success("Assignment updated successfully!");
        onSave(data.data);
        onClose();
      } else {
        toast.error(data.message || "Failed to update assignment");
      }
    } catch (err: any) {
      console.error("Error updating assignment:", err);
      toast.error(err.message || "Error updating assignment");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Edit Assignment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Assignment Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter assignment title"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter assignment description"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
                Due Date *
              </label>
              <input
                type="datetime-local"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="maxMarks" className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Marks *
              </label>
              <input
                type="number"
                id="maxMarks"
                name="maxMarks"
                value={formData.maxMarks}
                onChange={handleInputChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter maximum marks"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-1">
              Update Assignment File (Optional)
            </label>
            <input
              type="file"
              id="file"
              name="file"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              accept=".pdf,.doc,.docx,.txt,.zip,image/*"
              disabled={loading}
            />
            <p className="text-sm text-gray-500 mt-1">
              Leave empty to keep current file. Allowed types: PDF, DOC, DOCX, TXT, ZIP, Images
            </p>
          </div>

          {assignment?.fileUrl && (
            <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Assignment File
              </label>
              <button
                type="button"
                onClick={handleDownloadCurrentFile}
                className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-2 rounded-md"
                disabled={loading}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Current File
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Click to download the current assignment file
              </p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                "Update Assignment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}