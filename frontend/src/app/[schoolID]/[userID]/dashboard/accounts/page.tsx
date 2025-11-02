'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface User {
  _id: string;
  name: string;
  email: string;
  userId: number;
  role: string;
  roleProfile?: {
    fees?: number;
    feesHistory?: Array<{
      amount: number;
      date: string;
      status: string;
    }>;
    salary?: number;
    salaryHistory?: Array<{
      amount: number;
      date: string;
      status: string;
    }>;
    permissions?: string[];
  };
  school?: {
    _id: string;
    name: string;
    displayName?: string;
  };
  permissions?: string[];
}

interface DueDateConfig {
  _id?: string;
  dayOfMonth: number;
  lastApplied: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}

export default function UserManagement() {
  const params = useParams();
  const router = useRouter();
  const schoolID = params.schoolID as string;
  const userID = params.userID as string;
  
  const [users, setUsers] = useState<User[]>([]);
  const [dueDateConfig, setDueDateConfig] = useState<DueDateConfig>({ 
    dayOfMonth: 1, 
    lastApplied: null 
  });
  const [activeTab, setActiveTab] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState<{message: string, type: string} | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDueDateModal, setShowDueDateModal] = useState(false);

  // Financial stats state
  const [financialStats, setFinancialStats] = useState({
    totalIncome: 0,
    totalSalaryExpenses: 0,
    netBalance: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalFaculty: 0,
    totalAdmins: 0,
    pendingStudents: 0,
    pendingStaff: 0
  });

  // API base URL
  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  // Check if API_BASE is defined
  useEffect(() => {
    if (!API_BASE) {
      console.error('API_BASE is not defined');
      setAlert({ message: 'Configuration error: API URL not set', type: 'error' });
    }
  }, [API_BASE]);

  // Fetch users from backend
  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/users?includeRoleData=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const result: ApiResponse<User[]> = await response.json();
      
      if (result.success && result.data) {
        setUsers(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setAlert({ message: 'Failed to load users', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch due date configuration
  const fetchDueDateConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/due-date-config`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result: ApiResponse<DueDateConfig> = await response.json();
        if (result.success && result.data) {
          setDueDateConfig(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching due date config:', error);
    }
  };

  // Save due date configuration
  const saveDueDateConfig = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const dayOfMonth = parseInt((document.getElementById('dueDateSelect') as HTMLSelectElement)?.value || '1');
      
      const response = await fetch(`${API_BASE}/api/due-date-config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dayOfMonth })
      });
      
      const result: ApiResponse<DueDateConfig> = await response.json();
      
      if (result.success && result.data) {
        setDueDateConfig(result.data);
        setShowDueDateModal(false);
        setAlert({ message: 'Due date configuration saved successfully', type: 'success' });
      } else {
        throw new Error(result.message || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving due date config:', error);
      setAlert({ message: 'Failed to save due date configuration', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Manual reset of all payments
  const manualResetPayments = async () => {
    if (!confirm('Are you sure you want to reset all payments to pending? This will affect all users.')) return;
    
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/due-date-config/reset-now`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result: ApiResponse<any> = await response.json();
      
      if (result.success) {
        setAlert({ message: result.message || 'All payments reset to pending successfully', type: 'success' });
        fetchUsers(); // Refresh the user list
        fetchDueDateConfig(); // Refresh due date config
      } else {
        throw new Error(result.message || 'Failed to reset payments');
      }
    } catch (error) {
      console.error('Error resetting payments:', error);
      setAlert({ message: 'Failed to reset payments', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Mark fee as paid
  const markAsPaid = async (userId: string) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/users/${userId}/fees`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'paid' })
      });
      
      const result: ApiResponse<any> = await response.json();
      
      if (result.success) {
        setAlert({ message: 'Payment status updated successfully', type: 'success' });
        fetchUsers(); // Refresh the user list
      } else {
        throw new Error(result.message || 'Failed to update payment status');
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      setAlert({ message: 'Failed to update payment status', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Mark salary as paid
  const markSalaryAsPaid = async (userId: string) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/users/${userId}/salary`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'paid' })
      });
      
      const result: ApiResponse<any> = await response.json();
      
      if (result.success) {
        setAlert({ message: 'Salary marked as paid successfully', type: 'success' });
        
        // Update the user's salary status locally instead of refetching all users
        setUsers(prevUsers => 
          prevUsers.map(user => {
            if (user._id === userId && user.roleProfile) {
              const updatedRoleProfile = {
                ...user.roleProfile,
                salaryHistory: [
                  {
                    amount: user.roleProfile.salary || 0,
                    date: new Date().toISOString(),
                    status: 'paid'
                  },
                  ...(user.roleProfile.salaryHistory || [])
                ]
              };
              
              return {
                ...user,
                roleProfile: updatedRoleProfile
              };
            }
            return user;
          })
        );
      } else {
        throw new Error(result.message || 'Failed to update salary status');
      }
    } catch (error) {
      console.error('Error marking salary as paid:', error);
      setAlert({ 
        message: error instanceof Error ? error.message : 'Failed to update salary status', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mark all fees as paid
  const markAllFeesAsPaid = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      // Get all pending students
      const pendingStudents = users.filter(user => 
        user.role === 'student' && getPaymentStatus(user).status === 'pending'
      );
      
      // Update each student
      for (const student of pendingStudents) {
        await fetch(`${API_BASE}/api/users/${student._id}/fees`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'paid' })
        });
      }
      
      setAlert({ message: `Marked ${pendingStudents.length} student fees as paid`, type: 'success' });
      fetchUsers(); // Refresh the user list
    } catch (error) {
      console.error('Error marking all fees as paid:', error);
      setAlert({ message: 'Failed to mark all fees as paid', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Mark all salaries as paid
  const markAllSalariesAsPaid = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      // Get all pending staff
      const pendingStaff = users.filter(user => 
        ['teacher', 'faculty', 'admin'].includes(user.role) && 
        getPaymentStatus(user).status === 'pending'
      );
      
      // Update each staff member
      for (const staff of pendingStaff) {
        await fetch(`${API_BASE}/api/users/${staff._id}/salary`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'paid' })
        });
      }
      
      setAlert({ message: `Marked ${pendingStaff.length} staff salaries as paid`, type: 'success' });
      fetchUsers(); // Refresh the user list
    } catch (error) {
      console.error('Error marking all salaries as paid:', error);
      setAlert({ message: 'Failed to mark all salaries as paid', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result: ApiResponse<any> = await response.json();
      
      if (result.success) {
        setAlert({ message: 'User deleted successfully', type: 'success' });
        fetchUsers(); // Refresh the user list
      } else {
        throw new Error(result.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setAlert({ message: 'Failed to delete user', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect to users dashboard
  const redirectToUsersDashboard = () => {
    router.push(`/${schoolID}/${userID}/dashboard/users`);
  };

  useEffect(() => {
    fetchUsers();
    fetchDueDateConfig();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      const stats = updateStats();
      setFinancialStats(stats);
    }
  }, [users]);

  // Get payment status for any user type
  const getPaymentStatus = (user: User) => {
    if (user.role === 'student') {
      const feesHistory = user.roleProfile?.feesHistory;
      if (!feesHistory || feesHistory.length === 0) {
        return { status: 'pending', date: null, type: 'fee' };
      }
      const latestPayment = feesHistory[0];
      return { status: latestPayment.status, date: latestPayment.date, type: 'fee' };
    } 
    else if (['teacher', 'faculty', 'admin'].includes(user.role)) {
      const salaryHistory = user.roleProfile?.salaryHistory;
      if (!salaryHistory || salaryHistory.length === 0) {
        return { status: 'pending', date: null, type: 'salary' };
      }
      const latestSalary = salaryHistory[0];
      return { status: latestSalary.status, date: latestSalary.date, type: 'salary' };
    }
    return { status: 'unknown', date: null, type: 'none' };
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const updateStats = () => {
    const students = users.filter(user => user.role === 'student');
    const teachers = users.filter(user => user.role === 'teacher');
    const faculty = users.filter(user => user.role === 'faculty');
    const admins = users.filter(user => user.role === 'admin');
    
    let totalIncome = 0;
    let totalSalaryExpenses = 0;
    
    // Calculate income from student fees (only count paid fees)
    students.forEach(student => {
      const feeAmount = student.roleProfile?.fees || 0;
      const paymentStatus = getPaymentStatus(student);
      
      if (paymentStatus.status === 'paid') {
        totalIncome += feeAmount;
      }
    });
    
    // Calculate salary expenses (only count paid salaries)
    const allStaff = [...teachers, ...faculty, ...admins];
    allStaff.forEach(staff => {
      const salaryAmount = staff.roleProfile?.salary || 0;
      const salaryStatus = getPaymentStatus(staff);
      
      if (salaryStatus.status === 'paid') {
        totalSalaryExpenses += salaryAmount;
      }
    });
    
    const netBalance = totalIncome - totalSalaryExpenses;
    
    return {
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalFaculty: faculty.length,
      totalAdmins: admins.length,
      totalIncome,
      totalSalaryExpenses,
      netBalance,
      pendingStudents: students.filter(s => getPaymentStatus(s).status === 'pending').length,
      pendingStaff: allStaff.filter(s => getPaymentStatus(s).status === 'pending').length
    };
  };

  // Check if today is the due date
  const areFeesDue = () => {
    const today = new Date();
    return today.getDate() === dueDateConfig.dayOfMonth;
  };

  const students = users.filter(user => user.role === 'student');
  const staff = users.filter(user => ['teacher', 'faculty', 'admin'].includes(user.role));
  
  const canMarkAllFeesPaid = students.filter(s => getPaymentStatus(s).status === 'pending').length > 0;
  const canMarkAllSalariesPaid = staff.filter(s => getPaymentStatus(s).status === 'pending').length > 0;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 pb-6 border-b border-gray-300">
          <h1 className="text-3xl font-bold text-indigo-600">User Management</h1>
          <div className="flex gap-4">
            <button 
              className="flex items-center gap-2 px-4 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors"
              onClick={() => setShowDueDateModal(true)}
            >
              <span>📅</span> Due Date: Day {dueDateConfig.dayOfMonth}
            </button>
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              onClick={redirectToUsersDashboard}
            >
              <span>➕</span> Add New User
            </button>
          </div>
        </header>

        {alert && (
          <div className={`p-4 rounded-md mb-6 flex justify-between items-center ${
            alert.type === 'error' 
              ? 'bg-red-100 text-red-700 border-l-4 border-red-500' 
              : 'bg-green-100 text-green-700 border-l-4 border-green-500'
          }`}>
            <div>{alert.message}</div>
            <button 
              className="text-xl"
              onClick={() => setAlert(null)}
            >
              &times;
            </button>
          </div>
        )}

        {/* Payment Status Indicators */}
        {financialStats.pendingStudents > 0 && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
            <p>{financialStats.pendingStudents} student(s) have pending fees</p>
          </div>
        )}

        {financialStats.pendingStaff > 0 && (
          <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-4">
            <p>{financialStats.pendingStaff} staff member(s) have pending salaries</p>
          </div>
        )}

        {areFeesDue() && (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4">
            <p>Today is the due date (Day {dueDateConfig.dayOfMonth}). Payments will be reset to pending.</p>
            <button 
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              onClick={manualResetPayments}
            >
              Reset Payments Now
            </button>
          </div>
        )}

        {/* User Count Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm text-gray-500 mb-2">Total Students</h3>
            <div className="text-2xl font-bold">{financialStats.totalStudents}</div>
            {financialStats.pendingStudents > 0 && (
              <div className="text-sm text-yellow-600 mt-1">{financialStats.pendingStudents} pending</div>
            )}
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm text-gray-500 mb-2">Total Teachers</h3>
            <div className="text-2xl font-bold">{financialStats.totalTeachers}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm text-gray-500 mb-2">Total Faculty</h3>
            <div className="text-2xl font-bold">{financialStats.totalFaculty}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm text-gray-500 mb-2">Total Admins</h3>
            <div className="text-2xl font-bold">{financialStats.totalAdmins}</div>
          </div>
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-green-500">
            <h3 className="text-sm text-gray-500 mb-2">Total Income</h3>
            <div className="text-2xl font-bold">${financialStats.totalIncome.toFixed(2)}</div>
            <div className="text-sm text-gray-500 mt-1">From student fees</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-red-500">
            <h3 className="text-sm text-gray-500 mb-2">Salary Expenses</h3>
            <div className="text-2xl font-bold">${financialStats.totalSalaryExpenses.toFixed(2)}</div>
            <div className="text-sm text-gray-500 mt-1">To staff members</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-500">
            <h3 className="text-sm text-gray-500 mb-2">Net Balance</h3>
            <div className={`text-2xl font-bold ${
              financialStats.netBalance >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${financialStats.netBalance.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {financialStats.netBalance >= 0 ? 'Surplus' : 'Deficit'}
            </div>
          </div>
        </div>

        <div className="flex border-b border-gray-300 mb-6">
          <button 
            className={`px-6 py-3 ${activeTab === 'all' ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium' : 'text-gray-500'}`}
            onClick={() => setActiveTab('all')}
          >
            All Users
          </button>
          <button 
            className={`px-6 py-3 ${activeTab === 'students' ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium' : 'text-gray-500'}`}
            onClick={() => setActiveTab('students')}
          >
            Students
          </button>
          <button 
            className={`px-6 py-3 ${activeTab === 'staff' ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium' : 'text-gray-500'}`}
            onClick={() => setActiveTab('staff')}
          >
            Staff
          </button>
          <button 
            className={`px-6 py-3 ${activeTab === 'payments' ? 'border-b-2 border-indigo-600 text-indigo-600 font-medium' : 'text-gray-500'}`}
            onClick={() => setActiveTab('payments')}
          >
            Payment Management
          </button>
        </div>

        {activeTab === 'all' && (
          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex flex-col">
                <label className="text-sm text-gray-500 mb-1">Role</label>
                <select 
                  className="p-2 border border-gray-300 rounded-md bg-white"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                  <option value="faculty">Faculty</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-sm text-gray-500 mb-1">Status</label>
                <select 
                  className="p-2 border border-gray-300 rounded-md bg-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-indigo-100 text-indigo-600">
                    <th className="p-4 text-left">User ID</th>
                    <th className="p-4 text-left">Name</th>
                    <th className="p-4 text-left">Email</th>
                    <th className="p-4 text-left">Role</th>
                    <th className="p-4 text-left">Amount</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Last Payment</th>
                    <th className="p-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <div className="flex justify-center">
                          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        </div>
                      </td>
                    </tr>
                  ) : users
                    .filter(user => roleFilter === 'all' || user.role === roleFilter)
                    .filter(user => {
                      if (statusFilter === 'all') return true;
                      const paymentStatus = getPaymentStatus(user);
                      return paymentStatus.status === statusFilter;
                    })
                    .map(user => {
                      const isStudent = user.role === 'student';
                      const isStaff = ['teacher', 'faculty', 'admin'].includes(user.role);
                      const amount = user.roleProfile?.[isStudent ? 'fees' : 'salary'] || 0;
                      
                      const paymentStatus = getPaymentStatus(user);
                      
                      return (
                        <tr key={user._id} className="border-t border-gray-200">
                          <td className="p-4">{user.userId}</td>
                          <td className="p-4">{user.name}</td>
                          <td className="p-4">{user.email}</td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-gray-200 rounded-full text-sm">{user.role}</span>
                          </td>
                          <td className="p-4">
                            {isStudent || isStaff ? `$${amount.toFixed(2)}` : 'N/A'}
                          </td>
                          <td className="p-4">
                            {isStudent || isStaff ? (
                              <span className={`px-3 py-1 rounded-full text-xs ${
                                paymentStatus.status === 'paid' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {paymentStatus.status.toUpperCase()}
                              </span>
                            ) : 'N/A'}
                          </td>
                          <td className="p-4">
                            {paymentStatus.date ? formatDate(paymentStatus.date) : 'Never'}
                          </td>
                          <td className="p-4 flex gap-2">
                            {isStudent && (
                              <button 
                                className={`px-3 py-1 rounded-md text-sm ${
                                  paymentStatus.status === 'paid' 
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                                disabled={paymentStatus.status === 'paid'}
                                onClick={() => markAsPaid(user._id)}
                              >
                                Mark Paid
                              </button>
                            )}
                            {isStaff && (
                              <button 
                                className={`px-3 py-1 rounded-md text-sm ${
                                  paymentStatus.status === 'paid' 
                                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                                disabled={paymentStatus.status === 'paid'}
                                onClick={() => markSalaryAsPaid(user._id)}
                              >
                                Pay Salary
                              </button>
                            )}
                            <button 
                              className="px-3 py-1 rounded-md text-sm bg-red-600 text-white hover:bg-red-700"
                              onClick={() => deleteUser(user._id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-indigo-100 text-indigo-600">
                  <th className="p-4 text-left">Student ID</th>
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Email</th>
                  <th className="p-4 text-left">Fee Amount</th>
                  <th className="p-4 text-left">Payment Status</th>
                  <th className="p-4 text-left">Last Payment</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                      </div>
                    </td>
                  </tr>
                ) : students.map(student => {
                  const paymentStatus = getPaymentStatus(student);
                  const feeAmount = student.roleProfile?.fees || 0;
                  
                  return (
                    <tr key={student._id} className="border-t border-gray-200">
                      <td className="p-4">{student.userId}</td>
                      <td className="p-4">{student.name}</td>
                      <td className="p-4">{student.email}</td>
                      <td className="p-4">${feeAmount.toFixed(2)}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs ${
                          paymentStatus.status === 'paid' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {paymentStatus.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4">
                        {paymentStatus.date ? formatDate(paymentStatus.date) : 'Never'}
                      </td>
                      <td className="p-4 flex gap-2">
                        <button 
                          className={`px-3 py-1 rounded-md text-sm ${
                            paymentStatus.status === 'paid' 
                              ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                          disabled={paymentStatus.status === 'paid'}
                          onClick={() => markAsPaid(student._id)}
                        >
                          Mark Paid
                        </button>
                        <button 
                          className="px-3 py-1 rounded-md text-sm bg-red-600 text-white hover:bg-red-700"
                          onClick={() => deleteUser(student._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-indigo-100 text-indigo-600">
                  <th className="p-4 text-left">Staff ID</th>
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Email</th>
                  <th className="p-4 text-left">Role</th>
                  <th className="p-4 text-left">Salary Amount</th>
                  <th className="p-4 text-left">Salary Status</th>
                  <th className="p-4 text-left">Last Payment</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <div className="flex justify-center">
                          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        </div>
                      </td>
                    </tr>
                  ) : staff.map(staffMember => {
                    const paymentStatus = getPaymentStatus(staffMember);
                    const salaryAmount = staffMember.roleProfile?.salary || 0;
                    
                    return (
                      <tr key={staffMember._id} className="border-t border-gray-200">
                        <td className="p-4">{staffMember.userId}</td>
                        <td className="p-4">{staffMember.name}</td>
                        <td className="p-4">{staffMember.email}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-gray-200 rounded-full text-sm">{staffMember.role}</span>
                        </td>
                        <td className="p-4">${salaryAmount.toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs ${
                            paymentStatus.status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {paymentStatus.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          {paymentStatus.date ? formatDate(paymentStatus.date) : 'Never'}
                        </td>
                        <td className="p-4 flex gap-2">
                          <button 
                            className={`px-3 py-1 rounded-md text-sm ${
                              paymentStatus.status === 'paid' 
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                            disabled={paymentStatus.status === 'paid'}
                            onClick={() => markSalaryAsPaid(staffMember._id)}
                          >
                            Pay Salary
                          </button>
                          <button 
                            className="px-3 py-1 rounded-md text-sm bg-red-600 text-white hover:bg-red-700"
                            onClick={() => deleteUser(staffMember._id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'payments' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Payment Management</h2>
              <div className="flex gap-2">
                <button 
                  className={`flex items-center gap-2 px-4 py-2 rounded-md ${
                    canMarkAllFeesPaid 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                      : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  }`}
                  disabled={!canMarkAllFeesPaid}
                  onClick={markAllFeesAsPaid}
                >
                  <span>💰</span> Mark All Fees Paid
                </button>
                <button 
                  className={`flex items-center gap-2 px-4 py-2 rounded-md ${
                    canMarkAllSalariesPaid 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  }`}
                  disabled={!canMarkAllSalariesPaid}
                  onClick={markAllSalariesAsPaid}
                >
                  <span>💵</span> Pay All Salaries
                </button>
                <button 
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  onClick={manualResetPayments}
                >
                  <span>🔄</span> Reset All Payments
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
              <h3 className="p-4 bg-gray-100 text-lg font-semibold">Student Fee Payments</h3>
              <table className="w-full">
                <thead>
                  <tr className="bg-indigo-50 text-indigo-600">
                    <th className="p-4 text-left">Student ID</th>
                    <th className="p-4 text-left">Name</th>
                    <th className="p-4 text-left">Fee Amount</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Due Date</th>
                    <th className="p-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <div className="flex justify-center">
                          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                        </div>
                      </td>
                    </tr>
                  ) : students.map(student => {
                    const paymentStatus = getPaymentStatus(student);
                    const feeAmount = student.roleProfile?.fees || 0;
                    
                    return (
                      <tr key={student._id} className="border-t border-gray-200">
                        <td className="p-4">{student.userId}</td>
                        <td className="p-4">{student.name}</td>
                        <td className="p-4">${feeAmount.toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs ${
                            paymentStatus.status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {paymentStatus.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">Day {dueDateConfig.dayOfMonth} of each month</td>
                        <td className="p-4">
                          <button 
                            className={`px-3 py-1 rounded-md text-sm ${
                              paymentStatus.status === 'paid' 
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                            disabled={paymentStatus.status === 'paid'}
                            onClick={() => markAsPaid(student._id)}
                          >
                            Mark Paid
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <h3 className="p-4 bg-gray-100 text-lg font-semibold">Staff Salary Payments</h3>
              <table className="w-full">
                <thead>
                  <tr className="bg-green-50 text-green-600">
                    <th className="p-4 text-left">Staff ID</th>
                    <th className="p-4 text-left">Name</th>
                    <th className="p-4 text-left">Role</th>
                    <th className="p-4 text-left">Salary Amount</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <div className="flex justify-center">
                          <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                        </div>
                      </td>
                    </tr>
                  ) : staff.map(staffMember => {
                    const paymentStatus = getPaymentStatus(staffMember);
                    const salaryAmount = staffMember.roleProfile?.salary || 0;
                    
                    return (
                      <tr key={staffMember._id} className="border-t border-gray-200">
                        <td className="p-4">{staffMember.userId}</td>
                        <td className="p-4">{staffMember.name}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-gray-200 rounded-full text-sm">{staffMember.role}</span>
                        </td>
                        <td className="p-4">${salaryAmount.toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs ${
                            paymentStatus.status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {paymentStatus.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          <button 
                            className={`px-3 py-1 rounded-md text-sm ${
                              paymentStatus.status === 'paid' 
                                ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                            disabled={paymentStatus.status === 'paid'}
                            onClick={() => markSalaryAsPaid(staffMember._id)}
                          >
                            Pay Salary
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}

        {/* Due Date Modal */}
        {showDueDateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Configure Due Date</h2>
                <button 
                  className="text-2xl"
                  onClick={() => setShowDueDateModal(false)}
                >
                  &times;
                </button>
              </div>
              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Set the day of the month when fees and salaries will be automatically reset to unpaid status.
                </p>
                <div className="flex flex-col">
                  <label className="text-sm text-gray-500 mb-1">Day of Month</label>
                  <select 
                    id="dueDateSelect"
                    className="p-2 border border-gray-300 rounded-md bg-white"
                    defaultValue={dueDateConfig.dayOfMonth}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-3 text-gray-500 text-sm">
                  {dueDateConfig.lastApplied 
                    ? `Last applied: ${dueDateConfig.lastApplied ? formatDate(dueDateConfig.lastApplied) : 'Never'}` 
                    : 'Not applied yet'}
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50"
                  onClick={() => setShowDueDateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  onClick={saveDueDateConfig}
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}