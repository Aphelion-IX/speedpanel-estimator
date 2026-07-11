// =============================================================================
// Create a company workspace
// =============================================================================
// Self-service -- any signed-in user can create one (see create_company()
// RPC), becoming its first Owner immediately. Reached from
// ProjectsListPage.tsx's "Set up a company workspace" callout for anyone
// with zero memberships.
// =============================================================================
import { useState } from "react";
import { cx, NAVY, BLUE, WHITE, MUTED } from "../../styleTokens";
import { Field } from "../shared/fields";
import { useCreateCompany } from "./companyStore";

export const CreateCompanyPage = ({ onCreated, onBack }: { onCreated: () => void; onBack: () => void }) => {
  const { submitting, createCompany } = useCreateCompany();
  const [legalName, setLegalName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [abn, setAbn] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName.trim()) return;
    setError(null);
    const { id, error: err } = await createCompany({ legalName: legalName.trim(), tradingName, abn, billingEmail, phone, address });
    if (err || !id) { setError(err); return; }
    onCreated();
  };

  return (
    <div className="mt-2">
      <button onClick={onBack} className="text-sm font-semibold hover:underline" style={{ color: BLUE }}>&larr; Back to projects</button>

      <div className={`${cx.card} mt-3 max-w-lg`}>
        <h1 className="text-lg font-bold" style={{ color: NAVY }}>Set up a company workspace</h1>
        <p className={cx.footnote} style={{ paddingTop: 0 }}>
          You'll become the first Owner. Once created, you can invite teammates and share access to projects, orders and documents.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <Field label="Company name" value={legalName} onChange={setLegalName} required />
          <Field label="Trading name (optional)" value={tradingName} onChange={setTradingName} />
          <Field label="ABN (optional)" value={abn} onChange={setAbn} />
          <Field label="Billing email (optional)" value={billingEmail} onChange={setBillingEmail} type="email" />
          <Field label="Phone (optional)" value={phone} onChange={setPhone} />
          <Field label="Address (optional)" value={address} onChange={setAddress} />

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button type="submit" disabled={submitting || !legalName.trim()}
            className="w-full rounded-xl py-2.5 text-sm font-bold disabled:opacity-50" style={{ background: BLUE, color: WHITE }}>
            {submitting ? "Creating..." : "Create company"}
          </button>
        </form>
        <p className="mt-3 text-xs" style={{ color: MUTED }}>
          Speedpanel's customer account number is linked to the company once set up, not to any one person.
        </p>
      </div>
    </div>
  );
};
