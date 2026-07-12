// =============================================================================
// Edge Function invoke() error unwrapping
// =============================================================================
// A non-2xx response from supabase.functions.invoke() leaves `data` null and
// `error` a generic FunctionsHttpError whose `.context` is the raw Response
// -- every Edge Function in this app always returns a JSON { error } body in
// that case, so read it instead of surfacing supabase-js's generic
// status-code message. context is NOT a Response for other failure modes
// (e.g. the function isn't deployed / a network error), so guard with
// `instanceof` rather than assuming the shape. Shared by usersStore.ts's
// inviteUser, companyStore.ts's inviteMember, and companiesStore.ts's
// adminCreateCompanyUser -- all three call this identically.
// =============================================================================
export async function unwrapInvokeError(error: { message: string; context?: unknown }): Promise<string> {
  const context = error.context;
  if (context instanceof Response) {
    try {
      const body: { error?: string } = await context.clone().json();
      if (body?.error) return body.error;
    } catch { /* not JSON -- keep the generic message */ }
  }
  return error.message;
}
