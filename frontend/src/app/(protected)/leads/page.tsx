'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { apiClient } from '@/lib/apiClient';
import type { Lead, LeadStatus, Segment } from '@/lib/types';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Spinner from '@/components/ui/Spinner';

const statuses: LeadStatus[] = ['NEW', 'QUALIFIED', 'CONTACTED', 'CLOSED'];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [initialLoading, setInitialLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const requestIdRef = useRef(0);
  const firstLoadDoneRef = useRef(false);

  const loadSegments = useCallback(async () => {
    const segmentData = await apiClient.get<Segment[]>('/api/segments');
    setSegments(segmentData);
  }, []);

  const loadLeads = useCallback(async (options?: { isManualRefresh?: boolean }) => {
    const isManualRefresh = Boolean(options?.isManualRefresh);
    const requestId = ++requestIdRef.current;
    const isInitialLoad = !firstLoadDoneRef.current;

    if (isManualRefresh) {
      setRefreshing(true);
    }
    if (isInitialLoad) {
      setInitialLoading(true);
    } else {
      setTableLoading(true);
    }
    const query = new URLSearchParams({
      limit: '100',
      sortBy: 'createdAt',
      sortOrder,
      ...(appliedSearch ? { search: appliedSearch } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    });

    try {
      const leadData = await apiClient.get<{ data: Lead[] }>(`/api/leads?${query}`);
      if (requestId !== requestIdRef.current) return;
      setLeads(leadData.data);
      setErrorMessage('');
      firstLoadDoneRef.current = true;
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Failed to fetch leads');
    } finally {
      if (requestId !== requestIdRef.current) return;
      setInitialLoading(false);
      setTableLoading(false);
      setRefreshing(false);
    }
  }, [appliedSearch, sortOrder, statusFilter]);

  const updateLead = useCallback(async (id: string, body: { status?: string; segmentId?: string | null }) => {
    try {
      setUpdatingLeadId(id);
      setErrorMessage('');
      await apiClient.patch(`/api/leads/${id}`, body);
      await loadLeads();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update lead');
    } finally {
      setUpdatingLeadId(null);
    }
  }, [loadLeads]);

  const removeLead = useCallback(async () => {
    if (!leadToDelete) return;
    try {
      setDeletingLeadId(leadToDelete.id);
      setErrorMessage('');
      await apiClient.delete(`/api/leads/${leadToDelete.id}`);
      setShowDeleteModal(false);
      setLeadToDelete(null);
      toast.success(`${leadToDelete.fullName} deleted successfully`);
      await loadLeads();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete lead';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setDeletingLeadId(null);
    }
  }, [leadToDelete, loadLeads]);

  const onExport = async () => {
    try {
      setExporting(true);
      setErrorMessage('');
      const response = await fetch('/api/tools/export', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to download leads export');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'leads_export.xlsx';
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Leads downloaded successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export leads';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const downloadSampleFile = () => {
    const sampleCsv = `fullName,email,whatsapp,businessName,serviceInterest,message,status\nJane Doe,jane@example.com,+1234567890,Acme Inc,Paid Ads,Need lead generation support,NEW`;
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'leads-import-sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const toCsvFile = async (file: File): Promise<File> => {
    if (file.name.toLowerCase().endsWith('.csv')) return file;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    const csv = XLSX.utils.sheet_to_csv(firstSheet);
    return new File([csv], file.name.replace(/\.(xlsx|xls)$/i, '.csv'), { type: 'text/csv' });
  };

  const onImport = async () => {
    if (!importFile) return;
    try {
      setImporting(true);
      const csvFile = await toCsvFile(importFile);
      const formData = new FormData();
      formData.append('file', csvFile);
      const response = await fetch('/api/tools/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Import failed');
      }
      const failedRows = payload.failedRows ?? 0;
      const message = payload.message || 'Import completed.';
      if (failedRows > 0) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
      await loadLeads();
      setImportFile(null);
      setShowImportModal(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([loadLeads(), loadSegments()]).catch(() => {
        setInitialLoading(false);
        setTableLoading(false);
        setRefreshing(false);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLeads, loadSegments]);

  const rows = useMemo(
    () =>
      leads.map((lead) => [
        <div key={`${lead.id}-name`}>
          <p className="font-medium">{lead.fullName}</p>
          <p className="text-xs text-[var(--muted)]">{lead.email}</p>
        </div>,
        lead.businessName || '-',
        lead.segment?.name || 'Unassigned',
        <Badge key={`${lead.id}-status`} value={lead.status} />,
        <div key={`${lead.id}-actions`} className="flex items-center justify-end gap-2">
          <div className="w-36">
            <Select
              value={lead.status}
              onChange={(event) => updateLead(lead.id, { status: event.target.value })}
              disabled={updatingLeadId === lead.id}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Select
              value={lead.segmentId || ''}
              onChange={(event) => updateLead(lead.id, { segmentId: event.target.value || null })}
              disabled={updatingLeadId === lead.id}
            >
              <option value="">No segment</option>
              {segments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setLeadToDelete(lead);
              setShowDeleteModal(true);
            }}
            disabled={deletingLeadId === lead.id}
          >
            {deletingLeadId === lead.id ? <Spinner dark /> : null}
            Delete
          </Button>
          {updatingLeadId === lead.id ? <Spinner dark /> : null}
        </div>,
      ]),
    [deletingLeadId, leads, segments, updatingLeadId, updateLead]
  );

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Search, filter, and manage lead lifecycle."
        action={<div className="flex gap-2">
          <Button variant="ghost" onClick={onExport} loading={exporting}>Download Leads</Button>
          <Button variant="primary" onClick={() => setShowImportModal(true)}>Upload Leads</Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await Promise.all([loadLeads({ isManualRefresh: true }), loadSegments()]);
            }}
            loading={refreshing}
          >
            Refresh
          </Button>
        </div>}
      />
      {errorMessage ? <p className="mb-3 text-sm text-red-600">{errorMessage}</p> : null}
      <div className="crm-card mb-4 flex flex-wrap justify-between gap-3 p-3">
        <div className="flex gap-2">
          <Input
            className="max-w-64"
            placeholder="Search by name, email, mobile, business"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setAppliedSearch(searchInput);
              }
            }}
          />
          <Button variant="ghost" onClick={() => setAppliedSearch(searchInput.trim())}>
            Search
          </Button>
        </div>
        <div className="flex gap-2">
          <Select className="max-w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
          <Select
            className="max-w-44"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </Select>
        </div>
      </div>
      <DataTable
        headers={['Lead', 'Business', 'Segment', 'Status', 'Actions']}
        headerClassNames={['', '', '', '', '!text-center']}
        rows={rows}
        loading={initialLoading || tableLoading}
      />

      <Modal
        open={showImportModal}
        title="Upload leads"
        onClose={() => setShowImportModal(false)}
        footer={
          <>
            <Button variant="ghost" onClick={downloadSampleFile}>Download sample file</Button>
            <Button variant="primary" onClick={onImport} loading={importing} disabled={!importFile}>
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Upload a CSV or Excel file (.csv, .xlsx, .xls). Excel files are converted before import.
          </p>
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => setImportFile(event.target.files?.[0] || null)}
          />
        </div>
      </Modal>

      <ConfirmModal
        open={showDeleteModal}
        title="Delete lead"
        description={`Delete ${leadToDelete?.fullName || 'this lead'}? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={Boolean(deletingLeadId)}
        onClose={() => {
          setShowDeleteModal(false);
          setLeadToDelete(null);
        }}
        onConfirm={removeLead}
      />
    </div>
  );
}
