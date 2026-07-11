// =============================================================================
// Admin > Companies -- new company wizard
// =============================================================================
// The only way a company gets created now (see supabase/schema.sql's
// "Company-creation cutover" -- self-service create_company() was removed).
// 3 steps: Company Details (admin_create_company), Customer Users (optional
// -- reuses company/companyStore.ts's useCompanyMembers.inviteMember, the
// exact same company-invite-member Edge Function call CompanyTeamPage.tsx
// uses, now reachable by an admin who was never added as a member thanks to
// is_company_admin's is_admin() bypass), and Assign Speedpanel Team
// (StaffTeamAssignmentPanel.tsx). Steps 2/3 are both skippable -- a company
// can always get members/staff added later from AdminCompaniesPage.tsx's own
// per-company editor, this is just the guided first pass.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../../styleTokens";
import { Field, SelectField } from "../../shared/fields";
import { COMPANY_ROLES, COMPANY_ROLE_LABELS, type CompanyRole } from "../../company/companyTypes";
import { useCompanyMembers } from "../../company/companyStore";
import { useAdminCreateCompany } from "./companiesStore";
import { StaffTeamAssignmentPanel } from "./StaffTeamAssignmentPanel";

const ROLE_OPTIONS = COMPANY_ROLES.map(value => ({ value, label: COMPANY_ROLE_LABELS[value] }));

const StepIndicator = ({ step }: { step: 1 | 2 | 3 }) => (
  <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: MUTED }}>
    {["Company Details", "Customer Users", "Assign Speedpanel Team"].map((label, i) => (
      <span key={label} style={i + 1 === step ? { color: BLUE } : undefined}>
        {i > 0 && <span className="mx-1">&rarr;</span>}{label}
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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName.trim()) return;
    setError(null);
    const { id, error: err } = await createCompany({
      legalName: legalName.trim(), tradingName, abn, customerAccountNumber, billingEmail, phone, address,
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
        <Field label="Customer account number (optional)" value={customerAccountNumber} onChange={setCustomerAccountNumber} />
      </div>
      <Field label="Billing email (optional)" value={billingEmail} onChange={setBillingEmail} type="email" />
      <Field label="Phone (optional)" value={phone} onChange={setPhone} />
      <Field label="Address (optional)" value={address} onChange={setAddress} />

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button type="submit" disabled={submitting || !legalName.trim()}
        className="w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
        {submitting ? "Creating..." : "Create company & continue"}
      </button>
    </form>
  );
};

const CustomerUsersStep = ({ companyId, onNext }: { companyId: string; onNext: () => void }) => {
  const { inviteMember, addExistingMember } = useCompanyMembers(companyId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyRole>("owner");
  // Off = normal email invite (new person, no account yet). On = the account
  // was already created directly in Supabase before this company existed --
  // the normal invite's auto-link-on-signup only fires for a brand-new
  // auth.users row, so that order of operations needs addExistingMember
  // instead (see admin_add_company_member_by_email in supabase/schema.sql).
  const [alreadyExists, setAlreadyExists] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    const err = alreadyExists
      ? await addExistingMember({ email: email.trim(), role })
      : await inviteMember({ email: email.trim(), role });
    setInviting(false);
    if (err) { setError(err); return; }
    setAdded(a => [...a, email.trim()]);
    setEmail("");
    setRole("estimator");
  };

  return (
    <div className="mt-4 space-y-3">
      <p className={cx.footnote} style={{ paddingTop: 0 }}>
        Add this company's initial users now, or skip and add them later from the company's own Team page.
      </p>
      <label className="flex items-center gap-2 text-sm" style={{ color: NAVY }}>
        <input type="checkbox" checked={alreadyExists} onChange={e => setAlreadyExists(e.target.checked)} />
        Account already exists (created directly in Supabase) -- skip the invitation email
      </label>
      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1"><Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" /></div>
        <div className="sm:w-56"><SelectField label="Role" value={role} options={ROLE_OPTIONS} onChange={v => setRole(v as CompanyRole)} /></div>
        <button type="submit" disabled={inviting || !email.trim()}
          className="h-[46px] shrink-0 rounded-xl px-5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
          {inviting ? "Adding..." : "Add"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {added.length > 0 && (
        <ul className="text-sm" style={{ color: NAVY }}>
          {added.map(e => <li key={e}>Added {e}</li>)}
        </ul>
      )}
      <button onClick={onNext} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold" style={{ color: NAVY }}>
        {added.length > 0 ? "Continue" : "Skip for now"}
      </button>
    </div>
  );
};

export const AdminCompanyWizard = ({ onFinished, onCancel }: { onFinished: () => void; onCancel: () => void }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [companyId, setCompanyId] = useState<string | null>(null);

  return (
    <div className={`${cx.card} mt-3 max-w-lg`}>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>New company</h1>
        <button onClick={onCancel} className="text-sm font-semibold" style={{ color: MUTED }}>Cancel</button>
      </div>
      <div className="mt-2"><StepIndicator step={step} /></div>

      {step === 1 && <CompanyDetailsStep onCreated={id => { setCompanyId(id); setStep(2); }} />}
      {step === 2 && companyId && <CustomerUsersStep companyId={companyId} onNext={() => setStep(3)} />}
      {step === 3 && companyId && (
        <div className="mt-4 space-y-3">
          <StaffTeamAssignmentPanel companyId={companyId} />
          <button onClick={onFinished} className="w-full rounded-xl py-2.5 text-sm font-bold" style={{ background: BLUE, color: WHITE }}>
            Finish
          </button>
        </div>
      )}
    </div>
  );
};
