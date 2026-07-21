// =============================================================================
// Company Accounts & Pricing -- Create Company wizard
// =============================================================================
// The screenshots show a 6-step wizard (Company / Account / Primary User /
// Addresses / Pricing / Review). Only the first 3 are real here -- Addresses
// is Phase 3 (company_addresses doesn't exist yet) and Pricing is Phase 9
// (company_price_overrides doesn't exist yet), so steps 4-6 render as
// disabled "later phase" chips in the step indicator rather than being
// faked, same "don't fake, note where a later phase wires it in" precedent
// as ControlRoomPage.tsx/controlRoomStore.ts.
//
// The 3 real steps repurpose AdminCompanyWizard.tsx's existing 3 (Company
// Details -> Customer Users -> Assign Speedpanel Team), reordered to match
// the screenshots exactly: Company (all company-level fields, single
// admin_create_company call -- Phase 2 added payment_terms/internal_notes/
// account code to that same call rather than a separate patch step, since
// the RPC is already single-shot) -> Account (StaffTeamAssignmentPanel.tsx,
// reused verbatim -- the screenshot's step-3 "Internal owner" summary field
// is already set by the time Primary User is reached, meaning Account/
// owner-assignment happens BEFORE the customer invite, not after) ->
// Primary User (a single owner-role invite, restricted from the old
// multi-invite CustomerUsersStep down to exactly one person, matching the
// screenshot's "One primary user is required" copy).
// =============================================================================
import { useState } from "react";
import { cx, NAVY, BLUE, MUTED } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { Field, TextAreaField } from "../../shared/fields";
import { useCompanyMembers } from "../../company/companyStore";
import { useAdminCreateCompany } from "../../admin/companies/companiesStore";
import { StaffTeamAssignmentPanel } from "../../admin/companies/StaffTeamAssignmentPanel";
import type { Route } from "../../../appShell/useHashRoute";

const REAL_STEPS = ["Company", "Account", "Primary User"] as const;
const FUTURE_STEPS = ["Addresses", "Pricing", "Review"] as const;

const StepIndicator = ({ step }: { step: 1 | 2 | 3 }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold">
    {REAL_STEPS.map((label, i) => (
      <span key={label} style={{ color: i + 1 === step ? BLUE : MUTED }}>
        {i > 0 && <span className="mx-1">&rarr;</span>}{i + 1} {label}
      </span>
    ))}
    {FUTURE_STEPS.map(label => (
      <span key={label} className="opacity-40" style={{ color: MUTED }} title="Coming in a later phase">
        <span className="mx-1">&rarr;</span>{label}
      </span>
    ))}
  </div>
);

const CompanyDetailsStep = ({ onCreated }: { onCreated: (companyId: string) => void }) => {
  const { submitting, createCompany } = useAdminCreateCompany();
  const [legalName, setLegalName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [abn, setAbn] = useState("");
  const [customerAccountNumber, setCustomerAccountNumber] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName.trim()) return;
    setError(null);
    const { id, error: err } = await createCompany({
      legalName: legalName.trim(), tradingName, abn, customerAccountNumber, billingEmail, phone, address,
      paymentTerms, internalNotes,
    });
    if (err || !id) { setError(err); return; }
    onCreated(id);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <Field label="Company name" value={legalName} onChange={setLegalName} required />
      <Field label="Trading name (optional)" value={tradingName} onChange={setTradingName} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ABN (optional)" value={abn} onChange={setAbn} />
        <Field label="Account code (optional)" value={customerAccountNumber} onChange={setCustomerAccountNumber} />
      </div>
      <Field label="Billing email (optional)" value={billingEmail} onChange={setBillingEmail} type="email" />
      <Field label="Phone (optional)" value={phone} onChange={setPhone} />
      <Field label="Address (optional)" value={address} onChange={setAddress} />
      <Field label="Payment terms (optional)" value={paymentTerms} onChange={setPaymentTerms} />
      <TextAreaField label="Internal notes (optional)" value={internalNotes} onChange={setInternalNotes} />

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

      <Button type="submit" className="w-full" disabled={submitting || !legalName.trim()}>
        {submitting ? "Creating..." : "Create company & continue"}
      </Button>
    </form>
  );
};

const AccountStep = ({ companyId, onNext }: { companyId: string; onNext: () => void }) => (
  <div className="mt-4 space-y-3">
    <p className={cx.footnote} style={{ paddingTop: 0 }}>
      Assign this company's internal Speedpanel Team -- the Project Manager or BDM assigned here is shown as the account's internal owner.
    </p>
    <StaffTeamAssignmentPanel companyId={companyId} />
    <Button variant="secondary" className="w-full" onClick={onNext}>Continue</Button>
  </div>
);

const PrimaryUserStep = ({ companyId, onNext }: { companyId: string; onNext: () => void }) => {
  const { inviteMember, addExistingMember } = useCompanyMembers(companyId);
  const [email, setEmail] = useState("");
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [invited, setInvited] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    const err = alreadyExists
      ? await addExistingMember({ email: email.trim(), role: "owner" })
      : await inviteMember({ email: email.trim(), role: "owner" });
    setInviting(false);
    if (err) { setError(err); return; }
    setInvited(true);
  };

  return (
    <div className="mt-4 space-y-3">
      <p className={cx.infoNote}>
        One primary user is required. This person is the main account contact and can manage additional company users.
      </p>
      {invited ? (
        <p className="text-sm font-semibold" style={{ color: NAVY }}>Primary user invited.</p>
      ) : (
        <form onSubmit={handleInvite} className="space-y-2">
          <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
          <label className="flex items-center gap-2 text-sm" style={{ color: NAVY }}>
            <input type="checkbox" checked={alreadyExists} onChange={e => setAlreadyExists(e.target.checked)} />
            Account already exists (created directly in Supabase) -- skip the invitation email
          </label>
          {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
          <Button type="submit" className="w-full" disabled={inviting || !email.trim()}>
            {inviting ? "Sending..." : "Send invitation"}
          </Button>
        </form>
      )}
      <Button variant="secondary" className="w-full" onClick={onNext}>
        {invited ? "Finish" : "Skip for now"}
      </Button>
    </div>
  );
};

export const CompanyWizard = ({ navigate }: { navigate: (r: Route) => void }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const goToCompany = (id?: string) => navigate({ tab: "accounts", sub: "companies", companyId: id });

  return (
    <div>
      <button
        className="text-sm font-semibold hover:underline"
        style={{ color: BLUE }}
        onClick={() => goToCompany()}
      >
        &lsaquo; Companies
      </button>

      <div className={`${cx.card} mt-3 max-w-lg`}>
        <div className="flex items-center justify-between gap-2">
          <h1 className={cx.h3}>New company</h1>
          <Button variant="ghost" onClick={() => goToCompany()}>Cancel</Button>
        </div>
        <div className="mt-2"><StepIndicator step={step} /></div>

        {step === 1 && <CompanyDetailsStep onCreated={id => { setCompanyId(id); setStep(2); }} />}
        {step === 2 && companyId && <AccountStep companyId={companyId} onNext={() => setStep(3)} />}
        {step === 3 && companyId && (
          <PrimaryUserStep companyId={companyId} onNext={() => goToCompany(companyId)} />
        )}
      </div>
    </div>
  );
};
