/** @vitest-environment jsdom */
// =============================================================================
// Admin Dashboard -- Company Accounts & Pricing card
// =============================================================================
// Company Accounts & Pricing is a staff-only admin area that lived entirely
// outside the Admin section: its only entry point was AuthStatus.tsx's
// account dropdown, so an admin working from the dashboard had no way to see
// or reach it. These cover the card that puts it in the Admin card section,
// and that the existing section tiles still navigate as before.
// =============================================================================
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AdminDashboard } from "./AdminDashboard";
import { ADMIN_GROUPS } from "./adminSections";

// This project runs vitest without `globals: true` or a setup file, so
// Testing Library's automatic between-test cleanup never registers -- renders
// would otherwise stack up in document.body and every role query would find
// duplicates from earlier tests.
afterEach(cleanup);

const renderDashboard = () => {
  const onNavigate = vi.fn();
  const onOpenAccounts = vi.fn();
  render(<AdminDashboard onNavigate={onNavigate} onOpenAccounts={onOpenAccounts} />);
  return { onNavigate, onOpenAccounts };
};

describe("AdminDashboard", () => {
  it("shows a Company Accounts & Pricing card in the card section", () => {
    renderDashboard();
    expect(screen.getByRole("button", { name: /Company Accounts & Pricing/ })).toBeDefined();
  });

  it("opens the accounts workspace when that card is clicked", () => {
    const { onOpenAccounts, onNavigate } = renderDashboard();

    screen.getByRole("button", { name: /Company Accounts & Pricing/ }).click();

    expect(onOpenAccounts).toHaveBeenCalledTimes(1);
    // It's a separate top-level workspace, not an admin sub-page route.
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("still renders every existing admin section tile", () => {
    renderDashboard();
    for (const section of ADMIN_GROUPS.flatMap(g => g.items)) {
      expect(screen.getByRole("button", { name: new RegExp(section.label) })).toBeDefined();
    }
  });

  it("navigates to an admin sub-page when a section tile is clicked", () => {
    const { onNavigate, onOpenAccounts } = renderDashboard();
    const first = ADMIN_GROUPS[0].items[0];

    screen.getByRole("button", { name: new RegExp(first.label) }).click();

    expect(onNavigate).toHaveBeenCalledWith(first.key);
    expect(onOpenAccounts).not.toHaveBeenCalled();
  });
});
