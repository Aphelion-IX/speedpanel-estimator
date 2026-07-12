@@
   return (
-    <div className={`${cx.card} mt-3`}>
-      <div className="flex items-start justify-between gap-2">
-        <div className="text-sm font-bold" style={{ color: NAVY }}>{item.name}</div>
-        <div className={cx.footnote}>{new Date(item.updated_at).toLocaleString()}</div>
-      </div>
+    <div className={`${cx.card} mt-3`} data-testid={`project-row-${item.id}`}>
+      <div className="flex items-start justify-between gap-2">
+        <div className="text-sm font-bold" style={{ color: NAVY }} data-testid={`project-name-${item.id}`}>{item.name}</div>
+        <div className={cx.footnote} data-testid={`project-updated-${item.id}`}>{new Date(item.updated_at).toLocaleString()}</div>
+      </div>
@@
-      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
+      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400" data-testid={`project-error-${item.id}`}>{error}</p>}
@@
-            <button onClick={() => run(() => onApproveInstall(item.id))} disabled={submitting}
-              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
-              Approve install review
-            </button>
-            <button onClick={() => run(() => onChangesInstall(item.id, note))} disabled={submitting || !note.trim()}
-              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
-              Request changes
-            </button>
+            <button onClick={() => run(() => onApproveInstall(item.id))} disabled={submitting}
+              data-testid={`project-approve-install-${item.id}`}
+              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
+              Approve install review
+            </button>
+            <button onClick={() => run(() => onChangesInstall(item.id, note))} disabled={submitting || !note.trim()}
+              data-testid={`project-request-changes-install-${item.id}`}
+              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
+              Request changes
+            </button>
@@
-            <button onClick={() => run(() => onApproveTechnical(item.id))} disabled={submitting}
-              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
-              Approve technical review
-            </button>
-            <button onClick={() => run(() => onChangesTechnical(item.id, note))} disabled={submitting || !note.trim()}
-              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
-              Request changes
-            </button>
+            <button onClick={() => run(() => onApproveTechnical(item.id))} disabled={submitting}
+              data-testid={`project-approve-technical-${item.id}`}
+              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
+              Approve technical review
+            </button>
+            <button onClick={() => run(() => onChangesTechnical(item.id, note))} disabled={submitting || !note.trim()}
+              data-testid={`project-request-changes-technical-${item.id}`}
+              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
+              Request changes
+            </button>
@@
-            <pre className="overflow-auto rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs">
-            {JSON.stringify(item.data, null, 2)}
-          </pre>
+            <pre className="overflow-auto rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-xs" data-testid={`project-data-${item.id}`}>
+            {JSON.stringify(item.data, null, 2)}
+          </pre>
