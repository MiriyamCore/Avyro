'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { PageHeader } from '@/components/ui';

type Org = {
  id: string;
  name: string;
  legalName?: string | null;
  legalType: string;
  businessActivity?: string | null;
  countryCode: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  taxIdentifier?: string | null;
  vatIdentifier?: string | null;
  tradeLicenseNumber?: string | null;
  invoicePrefix?: string | null;
  defaultPaymentTermsDays?: number;
  logoUrl?: string | null;
  setupCompletedAt?: string | null;
};

type BankAccount = { id: string; name: string };

const STEPS = [
  { id: 1, title: 'Business' },
  { id: 2, title: 'IDs' },
  { id: 3, title: 'Bank' },
  { id: 4, title: 'Capital' },
  { id: 5, title: 'Invoices' },
] as const;

export default function BusinessSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [capitalPosted, setCapitalPosted] = useState(false);
  const [org, setOrg] = useState({
    name: '',
    legalName: '',
    legalType: 'Sole Proprietorship',
    businessActivity: 'Software & IT services',
    countryCode: 'BD',
    baseCurrency: 'BDT',
    fiscalYearStartMonth: 7,
    taxIdentifier: '',
    vatIdentifier: '',
    tradeLicenseNumber: '',
    invoicePrefix: 'INV-',
    defaultPaymentTermsDays: 30,
    logoUrl: '',
  });
  const [bankForm, setBankForm] = useState({
    name: 'Business BDT account',
    bankName: '',
    accountNumberMasked: '',
    currency: 'BDT',
  });
  const [capital, setCapital] = useState({
    amount: '50000',
    entryDate: new Date().toISOString().slice(0, 10),
    destination: 'bank' as 'cash' | 'bank',
    bankAccountId: '',
  });

  useEffect(() => {
    Promise.all([
      api<Org>('/api/v1/organizations/current'),
      api<BankAccount[]>('/api/v1/banking/accounts').catch(() => []),
    ])
      .then(([current, accounts]) => {
        setOrg({
          name: current.name ?? '',
          legalName: current.legalName ?? current.name ?? '',
          legalType: current.legalType ?? 'Sole Proprietorship',
          businessActivity: current.businessActivity ?? 'Software & IT services',
          countryCode: current.countryCode ?? 'BD',
          baseCurrency: current.baseCurrency ?? 'BDT',
          fiscalYearStartMonth: current.fiscalYearStartMonth ?? 7,
          taxIdentifier: current.taxIdentifier ?? '',
          vatIdentifier: current.vatIdentifier ?? '',
          tradeLicenseNumber: current.tradeLicenseNumber ?? '',
          invoicePrefix: current.invoicePrefix ?? 'INV-',
          defaultPaymentTermsDays: current.defaultPaymentTermsDays ?? 30,
          logoUrl: current.logoUrl ?? '',
        });
        setBanks(accounts);
        if (accounts[0]) {
          const first = accounts[0];
          setCapital((c) => ({ ...c, bankAccountId: first.id, destination: 'bank' }));
        } else {
          setCapital((c) => ({ ...c, destination: 'cash' }));
        }
        if (current.setupCompletedAt) setDone(true);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Unable to load business profile'),
      );
  }, []);

  async function saveBusiness(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/organizations/current', {
        method: 'PUT',
        body: JSON.stringify({
          name: org.name,
          legalName: org.legalName || org.name,
          legalType: org.legalType,
          businessActivity: org.businessActivity,
          countryCode: org.countryCode,
          baseCurrency: org.baseCurrency,
          fiscalYearStartMonth: org.fiscalYearStartMonth,
          fiscalYearStartDay: 1,
        }),
      });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save business');
    } finally {
      setSaving(false);
    }
  }

  async function saveIdentifiers(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/organizations/current', {
        method: 'PUT',
        body: JSON.stringify({
          taxIdentifier: org.taxIdentifier || null,
          vatIdentifier: org.vatIdentifier || null,
          tradeLicenseNumber: org.tradeLicenseNumber || null,
        }),
      });
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save identifiers');
    } finally {
      setSaving(false);
    }
  }

  async function refreshBanks() {
    const accounts = await api<BankAccount[]>('/api/v1/banking/accounts');
    setBanks(accounts);
    if (accounts[0] && !capital.bankAccountId) {
      const first = accounts[0];
      setCapital((c) => ({ ...c, bankAccountId: first.id, destination: 'bank' }));
    }
    return accounts;
  }

  async function saveBank(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const shouldCreate =
        bankForm.name.trim() &&
        (banks.length === 0 ||
          bankForm.bankName.trim() ||
          bankForm.accountNumberMasked.trim());
      if (shouldCreate) {
        await api('/api/v1/banking/accounts', {
          method: 'POST',
          body: JSON.stringify(bankForm),
        });
        await refreshBanks();
      } else {
        await refreshBanks();
      }
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save bank account');
    } finally {
      setSaving(false);
    }
  }

  async function saveCapital(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const amount = capital.amount.trim();
      if (amount && Number(amount) > 0) {
        await api('/api/v1/opening-balances/starting-capital', {
          method: 'POST',
          body: JSON.stringify({
            amount,
            entryDate: capital.entryDate,
            destination: capital.destination,
            bankAccountId:
              capital.destination === 'bank' ? capital.bankAccountId || undefined : undefined,
          }),
        });
        setCapitalPosted(true);
      }
      setStep(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record starting capital');
    } finally {
      setSaving(false);
    }
  }

  async function finish(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/v1/organizations/current', {
        method: 'PUT',
        body: JSON.stringify({
          invoicePrefix: org.invoicePrefix || 'INV-',
          defaultPaymentTermsDays: org.defaultPaymentTermsDays || 30,
          logoUrl: org.logoUrl || null,
          markSetupComplete: true,
        }),
      });
      setDone(true);
      setStep(5);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish setup');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ac-page mx-auto max-w-2xl">
      <PageHeader
        title="Business setup"
        description="Business profile, bank, starting money, and invoice defaults."
      />

      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <div className="mb-6 flex gap-1.5">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`flex-1 rounded-lg border px-1.5 py-2 text-[11px] font-semibold sm:text-xs ${
              step === s.id
                ? 'border-brand bg-brand text-white'
                : step > s.id
                  ? 'border-brand/30 bg-brand-soft text-ink'
                  : 'border-line bg-white text-muted'
            }`}
            onClick={() => {
              setDone(false);
              setStep(s.id);
            }}
          >
            {s.id}. {s.title}
          </button>
        ))}
      </div>

      {done ? (
        <div className="ac-card mb-6 p-8 text-center">
          <h2 className="font-display text-2xl font-semibold">Avyro is ready</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Your business profile is saved
            {capitalPosted ? ', including starting capital' : ''}. Create a customer and issue your
            first invoice whenever you are ready.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/app" className="ac-btn-primary">
              Go to dashboard
            </Link>
            <Link href="/app/customers?new=1" className="ac-btn-secondary">
              Add customer
            </Link>
            <button type="button" className="ac-btn-ghost" onClick={() => setDone(false)}>
              Edit setup
            </button>
          </div>
        </div>
      ) : null}

      {!done && step === 1 ? (
        <form onSubmit={saveBusiness} className="ac-card grid gap-4 p-5">
          <h2 className="font-display text-xl font-semibold">Your business</h2>
          <label>
            <span className="ac-label">Business name</span>
            <input
              className="ac-input"
              required
              value={org.name}
              onChange={(e) => setOrg({ ...org, name: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Legal name</span>
            <input
              className="ac-input"
              value={org.legalName}
              onChange={(e) => setOrg({ ...org, legalName: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Business type</span>
            <select
              className="ac-input"
              value={org.legalType}
              onChange={(e) => setOrg({ ...org, legalType: e.target.value })}
            >
              <option>Sole Proprietorship</option>
              <option>Partnership</option>
              <option>Private Limited</option>
              <option>Other</option>
            </select>
          </label>
          <label>
            <span className="ac-label">Activity</span>
            <input
              className="ac-input"
              value={org.businessActivity}
              onChange={(e) => setOrg({ ...org, businessActivity: e.target.value })}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className="ac-label">Country</span>
              <input
                className="ac-input"
                value={org.countryCode}
                onChange={(e) => setOrg({ ...org, countryCode: e.target.value.toUpperCase() })}
              />
            </label>
            <label>
              <span className="ac-label">Base currency</span>
              <input
                className="ac-input"
                value={org.baseCurrency}
                onChange={(e) => setOrg({ ...org, baseCurrency: e.target.value.toUpperCase() })}
              />
            </label>
            <label>
              <span className="ac-label">Financial year starts</span>
              <select
                className="ac-input"
                value={org.fiscalYearStartMonth}
                onChange={(e) =>
                  setOrg({ ...org, fiscalYearStartMonth: Number(e.target.value) })
                }
              >
                <option value={7}>July (BD income year)</option>
                <option value={1}>January</option>
                <option value={4}>April</option>
              </select>
            </label>
          </div>
          <button type="submit" className="ac-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </form>
      ) : null}

      {!done && step === 2 ? (
        <form onSubmit={saveIdentifiers} className="ac-card grid gap-4 p-5">
          <h2 className="font-display text-xl font-semibold">Business identifiers</h2>
          <p className="text-sm text-ink-soft">Optional — you can skip and add these later.</p>
          <label>
            <span className="ac-label">Trade licence</span>
            <input
              className="ac-input"
              value={org.tradeLicenseNumber}
              onChange={(e) => setOrg({ ...org, tradeLicenseNumber: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">TIN</span>
            <input
              className="ac-input"
              value={org.taxIdentifier}
              onChange={(e) => setOrg({ ...org, taxIdentifier: e.target.value })}
              placeholder="12-digit e-TIN when available"
            />
          </label>
          <label>
            <span className="ac-label">BIN</span>
            <input
              className="ac-input"
              value={org.vatIdentifier}
              onChange={(e) => setOrg({ ...org, vatIdentifier: e.target.value })}
              placeholder="13-digit BIN when VAT-registered"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="ac-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Continue'}
            </button>
            <button
              type="button"
              className="ac-btn-ghost"
              onClick={() => setStep(3)}
              disabled={saving}
            >
              Skip for now
            </button>
          </div>
        </form>
      ) : null}

      {!done && step === 3 ? (
        <form onSubmit={saveBank} className="ac-card grid gap-4 p-5">
          <h2 className="font-display text-xl font-semibold">Banking</h2>
          {banks.length > 0 ? (
            <div className="rounded-lg bg-paper px-3 py-2 text-sm text-ink-soft">
              Already set up: {banks.map((b) => b.name).join(', ')}
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Add a bank account, or skip and do it later.</p>
          )}
          <label>
            <span className="ac-label">Account name</span>
            <input
              className="ac-input"
              value={bankForm.name}
              onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Bank name</span>
            <input
              className="ac-input"
              value={bankForm.bankName}
              onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
              placeholder="Eastern Bank"
            />
          </label>
          <label>
            <span className="ac-label">Masked account number</span>
            <input
              className="ac-input"
              value={bankForm.accountNumberMasked}
              onChange={(e) =>
                setBankForm({ ...bankForm, accountNumberMasked: e.target.value })
              }
              placeholder="****4521"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="ac-btn-primary" disabled={saving}>
              {saving
                ? 'Saving…'
                : banks.length && !bankForm.bankName.trim() && !bankForm.accountNumberMasked.trim()
                  ? 'Continue'
                  : banks.length
                    ? 'Add another & continue'
                    : 'Save & continue'}
            </button>
            <button
              type="button"
              className="ac-btn-ghost"
              onClick={async () => {
                await refreshBanks().catch(() => undefined);
                setStep(4);
              }}
              disabled={saving}
            >
              Skip for now
            </button>
          </div>
        </form>
      ) : null}

      {!done && step === 4 ? (
        <form onSubmit={saveCapital} className="ac-card grid gap-4 p-5">
          <h2 className="font-display text-xl font-semibold">Starting capital</h2>
          <p className="text-sm text-ink-soft">
            Example: you started the business with ৳50,000 of your own money. This puts cash/bank up
            and owner capital up — not sales.
          </p>
          <label>
            <span className="ac-label">Amount ({org.baseCurrency || 'BDT'})</span>
            <input
              className="ac-input"
              inputMode="decimal"
              value={capital.amount}
              onChange={(e) => setCapital({ ...capital, amount: e.target.value })}
              placeholder="50000"
            />
          </label>
          <label>
            <span className="ac-label">Date money was introduced</span>
            <input
              className="ac-input"
              type="date"
              required
              value={capital.entryDate}
              onChange={(e) => setCapital({ ...capital, entryDate: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Where is the money?</span>
            <select
              className="ac-input"
              value={capital.destination}
              onChange={(e) =>
                setCapital({
                  ...capital,
                  destination: e.target.value as 'cash' | 'bank',
                })
              }
            >
              <option value="bank">In the bank</option>
              <option value="cash">Cash on hand</option>
            </select>
          </label>
          {capital.destination === 'bank' ? (
            <label>
              <span className="ac-label">Bank account</span>
              {banks.length === 0 ? (
                <p className="mt-1 text-sm text-warning">
                  No bank account yet — go back a step to add one, or choose cash on hand.
                </p>
              ) : (
                <select
                  className="ac-input"
                  required
                  value={capital.bankAccountId}
                  onChange={(e) => setCapital({ ...capital, bankAccountId: e.target.value })}
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="ac-btn-primary"
              disabled={
                saving ||
                (capital.destination === 'bank' && banks.length === 0 && Number(capital.amount) > 0)
              }
            >
              {saving
                ? 'Saving…'
                : Number(capital.amount) > 0
                  ? 'Record starting capital'
                  : 'Continue'}
            </button>
            <button
              type="button"
              className="ac-btn-ghost"
              onClick={() => setStep(5)}
              disabled={saving}
            >
              Skip — started with zero
            </button>
          </div>
        </form>
      ) : null}

      {!done && step === 5 ? (
        <form onSubmit={finish} className="ac-card grid gap-4 p-5">
          <h2 className="font-display text-xl font-semibold">Invoice defaults</h2>
          <label>
            <span className="ac-label">Invoice prefix</span>
            <input
              className="ac-input"
              value={org.invoicePrefix}
              onChange={(e) => setOrg({ ...org, invoicePrefix: e.target.value })}
            />
          </label>
          <label>
            <span className="ac-label">Payment terms (days)</span>
            <input
              className="ac-input"
              type="number"
              min={0}
              value={org.defaultPaymentTermsDays}
              onChange={(e) =>
                setOrg({ ...org, defaultPaymentTermsDays: Number(e.target.value) })
              }
            />
          </label>
          <label>
            <span className="ac-label">Logo URL (optional)</span>
            <input
              className="ac-input"
              value={org.logoUrl}
              onChange={(e) => setOrg({ ...org, logoUrl: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <button type="submit" className="ac-btn-primary" disabled={saving}>
            {saving ? 'Finishing…' : 'Finish setup'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
