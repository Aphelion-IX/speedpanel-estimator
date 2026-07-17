// =============================================================================
// Admin > Companies -- "Price List" AccordionCard content
// =============================================================================
// Drops into AdminCompaniesPage.tsx's CompanyRow, after "Speedpanel Team",
// per that file's own documented extension point. A plain dropdown of
// price_lists + Save -> admin_set_company_price_list.
// =============================================================================
import { useEffect, useState } from "react";
import { MUTED } from "../../../styleTokens";
import { Button } from "../../../ui/button";
import { LoadingState, ErrorState } from "../../../ui/states";
import { SelectField } from "../../shared/fields";
import { usePriceListPicker, useCompanyPriceListAssignment } from "./priceListsStore";

export const CompanyPriceListCard = ({ companyId }: { companyId: string }) => {
  const { priceLists, loading: pickerLoading, error: pickerError } = usePriceListPicker();
  const { priceListId, loading: assignmentLoading, error: assignmentError, saving, save } = useCompanyPriceListAssignment(companyId);
  const [draft, setDraft] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(priceListId); }, [priceListId]);

  if (pickerLoading || assignmentLoading) return <LoadingState label="Loading price lists" />;
  if (pickerError || assignmentError) return <ErrorState message={(pickerError || assignmentError)!} />;

  const dirty = draft !== priceListId;

  const handleSave = async () => {
    if (!draft) return;
    setSaveError(null);
    setSaved(false);
    const error = await save(draft);
    if (error) { setSaveError(error); return; }
    setSaved(true);
  };

  return (
    <div>
      <SelectField
        label="Assigned price list"
        value={draft ?? ""}
        options={priceLists.map(pl => ({ value: pl.id, label: pl.is_default ? `${pl.name} (default)` : pl.name }))}
        onChange={v => { setDraft(v); setSaved(false); }}
      />
      {saveError && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{saveError}</p>}
      {saved && !dirty && <p className="mt-2 text-sm" style={{ color: MUTED }}>Saved.</p>}
      {dirty && (
        <Button className="mt-3" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      )}
    </div>
  );
};
