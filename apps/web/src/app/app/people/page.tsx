'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  api,
  ApiError,
  personNidPath,
  personPhotoPath,
  uploadPersonNid,
  uploadPersonPhoto,
} from '@/lib/api';
import { EmptyState, Money, PageHeader, PersonAvatar, StatusBadge } from '@/components/ui';
import { PayrollSectionNav } from '@/components/section-nav';

type Person = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  nationalId?: string | null;
  taxIdentifier?: string | null;
  address?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  hireDate?: string | null;
  terminationDate?: string | null;
  status: string;
  tdsPercent?: string | null;
  photoUrl?: string | null;
  nidDocumentUrl?: string | null;
  compensations?: Array<{ grossPay: string }>;
};

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  title: '',
  nationalId: '',
  taxIdentifier: '',
  address: '',
  bankName: '',
  bankAccountNumber: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  hireDate: '',
  terminationDate: '',
  status: 'ACTIVE',
  grossPay: '',
  tdsPercent: '',
};

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [photoBust, setPhotoBust] = useState(0);
  const [nidBust, setNidBust] = useState(0);
  const [nidPreviewFailed, setNidPreviewFailed] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingNid, setUploadingNid] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    setPeople(await api<Person[]>('/api/v1/people'));
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load people'),
    );
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError(null);
    setMessage(null);
    setNidPreviewFailed(false);
  }

  function openEdit(person: Person) {
    setEditingId(person.id);
    setForm({
      name: person.name,
      email: person.email ?? '',
      phone: person.phone ?? '',
      title: person.title ?? '',
      nationalId: person.nationalId ?? '',
      taxIdentifier: person.taxIdentifier ?? '',
      address: person.address ?? '',
      bankName: person.bankName ?? '',
      bankAccountNumber: person.bankAccountNumber ?? '',
      emergencyContactName: person.emergencyContactName ?? '',
      emergencyContactPhone: person.emergencyContactPhone ?? '',
      hireDate: person.hireDate?.slice(0, 10) ?? '',
      terminationDate: person.terminationDate?.slice(0, 10) ?? '',
      status: person.status,
      grossPay: person.compensations?.[0]?.grossPay ?? '',
      tdsPercent: person.tdsPercent ?? '',
    });
    setShowForm(true);
    setError(null);
    setMessage(null);
    setNidPreviewFailed(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const payload = {
      ...form,
      email: form.email || undefined,
      phone: form.phone || undefined,
      title: form.title || undefined,
      nationalId: form.nationalId || undefined,
      taxIdentifier: form.taxIdentifier || undefined,
      address: form.address || undefined,
      bankName: form.bankName || undefined,
      bankAccountNumber: form.bankAccountNumber || undefined,
      emergencyContactName: form.emergencyContactName || undefined,
      emergencyContactPhone: form.emergencyContactPhone || undefined,
      hireDate: form.hireDate || undefined,
      terminationDate: form.terminationDate || undefined,
      grossPay: form.grossPay || undefined,
      tdsPercent: form.tdsPercent || undefined,
      status: form.status as 'ACTIVE' | 'INACTIVE' | 'TERMINATED',
    };
    try {
      if (editingId) {
        await api(`/api/v1/people/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setMessage('Employee updated.');
        await load();
      } else {
        const created = await api<Person>('/api/v1/people', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setEditingId(created.id);
        setMessage('Employee added — upload their profile photo and NID copy below.');
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function onPhotoSelected(file: File) {
    if (!editingId) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      await uploadPersonPhoto(editingId, file);
      setPhotoBust(Date.now());
      setMessage('Photo updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function onNidSelected(file: File) {
    if (!editingId) return;
    setUploadingNid(true);
    setError(null);
    try {
      await uploadPersonNid(editingId, file);
      setNidBust(Date.now());
      setNidPreviewFailed(false);
      setMessage('NID document uploaded.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload NID');
    } finally {
      setUploadingNid(false);
    }
  }

  const editingPerson = editingId ? people.find((p) => p.id === editingId) : null;

  return (
    <div className="ac-page">
      <PayrollSectionNav />
      <PageHeader
        title="People"
        description="Employee register for Bangladesh payroll — profile photo, NID copy, TIN, bank details, TDS %, and salary."
        actions={
          <button
            type="button"
            className="ac-btn-primary"
            onClick={() => (showForm ? (setShowForm(false), setEditingId(null)) : openCreate())}
          >
            {showForm ? 'Cancel' : 'Add employee'}
          </button>
        }
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-success">{message}</p> : null}

      {showForm ? (
        <form onSubmit={onSubmit} className="ac-card mb-6 space-y-4 p-5">
          <h2 className="font-display text-lg font-semibold">
            {editingId ? 'Edit employee' : 'New employee'}
          </h2>

          <div className="ac-card space-y-4 border border-line bg-paper p-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Profile photo &amp; NID copy</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Used on payslips and for HR records. PNG, JPEG, or WebP up to 5&nbsp;MB for
                photos; NID scan accepts images or PDF up to 10&nbsp;MB.
              </p>
            </div>

            {editingId && editingPerson ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Profile photo
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-line bg-paper">
                      {editingPerson.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={personPhotoPath(editingId, photoBust)}
                          alt={`${editingPerson.name} profile`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <PersonAvatar
                          personId={editingId}
                          name={editingPerson.name}
                          size="md"
                        />
                      )}
                    </div>
                    <label className="ac-btn-primary cursor-pointer text-xs">
                      {uploadingPhoto ? 'Uploading…' : 'Upload photo'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={uploadingPhoto}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void onPhotoSelected(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    NID document
                  </p>
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex h-20 w-28 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper">
                      {editingPerson.nidDocumentUrl && !nidPreviewFailed ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={personNidPath(editingId, nidBust)}
                          alt="NID document preview"
                          className="max-h-full max-w-full object-contain"
                          onError={() => setNidPreviewFailed(true)}
                        />
                      ) : editingPerson.nidDocumentUrl ? (
                        <span className="px-2 text-center text-xs text-muted">PDF document</span>
                      ) : (
                        <span className="text-xs text-muted">No NID</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="ac-btn-primary cursor-pointer text-xs">
                        {uploadingNid ? 'Uploading…' : 'Upload NID copy'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                          className="hidden"
                          disabled={uploadingNid}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void onNidSelected(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {editingPerson.nidDocumentUrl ? (
                        <a
                          className="ac-btn-secondary text-xs"
                          href={personNidPath(editingId, nidBust)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View NID
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted">
                Save the employee first, then upload their profile photo and NID scan here.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="ac-label">Full name</span>
              <input
                className="ac-input"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Designation</span>
              <input
                className="ac-input"
                placeholder="e.g. Accountant, Sales Executive"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Status</span>
              <select
                className="ac-input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="ac-label">Phone</span>
              <input
                className="ac-input"
                placeholder="+880 1XXX XXXXXX"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Email</span>
              <input
                className="ac-input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">NID (জাতীয় পরিচয়পত্র)</span>
              <input
                className="ac-input"
                placeholder="10 / 13 / 17 digit NID"
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Employee TIN (e-TIN)</span>
              <input
                className="ac-input"
                placeholder="12-digit e-TIN if applicable"
                value={form.taxIdentifier}
                onChange={(e) => setForm({ ...form, taxIdentifier: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="ac-label">Address</span>
              <textarea
                className="ac-input min-h-[72px]"
                placeholder="Present address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Join date</span>
              <input
                className="ac-input"
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Termination date</span>
              <input
                className="ac-input"
                type="date"
                value={form.terminationDate}
                onChange={(e) => setForm({ ...form, terminationDate: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Monthly gross (BDT)</span>
              <input
                className="ac-input"
                inputMode="decimal"
                placeholder="50000"
                value={form.grossPay}
                onChange={(e) => setForm({ ...form, grossPay: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">TDS % (source tax)</span>
              <input
                className="ac-input"
                inputMode="decimal"
                placeholder="e.g. 10 for 10%"
                value={form.tdsPercent}
                onChange={(e) => setForm({ ...form, tdsPercent: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Salary bank</span>
              <input
                className="ac-input"
                placeholder="e.g. City Bank, BRAC Bank"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Bank account no.</span>
              <input
                className="ac-input"
                placeholder="Account for net pay transfer"
                value={form.bankAccountNumber}
                onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Emergency contact name</span>
              <input
                className="ac-input"
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="ac-label">Emergency contact phone</span>
              <input
                className="ac-input"
                value={form.emergencyContactPhone}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="ac-btn-primary">
              {editingId ? 'Save changes' : 'Add employee'}
            </button>
            <button
              type="button"
              className="ac-btn-secondary"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              {editingId ? 'Done' : 'Cancel'}
            </button>
          </div>
        </form>
      ) : null}

      {people.length === 0 && !showForm ? (
        <EmptyState
          title="No employees yet"
          description="Add staff with NID, TIN, salary, and bank details — used when you run payroll."
          action={
            <button type="button" className="ac-btn-primary" onClick={openCreate}>
              Add employee
            </button>
          }
        />
      ) : people.length > 0 ? (
        <div className="ac-table-wrap">
          <table className="ac-table ac-table-zebra">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Designation</th>
                <th>NID / TIN</th>
                <th>Status</th>
                <th className="text-right">Gross (BDT)</th>
                <th className="text-right">TDS %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="hover:bg-brand-soft/30">
                  <td>
                    <PersonAvatar
                      personId={p.id}
                      name={p.name}
                      hasPhoto={Boolean(p.photoUrl)}
                      size="sm"
                    />
                  </td>
                  <td className="font-medium">
                    {p.name}
                    <div className="text-xs text-muted">
                      {[p.phone, p.email].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td>{p.title ?? '—'}</td>
                  <td className="font-mono text-xs">
                    {p.nationalId ? `NID ${p.nationalId}` : '—'}
                    {p.taxIdentifier ? (
                      <div className="text-muted">TIN {p.taxIdentifier}</div>
                    ) : null}
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-right">
                    {p.compensations?.[0] ? (
                      <Money amount={p.compensations[0].grossPay} />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-right font-mono text-sm">
                    {p.tdsPercent != null ? `${p.tdsPercent}%` : '—'}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="ac-btn-ghost text-xs"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
