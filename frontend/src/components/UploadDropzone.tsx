'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, CheckCircle } from 'lucide-react';
import Button from './ui/Button';

interface UploadDropzoneProps {
  onUploadSuccess: (jobId: string, type: 'structured' | 'unstructured') => void;
}

export default function UploadDropzone({ onUploadSuccess }: UploadDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isStructured = ['csv', 'xls', 'xlsx'].includes(extension || '');
    const type = isStructured ? 'structured' : 'unstructured';
    
    setUploading(true);
    setProgress(20);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const response = await fetch('/api/campaigns/upload', {
        method: 'POST',
        body: formData,
      });

      setProgress(80);
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setProgress(100);
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        onUploadSuccess(data.jobId, type);
      }, 500);

    } catch (error) {
      console.error(error);
      setUploading(false);
      setProgress(0);
      alert('Upload failed');
    }
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div className="crm-card p-6">
      <div 
        {...getRootProps()} 
        className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-gray-600 hover:border-gray-500'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center space-y-4 w-full max-w-md">
            <UploadCloud className="w-12 h-12 text-primary animate-pulse" />
            <h3 className="text-lg font-semibold text-white">Uploading & Parsing...</h3>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-white/5 rounded-full">
              <UploadCloud className="w-12 h-12 text-gray-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white">Drag & drop files here</h3>
              <p className="text-sm text-gray-400 mt-1">Supports CSV, Excel, PDF, and DOC</p>
            </div>
            <Button variant="ghost" className="mt-2">Browse Files</Button>
          </div>
        )}
      </div>
    </div>
  );
}
