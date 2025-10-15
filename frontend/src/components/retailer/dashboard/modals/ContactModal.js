import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import axios from 'axios';
import '../../../../stylesheet/retailer/dashboard/modals/ContactModal.css';
import { usePageNotRefreshContext } from '../../PageNotRefreshContext';

const ContactModal = ({ show, onHide }) => {
    const { contactDraftSave, setContactDraftSave } = usePageNotRefreshContext();
    const [contacts, setContacts] = useState([]);
    const [filteredContacts, setFilteredContacts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentFocus, setCurrentFocus] = useState(0);
    const [loadingState, setLoadingState] = useState({
        isLoading: !contactDraftSave,
        error: null,
        isFresh: false
    });
    const listRef = useRef(null);
    const rowRefs = useRef([]);
    const searchInputRef = useRef(null);

    useEffect(() => {
        if (!loadingState.isLoading && contactDraftSave && contactDraftSave.contacts) {
            setContacts(contactDraftSave.contacts);
            setFilteredContacts(contactDraftSave.contacts);
        }
    }, [loadingState.isLoading, contactDraftSave]);

    useEffect(() => {
        if (show) {
            fetchContacts();
            const interval = setInterval(fetchContacts, 300000); // 5 minutes
            return () => clearInterval(interval);
        }
    }, [show]);

    const fetchContacts = async () => {
        if (!contactDraftSave) {
            setLoadingState(prev => ({ ...prev, isLoading: true }));
        }

        try {
            const response = await axios.get('/api/retailer/contacts');
            // Handle both response formats - check if data has success property
            const responseData = response.data;

            if (responseData.success) {
                // Format: { success: true, data: [...] }
                const freshContacts = responseData.data || [];
                setContacts(freshContacts);
                // Only update filteredContacts if there's no active search
                if (!searchQuery) {
                    setFilteredContacts(freshContacts);
                }
                setContactDraftSave({ contacts: freshContacts });
                setLoadingState({ isLoading: false, error: null, isFresh: true });
            } else {
                // Format: direct array response
                const freshContacts = Array.isArray(responseData) ? responseData : [];
                setContacts(freshContacts);
                if (!searchQuery) {
                    setFilteredContacts(freshContacts);
                }
                setContactDraftSave({ contacts: freshContacts });
                setLoadingState({ isLoading: false, error: null, isFresh: true });
            }
        } catch (error) {
            console.error('Error fetching contacts:', error);
            if (!contactDraftSave) {
                setLoadingState({
                    isLoading: false,
                    error: error.response?.data?.error || 'Error fetching contacts. Please try again.',
                    isFresh: false
                });
            }
        }
    };

    const handleSearch = (e) => {
        const query = e.target.value.toLowerCase();
        setSearchQuery(query);

        // Determine which data source to use for filtering
        const sourceContacts = loadingState.isFresh ? contacts :
            (contactDraftSave?.contacts || contacts);

        const filtered = (sourceContacts || []).filter(contact =>
            (contact.name && contact.name.toLowerCase().includes(query)) ||
            (contact.address && contact.address.toLowerCase().includes(query)) ||
            (contact.phone && contact.phone.toLowerCase().includes(query)) ||
            (contact.email && contact.email.toLowerCase().includes(query)) ||
            (contact.contactperson && contact.contactperson.toLowerCase().includes(query))
        );
        setFilteredContacts(filtered);
        setCurrentFocus(0);
    };

    const handleKeyDown = (e) => {
        const currentFilteredContacts = filteredContacts || [];
        if (currentFilteredContacts.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextFocus = (currentFocus + 1) % currentFilteredContacts.length;
            setCurrentFocus(nextFocus);
            // Ensure the focused item is visible
            scrollToItem(nextFocus);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const nextFocus = (currentFocus - 1 + currentFilteredContacts.length) % currentFilteredContacts.length;
            setCurrentFocus(nextFocus);
            // Ensure the focused item is visible
            scrollToItem(nextFocus);
        } else if (e.key === 'Enter' && currentFilteredContacts[currentFocus]) {
            e.preventDefault();
            selectContact(currentFilteredContacts[currentFocus]);
        } else if (e.key === 'Escape') {
            onHide();
        }
    };

    // Scroll to ensure the focused item is visible
    const scrollToItem = (index) => {
        if (rowRefs.current[index] && listRef.current) {
            const rowElement = rowRefs.current[index];
            const listContainer = listRef.current;

            // Calculate positions
            const rowTop = rowElement.offsetTop;
            const rowBottom = rowTop + rowElement.offsetHeight;
            const containerTop = listContainer.scrollTop;
            const containerBottom = containerTop + listContainer.clientHeight;

            // Check if the row is not fully visible
            if (rowTop < containerTop) {
                // Row is above the visible area
                listContainer.scrollTop = rowTop;
            } else if (rowBottom > containerBottom) {
                // Row is below the visible area
                listContainer.scrollTop = rowBottom - listContainer.clientHeight;
            }
        }
    };

    const selectContact = (contact) => {
        console.log('Selected contact:', contact);
        onHide();
    };

    // Determine which data to display with proper null checks
    const displayContacts = loadingState.isFresh ? contacts :
        (contactDraftSave?.contacts || contacts || []);

    const displayFilteredContacts = loadingState.isFresh ?
        (searchQuery ? (filteredContacts || []) : (contacts || [])) :
        (contactDraftSave?.contacts ?
            (searchQuery ?
                (contactDraftSave.contacts || []).filter(contact =>
                    (contact.name && contact.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (contact.address && contact.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (contact.phone && contact.phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
                    (contact.contactperson && contact.contactperson.toLowerCase().includes(searchQuery.toLowerCase()))
                ) :
                (contactDraftSave.contacts || [])
            ) :
            (filteredContacts || []));

    // Safe length check
    const displayCount = displayFilteredContacts ? displayFilteredContacts.length : 0;

    if (loadingState.isLoading && !contactDraftSave) {
        return (
            <Modal show={show} onHide={onHide} size="lg" centered backdrop="static" dialogClassName="modal-custom-width">
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title>Contact Details</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-flex justify-content-center align-items-center" style={{ height: '600px' }}>
                    <div className="text-center">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-2">Loading contacts...</p>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }

    if (loadingState.error && !contactDraftSave) {
        return (
            <Modal show={show} onHide={onHide} size="lg" centered backdrop="static" dialogClassName="modal-custom-width">
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title>Contact Details</Modal.Title>
                </Modal.Header>
                <Modal.Body className="d-flex justify-content-center align-items-center" style={{ height: '600px' }}>
                    <div className="alert alert-danger">
                        {loadingState.error}
                        <button className="btn btn-sm btn-danger ms-2" onClick={fetchContacts}>
                            Retry
                        </button>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }

    return (
        <Modal
            show={show}
            onHide={onHide}
            size="lg"
            onKeyDown={handleKeyDown}
            centered
            backdrop="static"
            dialogClassName="modal-custom-width"
        >
            <Modal.Header closeButton className="bg-primary text-white">
                <Modal.Title>Contact Details</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{
                overflowY: 'auto',
                height: '600px',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <Form.Group className="mb-4">
                    <Form.Control
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search contacts by name, address, phone, email or contact person..."
                        value={searchQuery}
                        onChange={handleSearch}
                        autoFocus
                        className="search-input"
                        autoComplete='off'
                        onKeyDown={handleKeyDown}
                    />
                </Form.Group>

                <div
                    style={{
                        overflow: 'hidden',
                        flex: '1',
                        minHeight: '200px',
                        position: 'relative'
                    }}
                    tabIndex="0"
                    onKeyDown={handleKeyDown}
                >
                    <div className="contacts-container">
                        <div className="contacts-header">
                            <div className="contact-cell header-cell">Name</div>
                            <div className="contact-cell header-cell">Address</div>
                            <div className="contact-cell header-cell">Phone</div>
                            <div className="contact-cell header-cell">Email</div>
                            <div className="contact-cell header-cell">Contact Person</div>
                        </div>
                        <div
                            className="contacts-list"
                            ref={listRef}
                            style={{
                                maxHeight: '400px',
                                overflowY: 'auto',
                                position: 'relative'
                            }}
                        >
                            {displayCount === 0 ? (
                                <div className="contact-row text-center py-4 text-muted">
                                    {searchQuery ? 'No contacts match your search' : 'No contacts available'}
                                </div>
                            ) : (
                                displayFilteredContacts.map((contact, index) => (
                                    <div
                                        key={index}
                                        ref={el => rowRefs.current[index] = el}
                                        className={`contact-row ${index === currentFocus ? 'active' : ''}`}
                                        onClick={() => selectContact(contact)}
                                    >
                                        <div className="contact-cell">{contact.name || 'N/A'}</div>
                                        <div className="contact-cell">{contact.address || 'N/A'}</div>
                                        <div className="contact-cell">{contact.phone || 'N/A'}</div>
                                        <div className="contact-cell">{contact.email || 'N/A'}</div>
                                        <div className="contact-cell">{contact.contactperson || 'N/A'}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer className="d-flex justify-content-between">
                <div className="text-muted small">
                    {displayCount} contact{displayCount !== 1 ? 's' : ''} found
                    {contactDraftSave && !loadingState.isFresh && (
                        <span className="ms-2 text-info">
                            • Using saved data
                        </span>
                    )}
                </div>
                <Button variant="danger" onClick={onHide}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ContactModal;