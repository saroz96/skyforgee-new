import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import Header from '../retailer/Header';
import NotificationToast from '../NotificationToast';
import { FaUsers, FaUserPlus, FaSearch, FaEye, FaLock, FaEdit, FaUserSlash, FaUserCheck, FaSave } from 'react-icons/fa';
import { Tooltip, OverlayTrigger } from 'react-bootstrap';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const UserList = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [company, setCompany] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    const [currentUser, setCurrentUser] = useState({
        isAdminOrSupervisor: false,
        theme: 'light'
    });
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });

    const api = axios.create({
        baseURL: process.env.REACT_APP_API_BASE_URL,
        withCredentials: true,
    });

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await api.get('/api/auth/admin/users/list');
                if (response.data.success) {
                    setUsers(response.data.data.users);
                    setCompany(response.data.data.company);
                    setCurrentUser({
                        isAdminOrSupervisor: response.data.data.isAdminOrSupervisor,
                        theme: response.data.data.currentUser.theme
                    });
                } else {
                    setError(response.data.error);
                    if (response.status === 403) {
                        navigate('/dashboard');
                    }
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Failed to load users');
                if (err.response?.status === 403) {
                    navigate('/dashboard');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    const handleRoleChange = async (userId, newRole) => {
        try {
            const response = await api.post(`/api/auth/admin/users/${userId}/role`, { role: newRole });
            if (response.data.success) {
                setUsers(users.map(user => 
                    user.id === userId ? { ...user, role: newRole } : user
                ));
                showNotification('User role updated successfully', 'success');
            }
        } catch (err) {
            showNotification(err.response?.data?.error || 'Failed to update user role', 'error');
        }
    };

    const toggleUserStatus = async (userId, activate) => {
        const action = activate ? 'activate' : 'deactivate';
        if (!window.confirm(`Are you sure you want to ${action} this user?`)) {
            return;
        }

        try {
            const response = await api.post(`/api/auth/admin/users/${userId}/${action}`);
            if (response.data.success) {
                setUsers(users.map(user => 
                    user.id === userId ? { ...user, isActive: activate } : user
                ));
                showNotification(`User ${activate ? 'activated' : 'deactivated'} successfully`, 'success');
            }
        } catch (err) {
            showNotification(err.response?.data?.error || `Failed to ${action} user`, 'error');
        }
    };

    const showNotification = (message, type) => {
        setNotification({
            show: true,
            message,
            type
        });
    };

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedUsers = [...users].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    });

    const filteredUsers = sortedUsers.filter(user => {
        const searchLower = searchTerm.toLowerCase();
        return (
            user.name.toLowerCase().includes(searchLower) ||
            user.email.toLowerCase().includes(searchLower) ||
            user.role.toLowerCase().includes(searchLower)
        );
    });

    const renderTooltip = (text) => (
        <Tooltip id="button-tooltip">{text}</Tooltip>
    );

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? '↑' : '↓';
    };

    if (loading) {
        return (
            <div className='Container-fluid'>
                <Header />
                <div className="container user-management-container mt-4">
                    <div className="card user-management-card">
                        <div className="card-header">
                            <Skeleton height={30} width={200} />
                        </div>
                        <div className="card-body">
                            <Skeleton count={5} height={50} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className='Container-fluid'>
                <Header />
                <div className="container mt-4">
                    <div className="alert alert-danger">
                        <div className="d-flex align-items-center">
                            <i className="fas fa-exclamation-circle me-2"></i>
                            <div>{error}</div>
                        </div>
                        <button 
                            className="btn btn-sm btn-outline-danger mt-2"
                            onClick={() => window.location.reload()}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='Container-fluid'>
            <Header />
            <div className="container user-management-container mt-4">
                <div className="card user-management-card shadow-sm">
                    <div className="card-header bg-white border-bottom-0">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <h1 className="card-title mb-0">
                                <FaUsers className="me-2" />
                                User Management
                                {company && (
                                    <small className="text-muted ms-2">
                                        {company.name}
                                    </small>
                                )}
                            </h1>
                            <div className="d-flex gap-2">
                                <div className="search-container flex-grow-1">
                                    <div className="input-group">
                                        <span className="input-group-text bg-white">
                                            <FaSearch />
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control border-start-0"
                                            placeholder="Search users..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Link 
                                    to="/auth/admin/create-user/new" 
                                    className="btn btn-primary d-flex align-items-center"
                                >
                                    <FaUserPlus className="me-2" />
                                    Add User
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="card-body p-0">
                        {filteredUsers.length === 0 ? (
                            <div className="empty-state text-center py-5">
                                <div className="mb-3">
                                    <FaUsers size={48} className="text-muted" />
                                </div>
                                <h4 className="mb-2">No Users Found</h4>
                                <p className="text-muted mb-4">
                                    {searchTerm ? 
                                        'No users match your search criteria' : 
                                        'There are currently no users in the system'}
                                </p>
                                <Link 
                                    to="/auth/admin/create-user/new" 
                                    className="btn btn-primary"
                                >
                                    <FaUserPlus className="me-2" />
                                    Create New User
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div className="table-responsive">
                                    <table className="table table-hover mb-0">
                                        <thead className="table-light">
                                            <tr>
                                                <th 
                                                    className="cursor-pointer"
                                                    onClick={() => requestSort('name')}
                                                >
                                                    User {renderSortIcon('name')}
                                                </th>
                                                <th 
                                                    className="cursor-pointer"
                                                    onClick={() => requestSort('email')}
                                                >
                                                    Email {renderSortIcon('email')}
                                                </th>
                                                <th 
                                                    className="cursor-pointer"
                                                    onClick={() => requestSort('role')}
                                                >
                                                    Role {renderSortIcon('role')}
                                                </th>
                                                <th 
                                                    className="cursor-pointer"
                                                    onClick={() => requestSort('isActive')}
                                                >
                                                    Status {renderSortIcon('isActive')}
                                                </th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map(user => (
                                                <tr key={user.id} className={!user.isActive ? 'opacity-75' : ''}>
                                                    <td>
                                                        <div className="d-flex align-items-center">
                                                            <div 
                                                                className="user-avatar d-flex align-items-center justify-content-center"
                                                                style={{ 
                                                                    backgroundColor: user.isOwner ? '#6f42c1' : '#0d6efd',
                                                                    color: 'white'
                                                                }}
                                                            >
                                                                {user.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="fw-medium">
                                                                    {user.name}
                                                                    {user.isOwner && (
                                                                        <span className="badge bg-primary ms-2">Owner</span>
                                                                    )}
                                                                </div>
                                                                <small className="text-muted d-block">
                                                                    Joined {new Date(user.createdAt).toLocaleDateString()}
                                                                </small>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="d-flex align-items-center">
                                                            <span className="text-truncate" style={{ maxWidth: '200px' }}>
                                                                {user.email}
                                                            </span>
                                                            {user.isEmailVerified ? (
                                                                <span className="badge bg-success ms-2">Verified</span>
                                                            ) : (
                                                                <span className="badge bg-warning text-dark ms-2">Not Verified</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {user.isOwner ? (
                                                            <span className="badge bg-primary">Owner</span>
                                                        ) : currentUser.isAdminOrSupervisor ? (
                                                            <div className="d-flex align-items-center">
                                                                <select
                                                                    className="form-select form-select-sm me-2"
                                                                    value={user.role}
                                                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                                >
                                                                    <option value="User">User</option>
                                                                    <option value="Sales">Sales</option>
                                                                    <option value="Purchase">Purchase</option>
                                                                    <option value="Account">Account</option>
                                                                    <option value="Supervisor">Supervisor</option>
                                                                    <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                                                                </select>
                                                                <OverlayTrigger
                                                                    placement="top"
                                                                    overlay={renderTooltip('Save Role')}
                                                                >
                                                                    <button 
                                                                        className="btn btn-primary btn-sm"
                                                                        onClick={() => handleRoleChange(user.id, user.role)}
                                                                    >
                                                                        <FaSave size={12} />
                                                                    </button>
                                                                </OverlayTrigger>
                                                            </div>
                                                        ) : (
                                                            <span className="badge bg-secondary">
                                                                {user.role}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${user.isActive ? 'bg-success' : 'bg-danger'}`}>
                                                            {user.isActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        <div className="d-flex justify-content-end gap-1">
                                                            <OverlayTrigger
                                                                placement="top"
                                                                overlay={renderTooltip('View User')}
                                                            >
                                                                <Link 
                                                                    to={`/auth/users/view/${user.id}`} 
                                                                    className="btn btn-sm btn-outline-primary"
                                                                >
                                                                    <FaEye />
                                                                </Link>
                                                            </OverlayTrigger>
                                                            <OverlayTrigger
                                                                placement="top"
                                                                overlay={renderTooltip('Permissions')}
                                                            >
                                                                <Link
                                                                    to={`/auth/admin/users/user-permissions/${user.id}`}
                                                                    className="btn btn-sm btn-outline-primary"
                                                                >
                                                                    <FaLock />
                                                                </Link>
                                                            </OverlayTrigger>
                                                            {currentUser.isAdminOrSupervisor && !user.isOwner && (
                                                                <>
                                                                    <OverlayTrigger
                                                                        placement="top"
                                                                        overlay={renderTooltip('Edit User')}
                                                                    >
                                                                        <Link
                                                                            to={`/admin/users/edit/${user.id}`}
                                                                            className="btn btn-sm btn-outline-warning"
                                                                        >
                                                                            <FaEdit />
                                                                        </Link>
                                                                    </OverlayTrigger>
                                                                    {user.isActive ? (
                                                                        <OverlayTrigger
                                                                            placement="top"
                                                                            overlay={renderTooltip('Deactivate User')}
                                                                        >
                                                                            <button
                                                                                className="btn btn-sm btn-outline-danger"
                                                                                onClick={() => toggleUserStatus(user.id, false)}
                                                                            >
                                                                                <FaUserSlash />
                                                                            </button>
                                                                        </OverlayTrigger>
                                                                    ) : (
                                                                        <OverlayTrigger
                                                                            placement="top"
                                                                            overlay={renderTooltip('Activate User')}
                                                                        >
                                                                            <button
                                                                                className="btn btn-sm btn-outline-success"
                                                                                onClick={() => toggleUserStatus(user.id, true)}
                                                                            >
                                                                                <FaUserCheck />
                                                                            </button>
                                                                        </OverlayTrigger>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-3 border-top">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div className="text-muted">
                                            Showing <span className="fw-semibold">{filteredUsers.length}</span> of{' '}
                                            <span className="fw-semibold">{users.length}</span> user{users.length !== 1 ? 's' : ''}
                                        </div>
                                        <Link 
                                            to="/auth/admin/create-user/new" 
                                            className="btn btn-outline-primary btn-sm"
                                        >
                                            <FaUserPlus className="me-2" />
                                            Add Another User
                                        </Link>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <NotificationToast
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ ...notification, show: false })}
            />
        </div>
    );
};

export default UserList;