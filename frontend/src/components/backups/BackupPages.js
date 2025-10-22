import React, { useState, useEffect } from 'react';
import axios from 'axios';
import MongoDumpBackupButton from './mongoDumpBackupButton';
import Header from '../retailer/Header';
import NotificationToast from '../NotificationToast';
import JsonBackupButton from './JsonBackupButton';

const BackupPages = () => {
    const [notification, setNotification] = useState({
        show: false,
        message: '',
        type: 'success'
    });
    return (
        <div className="Container-fluid">
            <Header />
            <div className="container settings-container mt-4">
                <MongoDumpBackupButton />
                <JsonBackupButton />
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

export default BackupPages;