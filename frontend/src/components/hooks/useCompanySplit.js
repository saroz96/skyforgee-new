// import { useState, useCallback } from 'react';

// const useCompanySplit = () => {
//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState(null);
//     const [progress, setProgress] = useState(0);
//     const [processLog, setProcessLog] = useState([]);

//     const addToLog = useCallback((message) => {
//         const timestamp = new Date().toLocaleTimeString();
//         setProcessLog(prev => [...prev, { timestamp, message }]);
//     }, []);

//     // Regular POST request (non-SSE)
//     const splitCompany = useCallback(async (splitData) => {
//         setLoading(true);
//         setError(null);
//         setProgress(0);
//         setProcessLog([]);

//         try {
//             addToLog('Starting company split process...');

//             const response = await fetch('/api/split-fiscal-year', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 credentials: 'include',
//                 body: JSON.stringify(splitData)
//             });

//             if (!response.ok) {
//                 throw new Error(`HTTP error! status: ${response.status}`);
//             }

//             const result = await response.json();

//             if (result.success) {
//                 addToLog('Company split completed successfully!');
//                 return result;
//             } else {
//                 throw new Error(result.error);
//             }
//         } catch (err) {
//             const errorMsg = err.message || 'Failed to split company';
//             setError(errorMsg);
//             addToLog(`Error: ${errorMsg}`);
//             throw err;
//         } finally {
//             setLoading(false);
//         }
//     }, [addToLog]);

//     // SSE version - CORRECTED
//     // const splitCompanyWithSSE = useCallback((splitData) => {
//     //     return new Promise((resolve, reject) => {
//     //         setLoading(true);
//     //         setError(null);
//     //         setProgress(0);
//     //         setProcessLog([]);

//     //         // Create URL with query parameters
//     //         const params = new URLSearchParams();
//     //         params.append('sse', 'true');

//     //         const url = `/api/split-fiscal-year?${params.toString()}`;

//     //         console.log('SSE URL:', url); // Debug log

//     //         const eventSource = new EventSource(url, {
//     //             withCredentials: true
//     //         });

//     //         eventSource.onopen = () => {
//     //             addToLog('Connected to server, starting company split...');

//     //             // Send the actual data via a separate POST request
//     //             // Since EventSource is GET-only, we need to handle data differently
//     //             fetch('/api/split-fiscal-year', {
//     //                 method: 'POST',
//     //                 headers: {
//     //                     'Content-Type': 'application/json',
//     //                 },
//     //                 credentials: 'include',
//     //                 body: JSON.stringify(splitData)
//     //             }).catch(err => {
//     //                 console.error('Failed to start split process:', err);
//     //                 eventSource.close();
//     //                 setError('Failed to start split process');
//     //                 reject(err);
//     //             });
//     //         };

//     //         eventSource.onmessage = (event) => {
//     //             try {
//     //                 const data = JSON.parse(event.data);
//     //                 console.log('SSE Data received:', data); // Debug log

//     //                 if (data.type === 'progress') {
//     //                     setProgress(data.value);
//     //                     if (data.message) addToLog(data.message);
//     //                 } else if (data.type === 'complete') {
//     //                     eventSource.close();
//     //                     setLoading(false);
//     //                     addToLog('Company split completed successfully!');
//     //                     resolve(data);
//     //                 } else if (data.type === 'error') {
//     //                     eventSource.close();
//     //                     setLoading(false);
//     //                     setError(data.error);
//     //                     addToLog(`Error: ${data.error}`);
//     //                     reject(new Error(data.error));
//     //                 }
//     //             } catch (parseError) {
//     //                 console.error('Error parsing SSE data:', parseError);
//     //             }
//     //         };

//     //         eventSource.onerror = (error) => {
//     //             console.error('SSE Error:', error);
//     //             eventSource.close();
//     //             setLoading(false);
//     //             const errorMsg = 'Connection to server failed';
//     //             setError(errorMsg);
//     //             addToLog(`Error: ${errorMsg}`);
//     //             reject(new Error(errorMsg));
//     //         };

//     //         // Handle page unload
//     //         window.addEventListener('beforeunload', () => {
//     //             eventSource.close();
//     //         });
//     //     });
//     // }, [addToLog]);

//     // hooks/useCompanySplit.js - Updated for GET SSE
//     const splitCompanyWithSSE = useCallback((splitData) => {
//         return new Promise((resolve, reject) => {
//             setLoading(true);
//             setError(null);
//             setProgress(0);
//             setProcessLog([]);

//             // Create URL with query parameters for GET request
//             const params = new URLSearchParams();
//             params.append('sourceCompanyId', splitData.sourceCompanyId);
//             params.append('fiscalYearId', splitData.fiscalYearId);
//             params.append('newCompanyName', splitData.newCompanyName);
//             params.append('deleteAfterSplit', splitData.deleteAfterSplit.toString());

//             const url = `/api/split-fiscal-year?${params.toString()}`;

//             console.log('SSE GET URL:', url);

//             const eventSource = new EventSource(url, {
//                 withCredentials: true
//             });

//             eventSource.onopen = () => {
//                 addToLog('Connected to server, starting company split...');
//             };

//             eventSource.onmessage = (event) => {
//                 try {
//                     const data = JSON.parse(event.data);
//                     console.log('SSE Data received:', data);

//                     if (data.type === 'progress') {
//                         setProgress(data.value);
//                         if (data.message) addToLog(data.message);
//                     } else if (data.type === 'complete') {
//                         eventSource.close();
//                         setLoading(false);
//                         addToLog('Company split completed successfully!');
//                         resolve(data);
//                     } else if (data.type === 'error') {
//                         eventSource.close();
//                         setLoading(false);
//                         setError(data.error);
//                         addToLog(`Error: ${data.error}`);
//                         reject(new Error(data.error));
//                     }
//                 } catch (parseError) {
//                     console.error('Error parsing SSE data:', parseError);
//                 }
//             };

//             eventSource.onerror = (error) => {
//                 console.error('SSE Error:', error);
//                 eventSource.close();
//                 setLoading(false);
//                 const errorMsg = 'Connection to server failed';
//                 setError(errorMsg);
//                 addToLog(`Error: ${errorMsg}`);
//                 reject(new Error(errorMsg));
//             };
//         });
//     }, [addToLog]);

//     const reset = useCallback(() => {
//         setLoading(false);
//         setError(null);
//         setProgress(0);
//         setProcessLog([]);
//     }, []);

//     return {
//         loading,
//         error,
//         progress,
//         processLog,
//         splitCompany,
//         splitCompanyWithSSE,
//         reset,
//         addToLog
//     };
// };

// export default useCompanySplit;

import { useState, useCallback } from 'react';

const useCompanySplit = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [processLog, setProcessLog] = useState([]);

    const addToLog = useCallback((message) => {
        const timestamp = new Date().toLocaleTimeString();
        setProcessLog(prev => [...prev, { timestamp, message }]);
    }, []);

    // Regular POST request (non-SSE)
    const splitCompany = useCallback(async (splitData) => {
        setLoading(true);
        setError(null);
        setProgress(0);
        setProcessLog([]);

        try {
            addToLog('Starting company split process...');

            const response = await fetch('/api/split-fiscal-year', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(splitData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                addToLog('Company split completed successfully!');
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            const errorMsg = err.message || 'Failed to split company';
            setError(errorMsg);
            addToLog(`Error: ${errorMsg}`);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [addToLog]);

    // SSE version for GET request
    const splitCompanyWithSSE = useCallback((splitData) => {
        return new Promise((resolve, reject) => {
            setLoading(true);
            setError(null);
            setProgress(0);
            setProcessLog([]);

            // Create URL with query parameters for GET request
            const params = new URLSearchParams();
            params.append('sourceCompanyId', splitData.sourceCompanyId);
            params.append('fiscalYearId', splitData.fiscalYearId);
            params.append('newCompanyName', splitData.newCompanyName);
            params.append('deleteAfterSplit', splitData.deleteAfterSplit.toString());

            const url = `/api/split-fiscal-year?${params.toString()}`;

            console.log('SSE GET URL:', url);

            const eventSource = new EventSource(url, {
                withCredentials: true
            });

            eventSource.onopen = () => {
                addToLog('Connected to server, starting company split...');
            };

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('SSE Data received:', data);

                    if (data.type === 'progress') {
                        setProgress(data.value);
                        if (data.message) addToLog(data.message);
                    } else if (data.type === 'complete') {
                        eventSource.close();
                        setLoading(false);
                        addToLog('Company split completed successfully!');
                        resolve(data);
                    } else if (data.type === 'error') {
                        eventSource.close();
                        setLoading(false);
                        setError(data.error);
                        addToLog(`Error: ${data.error}`);
                        reject(new Error(data.error));
                    }
                } catch (parseError) {
                    console.error('Error parsing SSE data:', parseError);
                }
            };

            eventSource.onerror = (error) => {
                console.error('SSE Error:', error);
                eventSource.close();
                setLoading(false);
                const errorMsg = 'Connection to server failed';
                setError(errorMsg);
                addToLog(`Error: ${errorMsg}`);
                reject(new Error(errorMsg));
            };
        });
    }, [addToLog]);

    const reset = useCallback(() => {
        setLoading(false);
        setError(null);
        setProgress(0);
        setProcessLog([]);
    }, []);

    return {
        loading,
        error,
        progress,
        processLog,
        splitCompany,
        splitCompanyWithSSE,
        reset,
        addToLog
    };
};

export default useCompanySplit;