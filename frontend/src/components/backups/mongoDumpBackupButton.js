
import axios from 'axios';
import { useState } from 'react';

const MongoDumpBackupButton = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleBackup = async () => {
    try {
      setIsLoading(true);
      
      // Make a GET request to the backup endpoint
      const response = await axios.get('/api/backup/download', {
        responseType: 'blob',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      // Extract filename from response headers or create one
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'company_backup.json.gz';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create a temporary URL for the downloaded blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Backup failed:', error);
      alert('Backup failed. Please check your session and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handleBackup} 
      disabled={isLoading}
      className={isLoading ? 'loading' : ''}
    >
      {isLoading ? 'Creating Backup...' : 'Download Company Backup In MongoDump'}
    </button>
  );
};

export default MongoDumpBackupButton;