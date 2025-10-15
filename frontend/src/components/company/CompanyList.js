// import React, { useState, useEffect, useRef } from 'react';
// import { Table, Badge, Button } from 'react-bootstrap';
// import { FaEye } from 'react-icons/fa';
// import { Link } from 'react-router-dom';
// import Skeleton from 'react-loading-skeleton';
// import 'react-loading-skeleton/dist/skeleton.css';

// const CompanyList = ({ companies, onCompanyClick, isAdminOrSupervisor }) => {
//   const [loading, setLoading] = useState(true);
//   const [selectedIndex, setSelectedIndex] = useState(0);
//   const tableRef = useRef(null);

//   useEffect(() => {
//     // Simulate loading delay
//     const timer = setTimeout(() => {
//       setLoading(false);
//     }, 1000);
//     return () => clearTimeout(timer);
//   }, []);

//   useEffect(() => {
//     if (!loading && companies.length > 0) {
//       // Focus the first row when data loads
//       focusRow(0);
//     }
//   }, [loading, companies]);

//   const focusRow = (index) => {
//     setSelectedIndex(index);
//     if (tableRef.current) {
//       const rows = tableRef.current.querySelectorAll('tbody tr');
//       if (rows.length > index) {
//         rows[index].focus();
//       }
//     }
//   };

//   const handleKeyDown = (e, companyId, index) => {
//     if (loading || companies.length === 0) return;

//     switch (e.key) {
//       case 'ArrowUp':
//         e.preventDefault();
//         if (selectedIndex > 0) {
//           focusRow(selectedIndex - 1);
//         }
//         break;
//       case 'ArrowDown':
//         e.preventDefault();
//         if (selectedIndex < companies.length - 1) {
//           focusRow(selectedIndex + 1);
//         }
//         break;
//       case 'Enter':
//         e.preventDefault();
//         onCompanyClick(companyId);
//         break;
//       default:
//         break;
//     }
//   };

//   // Loading state
//   if (loading) {
//     // Determine how many skeleton rows to show based on companies count
//     const skeletonCount = companies.length > 0 ? companies.length : 5;
    
//     return (
//       <div className='container-fluid'>
//         <div className="container user-management-container mt-4">
//           <div className="card user-management-card">
//             <div className="card-header">
//               <Skeleton height={30} width={200} />
//             </div>
//             <div className="card-body">
//               <Table hover>
//                 <thead>
//                   <tr>
//                     <th><Skeleton width={30} /></th>
//                     <th><Skeleton width={150} /></th>
//                     <th><Skeleton width={100} /></th>
//                     <th><Skeleton width={120} /></th>
//                     <th className="text-end"><Skeleton width={80} /></th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {Array.from({ length: skeletonCount }).map((_, index) => (
//                     <tr key={`skeleton-${index}`}>
//                       <td><Skeleton width={20} /></td>
//                       <td><Skeleton width={180} /></td>
//                       <td><Skeleton width={80} /></td>
//                       <td><Skeleton width={100} /></td>
//                       <td className="text-end">
//                         <Skeleton width={120} height={30} />
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </Table>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // Empty state
//   if (companies.length === 0) {
//     return (
//       <div className="text-center py-5">
//         <i className="fas fa-building fa-3x text-muted mb-3"></i>
//         <h4>No Companies Available</h4>
//         <p className="text-muted">
//           {isAdminOrSupervisor
//             ? "You don't have any companies yet. Create your first company to get started."
//             : "You haven't been added to any companies yet."}
//         </p>
//         {isAdminOrSupervisor && (
//           <Button as={Link} to="/company/new" variant="primary" className="mt-3">
//             <i className="fas fa-plus-circle me-2"></i>Create Company
//           </Button>
//         )}
//       </div>
//     );
//   }

//   // Company list
//   return (
//     <div className="table-responsive" ref={tableRef}>
//       <Table hover>
//         <thead>
//           <tr>
//             <th>#</th>
//             <th>Company Name</th>
//             <th>Trade Type</th>
//             <th>Date Format</th>
//             <th className="text-end">Actions</th>
//           </tr>
//         </thead>
//         <tbody>
//           {companies.map((company, index) => (
//             <tr 
//               key={company._id}
//               tabIndex={0}
//               className={selectedIndex === index ? 'table-active' : ''}
//               onKeyDown={(e) => handleKeyDown(e, company._id, index)}
//               onClick={() => {
//                 setSelectedIndex(index);
//                 onCompanyClick(company._id);
//               }}
//               style={{ cursor: 'pointer' }}
//             >
//               <td>{index + 1}</td>
//               <td>
//                 <strong>{company.name}</strong>
//               </td>
//               <td>
//                 <Badge bg="primary">{company.tradeType}</Badge>
//               </td>
//               <td>
//                 <Badge bg="info" text="dark">
//                   {company.dateFormat?.charAt(0).toUpperCase() + company.dateFormat?.slice(1)}
//                 </Badge>
//               </td>
//               <td className="text-end">
//                 <div className="d-flex justify-content-end gap-2">
//                   <Button
//                     variant="primary"
//                     size="sm"
//                     onClick={(e) => {
//                       e.stopPropagation();
//                       onCompanyClick(company._id);
//                     }}
//                   >
//                     <i className="fas fa-door-open me-1"></i>Open
//                   </Button>
//                   <Button
//                     as={Link}
//                     to={`/company/${company._id}`}
//                     variant="info"
//                     size="md"
//                     onClick={(e) => e.stopPropagation()}
//                   >
//                     <FaEye />
//                   </Button>
//                 </div>
//               </td>
//             </tr>
//           ))}
//         </tbody>
//       </Table>
//     </div>
//   );
// };

// export default CompanyList;

import React, { useState, useEffect, useRef } from 'react';
import { Table, Badge, Button } from 'react-bootstrap';
import { FaEye } from 'react-icons/fa';
import { Link } from 'react-router-dom';

const CompanyList = ({ companies, onCompanyClick, isAdminOrSupervisor }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tableRef = useRef(null);

  useEffect(() => {
    if (companies.length > 0) {
      // Focus the first row when data loads
      focusRow(0);
    }
  }, [companies]);

  const focusRow = (index) => {
    setSelectedIndex(index);
    if (tableRef.current) {
      const rows = tableRef.current.querySelectorAll('tbody tr');
      if (rows.length > index) {
        rows[index].focus();
      }
    }
  };

  const handleKeyDown = (e, companyId, index) => {
    if (companies.length === 0) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (selectedIndex > 0) {
          focusRow(selectedIndex - 1);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (selectedIndex < companies.length - 1) {
          focusRow(selectedIndex + 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        onCompanyClick(companyId);
        break;
      default:
        break;
    }
  };

  // Empty state
  if (companies.length === 0) {
    return (
      <div className="text-center py-5">
        <i className="fas fa-building fa-3x text-muted mb-3"></i>
        <h4>No Companies Available</h4>
        <p className="text-muted">
          {isAdminOrSupervisor
            ? "You don't have any companies yet. Create your first company to get started."
            : "You haven't been added to any companies yet."}
        </p>
        {isAdminOrSupervisor && (
          <Button as={Link} to="/company/new" variant="primary" className="mt-3">
            <i className="fas fa-plus-circle me-2"></i>Create Company
          </Button>
        )}
      </div>
    );
  }

  // Company list
  return (
    <div className="table-responsive" ref={tableRef}>
      <Table hover>
        <thead>
          <tr>
            <th>#</th>
            <th>Company Name</th>
            <th>Trade Type</th>
            <th>Date Format</th>
            <th className="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company, index) => (
            <tr 
              key={company._id}
              tabIndex={0}
              className={selectedIndex === index ? 'table-active' : ''}
              onKeyDown={(e) => handleKeyDown(e, company._id, index)}
              onClick={() => {
                setSelectedIndex(index);
                onCompanyClick(company._id);
              }}
              style={{ cursor: 'pointer' }}
            >
              <td>{index + 1}</td>
              <td>
                <strong>{company.name}</strong>
              </td>
              <td>
                <Badge bg="primary">{company.tradeType}</Badge>
              </td>
              <td>
                <Badge bg="info" text="dark">
                  {company.dateFormat?.charAt(0).toUpperCase() + company.dateFormat?.slice(1)}
                </Badge>
              </td>
              <td className="text-end">
                <div className="d-flex justify-content-end gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCompanyClick(company._id);
                    }}
                  >
                    <i className="fas fa-door-open me-1"></i>Open
                  </Button>
                  <Button
                    as={Link}
                    to={`/company/${company._id}`}
                    variant="info"
                    size="md"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FaEye />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default CompanyList;