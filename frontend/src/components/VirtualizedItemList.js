// src/components/VirtualizedItemList.js
import React, { useState, useEffect, useRef, memo } from 'react';

const ItemRow = memo(({ item, index, style, onItemClick, searchRef }) => {
  const handleClick = () => onItemClick(item);
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onItemClick(item);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextItem = e.target.nextElementSibling;
      if (nextItem) {
        e.target.classList.remove('active');
        nextItem.classList.add('active');
        nextItem.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevItem = e.target.previousElementSibling;
      if (prevItem) {
        e.target.classList.remove('active');
        prevItem.classList.add('active');
        prevItem.focus();
      } else {
        searchRef.current?.focus();
      }
    }
  };

  const handleFocus = (e) => {
    document.querySelectorAll('.dropdown-item').forEach(item => {
      item.classList.remove('active');
    });
    e.target.classList.add('active');
  };

  return (
    <div
      data-index={index}
      className={`dropdown-item ${item.vatStatus === 'vatable' ? 'vatable' : 'vatExempt'}`}
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        alignItems: 'center',
        padding: '0 10px',
        borderBottom: '1px solid #eee',
        cursor: 'pointer'
      }}
      onClick={handleClick}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
    >
      <div>{item.uniqueNumber || 'N/A'}</div>
      <div>{item.hscode || 'N/A'}</div>
      <div className="dropdown-items-name">{item.name}</div>
      <div>{item.category?.name || 'No Category'}</div>
      <div>{item.stock || 0}</div>
      <div>{item.unit?.name || ''}</div>
      <div>Rs.{item.latestPuPrice || 0}</div>
    </div>
  );
});

const VirtualizedItemList = memo(({ items, onItemClick, searchRef }) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 25 });
  const itemHeight = 40;
  const containerRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const scrollTop = containerRef.current.scrollTop;
      const start = Math.floor(scrollTop / itemHeight);
      const end = start + 30; // Render 30 items at a time (with buffer)

      setVisibleRange({ 
        start: Math.max(0, start - 5), 
        end: Math.min(items.length, end + 5) 
      });
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial calculation
      
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [items.length]);

  const visibleItems = items.slice(visibleRange.start, visibleRange.end);
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return (
    <div 
      ref={containerRef}
      style={{ 
        height: '240px', 
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => {
            const actualIndex = visibleRange.start + index;
            return (
              <ItemRow
                key={item._id}
                item={item}
                index={actualIndex}
                style={{
                  height: `${itemHeight}px`
                }}
                onItemClick={onItemClick}
                searchRef={searchRef}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default VirtualizedItemList;