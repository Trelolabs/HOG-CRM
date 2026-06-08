'use client';

import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { UploadCloud, Loader, AlertCircle } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import { useDropzone } from 'react-dropzone';
import type { Lead } from '@/lib/types';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (contacts: Lead[], segmentName: string, segmentId: string) => void;
  campaignType?: 'EMAIL' | 'SMS';
}

export default function UploadModal({ open, onClose, onImported, campaignType = 'EMAIL' }: UploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [importing, setImporting] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [extractedCount, setExtractedCount] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);


  const clearPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };


  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const autoSegmentName = file.name.replace(/\.[^/.]+$/, '');

    setUploading(true);
    setExtractedCount(0);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('campaignType', campaignType);

    try {
      const response = await fetch('/api/campaigns/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();

      if (!isMountedRef.current) return;

      setUploading(false);
      setPolling(true);

      // Poll for completion
      const pollTimeout = setTimeout(() => {
        clearPolling();
        if (isMountedRef.current) {
          setPolling(false);
          toast.error('File processing timed out');
        }
      }, 5 * 60 * 1000);

      pollingIntervalRef.current = setInterval(async () => {
        if (!isMountedRef.current) {
          clearPolling();
          return;
        }

        try {
          const statusRes = await fetch(`/api/campaigns/upload/${data.jobId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();

            if (statusData.state === 'completed') {
              clearTimeout(pollTimeout);
              clearPolling();
              setPolling(false);

              const extractedContacts = statusData.result.contacts || [];
              setExtractedCount(extractedContacts.length);

              if (extractedContacts.length === 0) {
                toast.warning(campaignType === 'SMS' ? 'No phone numbers found in file' : 'No emails found in file');
                if (isMountedRef.current) {
                  setUploading(false);
                }
                return;
              }

              // Import contacts
              const finalSegmentName = segmentName.trim() || autoSegmentName;
              if (isMountedRef.current) {
                setPolling(false);
                setImporting(true);
              }

              const importRes = await fetch('/api/campaigns/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contacts: extractedContacts,
                  segmentName: finalSegmentName,
                  campaignType,
                }),
              });

              if (!importRes.ok) {
                const importErr = await importRes.json();
                toast.error(importErr.error || 'Import failed');
                if (isMountedRef.current) {
                  setImporting(false);
                }
                return;
              }

              const importData = await importRes.json();
              const foundSegmentId = importData.segmentId;

              // Fetch actual Lead records from database (limit=1000 to show all imported)
              const leadsRes = await fetch(`/api/leads?segmentId=${foundSegmentId}&limit=1000`);
              if (!leadsRes.ok) {
                toast.error('Failed to fetch imported leads');
                if (isMountedRef.current) {
                  setImporting(false);
                }
                return;
              }

              const leadsData = await leadsRes.json();
              const leads: Lead[] = leadsData.data || [];

              if (!isMountedRef.current) return;

              toast.success(`Imported ${importData.imported} contacts`);
              onImported(leads, finalSegmentName, foundSegmentId);
              onClose();
            } else if (statusData.state === 'failed') {
              clearTimeout(pollTimeout);
              clearPolling();
              setPolling(false);
              if (isMountedRef.current) {
                toast.error(statusData.failedReason || 'File parsing failed');
              }
            }
          }
        } catch (err) {
          console.error('Polling error', err);
          // Don't clear on transient errors, let it retry
        }
      }, 2000);
    } catch (error) {
      console.error(error);
      setUploading(false);
      clearPolling();
      toast.error('Upload failed');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleClose = () => {
    isMountedRef.current = false;
    clearPolling();
    setUploading(false);
    setPolling(false);
    setImporting(false);
    setSegmentName('');
    setExtractedCount(0);
    setTimeout(() => {
      isMountedRef.current = true;
    }, 100);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="📁 Import Contacts"
      onClose={handleClose}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleClose} disabled={uploading || polling || importing}>
            Cancel
          </Button>
          <Button disabled={uploading || polling || importing}>
            {uploading ? 'Uploading...' : polling ? 'Processing...' : importing ? 'Importing...' : 'Import'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${
            isDragActive ? 'border-blue-500 bg-blue-50/10' : 'border-gray-600 hover:border-gray-500'
          } ${uploading || polling || importing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <input {...getInputProps()} disabled={uploading || polling || importing} />
          {uploading || polling || importing ? (
            <>
              <Loader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-400">{uploading ? 'Uploading...' : polling ? 'Processing...' : 'Importing...'}</p>
              {extractedCount > 0 && (
                <p className="text-sm text-blue-400 mt-2">Found {extractedCount} {campaignType === 'SMS' ? 'phone numbers' : 'email addresses'}</p>
              )}
            </>
          ) : (
            <>
              <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-white mb-1">Drop any file here</h3>
              <p className="text-sm text-gray-400">CSV, Excel, PDF, DOCX, TXT — we extract all {campaignType === 'EMAIL' ? 'emails' : 'contacts'}</p>
            </>
          )}
        </div>

        {/* Segment Name (optional) */}
        <div>
          <label className="block text-sm font-medium mb-1">Segment Name (optional)</label>
          <Input
            value={segmentName}
            onChange={(e) => setSegmentName(e.target.value)}
            placeholder="Leave empty to auto-name from filename"
            disabled={uploading || polling || importing}
          />
        </div>

        {/* Expected format hint */}
        <div className="text-xs text-gray-400 p-3 bg-gray-900/30 rounded-lg border border-gray-700">
          <div className="font-semibold mb-1">Expected format:</div>
          {campaignType === 'EMAIL' ? (
            <div>Required column: <code className="bg-gray-800 px-1.5 py-0.5 rounded">Email</code> • Optional: <code className="bg-gray-800 px-1.5 py-0.5 rounded">Name</code></div>
          ) : (
            <div>Required column: <code className="bg-gray-800 px-1.5 py-0.5 rounded">Phone</code>, <code className="bg-gray-800 px-1.5 py-0.5 rounded">Mobile</code>, or <code className="bg-gray-800 px-1.5 py-0.5 rounded">WhatsApp</code> • Optional: <code className="bg-gray-800 px-1.5 py-0.5 rounded">Name</code></div>
          )}
        </div>

        {/* Info message */}
        {extractedCount > 0 && (
          <div className="flex gap-2 p-3 bg-blue-50/10 rounded-lg border border-blue-500/30">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-400">
              Found {extractedCount} {campaignType === 'SMS' ? 'phone numbers' : 'email addresses'}. Click Import to proceed.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
