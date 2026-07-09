import { describe, it, expect } from "vitest";
import { SubmitRequestSchema } from "./requestsClient";

describe("SubmitRequestSchema", () => {
  it("accepts a well-formed request with only the required fields", () => {
    expect(SubmitRequestSchema.safeParse({ name: "Sam Hale", email: "sam@example.com" }).success).toBe(true);
  });

  it("accepts optional phone/message when present", () => {
    const result = SubmitRequestSchema.safeParse({
      name: "Sam Hale", email: "sam@example.com", phone: "0400 000 000", message: "Please call back.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(SubmitRequestSchema.safeParse({ name: "", email: "sam@example.com" }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(SubmitRequestSchema.safeParse({ name: "Sam Hale", email: "not-an-email" }).success).toBe(false);
  });

  it("rejects an abusively long message", () => {
    const result = SubmitRequestSchema.safeParse({
      name: "Sam Hale", email: "sam@example.com", message: "a".repeat(5001),
    });
    expect(result.success).toBe(false);
  });
});
