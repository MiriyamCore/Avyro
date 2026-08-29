'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Money, PageHeader, StatusBadge } from '@/components/ui';

type Profile = {
  vatRegistered: boolean;
  notes?: string | null;
  taxIdentifier?: string | null;
  vatIdentifier?: string | null;
  tradeLicenseNumber?: string | null;
  name: string;
};

type RecordRow = {
  id: string;
  type: string;
  label: string;
  identifier?: string | null;
  expiresOn?: string | null;
  status: string;
};

type TaxCode = {
  id: string;
  code: string;
  name: string;
  kind: string;
  ratePercent: string | null;
};

export default function CompliancePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [reminders, setReminders] = useState<RecordRow[]>([]);
  const [challans, setChallans] = useState<
    Array<{ id: string; type: string; amount: string; reference?: string | null }>
  >([]);
  const [vatDocs, setVatDocs] = useState<
    Array<{ id: string; type: string; partyName?: string | null; vatAmount: string; status: string }>
  >([]);
  const [exports, setExports] = useState<
    Array<{ id: string; formCRef?: string | null; erqRef?: string | null; remittanceNotes?: string | null }>
  >([]);
  const [withholdings, setWithholdings] = useState<
    Array<{
      id: string;
      kind: string;
      amount: string;
      baseAmount: string;
      challanId?: string | null;
      challan?: { id: string; reference?: string | null } | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'TIN',
    label: '',
    identifier: '',
    expiresOn: '',
  });
  const [challanForm, setChallanForm] = useState({
    type: 'TDS',
    amount: '',
    reference: '',
    paidOn: new Date().toISOString().slice(0, 10),
  });
  const [exportForm, setExportForm] = useState({
    formCRef: '',
    erqRef: '',
    remittanceNotes: '',
  });
  const [vatForm, setVatForm] = useState({
    type: 'MUSHAK_6_1',
    partyName: '',
    taxableAmount: '',
    vatAmount: '',
    notes: '',
  });
  const [mushakPeriod, setMushakPeriod] = useState({
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
  });

  async function load() {
    const [p, r, t, rem, ch, vd, se, wh] = await Promise.all([
      api<Profile>('/api/v1/compliance/profile'),
      api<RecordRow[]>('/api/v1/compliance/records'),
      api<TaxCode[]>('/api/v1/compliance/tax-codes'),
      api<RecordRow[]>('/api/v1/compliance/reminders'),
      api<typeof challans>('/api/v1/compliance/challans'),
      api<typeof vatDocs>('/api/v1/compliance/vat-documents'),
      api<typeof exports>('/api/v1/compliance/service-exports'),
      api<typeof withholdings>('/api/v1/compliance/withholdings'),
    ]);
    setProfile(p);
    setRecords(r);
    setTaxCodes(t);
    setReminders(rem);
    setChallans(ch);
    setVatDocs(vd);
    setExports(se);
    setWithholdings(wh);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : 'Unable to load compliance'),
    );
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setError(null);
    try {
      await api('/api/v1/compliance/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function addRecord(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/v1/compliance/records', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          expiresOn: form.expiresOn || undefined,
        }),
      });
      setForm({ type: 'TIN', label: '', identifier: '', expiresOn: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save record');
    }
  }

  return (
    <div className="ac-page">
      <PageHeader
        title="Bangladesh compliance"
        description="Tax codes, VAT documents, withholdings, and Mushak register exports for this business."
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              className="ac-btn-secondary text-xs"
              href="/api/v1/compliance/registers/sales.csv"
            >
              Sales register CSV
            </a>
            <a
              className="ac-btn-secondary text-xs"
              href="/api/v1/compliance/registers/sales.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Sales register PDF
            </a>
            <a
              className="ac-btn-secondary text-xs"
              href="/api/v1/compliance/registers/purchase.csv"
            >
              Purchase / withholding CSV
            </a>
            <a
              className="ac-btn-secondary text-xs"
              href="/api/v1/compliance/registers/purchase.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Purchase register PDF
            </a>
            <a
              className="ac-btn-secondary text-xs"
              href={`/api/v1/compliance/registers/mushak-9.1.csv?year=${mushakPeriod.year}&month=${mushakPeriod.month}`}
            >
              Mushak 9.1 CSV
            </a>
            <a
              className="ac-btn-secondary text-xs"
              href={`/api/v1/compliance/registers/mushak-9.1.pdf?year=${mushakPeriod.year}&month=${mushakPeriod.month}`}
              target="_blank"
              rel="noreferrer"
            >
              Mushak 9.1 PDF
            </a>
            <a className="ac-btn-secondary text-xs" href="/api/v1/compliance/registers/combined-6.2.1.csv">
              Combined 6.2.1 CSV
            </a>
            <a
              className="ac-btn-secondary text-xs"
              href="/api/v1/compliance/registers/combined-6.2.1.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Combined 6.2.1 PDF
            </a>
            <a className="ac-btn-secondary text-xs" href="/api/v1/compliance/registers/vds-6.6.csv">
              VDS 6.6 CSV
            </a>
            <a className="ac-btn-secondary text-xs" href="/api/v1/compliance/registers/vds-6.10.csv">
              VDS 6.10 CSV
            </a>
            <a className="ac-btn-secondary text-xs" href="/api/v1/compliance/registers/credit-notes-6.7.csv">
              Credit notes 6.7
            </a>
            <a className="ac-btn-secondary text-xs" href="/api/v1/compliance/registers/debit-notes-6.8.csv">
              Debit notes 6.8
            </a>
            <a className="ac-btn-secondary text-xs" href="/api/v1/compliance/e-return-pack" target="_blank" rel="noreferrer">
              e-Return evidence pack
            </a>
            <button
              type="button"
              className="ac-btn-secondary text-xs"
              onClick={async () => {
                await api('/api/v1/compliance/tax-codes/ensure-defaults', {
                  method: 'POST',
                });
                await load();
              }}
            >
              Seed default tax rates
            </button>
          </div>
        }
      />
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="ac-card mb-6 flex flex-wrap items-end gap-3 p-4">
        <label>
          <span className="ac-label">Mushak 9.1 year</span>
          <input
            className="ac-input w-24"
            value={mushakPeriod.year}
            onChange={(e) => setMushakPeriod({ ...mushakPeriod, year: e.target.value })}
          />
        </label>
        <label>
          <span className="ac-label">Month</span>
          <input
            className="ac-input w-16"
            value={mushakPeriod.month}
            onChange={(e) => setMushakPeriod({ ...mushakPeriod, month: e.target.value })}
          />
        </label>
      </div>

      {reminders.length > 0 ? (
        <div className="ac-card mb-6 border-amber-200 bg-amber-50 p-4 text-sm text-warning">
          {reminders.length} record(s) expiring within 60 days.
        </div>
      ) : null}

      {profile ? (
        <form onSubmit={saveProfile} className="ac-card mb-6 grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-semibold sm:col-span-2">
            {profile.name} profile
          </h2>
          <label>
            <span className="ac-label">TIN (e-TIN)</span>
            <input
              className="ac-input"
              value={profile.taxIdentifier ?? ''}
              onChange={(e) => setProfile({ ...profile, taxIdentifier: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">BIN / VAT</span>
            <input
              className="ac-input"
              value={profile.vatIdentifier ?? ''}
              onChange={(e) => setProfile({ ...profile, vatIdentifier: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Trade licence</span>
            <input
              className="ac-input"
              value={profile.tradeLicenseNumber ?? ''}
              onChange={(e) =>
                setProfile({ ...profile, tradeLicenseNumber: e.target.value })
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.vatRegistered}
              onChange={(e) => setProfile({ ...profile, vatRegistered: e.target.checked })}
            />
            VAT registered
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="ac-btn-primary">
              Save profile
            </button>
          </div>
        </form>
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={addRecord} className="ac-card grid gap-3 p-5">
          <h2 className="font-display text-lg font-semibold">Add record</h2>
          <select
            className="ac-input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {['TRADE_LICENCE', 'TIN', 'BIN_VAT', 'FORM_C', 'ERQ', 'OTHER'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            className="ac-input"
            placeholder="Label"
            required
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
          <input
            className="ac-input"
            placeholder="Identifier"
            value={form.identifier}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
          />
          <input
            className="ac-input"
            type="date"
            value={form.expiresOn}
            onChange={(e) => setForm({ ...form, expiresOn: e.target.value })}
          />
          <button type="submit" className="ac-btn-secondary">
            Save record
          </button>
          <div className="divide-y divide-line pt-2">
            {records.map((r) => (
              <div key={r.id} className="flex justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">
                    {r.type} — {r.label}
                  </div>
                  <div className="text-xs text-muted">{r.identifier}</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </form>

        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">Tax codes</h2>
          <p className="mt-1 text-xs text-muted">
            Set a rate to enable auto VAT/TDS/VDS on invoices and bills.
          </p>
          <div className="mt-3 divide-y divide-line">
            {taxCodes.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <div className="font-medium">
                    {t.code} · {t.kind}
                  </div>
                  <div className="text-muted">{t.name}</div>
                </div>
                <input
                  className="ac-input w-28"
                  placeholder="rate %"
                  defaultValue={t.ratePercent ?? ''}
                  onBlur={async (e) => {
                    const value = e.target.value.trim();
                    await api(`/api/v1/compliance/tax-codes/${t.id}`, {
                      method: 'PUT',
                      body: JSON.stringify({ ratePercent: value || null }),
                    });
                    await load();
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <form
          className="ac-card grid gap-3 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            await api('/api/v1/compliance/challans', {
              method: 'POST',
              body: JSON.stringify(challanForm),
            });
            setChallanForm({
              type: 'TDS',
              amount: '',
              reference: '',
              paidOn: new Date().toISOString().slice(0, 10),
            });
            await load();
          }}
        >
          <h2 className="font-display text-lg font-semibold">Challans</h2>
          <select
            className="ac-input"
            value={challanForm.type}
            onChange={(e) => setChallanForm({ ...challanForm, type: e.target.value })}
          >
            {['TDS', 'VDS', 'VAT', 'OTHER'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <input
            className="ac-input"
            placeholder="Amount"
            required
            value={challanForm.amount}
            onChange={(e) => setChallanForm({ ...challanForm, amount: e.target.value })}
          />
          <input
            className="ac-input"
            placeholder="Reference"
            value={challanForm.reference}
            onChange={(e) => setChallanForm({ ...challanForm, reference: e.target.value })}
          />
          <button type="submit" className="ac-btn-secondary">
            Add challan
          </button>
          <div className="divide-y divide-line">
            {challans.map((c) => (
              <div key={c.id} className="flex justify-between py-2 text-sm">
                <span>
                  {c.type} {c.reference}
                </span>
                <Money amount={c.amount} />
              </div>
            ))}
          </div>
        </form>

        <form
          className="ac-card grid gap-3 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            await api('/api/v1/compliance/service-exports', {
              method: 'POST',
              body: JSON.stringify(exportForm),
            });
            setExportForm({ formCRef: '', erqRef: '', remittanceNotes: '' });
            await load();
          }}
        >
          <h2 className="font-display text-lg font-semibold">Export evidence (Form-C / ERQ)</h2>
          <input
            className="ac-input"
            placeholder="Form-C ref"
            value={exportForm.formCRef}
            onChange={(e) => setExportForm({ ...exportForm, formCRef: e.target.value })}
          />
          <input
            className="ac-input"
            placeholder="ERQ ref"
            value={exportForm.erqRef}
            onChange={(e) => setExportForm({ ...exportForm, erqRef: e.target.value })}
          />
          <input
            className="ac-input"
            placeholder="Remittance notes"
            value={exportForm.remittanceNotes}
            onChange={(e) =>
              setExportForm({ ...exportForm, remittanceNotes: e.target.value })
            }
          />
          <button type="submit" className="ac-btn-secondary">
            Save export record
          </button>
          <div className="divide-y divide-line text-sm">
            {exports.map((x) => (
              <div key={x.id} className="py-2">
                Form-C: {x.formCRef || '—'} · ERQ: {x.erqRef || '—'}
                <div className="text-xs text-muted">{x.remittanceNotes}</div>
              </div>
            ))}
          </div>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">VAT documents / registers</h2>
          <form
            className="mt-3 grid gap-2 border-b border-line pb-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await api('/api/v1/compliance/vat-documents', {
                method: 'POST',
                body: JSON.stringify(vatForm),
              });
              setVatForm({
                type: 'MUSHAK_6_1',
                partyName: '',
                taxableAmount: '',
                vatAmount: '',
                notes: '',
              });
              await load();
            }}
          >
            <select
              className="ac-input"
              value={vatForm.type}
              onChange={(e) => setVatForm({ ...vatForm, type: e.target.value })}
            >
              {['MUSHAK_6_1', 'MUSHAK_6_3', 'MUSHAK_9_1', 'OTHER'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input
              className="ac-input"
              placeholder="Party name"
              value={vatForm.partyName}
              onChange={(e) => setVatForm({ ...vatForm, partyName: e.target.value })}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="ac-input"
                placeholder="Taxable amount"
                required
                value={vatForm.taxableAmount}
                onChange={(e) => setVatForm({ ...vatForm, taxableAmount: e.target.value })}
              />
              <input
                className="ac-input"
                placeholder="VAT amount"
                required
                value={vatForm.vatAmount}
                onChange={(e) => setVatForm({ ...vatForm, vatAmount: e.target.value })}
              />
            </div>
            <button type="submit" className="ac-btn-secondary text-xs">
              Create VAT document
            </button>
          </form>
          <p className="mt-1 text-xs text-muted">
            Auto-created from taxed invoices. Download CSV/PDF registers above for Mushak worksheets.
          </p>
          <div className="mt-3 divide-y divide-line text-sm">
            {vatDocs.map((d) => (
              <div key={d.id} className="flex justify-between py-2">
                <span>
                  {d.type} · {d.partyName}
                </span>
                <Money amount={d.vatAmount} />
              </div>
            ))}
            {vatDocs.length === 0 ? (
              <p className="py-3 text-muted">
                Created automatically when taxed invoices issue.
              </p>
            ) : null}
          </div>
        </div>
        <div className="ac-card p-5">
          <h2 className="font-display text-lg font-semibold">Withholdings</h2>
          <div className="mt-3 divide-y divide-line text-sm">
            {withholdings.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {w.kind} on <Money amount={w.baseAmount} />
                </span>
                <div className="flex items-center gap-2">
                  <Money amount={w.amount} />
                  <select
                    className="ac-input py-1 text-xs"
                    value={w.challanId ?? ''}
                    onChange={async (e) => {
                      await api(`/api/v1/compliance/withholdings/${w.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          challanId: e.target.value || null,
                        }),
                      });
                      await load();
                    }}
                  >
                    <option value="">Link challan…</option>
                    {challans.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.type} {c.reference || c.id.slice(0, 6)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {withholdings.length === 0 ? (
              <p className="py-3 text-muted">
                Created when TDS/VDS tax codes are used on bills.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
