'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, uploadReceipt } from '@/lib/api';
import { EmptyState, PageHeader } from '@/components/ui';
import { PurchasesSectionNav } from '@/components/section-nav';

type DocLink = {
  id: string;
  entityType: string;
  entityId: string;
  label?: string | null;
};

type DocumentRow = {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  category: string;
  createdAt: string;
  links: DocLink[];
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const rows = await api<DocumentRow[]>('/api/v1/documents');
    setDocs(rows);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Failed to load documents'),
    );
  }, []);

  return (
    <div className="ac-page">
      <PageHeader
        title="Receipts"
        description="Receipts and files stored for this business."
        actions={
          <label className="ac-btn-primary cursor-pointer text-xs">
            {uploading ? 'Uploading…' : 'Upload file'}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setUploading(true);
                setError(null);
                try {
                  await uploadReceipt(file);
                  await load();
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : 'Upload failed');
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        }
      />
      <PurchasesSectionNav />

      {error ? (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {docs.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Attach receipts from Expenses or Bills, or upload a file here."
        />
      ) : (
        <div className="ac-card overflow-x-auto">
          <table className="ac-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Category</th>
                <th>Linked to</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.id}>
                  <td className="font-medium">{doc.originalFilename}</td>
                  <td>{doc.category}</td>
                  <td className="text-sm text-ink-soft">
                    {doc.links.length
                      ? doc.links
                          .map((l) => `${l.label ?? l.entityType} (${l.entityId.slice(0, 8)}…)`)
                          .join(', ')
                      : '—'}
                  </td>
                  <td className="font-mono text-sm">
                    {(doc.fileSize / 1024).toFixed(1)} KB
                  </td>
                  <td>{doc.createdAt.slice(0, 10)}</td>
                  <td className="text-right">
                    <a
                      className="text-xs font-semibold text-brand"
                      href={`/api/v1/documents/${doc.id}/download`}
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
