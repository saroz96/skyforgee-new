import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import RelatedItemsList from './RelatedItemsList';
import './composition.css';

const RelatedItemsModal = ({ show, onHide, composition }) => {
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (show && composition) {
      fetchRelatedItems();
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [show, composition]);

  const fetchRelatedItems = async () => {
    try {
      const response = await fetch(`/api/retailer/items?composition=${composition._id}`);
      const data = await response.json();
      setItems(data);
      setAllItems(data);
    } catch (error) {
      console.error('Error fetching related items:', error);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    
    const filtered = allItems.filter(item =>
      item.name.toLowerCase().includes(query) ||
      (item.uniqueNumber && item.uniqueNumber.toString().toLowerCase().includes(query)) ||
      (item.category?.name && item.category.name.toLowerCase().includes(query))
    );
    setItems(filtered);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onHide();
    }
    // Add more keyboard navigation as needed
  };

  return (
    <Modal 
      show={show} 
      onHide={onHide} 
      size="lg"
      onKeyDown={handleKeyDown}
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="selected-composition-name">{composition.name}</span>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3">
          <Form.Control
            type="text"
            placeholder="Search items by name or code..."
            value={searchQuery}
            onChange={handleSearch}
            ref={searchInputRef}
            autoFocus
          />
        </Form.Group>
        
        <RelatedItemsList items={items} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RelatedItemsModal;