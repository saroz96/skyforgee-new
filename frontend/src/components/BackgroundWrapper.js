// BackgroundWrapper.js
import React from 'react';
import '../stylesheet/BackgroundWrapper.css';

const BackgroundWrapper = ({ children }) => {
  return (
    <div className="background-wrapper">
      <div className="background-overlay"></div>
      <div className="content-wrapper">
        {children}
      </div>
    </div>
  );
};

export default BackgroundWrapper;