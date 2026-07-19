
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Card } from "../../ui/primitives";
import { Button } from "../../ui/button";
import { SelectField } from "../shared/fields";
import { cx } from "../../styleTokens";
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from "./projectOperationsTypes";
import { useProjectNotificationPreferences } from "./projectOperationsStore";

const OPTIONS = NOTIFICATION_CHANNELS.map(value => ({
  value,
  label:
    value === "none"
      ? "None"
      : value === "in_app"
        ? "In-app only"
        : "Email and in-app",
}));

export const ProjectNotificationPreferencesCard = ({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string | null;
}) => {
  const { preferences, loading, error, save } =
    useProjectNotificationPreferences(projectId, userId);
  const [orders, setOrders] =
    useState<NotificationChannel>("email_and_in_app");
  const [manufacturing, setManufacturing] =
    useState<NotificationChannel>("in_app");
  const [deliveries, setDeliveries] =
    useState<NotificationChannel>("email_and_in_app");
  const [services, setServices] =
    useState<NotificationChannel>("email_and_in_app");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!preferences) return;
    setOrders(preferences.orders);
    setManufacturing(preferences.manufacturing);
    setDeliveries(preferences.deliveries);
    setServices(preferences.services);
  }, [preferences]);

  if (!userId) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setActionError(null);
    const saveError = await save({
      orders,
      manufacturing,
      deliveries,
      services,
    });
    setSaving(false);
    if (saveError) {
      setActionError(saveError);
      return;
    }
    setSaved(true);
  };

  return (
    <Card title="Notifications" icon={<Bell size={14} />}>
      {loading ? (
        <p className={cx.footnote} style={{ paddingTop: 0 }}>
          Loading preferences...
        </p>
      ) : (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Orders & quotes"
            value={orders}
            options={OPTIONS}
            onChange={value => setOrders(value as NotificationChannel)}
          />
          <SelectField
            label="Manufacturing"
            value={manufacturing}
            options={OPTIONS}
            onChange={value => setManufacturing(value as NotificationChannel)}
          />
          <SelectField
            label="Deliveries"
            value={deliveries}
            options={OPTIONS}
            onChange={value => setDeliveries(value as NotificationChannel)}
          />
          <SelectField
            label="Services"
            value={services}
            options={OPTIONS}
            onChange={value => setServices(value as NotificationChannel)}
          />
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Notifications"}
            </Button>
            {saved && (
              <span className="text-sm text-emerald-600 dark:text-emerald-300">
                Saved
              </span>
            )}
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
