import React, { useEffect, useRef, useState } from 'react';
import ApexCharts from 'apexcharts';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { usePageNotRefreshContext } from '../PageNotRefreshContext';

const SalesChart = () => {
  const { salesChartDraftSave, setSalesChartDraftSave } = usePageNotRefreshContext();
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [loading, setLoading] = useState(!salesChartDraftSave);
  const [error, setError] = useState(null);
  const { currentCompany } = useAuth();
  const [dataStatus, setDataStatus] = useState(salesChartDraftSave ? 'cached' : 'loading');

  const initializeChart = () => {
    if (chartRef.current && !chartInstance.current) {
      const options = {
        series: [{
          name: 'Net Sales',
          data: []
        }],
        chart: {
          height: 350,
          type: 'area',
          toolbar: { show: true },
          zoom: { enabled: true },
          animations: {
            enabled: false
          }
        },
        colors: ['#0d6efd'],
        dataLabels: { enabled: false },
        stroke: {
          curve: 'smooth',
          width: 2,
          colors: ['#0d6efd']
        },
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.7,
            opacityTo: 0.3,
            stops: [0, 90, 100]
          }
        },
        xaxis: {
          categories: [],
          labels: {
            style: {
              colors: '#6c757d'
            }
          }
        },
        yaxis: {
          labels: {
            formatter: function (value) {
              return 'Rs. ' + value.toLocaleString();
            },
            style: {
              colors: '#6c757d'
            }
          }
        },
        tooltip: {
          y: {
            formatter: function (value) {
              return 'Rs. ' + value.toLocaleString();
            }
          }
        },
        grid: {
          borderColor: '#f1f1f1',
          strokeDashArray: 3
        }
      };

      chartInstance.current = new ApexCharts(chartRef.current, options);
      chartInstance.current.render();
    }
  };

  const updateChartData = (categories, seriesData) => {
    if (!chartInstance.current) {
      initializeChart();
    }

    if (chartInstance.current) {
      chartInstance.current.updateOptions({
        series: [{
          data: seriesData
        }],
        xaxis: {
          categories: categories
        }
      }, false, true);
    }
  };

  const renderChart = (categories, seriesData) => {
    initializeChart();
    updateChartData(categories, seriesData);
  };

  const fetchChartData = async () => {
    try {
      if (!salesChartDraftSave) setLoading(true);
      setError(null);

      const response = await axios.get('/api/retailer/retailerDashboard/indexv1', {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      });

      if (response.data.success) {
        const { chartData } = response.data.data;
        const categories = chartData.categories;
        const seriesData = chartData.series[0].data;
        
        updateChartData(categories, seriesData);
        setSalesChartDraftSave({ categories, seriesData });
        setDataStatus('fresh');
      } else {
        throw new Error(response.data.error || 'Failed to load chart data');
      }
    } catch (err) {
      console.error('Error fetching chart data:', err);
      setError(err.response?.data?.error || err.message);
      setDataStatus('error');
      
      if (!salesChartDraftSave) {
        updateChartData(['No Data'], [0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentCompany) return;

    // Initialize chart with empty data if no draft exists
    if (!salesChartDraftSave) {
      renderChart([], []);
    }

    // Initialize chart with draft data if available
    if (salesChartDraftSave) {
      updateChartData(salesChartDraftSave.categories, salesChartDraftSave.seriesData);
    }

    // Fetch data immediately if no draft, otherwise fetch in background
    if (!salesChartDraftSave) {
      fetchChartData();
    } else {
      fetchChartData().catch(e => console.log('Background refresh failed:', e));
    }

    // Set up auto-refresh every 5 minutes
    const interval = setInterval(fetchChartData, 300000);
    return () => {
      clearInterval(interval);
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [currentCompany]);

  // Show loading only if we have no draft data
  if (loading && !salesChartDraftSave) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading sales data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error only if we have no draft data
  if (error && !salesChartDraftSave) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-danger">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
            <button 
              className="btn btn-sm btn-outline-danger ms-3"
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchChartData();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header border-0">
        <h3 className="card-title">
          <i className="bi bi-graph-up me-2"></i> Sales Overview
        </h3>
      </div>
      <div className="card-body">
        <div id="revenue-chart" ref={chartRef}></div>
        {dataStatus === 'cached' && (
          <div className="text-muted text-end small mt-2">
            <i className="bi bi-info-circle me-1"></i>
            Showing cached data while we fetch the latest
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesChart;