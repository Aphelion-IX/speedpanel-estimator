import { describe, it, expect } from "vitest";
import { fromDocumentRow, toDocumentRow } from "./documentMappers";

describe("documentMappers", () => {
  it("round-trips a document row, including nested sections and tags", () => {
    const row = {
      id: "id-1", created_at: "2024-01-01T00:00:00.000Z", updated_at: "2024-01-02T00:00:00.000Z", notes: null,
      title: "Installation Guide", category: "Installation" as const,
      tags: ["Installation", "Vertical"], description: "Step-by-step guide.",
      edition: "Release 3", date: "Apr 2024", file_size: "22.1 MB", file_type: "PDF", page_count: 96,
      swatch: "var(--gold)",
      sections: [{ name: "Pre-installation checklist", description: "Site conditions.", pages: "1-8" }],
      file_url: null,
    };
    const entity = fromDocumentRow(row);
    expect(entity).toMatchObject({
      id: "id-1", createdAt: row.created_at, updatedAt: row.updated_at, notes: undefined,
      title: "Installation Guide", category: "Installation", tags: row.tags, description: row.description,
      edition: "Release 3", date: "Apr 2024", fileSize: "22.1 MB", fileType: "PDF", pageCount: 96,
      swatch: "var(--gold)", sections: row.sections, fileUrl: undefined,
    });
    const { id, createdAt, updatedAt, ...withoutStamp } = entity;
    void id; void createdAt; void updatedAt;
    expect(toDocumentRow(withoutStamp)).toEqual({
      notes: null, title: "Installation Guide", category: "Installation", tags: row.tags,
      description: row.description, edition: "Release 3", date: "Apr 2024", file_size: "22.1 MB",
      file_type: "PDF", page_count: 96, swatch: "var(--gold)", sections: row.sections, file_url: null,
    });
  });

  it("preserves a real fileUrl and notes value through the round trip", () => {
    const row = {
      id: "id-2", created_at: "2024-01-01T00:00:00.000Z", updated_at: "2024-01-02T00:00:00.000Z", notes: "internal note",
      title: "Fire Resistance", category: "Fire & Acoustic" as const, tags: ["Fire Rated"], description: "Report.",
      edition: "Report 28928", date: "Jul 2024", file_size: "3.5 MB", file_type: "PDF", page_count: 37,
      swatch: "var(--blue)", sections: [], file_url: "/docs/fire-performance.pdf",
    };
    const entity = fromDocumentRow(row);
    expect(entity.notes).toBe("internal note");
    expect(entity.fileUrl).toBe("/docs/fire-performance.pdf");
    const { id, createdAt, updatedAt, ...withoutStamp } = entity;
    void id; void createdAt; void updatedAt;
    expect(toDocumentRow(withoutStamp).file_url).toBe("/docs/fire-performance.pdf");
    expect(toDocumentRow(withoutStamp).notes).toBe("internal note");
  });
});
