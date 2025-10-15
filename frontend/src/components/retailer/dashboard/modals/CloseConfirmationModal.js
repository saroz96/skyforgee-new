import React from 'react';

const ConfirmationModal = ({ 
    show, 
    onClose, 
    onConfirm, 
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = "warning", // warning, danger, info, success
    details = null
}) => {
    if (!show) return null;

    const getHeaderColor = () => {
        switch (type) {
            case 'danger': return 'bg-danger text-white';
            case 'success': return 'bg-success text-white';
            case 'info': return 'bg-info text-white';
            default: return 'bg-warning text-dark';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'danger': return '❌';
            case 'success': return '✅';
            case 'info': return 'ℹ️';
            default: return '⚠️';
        }
    };

    return (
        <div className="modal fade show" style={{
            display: 'block',
            backgroundColor: 'rgba(0,0,0,0.7)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1060
        }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content" style={{ 
                    border: type === 'danger' ? '3px solid #dc3545' : 
                           type === 'success' ? '3px solid #28a745' : 
                           '3px solid #ffc107'
                }}>
                    {/* Modal Header */}
                    <div className={`modal-header ${getHeaderColor()}`}>
                        <h5 className="modal-title">
                            {getIcon()} {title}
                        </h5>
                        <button
                            type="button"
                            className={`btn-close ${type === 'warning' || type === 'info' ? '' : 'btn-close-white'}`}
                            onClick={onClose}
                        ></button>
                    </div>

                    {/* Modal Body */}
                    <div className="modal-body">
                        <div className={`alert alert-${type} mb-3`}>
                            <strong>{message}</strong>
                        </div>
                        
                        {details && (
                            <div className="details-section">
                                {details}
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                        >
                            {cancelText}
                        </button>
                        <button
                            type="button"
                            className={`btn ${
                                type === 'danger' ? 'btn-danger' :
                                type === 'success' ? 'btn-success' :
                                'btn-warning'
                            }`}
                            onClick={onConfirm}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;