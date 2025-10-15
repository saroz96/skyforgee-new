import React, { useState, useEffect, useRef } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import CompositionList from './CompositionList';
import RelatedItemsModal from './RelatedItemsModal';
import './composition.css';

const CompositionModal = ({ show, onHide }) => {
  const [compositions, setCompositions] = useState([]);
  const [allCompositions, setAllCompositions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComposition, setSelectedComposition] = useState(null);
  const [showRelatedItems, setShowRelatedItems] = useState(false);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (show) {
      fetchCompositions();
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  }, [show]);

  const fetchCompositions = async () => {
    try {
      const response = await fetch('/api/retailer/compositions');
      const data = await response.json();
      setCompositions(data);
      setAllCompositions(data);
    } catch (error) {
      console.error('Error fetching composition details:', error);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    
    const filtered = allCompositions.filter(composition =>
      composition.name.toLowerCase().includes(query) ||
      (composition.uniqueNumber && composition.uniqueNumber.toString().toLowerCase().includes(query))
    );
    setCompositions(filtered);
  };

  const handleCompositionSelect = (composition) => {
    setSelectedComposition(composition);
    setShowRelatedItems(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onHide();
    }
    // Add more keyboard navigation as needed
  };

  return (
    <>
      <Modal 
        show={show} 
        onHide={onHide} 
        size="lg"
        onKeyDown={handleKeyDown}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Composition Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Control
              type="text"
              placeholder="Search compositions by name or code..."
              value={searchQuery}
              onChange={handleSearch}
              ref={searchInputRef}
              autoFocus
            />
          </Form.Group>
          
          <CompositionList 
            compositions={compositions} 
            onSelect={handleCompositionSelect}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {selectedComposition && (
        <RelatedItemsModal
          show={showRelatedItems}
          onHide={() => setShowRelatedItems(false)}
          composition={selectedComposition}
        />
      )}
    </>
  );
};

export default CompositionModal;