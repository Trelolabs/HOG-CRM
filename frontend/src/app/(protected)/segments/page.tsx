'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import type { Segment } from '@/lib/types';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import ConfirmModal from '@/components/ui/ConfirmModal';

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [deletingSegmentId, setDeletingSegmentId] = useState<string | null>(null);
  const [segmentToDelete, setSegmentToDelete] = useState<Segment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const data = await apiClient.get<Segment[]>('/api/segments');

      setSegments(data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load segments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const validateForm = () => {
    const validationErrors: Record<string, string> = {};

    if (!name.trim()) {
      validationErrors.name = 'Segment name is required';
    }

    setErrors(validationErrors);

    return Object.keys(validationErrors).length === 0;
  };

  const createSegment = async (event: FormEvent) => {
    event.preventDefault();

    setErrorMessage('');

    const isValid = validateForm();

    if (!isValid) {
      return;
    }

    try {
      setCreating(true);

      await apiClient.post('/api/segments', {
        name: name.trim(),
        description: description.trim(),
      });

      setName('');
      setDescription('');
      setErrors({});
      setShowCreateModal(false);
      toast.success(`Segment "${name.trim()}" created successfully`);

      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create segment';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const removeSegment = async () => {
    if (!segmentToDelete) return;

    try {
      setDeletingSegmentId(segmentToDelete.id);

      await apiClient.delete(`/api/segments/${segmentToDelete.id}`);

      setShowDeleteModal(false);
      toast.success(`Segment "${segmentToDelete.name}" deleted successfully`);
      setSegmentToDelete(null);

      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete segment';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setDeletingSegmentId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Segments"
        subtitle="Create and manage lead groups."
        action={
          <Button
            variant="primary"
            onClick={() => {
              setShowCreateModal(true);
              setErrors({});
              setErrorMessage('');
            }}
          >
            Create Segment
          </Button>
        }
      />

      {errorMessage ? (
        <p className="mb-3 text-sm text-red-600">{errorMessage}</p>
      ) : null}

      <DataTable
        headers={['Name', 'Description', 'Lead count', 'Actions']}
        loading={loading}
        rows={segments.map((segment) => [
          segment.name,
          segment.description || '-',
          String(segment._count?.leads ?? 0),
          <Button
            key={segment.id}
            variant="ghost"
            onClick={() => {
              setSegmentToDelete(segment);
              setShowDeleteModal(true);
            }}
          >
            Delete
          </Button>,
        ])}
      />

      <Modal
        open={showCreateModal}
        title="Create segment"
        onClose={() => {
          setShowCreateModal(false);
          setErrors({});
        }}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                setErrors({});
              }}
              disabled={creating}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              loading={creating}
              type="submit"
              form="create-segment-form"
            >
              Create
            </Button>
          </>
        }
      >
        <form
          id="create-segment-form"
          className="space-y-3"
          onSubmit={createSegment}
        >
          <Input
            label="Segment name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);

              if (errors.name) {
                setErrors((prev) => ({
                  ...prev,
                  name: '',
                }));
              }
            }}
            placeholder="Enterprise Prospects"
            error={errors.name}
          />

          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional segment description"
            error={errors.description}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={showDeleteModal}
        title="Delete segment"
        description={`Delete ${
          segmentToDelete?.name || 'this segment'
        }? Assigned leads will be unassigned.`}
        confirmLabel="Delete"
        loading={Boolean(deletingSegmentId)}
        onClose={() => {
          setShowDeleteModal(false);
          setSegmentToDelete(null);
        }}
        onConfirm={removeSegment}
      />
    </div>
  );
}