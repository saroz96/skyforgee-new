import React, { useEffect } from 'react';
import { FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import '../stylesheet/retailer/NotificationToast.css';

const NotificationToast = ({ message, type, show, onClose }) => {
    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => {
                onClose();
            }, 3000);
            
            return () => clearTimeout(timer);
        }
    }, [show, onClose]);

    if (!show) return null;

    return (
        <div className={`notification-toast notification-${type}`}>
            <div className="notification-icon">
                {type === 'success' ? <FiCheckCircle /> : <FiAlertTriangle />}
            </div>
            <div className="notification-content">
                {message}
            </div>
            <div className="notification-progress"></div>
        </div>
    );
};

export default NotificationToast;