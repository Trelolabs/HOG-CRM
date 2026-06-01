'use client';

import React, { useState } from 'react';
import Button from './ui/Button';
import Select from './ui/Select';
import { CheckCircle } from 'lucide-react';

interface DataMapperProps {
  jobData: any; // Could be structured { headers, rows } or unstructured { contacts }
  type: 'structured' | 'unstructured';
  onImport: (mappedData: any) => Promise<void>;
  onCancel: () => void;
}

export default function DataMapperUI({ jobData, type, onImport, onCancel }: DataMapperProps) {
  const [mapping, setMapping] = useState<{ name: string; email: string; phone: string }>({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    setLoading(true);
    try {
      if (type === 'structured') {
        const mappedData = jobData.rows.map((row: any) => {
          const fullName = mapping.name ? row[mapping.name] : '';
          const [firstName = '', lastName = ''] = fullName.split(' ').length > 0
            ? [fullName.split(' ')[0], fullName.split(' ').slice(1).join(' ')]
            : ['', ''];
          return {
            firstName,
            lastName,
            email: mapping.email ? row[mapping.email] : '',
            phone: mapping.phone ? row[mapping.phone] : '',
          };
        });
        await onImport(mappedData);
      } else {
        await onImport(jobData.contacts);
      }
    } finally {
      setLoading(false);
    }
  };

  if (type === 'unstructured') {
    return (
      <div className="crm-card p-6 border border-[#6f3145]/30">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="text-green-500 w-6 h-6" />
          <h3 className="text-xl font-semibold">Extracted Contacts</h3>
        </div>
        <p className="text-gray-400 mb-4">We found {jobData.contacts?.length || 0} contacts in your document. Please review them before importing.</p>
        
        <div className="max-h-60 overflow-y-auto mb-6 bg-white/5 rounded-md p-2">
          {jobData.contacts?.map((c: any, i: number) => (
            <div key={i} className="flex justify-between p-2 border-b border-gray-700 last:border-0 text-sm">
              <span className="font-medium">{c.name || 'Unknown'}</span>
              <span className="text-gray-400">{c.email}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleImport} loading={loading}>Import Contacts</Button>
        </div>
      </div>
    );
  }

  // Structured CSV/Excel mapper
  return (
    <div className="crm-card p-6 border border-[#6f3145]/30">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-xl font-semibold">Map Columns</h3>
      </div>
      <p className="text-gray-400 mb-6">Select which columns from your file match our standard fields.</p>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4 items-center">
          <label className="font-medium text-sm">Name Column:</label>
          <Select value={mapping.name} onChange={(e) => setMapping(s => ({ ...s, name: e.target.value }))}>
            <option value="">Select column...</option>
            {jobData.headers?.map((h: string) => <option key={h} value={h}>{h}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4 items-center">
          <label className="font-medium text-sm">Email Column:</label>
          <Select value={mapping.email} onChange={(e) => setMapping(s => ({ ...s, email: e.target.value }))}>
            <option value="">Select column...</option>
            {jobData.headers?.map((h: string) => <option key={h} value={h}>{h}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4 items-center">
          <label className="font-medium text-sm">Phone Column (Optional):</label>
          <Select value={mapping.phone} onChange={(e) => setMapping(s => ({ ...s, phone: e.target.value }))}>
            <option value="">Select column...</option>
            {jobData.headers?.map((h: string) => <option key={h} value={h}>{h}</option>)}
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={handleImport}
          loading={loading}
          disabled={!mapping.email || !mapping.name}
        >
          Import Contacts
        </Button>
      </div>
    </div>
  );
}
