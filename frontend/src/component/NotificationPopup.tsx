"use client";

import React, { useEffect, useState } from 'react';
import { useNotification } from '@/context/NotificationContext';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { FiX, FiBell, FiCheck } from 'react-icons/fi';

const NotificationPopup = () => {
  const { showPopup, setShowPopup, newNotification, markAsRead } = useNotification();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (showPopup && newNotification) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setShowPopup(false), 300);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [showPopup, newNotification, setShowPopup]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => setShowPopup(false), 300);
  };

  const handleMarkAsRead = () => {
    if (newNotification) {
      markAsRead(newNotification._id);
      handleClose();
    }
  };

  if (!showPopup || !newNotification || !user) {
    return null;
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 w-80 bg-white rounded-lg shadow-lg border-l-4 ${
      getPriorityColor(newNotification.priority)
    } border-l-4 transform transition-all duration-300 ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    } z-50`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <FiBell className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">New Notification</span>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 text-sm mb-1">
            {newNotification.title}
          </h3>
          <p className="text-gray-600 text-sm line-clamp-2">
            {newNotification.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleMarkAsRead}
              className="flex items-center gap-1 px-2 py-1 text-xs text-green-700 bg-green-50 rounded hover:bg-green-100 transition-colors"
            >
              <FiCheck className="h-3 w-3" />
              Mark read
            </button>
            <Link 
              href={`/${user.school_id}/${user.id}/dashboard/notifications`}
              className="px-2 py-1 text-xs text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
              onClick={handleClose}
            >
              View all
            </Link>
          </div>
          <span className="text-xs text-gray-500">
            Just now
          </span>
        </div>
      </div>
    </div>
  );
};

export default NotificationPopup;