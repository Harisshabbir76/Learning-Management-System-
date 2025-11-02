'use client';
import React, { useState, useEffect } from 'react';
import { notificationAPI } from '../../../../../utils/notifications';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const NotificationList = () => {
  const { user, loading: authLoading, unreadCount, fetchUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [gradeNotifications, setGradeNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('all');
  const [showMarkAllConfirm, setShowMarkAllConfirm] = useState(false);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [targetFilter, setTargetFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'grades', 'assignments'
  const router = useRouter();

  const getCurrentIds = () => {
    if (typeof window !== 'undefined') {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const schoolId = pathParts[0];
      const userId = pathParts[1];
      
      return {
        schoolId: schoolId || user?.schoolId,
        userId: userId || user?.userId
      };
    }
    return { schoolId: '', userId: '' };
  };

  useEffect(() => {
    fetchNotifications();
    if (user?.role === 'student') {
      fetchGradeNotifications();
    }
  }, [page, filter, targetFilter, deliveryFilter, activeTab]);

  const fetchGradeNotifications = async () => {
    try {
      const response = await notificationAPI.getGradeNotifications({
        page,
        limit: 10,
        unreadOnly: filter === 'unread'
      });
      
      setGradeNotifications(response.data.data || []);
    } catch (err) {
      console.error('Error fetching grade notifications:', err);
    }
  };

  const canCreateNotifications = () => {
    if (!user) return false;
    
    if (user.role === 'admin') {
      return true;
    }
    
    if (user.role === 'faculty' && user.permissions?.includes('send_notifications')) {
      return true;
    }
    
    return false;
  };

  const canViewAllNotifications = () => {
    if (!user) return false;
    
    if (user.role === 'admin') {
      return true;
    }
    
    if (user.role === 'faculty' && user.permissions?.includes('view_notifications')) {
      return true;
    }
    
    return false;
  };

  const handleCreateNotification = () => {
    const { schoolId, userId } = getCurrentIds();
    if (schoolId && userId) {
      router.push(`/${schoolId}/${userId}/dashboard/notifications/create`);
    } else {
      router.push('/notifications/create');
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 10,
        unreadOnly: filter === 'unread',
        targetType: targetFilter !== 'all' ? targetFilter : undefined
      };

      // Use different endpoint based on user permissions
      const response = canViewAllNotifications()
        ? await notificationAPI.getAllNotifications(params)
        : await notificationAPI.getMyNotifications(params);

      const notificationsWithReadStatus = response.data.data.map((notification: any) => ({
        ...notification,
        isReadByCurrentUser: notification.readBy?.some((entry: any) => 
          entry.user === 'current' || 
          entry.user?._id === 'current' || 
          entry.user === user?._id ||
          entry.user?._id === user?._id
        )
      }));
      
      // Filter by delivery method if needed
      let filteredNotifications = notificationsWithReadStatus;
      if (deliveryFilter !== 'all') {
        filteredNotifications = notificationsWithReadStatus.filter((notification: any) => 
          notification.deliveryMethods?.[deliveryFilter] === true
        );
      }
      
      setNotifications(filteredNotifications);
      fetchUnreadCount();
      setTotalPages(Math.ceil(response.data.pagination?.total / 10) || 1);
      setTotalNotifications(response.data.pagination?.total || 0);
      setError('');
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Error fetching notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await notificationAPI.markAsRead(notificationId);
      
      setNotifications(prev => prev.map(notif =>
        notif._id === notificationId
          ? { 
              ...notif, 
              readBy: [...(notif.readBy || []), { user: user?._id || 'current' }],
              readCount: (notif.readCount || 0) + 1,
              isReadByCurrentUser: true
            }
          : notif
      ));

      // Also update grade notifications if it's a grade notification
      if (gradeNotifications.some(gn => gn._id === notificationId)) {
        setGradeNotifications(prev => prev.map(notif =>
          notif._id === notificationId
            ? { 
                ...notif, 
                readBy: [...(notif.readBy || []), { user: user?._id || 'current' }],
                readCount: (notif.readCount || 0) + 1,
                isReadByCurrentUser: true
              }
            : notif
        ));
      }
      
      fetchUnreadCount();
    } catch (err) {
      console.error('Error marking as read:', err);
      setError('Error marking notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      // For non-students, only mark non-assignment notifications as read
      if (user?.role !== 'student') {
        const nonAssignmentNotifications = notifications.filter(
          (notification: any) => notification.type !== 'assignment'
        );
        
        await Promise.all(
          nonAssignmentNotifications.map(notification => 
            notificationAPI.markAsRead(notification._id)
          )
        );
      } else {
        // Students can mark all as read
        await notificationAPI.markAllRead();
      }
      
      // Update local state
      setNotifications(prev => prev.map(notif => ({
        ...notif,
        isReadByCurrentUser: user?.role === 'student' ? true : notif.type !== 'assignment',
        readBy: user?.role === 'student' 
          ? [...(notif.readBy || []), { user: user?._id || 'current' }]
          : notif.type !== 'assignment' 
            ? [...(notif.readBy || []), { user: user?._id || 'current' }]
            : notif.readBy,
        readCount: user?.role === 'student' 
          ? (notif.readCount || 0) + 1
          : notif.type !== 'assignment' 
            ? (notif.readCount || 0) + 1
            : notif.readCount
      })));

      // Also update grade notifications for students
      if (user?.role === 'student') {
        setGradeNotifications(prev => prev.map(notif => ({
          ...notif,
          isReadByCurrentUser: true,
          readBy: [...(notif.readBy || []), { user: user?._id || 'current' }],
          readCount: (notif.readCount || 0) + 1
        })));
      }
      
      fetchUnreadCount();
      setShowMarkAllConfirm(false);
    } catch (err) {
      console.error('Error marking all as read:', err);
      setError('Error marking notifications as read');
    }
  };

  const refreshNotifications = () => {
    setPage(1);
    fetchNotifications();
    if (user?.role === 'student') {
      fetchGradeNotifications();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'error': return '❌';
      case 'announcement': return '📢';
      case 'reminder': return '⏰';
      case 'assignment': return '📝';
      case 'grade': return '📊';
      default: return 'ℹ️';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#0dcaf0';
      case 'low': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'warning': return '#ffc107';
      case 'success': return '#28a745';
      case 'error': return '#dc3545';
      case 'announcement': return '#17a2b8';
      case 'reminder': return '#6f42c1';
      case 'assignment': return '#20c997';
      case 'grade': return '#e83e8c';
      default: return '#17a2b8';
    }
  };

  const getTargetTypeLabel = (targetType: string) => {
    switch (targetType) {
      case 'all': return 'All Users';
      case 'role': return 'Role-based';
      case 'specific': return 'Specific Users';
      case 'section': return 'Section-based';
      case 'course': return 'Course-based';
      default: return targetType;
    }
  };

  const getTargetDetails = (notification: any) => {
    switch (notification.targetType) {
      case 'role':
        return notification.targetRoles?.join(', ') || 'No roles specified';
      
      case 'specific':
        return notification.specificUsers?.length 
          ? `${notification.specificUsers.length} user(s)` 
          : 'No users specified';
      
      case 'section':
        return notification.sections?.length 
          ? `${notification.sections.length} section(s)` 
          : 'No sections specified';
      
      case 'course':
        return notification.courses?.length 
          ? `${notification.courses.length} course(s)` 
          : 'No courses specified';
      
      default:
        return 'All users';
    }
  };

  const getDeliveryMethods = (notification: any) => {
    const methods = [];
    if (notification.deliveryMethods?.inApp) methods.push('In-App');
    if (notification.deliveryMethods?.push) methods.push('Push');
    if (notification.deliveryMethods?.email) methods.push('Email');
    return methods.length > 0 ? methods.join(', ') : 'In-App';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Get notifications based on active tab
  const getDisplayNotifications = () => {
    switch (activeTab) {
      case 'grades':
        return gradeNotifications;
      case 'assignments':
        return notifications.filter(n => n.type === 'assignment');
      default:
        return notifications;
    }
  };

  // Filter notifications based on search term
  const displayNotifications = getDisplayNotifications();
  const filteredNotifications = displayNotifications.filter((notification: any) => {
    if (!searchTerm) return true;
    
    const term = searchTerm.toLowerCase();
    return (
      notification.title?.toLowerCase().includes(term) ||
      notification.message?.toLowerCase().includes(term) ||
      notification.sender?.name?.toLowerCase().includes(term) ||
      getTargetTypeLabel(notification.targetType).toLowerCase().includes(term) ||
      getTargetDetails(notification).toLowerCase().includes(term) ||
      getDeliveryMethods(notification).toLowerCase().includes(term)
    );
  });

  // Don't show mark all button if there are no readable notifications for non-students
  const hasReadableNotifications = user?.role === 'student' 
    ? filteredNotifications.some(n => !n.isReadByCurrentUser)
    : filteredNotifications.some(n => !n.isReadByCurrentUser && n.type !== 'assignment');

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading user information...</p>
      </div>
    );
  }

  if (loading && page === 1) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="notification-list-container">
      <div className="notification-header">
        <div className="header-content">
          <h1>
            Notifications 
            {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
            {user?.role === 'student' && gradeNotifications.length > 0 && (
              <span className="grade-badge">📊 {gradeNotifications.length} Grades</span>
            )}
          </h1>
          {totalNotifications > 0 && (
            <p className="total-count">{totalNotifications} total notifications</p>
          )}
        </div>
        
        <div className="header-actions">
          {canCreateNotifications() && (
            <button
              onClick={handleCreateNotification}
              className="btn btn-primary create-btn"
            >
              <span className="btn-icon">+</span>
              Create Notification
            </button>
          )}

          <button
            onClick={refreshNotifications}
            className="btn btn-secondary"
          >
            <span className="btn-icon">🔄</span>
            Refresh
          </button>

          {hasReadableNotifications && (
            <button
              onClick={() => setShowMarkAllConfirm(true)}
              className="btn btn-primary mark-all-btn"
              title="Mark all notifications as read"
            >
              <span className="btn-icon">✓</span>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation for Students */}
      {user?.role === 'student' && (
        <div className="notification-tabs">
          <button
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Notifications
          </button>
          <button
            className={`tab ${activeTab === 'grades' ? 'active' : ''}`}
            onClick={() => setActiveTab('grades')}
          >
            📊 Grades ({gradeNotifications.length})
          </button>
          <button
            className={`tab ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignments')}
          >
            📝 Assignments
          </button>
        </div>
      )}

      {/* Search and Filter Section */}
      <div className="filter-section">
        <div className="search-container">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            placeholder="Search notifications..."
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="search-clear"
            >
              ✕
            </button>
          )}
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label className="filter-label">Status:</label>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="all">All Notifications</option>
              <option value="unread">Unread Only</option>
            </select>
          </div>

          {canViewAllNotifications() && (
            <>
              <div className="filter-group">
                <label className="filter-label">Target Type:</label>
                <select
                  value={targetFilter}
                  onChange={(e) => {
                    setTargetFilter(e.target.value);
                    setPage(1);
                  }}
                  className="filter-select"
                >
                  <option value="all">All Types</option>
                  <option value="all">All Users</option>
                  <option value="role">Role-based</option>
                  <option value="specific">Specific Users</option>
                  <option value="section">Section-based</option>
                  <option value="course">Course-based</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Delivery:</label>
                <select
                  value={deliveryFilter}
                  onChange={(e) => {
                    setDeliveryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="filter-select"
                >
                  <option value="all">All Methods</option>
                  <option value="inApp">In-App Only</option>
                  <option value="push">Push Only</option>
                  <option value="email">Email Only</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {showMarkAllConfirm && (
        <div className="modal-overlay">
          <div className="confirmation-modal">
            <h3>Confirm Action</h3>
            <p>
              {user?.role !== 'student' 
                ? `Are you sure you want to mark all non-assignment notifications as read? (Assignment notifications will remain unread)`
                : `Are you sure you want to mark all ${unreadCount} notifications as read?`
              }
            </p>
            <div className="modal-actions">
              <button
                onClick={() => setShowMarkAllConfirm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={markAllAsRead}
                className="btn btn-primary"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <strong>Error:</strong> {error}
            <button
              onClick={refreshNotifications}
              className="alert-action"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      <div className="notifications-grid">
        {filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              {activeTab === 'grades' ? '📊' : activeTab === 'assignments' ? '📝' : '📭'}
            </div>
            <h3>
              {activeTab === 'grades' ? 'No grade notifications' : 
               activeTab === 'assignments' ? 'No assignment notifications' : 
               'No notifications found'}
            </h3>
            <p>
              {searchTerm 
                ? `No notifications match "${searchTerm}"`
                : filter === 'unread' 
                  ? `You have no unread ${activeTab === 'grades' ? 'grade ' : activeTab === 'assignments' ? 'assignment ' : ''}notifications`
                  : `You have no ${activeTab === 'grades' ? 'grade ' : activeTab === 'assignments' ? 'assignment ' : ''}notifications yet`
              }
              {targetFilter !== 'all' && ` for ${getTargetTypeLabel(targetFilter)}`}
              {deliveryFilter !== 'all' && ` with ${deliveryFilter} delivery`}
            </p>
            {(searchTerm || targetFilter !== 'all' || deliveryFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setTargetFilter('all');
                  setDeliveryFilter('all');
                  setFilter('all');
                }}
                className="btn btn-secondary"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const isRead = notification.isReadByCurrentUser;
            const isScheduled = notification.status === 'scheduled';
            const isSent = notification.status === 'sent';
            const isPushSent = notification.pushSent;
            
            // For non-students, assignment notifications are always considered "read" for UI purposes
            const isEffectivelyRead = user?.role !== 'student' && notification.type === 'assignment' 
              ? true 
              : isRead;
            
            return (
              <div
                key={notification._id}
                className={`notification-card ${isEffectivelyRead ? 'read' : 'unread'} ${
                  isScheduled ? 'scheduled' : ''
                } ${user?.role !== 'student' && notification.type === 'assignment' ? 'assignment-notification' : ''}`}
                style={{ borderLeftColor: getPriorityColor(notification.priority) }}
              >
                {!isEffectivelyRead && isSent && !(user?.role !== 'student' && notification.type === 'assignment') && (
                  <button
                    onClick={() => markAsRead(notification._id)}
                    title="Mark as read"
                    className="mark-read-btn"
                  >
                    ✓
                  </button>
                )}

                <div className="notification-content">
                  <div className="notification-header">
                    <h3 className="notification-title">
                      {notification.title}
                      {isScheduled && (
                        <span className="scheduled-badge" title="Scheduled notification">
                          ⏰
                        </span>
                      )}
                      {user?.role !== 'student' && notification.type === 'assignment' && (
                        <span className="student-only-badge" title="Student-only notification">
                          👨‍🎓
                        </span>
                      )}
                      {notification.type === 'grade' && (
                        <span className="grade-badge-small" title="Grade notification">
                          📊
                        </span>
                      )}
                    </h3>
                    <div className="notification-badges">
                      <span 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(notification.priority) }}
                      >
                        {notification.priority}
                      </span>
                      {canViewAllNotifications() && (
                        <span className="target-badge">
                          {getTargetTypeLabel(notification.targetType)}
                        </span>
                      )}
                      {canViewAllNotifications() && notification.deliveryMethods?.push && (
                        <span 
                          className={`push-badge ${isPushSent ? 'sent' : 'pending'}`}
                          title={isPushSent ? 'Push notification sent' : 'Push notification pending'}
                        >
                          📱 {isPushSent ? 'Sent' : 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <p className="notification-message">
                    {notification.message}
                    {user?.role !== 'student' && notification.type === 'assignment' && (
                      <span className="student-only-note">
                        {' '}(Student-only notification)
                      </span>
                    )}
                    {notification.type === 'grade' && notification.metadata && (
                      <span className="grade-details">
                        {' '}
                      </span>
                    )}
                  </p>
                  
                  {/* Delivery methods */}
                  {canViewAllNotifications() && (
                    <div className="delivery-methods-info">
                      <span className="delivery-label">Delivery: </span>
                      <span className="delivery-value">{getDeliveryMethods(notification)}</span>
                    </div>
                  )}
                  
                  {/* Target details section - only show for admin/faculty with view permissions */}
                  {canViewAllNotifications() && (
                    <div className="target-details">
                      <span className="target-label">Target: </span>
                      <span className="target-value">{getTargetDetails(notification)}</span>
                    </div>
                  )}
                  
                  <div className="notification-footer">
                    <div className="notification-meta">
                      <span className="sender">From: {notification.sender?.name || 'System'}</span>
                      <span className="timestamp">
                        {isScheduled 
                          ? `Scheduled for: ${formatDate(notification.scheduledFor)}` 
                          : `Sent: ${formatDate(notification.sentAt || notification.createdAt)}`
                        }
                      </span>
                      {notification.expiresAt && (
                        <span className="expires">
                          Expires: {formatDate(notification.expiresAt)}
                        </span>
                      )}
                    </div>
                    
                    {isSent && notification.readCount > 0 && canViewAllNotifications() && (
                      <div className="read-stats">
                        <span className="stats-text">
                          {notification.readCount} of {notification.totalRecipients} read
                        </span>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ 
                              width: `${(notification.readCount / notification.totalRecipients) * 100}%`,
                              backgroundColor: getPriorityColor(notification.priority)
                            }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div 
                  className="notification-icon"
                  style={{ color: getTypeColor(notification.type) }}
                >
                  {getIcon(notification.type)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setPage(prev => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="pagination-btn"
          >
            Previous
          </button>

          <div className="pagination-pages">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = page <= 3 ? i + 1 : 
                            page >= totalPages - 2 ? totalPages - 4 + i :
                            page - 2 + i;
              if (pageNum < 1 || pageNum > totalPages) return null;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`pagination-page ${page === pageNum ? 'active' : ''}`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      )}

      {loading && page > 1 && (
        <div className="loading-more">
          <div className="loading-spinner small"></div>
          Loading more notifications...
        </div>
      )}

      <style jsx>{`
        .notification-list-container {
          padding: 2rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin: 1.5rem 0;
          min-height: 600px;
        }
        
        .notification-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .header-content h1 {
          margin: 0 0 0.5rem 0;
          color: #2d3748;
          font-size: 1.75rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        
        .unread-badge {
          background: #e53e3e;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
        }
        
        .grade-badge {
          background: #e83e8c;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 600;
        }
        
        .total-count {
          margin: 0;
          color: #718096;
          font-size: 0.875rem;
        }
        
        .header-actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        
        .notification-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .tab {
          padding: 0.75rem 1.5rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: #718096;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .tab:hover {
          color: #4299e1;
        }
        
        .tab.active {
          color: #4299e1;
          border-bottom-color: #4299e1;
          background: #ebf8ff;
        }
        
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1.25rem;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          gap: 0.5rem;
        }
        
        .btn-primary {
          background: #4299e1;
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #3182ce;
          transform: translateY(-1px);
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
        
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .btn-icon {
          font-size: 1rem;
        }
        
        .create-btn {
          background: #38a169;
        }
        
        .create-btn:hover:not(:disabled) {
          background: #2f855a;
        }
        
        .mark-all-btn:disabled {
          background: #a0aec0;
        }
        
        .filter-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }
        
        .search-container {
          position: relative;
          max-width: 400px;
        }
        
        .search-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.5rem;
          border: 1px solid #cbd5e0;
          border-radius: 8px;
          font-size: 0.875rem;
          background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23718096' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E") no-repeat 1rem center;
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
        
        .filter-controls {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }
        
        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .filter-label {
          font-weight: 500;
          color: #4a5568;
          font-size: 0.875rem;
        }
        
        .filter-select {
          padding: 0.5rem 2rem 0.5rem 0.75rem;
          border: 1px solid #cbd5e0;
          border-radius: 6px;
          font-size: 0.875rem;
          background: white;
          cursor: pointer;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        
        .confirmation-modal {
          background: white;
          padding: 2rem;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          max-width: 400px;
          width: 100%;
        }
        
        .confirmation-modal h3 {
          margin: 0 0 1rem 0;
          color: #2d3748;
        }
        
        .confirmation-modal p {
          margin: 0 0 1.5rem 0;
          color: #718096;
        }
        
        .modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
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
        
        .alert-icon {
          margin-right: 0.75rem;
          font-size: 1.25rem;
        }
        
        .alert-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        
        .alert-action {
          background: none;
          border: 1px solid #c53030;
          color: #c53030;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .alert-action:hover {
          background: #c53030;
          color: white;
        }
        
        .notifications-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .notification-card {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.5rem;
          border-radius: 12px;
          background: white;
          border-left: 4px solid;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          transition: all 0.2s;
          position: relative;
        }
        
        .notification-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          transform: translateY(-1px);
        }
        
        .notification-card.unread {
          background: #ebf8ff;
        }
        
        .notification-card.scheduled {
          background: #fffaf0;
          opacity: 0.8;
        }
        
        .notification-card.assignment-notification {
          background: #f0fff4;
          opacity: 0.7;
        }
        
        .mark-read-btn {
          background: none;
          border: 1px solid #4299e1;
          color: #4299e1;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1rem;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        
        .mark-read-btn:hover {
          background: #4299e1;
          color: white;
        }
        
        .notification-content {
          flex: 1;
          min-width: 0;
        }
        
        .notification-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }
        
        .notification-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #2d3748;
          line-height: 1.4;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .scheduled-badge, .student-only-badge, .grade-badge-small {
          font-size: 0.75rem;
          opacity: 0.7;
        }
        
        .student-only-badge {
          color: #38a169;
        }
        
        .grade-badge-small {
          color: #e83e8c;
        }
        
        .notification-badges {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        
        .priority-badge, .target-badge, .push-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 500;
          color: white;
        }
        
        .target-badge {
          background: #6c757d;
        }
        
        .push-badge {
          background: #6f42c1;
          font-size: 0.7rem;
        }
        
        .push-badge.pending {
          background: #fd7e14;
        }
        
        .push-badge.sent {
          background: #28a745;
        }
        
        .notification-message {
          margin: 0 0 1rem 0;
          color: #4a5568;
          line-height: 1.5;
          font-size: 0.875rem;
        }
        
        .student-only-note {
          color: #38a169;
          font-style: italic;
          font-size: 0.8rem;
        }
        
        .grade-details {
          color: #e83e8c;
          font-weight: 600;
          font-size: 0.8rem;
        }
        
        .delivery-methods-info {
          margin: 0.5rem 0;
          padding: 0.25rem 0.5rem;
          background: #f8f9fa;
          border-radius: 4px;
          font-size: 0.75rem;
          color: #6c757d;
          display: inline-block;
        }
        
        .delivery-label {
          font-weight: 600;
          margin-right: 0.25rem;
        }
        
        .target-details {
          margin: 0.5rem 0;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 6px;
          font-size: 0.75rem;
          color: #6c757d;
        }
        
        .target-label {
          font-weight: 600;
          margin-right: 0.25rem;
        }
        
        .target-value {
          font-style: italic;
        }
        
        .notification-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .notification-meta {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        
        .sender, .timestamp, .expires {
          font-size: 0.75rem;
          color: #718096;
        }
        
        .expires {
          color: #e53e3e;
          font-style: italic;
        }
        
        .read-stats {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .stats-text {
          font-size: 0.75rem;
          color: #718096;
          white-space: nowrap;
        }
        
        .progress-bar {
          width: 60px;
          height: 6px;
          background: #e2e8f0;
          border-radius: 3px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }
        
        .notification-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
          margin-top: 0.25rem;
        }
        
        .empty-state {
          text-align: center;
          padding: 3rem 1rem;
          color: #718096;
        }
        
        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }
        
        .empty-state h3 {
          margin: 0 0 0.5rem 0;
          color: #4a5568;
          font-weight: 500;
        }
        
        .empty-state p {
          margin: 0 0 1.5rem 0;
        }
        
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1rem;
          margin-top: 2rem;
          flex-wrap: wrap;
        }
        
        .pagination-btn {
          padding: 0.5rem 1rem;
          border: 1px solid #cbd5e0;
          background: white;
          color: #4a5568;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s;
        }
        
        .pagination-btn:hover:not(:disabled) {
          border-color: #4299e1;
          color: #4299e1;
        }
        
        .pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .pagination-pages {
          display: flex;
          gap: 0.25rem;
        }
        
        .pagination-page {
          padding: 0.5rem 0.75rem;
          border: 1px solid #cbd5e0;
          background: white;
          color: #4a5568;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.875rem;
          min-width: 40px;
          transition: all 0.2s;
        }
        
        .pagination-page:hover {
          border-color: #4299e1;
          color: #4299e1;
        }
        
        .pagination-page.active {
          background: #4299e1;
          border-color: #4299e1;
          color: white;
        }
        
        .loading-more {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1.5rem;
          color: #718096;
          font-size: 0.875rem;
        }
        
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem;
          color: #718096;
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top: 3px solid #4299e1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }
        
        .loading-spinner.small {
          width: 20px;
          height: 20px;
          border-width: 2px;
          margin-bottom: 0;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .notification-list-container {
            padding: 1rem;
            margin: 1rem 0;
          }
          
          .notification-header {
            flex-direction: column;
            align-items: stretch;
          }
          
          .header-actions {
            justify-content: center;
          }
          
          .notification-tabs {
            flex-direction: column;
          }
          
          .filter-controls {
            flex-direction: column;
            align-items: stretch;
          }
          
          .filter-group {
            justify-content: space-between;
          }
          
          .notification-footer {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .pagination {
            flex-direction: column;
            gap: 0.75rem;
          }
          
          .pagination-pages {
            order: -1;
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationList;
