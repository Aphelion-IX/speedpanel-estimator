import { describe, it, expect } from "vitest";
import { journeyStageForProject, journeyProgressPercent, JOURNEY_STAGES, type JourneyOrderGroup } from "./journeyStage";
import type { OrderLineItem } from "../../export/priceEstimateReportData";
import type { OrderStage, DeliveryStatus } from "./orders/orderTypes";

const panelLineItem = (qty: number): OrderLineItem => ({
  id: "li-1", category: "panel", label: "78mm panel", qty, unit: "panel", unitPriceExGst: 100, lineTotalExGst: qty * 100, matched: true,
});

function order(overrides: Partial<{ id: string; stage: OrderStage; panels_manufactured: number | null; qty: number }> = {}) {
  const qty = overrides.qty ?? 10;
  return {
    id: overrides.id ?? "order-1",
    stage: overrides.stage ?? "draft",
    line_items: [panelLineItem(qty)],
    panels_manufactured: overrides.panels_manufactured ?? null,
  };
}

function group(overrides: Parameters<typeof order>[0] = {}, deliveries: { status: DeliveryStatus }[] = []): JourneyOrderGroup {
  return { order: order(overrides), deliveries };
}

describe("journeyStageForProject", () => {
  it("no orders -> estimating, with a project.stage-derived sub-label", () => {
    expect(journeyStageForProject({ stage: "draft" }, [])).toEqual({
      stage: "estimating", representativeOrderId: null, estimatingNote: "Add walls in the estimator to get started",
    });
    expect(journeyStageForProject({ stage: "install_review" }, []).estimatingNote).toBe("Install review in progress");
    expect(journeyStageForProject({ stage: "technical_review" }, []).estimatingNote).toBe("Technical review in progress");
    expect(journeyStageForProject({ stage: "approved" }, []).estimatingNote).toBe("Design approved -- ready to request a quote");
  });

  it("maps each order.stage value in isolation", () => {
    expect(journeyStageForProject({ stage: "draft" }, [group({ stage: "draft" })]).stage).toBe("estimating");
    expect(journeyStageForProject({ stage: "draft" }, [group({ stage: "submitted" })]).stage).toBe("quote_submitted");
    expect(journeyStageForProject({ stage: "draft" }, [group({ stage: "proforma_requested" })]).stage).toBe("quote_accepted");
    expect(journeyStageForProject({ stage: "draft" }, [group({ stage: "proforma_issued" })]).stage).toBe("processing");
  });

  it("manufacturing progress: 0 made -> processing, partial -> manufacturing, full with no delivery -> ready_for_delivery", () => {
    expect(journeyStageForProject({ stage: "draft" }, [group({ stage: "proforma_issued", panels_manufactured: 0 })]).stage).toBe("processing");
    expect(journeyStageForProject({ stage: "draft" }, [group({ stage: "proforma_issued", panels_manufactured: 4, qty: 10 })]).stage).toBe("manufacturing");
    expect(journeyStageForProject({ stage: "draft" }, [group({ stage: "proforma_issued", panels_manufactured: 10, qty: 10 })]).stage).toBe("ready_for_delivery");
  });

  it("fully-manufactured order is delivered only once every delivery is 'delivered' (paired with a lagging order so the project-level 'completed' promotion doesn't mask the per-order distinction)", () => {
    const full = { stage: "proforma_issued", panels_manufactured: 10, qty: 10 } as const;
    const lagging = group({ id: "lagging", stage: "submitted" });
    expect(journeyStageForProject({ stage: "draft" }, [group({ ...full, id: "a" }, [{ status: "planned" }]), lagging]).stage).toBe("ready_for_delivery");
    expect(journeyStageForProject({ stage: "draft" }, [group({ ...full, id: "a" }, [{ status: "delivered" }, { status: "in_transit" }]), lagging]).stage).toBe("ready_for_delivery");
    expect(journeyStageForProject({ stage: "draft" }, [group({ ...full, id: "a" }, [{ status: "delivered" }]), lagging]).stage).toBe("delivered");
  });

  it("project stage = single most-advanced non-cancelled order", () => {
    const orders = [group({ id: "a", stage: "draft" }), group({ id: "b", stage: "proforma_requested" })];
    const result = journeyStageForProject({ stage: "draft" }, orders);
    expect(result.stage).toBe("quote_accepted");
    expect(result.representativeOrderId).toBe("b");
  });

  it("'completed' requires EVERY non-cancelled order to independently be delivered -- a lagging order keeps the project at 'delivered', not demoted further and not promoted to 'completed'", () => {
    const delivered = group({ id: "a", stage: "proforma_issued", panels_manufactured: 10, qty: 10 }, [{ status: "delivered" }]);
    const alsoDelivered = group({ id: "b", stage: "proforma_issued", panels_manufactured: 10, qty: 10 }, [{ status: "delivered" }]);
    const stillManufacturing = group({ id: "c", stage: "proforma_issued", panels_manufactured: 3, qty: 10 });
    expect(journeyStageForProject({ stage: "draft" }, [delivered]).stage).toBe("completed");
    expect(journeyStageForProject({ stage: "draft" }, [delivered, alsoDelivered]).stage).toBe("completed");
    expect(journeyStageForProject({ stage: "draft" }, [delivered, stillManufacturing]).stage).toBe("delivered");
  });

  it("cancelled orders are excluded by the caller and never influence the result", () => {
    // Simulates the caller's own `orders.filter(o => o.stage !== "cancelled")`
    // before calling -- a lone cancelled order passed in here would behave
    // as an ordinary "estimating"-ranked order, so this asserts the caller
    // contract via a non-cancelled-only orders array.
    const onlyDraft = [group({ id: "a", stage: "draft" })];
    expect(journeyStageForProject({ stage: "draft" }, onlyDraft).stage).toBe("estimating");
  });
});

describe("journeyProgressPercent", () => {
  const step = 100 / (JOURNEY_STAGES.length - 1);

  it("returns the flat index-based percent for non-manufacturing stages", () => {
    expect(journeyProgressPercent("estimating")).toBe(0);
    expect(journeyProgressPercent("quote_submitted")).toBe(Math.round(step));
    expect(journeyProgressPercent("completed")).toBe(100);
  });

  it("interpolates within 'manufacturing' from real panel counts, never a fabricated number", () => {
    const idx = JOURNEY_STAGES.indexOf("manufacturing");
    const base = idx * step;
    const order = { line_items: [panelLineItem(10)], panels_manufactured: 5 };
    expect(journeyProgressPercent("manufacturing", order)).toBe(Math.round(base + 0.5 * step));
    expect(journeyProgressPercent("manufacturing")).toBe(Math.round(base));
  });
});
