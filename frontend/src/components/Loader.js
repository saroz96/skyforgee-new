import React, { useState, useEffect, createContext, useContext } from 'react';
import '../stylesheet/loader.css'

// Create a Loading Context for global state management
const LoadingContext = createContext();

// // Custom hook to use the loading context
// export const useLoading = () => {
//   return useContext(LoadingContext);
// };

// // Loading Provider component to wrap your app
// export const LoadingProvider = ({ children }) => {
//   const [loading, setLoading] = useState(false);

//   const showLoading = () => setLoading(true);
//   const hideLoading = () => setLoading(false);

//   return (
//     <LoadingContext.Provider value={{ loading, showLoading, hideLoading }}>
//       {children}
//       {loading && <Loader />}
//     </LoadingContext.Provider>
//   );
// };

// Loader Component with rotating SVG animation
const Loader = () => {
  return (
    <div className="loader-overlay">
      <div className="loader-content">
        <div className="loader-spinner">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid"
            className="loading-svg"
          >
            <circle
              cx="50"
              cy="50"
              r="40"
              strokeWidth="8"
              stroke="#2c7be5"
              strokeDasharray="62.83 62.83"
              fill="none"
              strokeLinecap="round"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                repeatCount="indefinite"
                dur="1.5s"
                keyTimes="0;1"
                values="0 50 50;360 50 50"
              />
            </circle>
            <circle
              cx="50"
              cy="50"
              r="33"
              strokeWidth="8"
              stroke="#e63757"
              strokeDasharray="51.84 51.84"
              strokeDashoffset="51.84"
              fill="none"
              strokeLinecap="round"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                repeatCount="indefinite"
                dur="1.8s"
                keyTimes="0;1"
                values="0 50 50;-360 50 50"
              />
            </circle>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Loader;