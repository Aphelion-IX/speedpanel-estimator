// =============================================================================
// Service request form -- Drawer (right panel on web, bottom sheet on phone)
// =============================================================================
// Fields vary by request type per spec section 12: Technical Review gets the
// full category/question/description/drawing-reference form; Pre-Start
// Meeting gets meeting-scheduling fields instead; Installation Review and
// Product Warranty just confirm with an optional note, since their own
// eligibility gate (see ProjectServicesCard.tsx) is already the interesting
// part of those two.
// =============================================================================
import { useState } from "react";
import { MUTED } from "../../../styleTokens";
import { Field, SelectField, TextAreaField } from "../../shared/fields";
import { Button } from "../../../ui/button";
import { Drawer } from "../../../ui/drawer";
import { SERVICE_REQUEST_TYPE_LABELS, type ServiceRequestType, type MeetingDetails } from "./serviceRequestTypes";
import type { EffectiveLayout } from "../../../useLayoutMode";

const CATEGORY_OPTIONS = ["General question", "Drawing review", "Product specification", "Site condition", "Other"]
  .map(v => ({ value: v, label: v }));
const MEETING_TYPE_OPTIONS = ["On-site", "Video call", "Phone call"].map(v => ({ value: v, label: v }));

export interface ServiceRequestFormFields {
  category?: string; question?: string; description?: string; drawingReference?: string; meetingDetails?: MeetingDetails;
}

export const ServiceRequestForm = ({ requestType, layoutMode, onClose, onSubmit, onCreated }: {
  requestType: ServiceRequestType;
  layoutMode: EffectiveLayout;
  onClose: () => void;
  onSubmit: (fields: ServiceRequestFormFields) => Promise<string | null>;
  onCreated: () => void;
}) => {
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [drawingReference, setDrawingReference] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [meetingType, setMeetingType] = useState(MEETING_TYPE_OPTIONS[0].value);
  const [attendees, setAttendees] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fields: ServiceRequestFormFields = requestType === "pre_start_meeting"
      ? { meetingDetails: { preferredDate, preferredTime, meetingType, attendees, notes } }
      : requestType === "technical_review"
        ? { category, question, description, drawingReference }
        : { description };
    const err = await onSubmit(fields);
    setSubmitting(false);
    if (err) { setError(err); return; }
    onCreated();
  };

  return (
    <Drawer open onClose={onClose} layoutMode={layoutMode} title={`Request: ${SERVICE_REQUEST_TYPE_LABELS[requestType]}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {requestType === "technical_review" && (
          <>
            <SelectField label="Category" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
            <Field label="Question" value={question} onChange={setQuestion} required />
            <TextAreaField label="Description" value={description} onChange={setDescription} />
            <Field label="Drawing reference (optional)" value={drawingReference} onChange={setDrawingReference} />
          </>
        )}

        {requestType === "pre_start_meeting" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Preferred date" value={preferredDate} onChange={setPreferredDate} type="date" required />
              <Field label="Preferred time" value={preferredTime} onChange={setPreferredTime} type="time" />
            </div>
            <SelectField label="Meeting type" value={meetingType} options={MEETING_TYPE_OPTIONS} onChange={setMeetingType} />
            <Field label="Attendees (optional)" value={attendees} onChange={setAttendees} />
            <TextAreaField label="Notes (optional)" value={notes} onChange={setNotes} />
          </>
        )}

        {(requestType === "installation_review" || requestType === "product_warranty") && (
          <TextAreaField label="Anything we should know? (optional)" value={description} onChange={setDescription} />
        )}

        <p className="text-xs" style={{ color: MUTED }}>
          You can attach documents or photos once the request is submitted.
        </p>

        {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

        <div className="mt-2 flex items-center gap-2">
          <Button type="submit" disabled={submitting} className="h-[46px] shrink-0">
            {submitting ? "Submitting..." : "Submit request"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Drawer>
  );
};
