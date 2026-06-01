'use client';

import React, { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, FileText, Image as ImageIcon, Plus } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import TextArea from './ui/TextArea';
import type { ComposeData, Attachment } from '@/lib/types';

interface ComposeModalProps {
  open: boolean;
  recipientCount: number;
  onClose: () => void;
  onSend: (data: ComposeData) => Promise<void>;
}

export default function ComposeModal({ open, recipientCount, onClose, onSend }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        setAttachments(prev => [...prev, { filename: file.name, content: base64 }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const handleSend = async () => {
    if (!subject.trim() || !content.trim()) {
      alert('Subject and content are required');
      return;
    }

    setLoading(true);
    try {
      await onSend({ subject, content, attachments });
      setSubject('');
      setContent('');
      setAttachments([]);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (filename: string) => {
    if (filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return <ImageIcon className="w-4 h-4" />;
    }
    return <FileText className="w-4 h-4" />;
  };

  const getFilePreview = (filename: string) => {
    if (filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return 'image';
    }
    return 'file';
  };

  return (
    <Modal
      open={open}
      title="✉ Compose Email"
      onClose={onClose}
      footer={
        <div className="flex justify-between items-center w-full">
          <span className="text-sm text-gray-400">To: {recipientCount} selected contacts</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSend} loading={loading}>
              🚀 Send to {recipientCount}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Subject */}
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            disabled={loading}
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium mb-1">Body</label>
          <TextArea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Compose your email here... (HTML supported)"
            className="h-48"
            disabled={loading}
          />
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium mb-2">Attachments</label>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50/10' : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <input {...getInputProps()} />
            <Plus className="w-6 h-6 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-400">
              {isDragActive ? 'Drop files here' : 'Drop files or click to upload'}
            </p>
          </div>

          {/* Attachment Grid */}
          {attachments.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-3">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="relative p-2 bg-gray-800 rounded-lg flex flex-col items-center justify-center group"
                >
                  {getFileIcon(att.filename)}
                  <span className="text-xs mt-1 text-center truncate w-full px-1">
                    {att.filename.split('.')[0]}
                  </span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
