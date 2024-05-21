import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

const FileUpload = () => {
  const [files, setFiles] = useState([]);
  
  const fetchFiles = async () => {
    try {
      const response = await axios.get('http://localhost:8000/files/');
      setFiles(response.data.files);
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const onDrop = async (acceptedFiles) => {
    const formData = new FormData();
    acceptedFiles.forEach(file => {
      formData.append('file', file);
    });
    
    try {
      await axios.post('http://localhost:8000/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      fetchFiles();
    } catch (error) {
      console.error('Error uploading files:', error);
    }
  };

  const deleteFile = async (filename) => {
    try {
      await axios.delete(`http://localhost:8000/files/${filename}`);
      fetchFiles();
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <div>
      <div {...getRootProps()} style={{ border: '2px dashed #cccccc', padding: '20px', textAlign: 'center' }}>
        <input {...getInputProps()} />
        <p>Drag 'n' drop some files here, or click to select files</p>
      </div>
      <h2>Uploaded Files</h2>
      <ul>
        {files.map(file => (
          <li key={file}>
            {file} 
            <button onClick={() => deleteFile(file)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileUpload;