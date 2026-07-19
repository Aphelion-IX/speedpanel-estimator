
import { useState } from "react";
import { Contact, Plus, Trash2 } from "lucide-react";
import { Card, IconButton } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { Field, SelectField } from "../shared/fields";
import { cx, MUTED, NAVY } from "../../styleTokens";
import {
  PROJECT_CONTACT_TYPES,
  PROJECT_CONTACT_TYPE_LABELS,
  type ProjectContactType,
} from "./projectOperationsTypes";
import { useProjectContacts } from "./projectOperationsStore";

const CONTACT_OPTIONS = PROJECT_CONTACT_TYPES.map(value => ({
  value,
  label: PROJECT_CONTACT_TYPE_LABELS[value],
}));

export const ProjectContactsCard = ({
  projectId,
}: {
  projectId: string;
}) => {
  const { contacts, loading, error, save, remove } =
    useProjectContacts(projectId);
  const [adding, setAdding] = useState(false);
  const [contactType, setContactType] =
    useState<ProjectContactType>("site_contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const reset = () => {
    setAdding(false);
    setContactType("site_contact");
    setName("");
    setEmail("");
    setPhone("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);
    const saveError = await save({
      contact_type: contactType,
      name,
      email,
      phone,
    });
    if (saveError) {
      setActionError(saveError);
      return;
    }
    reset();
  };

  return (
    <Card title="Project Contacts" icon={<Contact size={14} />}>
      {!adding && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            icon={<Plus size={14} />}
            onClick={() => setAdding(true)}
          >
            Add Contact
          </Button>
        </div>
      )}
      {loading ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>
          Loading contacts...
        </p>
      ) : contacts.length === 0 ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>
          No project contacts added yet.
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map(contact => (
            <div
              key={contact.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: NAVY }}>
                  {contact.name}
                </p>
                <p className="truncate text-xs" style={{ color: MUTED }}>
                  {PROJECT_CONTACT_TYPE_LABELS[contact.contact_type]}
                  {contact.email ? ` · ${contact.email}` : ""}
                  {contact.phone ? ` · ${contact.phone}` : ""}
                </p>
              </div>
              <IconButton
                size="sm"
                variant="danger"
                onClick={async () => {
                  const removeError = await remove(contact.id);
                  if (removeError) setActionError(removeError);
                }}
                title="Remove contact"
                ariaLabel="Remove contact"
              >
                <Trash2 size={13} />
              </IconButton>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Contact type"
            value={contactType}
            options={CONTACT_OPTIONS}
            onChange={value => setContactType(value as ProjectContactType)}
          />
          <Field label="Name" value={name} onChange={setName} required />
          <Field label="Email" value={email} onChange={setEmail} />
          <Field label="Phone" value={phone} onChange={setPhone} />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">Save Contact</Button>
            <Button type="button" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {(error || actionError) && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error || actionError}
        </p>
      )}
    </Card>
  );
};
