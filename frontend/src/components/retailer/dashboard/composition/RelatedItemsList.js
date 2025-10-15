import React from 'react';
import { ListGroup } from 'react-bootstrap';

const RelatedItemsList = ({ items }) => {
  if (items.length === 0) {
    return (
      <div className="text-center py-3 text-muted">
        No items found with this composition
      </div>
    );
  }

  return (
    <div className="related-items-container">
      <div className="related-items-header">
        <div className="item-cell">#</div>
        <div className="item-cell">Code</div>
        <div className="item-cell item-name">Item Name</div>
        <div className="item-cell">Category</div>
      </div>
      
      <ListGroup className="related-items-list">
        {items.map((item, index) => (
          <ListGroup.Item
            key={item._id}
            action
            onClick={() => handleItemSelect(item)}
            className="item-row"
            tabIndex={0}
          >
            <div className="item-cell">{index + 1}</div>
            <div className="item-cell">{item.uniqueNumber || 'N/A'}</div>
            <div className="item-cell item-name">{item.name}</div>
            <div className="item-cell">{item.category?.name || 'N/A'}</div>
          </ListGroup.Item>
        ))}
      </ListGroup>
    </div>
  );
};

const handleItemSelect = (item) => {
  // Handle item selection logic here
  console.log('Selected item:', item);
};

export default RelatedItemsList;