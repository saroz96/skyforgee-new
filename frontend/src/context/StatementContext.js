// StatementContext.js
import React, { createContext, useContext, useState } from 'react';

const StatementContext = createContext();

export const useStatementContext = () => {
  const context = useContext(StatementContext);
  if (!context) {
    throw new Error('useStatementContext must be used within a StatementProvider');
  }
  return context;
};

export const StatementProvider = ({ children }) => {
  const [statementState, setStatementState] = useState({
    selectedCompany: '',
    partyName: '',
    fromDate: '',
    toDate: '',
    paymentMode: 'all',
    statement: [],
    accounts: [],
    totalDebit: 0,
    totalCredit: 0,
    openingBalance: 0
  });

  return (
    <StatementContext.Provider value={{ statementState, setStatementState }}>
      {children}
    </StatementContext.Provider>
  );
};