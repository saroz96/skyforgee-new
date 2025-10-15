import React from 'react';
import { ListGroup } from 'react-bootstrap';

const CompositionList = ({ compositions, onSelect }) => {
  if (compositions.length === 0) {
    return (
      <div className="text-center py-3 text-muted">
        No compositions found
      </div>
    );
  }

  return (
    <div className="composition-container">
      <div className="composition-header">
        <div className="composition-cell">#</div>
        <div className="composition-cell">Code</div>
        <div className="composition-cell composition-name">Name</div>
      </div>
      
      <ListGroup className="composition-list">
        {compositions.map((composition, index) => (
          <ListGroup.Item
            key={composition._id}
            action
            onClick={() => onSelect(composition)}
            className="composition-row"
            tabIndex={0}
          >
            <div className="composition-cell">{index + 1}</div>
            <div className="composition-cell">{composition.uniqueNumber || 'N/A'}</div>
            <div className="composition-cell composition-name">{composition.name}</div>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  );
};

export default CompositionList;