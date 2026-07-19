
import { useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAsyncResource } from "./useAsyncResource";
import {
  ProjectCompletionCheckSchema,
  ProjectContactRowSchema,
  ProjectNotificationPreferencesRowSchema,
  ProjectOperationsAuditRowSchema,
  ProjectOperationsRowSchema,
  type NotificationChannel,
  type ProjectContactType,
  type ProjectOperationalStatus,
} from "./projectOperationsTypes";

const NOT_CONFIGURED = "Projects aren't configured for this environment.";
const BAD_SHAPE = "Unexpected project operations data from the server.";

export function useProjectOperations(projectId: string) {
  const fetchOperations = useCallback(async () => {
    if (!supabase) return { data: null, error: NOT_CONFIGURED };

    const { data, error } = await supabase
      .from("project_operations")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) {
      const { data: created, error: createError } = await supabase
        .from("project_operations")
        .insert({ project_id: projectId })
        .select("*")
        .single();

      if (createError) return { data: null, error: createError.message };
      const parsedCreated = ProjectOperationsRowSchema.safeParse(created);
      return parsedCreated.success
        ? { data: parsedCreated.data, error: null }
        : { data: null, error: BAD_SHAPE };
    }

    const parsed = ProjectOperationsRowSchema.safeParse(data);
    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: null, error: BAD_SHAPE };
  }, [projectId]);

  const state = useAsyncResource(fetchOperations, [projectId], {
    initialData: null,
    skip: !projectId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  const call = async (
    fn: string,
    args: Record<string, unknown>,
  ): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase.rpc(fn, args);
    if (error) return error.message;
    await state.reload();
    return null;
  };

  const progress = (
    toStatus: ProjectOperationalStatus,
    expectedVersion: number,
  ) => call("progress_project_operational_status", {
    p_project_id: projectId,
    p_to_status: toStatus,
    p_expected_version: expectedVersion,
  });

  const correct = (
    toStatus: ProjectOperationalStatus,
    expectedVersion: number,
    reason: string,
  ) => call("correct_project_operational_status", {
    p_project_id: projectId,
    p_to_status: toStatus,
    p_expected_version: expectedVersion,
    p_reason: reason,
  });

  const complete = (expectedVersion: number) =>
    call("complete_project", {
      p_project_id: projectId,
      p_expected_version: expectedVersion,
    });

  const archive = (expectedVersion: number) =>
    call("archive_project", {
      p_project_id: projectId,
      p_expected_version: expectedVersion,
    });

  const restore = (expectedVersion: number) =>
    call("restore_project", {
      p_project_id: projectId,
      p_expected_version: expectedVersion,
    });

  return {
    operations: state.data,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
    progress,
    correct,
    complete,
    archive,
    restore,
  };
}

export function useProjectCompletionCheck(projectId: string) {
  const fetchCheck = useCallback(async () => {
    if (!supabase) return { data: null, error: NOT_CONFIGURED };
    const { data, error } = await supabase.rpc(
      "project_completion_check",
      { p_project_id: projectId },
    );
    if (error) return { data: null, error: error.message };

    const parsed = ProjectCompletionCheckSchema.safeParse(data);
    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: null, error: BAD_SHAPE };
  }, [projectId]);

  const state = useAsyncResource(fetchCheck, [projectId], {
    initialData: null,
    skip: !projectId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  return {
    check: state.data,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  };
}

export function useProjectContacts(projectId: string) {
  const fetchContacts = useCallback(async () => {
    if (!supabase) return { data: [], error: NOT_CONFIGURED };
    const { data, error } = await supabase
      .from("project_contacts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");

    if (error) return { data: [], error: error.message };
    const parsed = ProjectContactRowSchema.array().safeParse(data ?? []);
    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: [], error: BAD_SHAPE };
  }, [projectId]);

  const state = useAsyncResource(fetchContacts, [projectId], {
    initialData: [],
    skip: !projectId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  const save = async (input: {
    id?: string;
    contact_type: ProjectContactType;
    company_user_id?: string | null;
    name: string;
    email?: string | null;
    phone?: string | null;
  }): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const payload = {
      project_id: projectId,
      contact_type: input.contact_type,
      company_user_id: input.company_user_id ?? null,
      name: input.name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
    };

    const query = input.id
      ? supabase.from("project_contacts").update(payload).eq("id", input.id)
      : supabase.from("project_contacts").insert(payload);

    const { error } = await query;
    if (error) return error.message;
    await state.reload();
    return null;
  };

  const remove = async (contactId: string): Promise<string | null> => {
    if (!supabase) return NOT_CONFIGURED;
    const { error } = await supabase
      .from("project_contacts")
      .delete()
      .eq("id", contactId)
      .eq("project_id", projectId);

    if (error) return error.message;
    await state.reload();
    return null;
  };

  return {
    contacts: state.data,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
    save,
    remove,
  };
}

export function useProjectNotificationPreferences(
  projectId: string,
  userId: string | null,
) {
  const fetchPreferences = useCallback(async () => {
    if (!supabase || !userId) return { data: null, error: null };
    const { data, error } = await supabase
      .from("project_notification_preferences")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };

    const parsed = ProjectNotificationPreferencesRowSchema.safeParse(data);
    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: null, error: BAD_SHAPE };
  }, [projectId, userId]);

  const state = useAsyncResource(fetchPreferences, [projectId, userId], {
    initialData: null,
    skip: !projectId || !userId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  const save = async (input: {
    orders: NotificationChannel;
    manufacturing: NotificationChannel;
    deliveries: NotificationChannel;
    services: NotificationChannel;
  }): Promise<string | null> => {
    if (!supabase || !userId) return NOT_CONFIGURED;
    const { error } = await supabase
      .from("project_notification_preferences")
      .upsert(
        { project_id: projectId, user_id: userId, ...input },
        { onConflict: "project_id,user_id" },
      );

    if (error) return error.message;
    await state.reload();
    return null;
  };

  return {
    preferences: state.data,
    loading: state.loading,
    error: state.error,
    save,
  };
}

export function useProjectOperationsAudit(projectId: string) {
  const fetchAudit = useCallback(async () => {
    if (!supabase) return { data: [], error: NOT_CONFIGURED };
    const { data, error } = await supabase
      .from("project_operations_audit")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) return { data: [], error: error.message };
    const parsed = ProjectOperationsAuditRowSchema.array().safeParse(data ?? []);
    return parsed.success
      ? { data: parsed.data, error: null }
      : { data: [], error: BAD_SHAPE };
  }, [projectId]);

  const state = useAsyncResource(fetchAudit, [projectId], {
    initialData: [],
    skip: !projectId || !supabase,
    skipError: !supabase ? NOT_CONFIGURED : null,
  });

  return {
    events: state.data,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  };
}
