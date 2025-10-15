import { useState, useEffect, useRef } from 'react';
import { NepaliDatePicker } from 'nepali-datepicker-reactjs';
import "nepali-datepicker-reactjs/dist/index.css";

const NepaliDateInput = ({ value, onChange, onKeyDown, id }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    if (/^\d{4}-\d{2}-\d{2}$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handleDateSelect = (selectedDate) => {
    setInputValue(selectedDate);
    onChange(selectedDate);
    setShowPicker(false);
    // Focus back on input after selection
    inputRef.current?.focus();
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Call the parent's onKeyDown handler if provided
      if (onKeyDown) {
        onKeyDown(e);
      }
    }
  };

  return (
    <div className="nepali-date-input-wrapper" ref={wrapperRef}>
      <div className="input-group">
        <input
          ref={inputRef}
          type="text"
          id={id}
          className="form-control"
          value={inputValue}
          onChange={handleInputChange}
        //   onFocus={() => setShowPicker(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="YYYY-MM-DD"
        />
        {/* <button 
          className="btn btn-outline-secondary" 
          type="button"
          onClick={() => {
            setShowPicker(!showPicker);
            inputRef.current?.focus();
          }}
        >
          📅
        </button> */}
      </div>
      
      {showPicker && (
        <div className="nepali-date-picker-container">
          <NepaliDatePicker
            value={inputValue}
            onChange={handleDateSelect}
            options={{
              calendarLocale: 'ne',
              valueLocale: 'en',
              dateFormat: 'YYYY-MM-DD',
              closeOnSelect: true
            }}
          />
        </div>
      )}
    </div>
  );
};

export default NepaliDateInput;