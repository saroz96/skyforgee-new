import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    padding: 14,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    textAlign: 'center',
    marginBottom: 15,
  },
  companyName: {
    fontSize: 18,
    marginBottom: 5,
  },
  reportTitle: {
    fontSize: 16,
    textDecoration: 'underline',
    marginVertical: 10,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    fontSize: 9,
  },
  table: {
    display: 'table',
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: 'row',
    margin: 'auto',
  },
  tableCol: {
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableCell: {
    margin: 'auto',
    marginTop: 5,
    fontSize: 10,
    padding: 4,
  },
  tableHeader: {
    backgroundColor: '#f2f2f2',
    fontWeight: 'bold',
  },
  textRight: {
    textAlign: 'right',
  },
  footer: {
    marginTop: 10,
    fontSize: 9,
    textAlign: 'right',
  },
});

// Format currency function (reusable)
const formatCurrency = (num) => {
  const number = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : Number(num) || 0;
  return number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Main PDF component
const StockStatusPDF = ({ 
  items, 
  company, 
  displayOptions, 
  totals, 
  isAllItems, 
  searchQuery 
}) => {
  const printDate = new Date().toLocaleDateString();
  const fiscalYear = company.fiscalYear?.name || 'N/A';
  const generatedDate = new Date().toLocaleString();
  
  // Extract company data properly
  const companyData = company.company || {};
  const companyName = companyData.name || companyData.currentCompanyName || 'Company Name';
  const address = companyData.address || '';
  const ward = companyData.ward || '';
  const city = companyData.city || '';
  const pan = companyData.pan || '';

  return (
    <Document>
      <Page size="A4" style={styles.page} orientation="landscape">
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyName}</Text>
          <Text>
            {address}{ward ? `-${ward}` : ''}{city ? `, ${city}` : ''}
            {pan ? `, TPIN: ${pan}` : ''}
          </Text>
          <Text style={styles.reportTitle}>Stock Status Report</Text>
        </View>

        {/* Report Info */}
        <View style={styles.infoContainer}>
          <View>
            <Text>
              <Text style={{ fontWeight: 'bold' }}>As on:</Text> {printDate} |
              <Text style={{ fontWeight: 'bold' }}>F.Y:</Text> {fiscalYear}
            </Text>
          </View>
          <View>
            <Text>
              <Text style={{ fontWeight: 'bold' }}>Report:</Text> {isAllItems ? 'All Items' : 'Current Page'} |
              <Text style={{ fontWeight: 'bold' }}>Total Items:</Text> {items.length}
            </Text>
            {searchQuery && (
              <Text>
                <Text style={{ fontWeight: 'bold' }}>Search Filter:</Text> "{searchQuery}"
              </Text>
            )}
          </View>
          <View>
            <Text>
              <Text style={{ fontWeight: 'bold' }}>Generated:</Text> {generatedDate}
            </Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={[styles.tableCol, { width: '4%' }]}><Text style={styles.tableCell}>#</Text></View>
            <View style={[styles.tableCol, { width: '20%' }]}><Text style={styles.tableCell}>Item Name</Text></View>
            <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.tableCell}>Category</Text></View>
            <View style={[styles.tableCol, { width: '6%' }]}><Text style={styles.tableCell}>Unit</Text></View>
            <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>Stock</Text></View>
            <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>Op. Stock</Text></View>
            <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>Qty. In</Text></View>
            <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>Qty. Out</Text></View>
            <View style={[styles.tableCol, { width: '7%' }]}><Text style={[styles.tableCell, styles.textRight]}>Min Stock</Text></View>
            <View style={[styles.tableCol, { width: '7%' }]}><Text style={[styles.tableCell, styles.textRight]}>Max Stock</Text></View>
            <View style={[styles.tableCol, { width: '7%' }]}><Text style={[styles.tableCell, styles.textRight]}>C.P</Text></View>
            <View style={[styles.tableCol, { width: '7%' }]}><Text style={[styles.tableCell, styles.textRight]}>S.P</Text></View>
            {displayOptions.showPurchaseValue && (
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, styles.textRight]}>St.Val (C.P)</Text></View>
            )}
            {displayOptions.showSalesValue && (
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, styles.textRight]}>St.Val (S.P)</Text></View>
            )}
          </View>

          {/* Table Rows */}
          {items.map((item, index) => (
            <View style={styles.tableRow} key={index}>
              <View style={[styles.tableCol, { width: '4%' }]}><Text style={styles.tableCell}>{index + 1}</Text></View>
              <View style={[styles.tableCol, { width: '20%' }]}>
                <Text style={styles.tableCell}>
                  {item.name}
                  {item.code && ` (${item.code})`}
                </Text>
              </View>
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.tableCell}>{item.category || '-'}</Text></View>
              <View style={[styles.tableCol, { width: '6%' }]}><Text style={styles.tableCell}>{item.unit || '-'}</Text></View>
              <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(item.stock)}</Text></View>
              <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(item.openingStock)}</Text></View>
              <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(item.totalQtyIn)}</Text></View>
              <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(item.totalQtyOut)}</Text></View>
              <View style={[styles.tableCol, { width: '7%' }]}><Text style={[styles.tableCell, styles.textRight]}>{item.minStock || '-'}</Text></View>
              <View style={[styles.tableCol, { width: '7%' }]}><Text style={[styles.tableCell, styles.textRight]}>{item.maxStock || '-'}</Text></View>
              <View style={[styles.tableCol, { width: '7%' }]}><Text style={[styles.tableCell, styles.textRight]}>{item.avgPuPrice ? formatCurrency(item.avgPuPrice) : '-'}</Text></View>
              <View style={[styles.tableCol, { width: '7%' }]}><Text style={[styles.tableCell, styles.textRight]}>{item.avgPrice ? formatCurrency(item.avgPrice) : '-'}</Text></View>
              {displayOptions.showPurchaseValue && (
                <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(item.totalStockValuePurchase)}</Text></View>
              )}
              {displayOptions.showSalesValue && (
                <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(item.totalStockValueSales)}</Text></View>
              )}
            </View>
          ))}

          {/* Totals Row */}
          <View style={[styles.tableRow, { fontWeight: 'bold' }]}>
            <View style={[styles.tableCol, { width: '4%' }]}><Text style={styles.tableCell}></Text></View>
            <View style={[styles.tableCol, { width: '20%' }]}><Text style={styles.tableCell}></Text></View>
            <View style={[styles.tableCol, { width: '10%' }]}><Text style={styles.tableCell}></Text></View>
            <View style={[styles.tableCol, { width: '6%' }]}><Text style={styles.tableCell}>Totals</Text></View>
            <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(totals.totalStock)}</Text></View>
            <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(totals.totalOpeningStock)}</Text></View>
            <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(totals.totalQtyIn)}</Text></View>
            <View style={[styles.tableCol, { width: '8%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(totals.totalQtyOut)}</Text></View>
            <View style={[styles.tableCol, { width: '7%' }]}><Text style={styles.tableCell}></Text></View>
            <View style={[styles.tableCol, { width: '7%' }]}><Text style={styles.tableCell}></Text></View>
            <View style={[styles.tableCol, { width: '7%' }]}><Text style={styles.tableCell}></Text></View>
            <View style={[styles.tableCol, { width: '7%' }]}><Text style={styles.tableCell}></Text></View>
            {displayOptions.showPurchaseValue && (
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(totals.totalPurchaseValue)}</Text></View>
            )}
            {displayOptions.showSalesValue && (
              <View style={[styles.tableCol, { width: '10%' }]}><Text style={[styles.tableCell, styles.textRight]}>{formatCurrency(totals.totalSalesValue)}</Text></View>
            )}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Generated from {companyName} | Page 1 of 1</Text>
        </View>
      </Page>
    </Document>
  );
};

export default StockStatusPDF;
export { formatCurrency };