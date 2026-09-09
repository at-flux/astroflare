import { describe, it, expect } from "vitest";
import { withClock } from "../src/clock";
import {
  composeEmailAddress,
  generateFormResultHtml,
  renderEmailTemplate,
  type FormSection,
} from "../src/forms/index";

describe("forms utilities", () => {
  it("composeEmailAddress adds tag when provided", () => {
    expect(composeEmailAddress("hello", "example.com", "contact")).toBe(
      "hello+contact@example.com",
    );
  });

  it("composeEmailAddress omits tag when not provided", () => {
    expect(composeEmailAddress("hello", "example.com")).toBe(
      "hello@example.com",
    );
  });

  it("generateFormResultHtml renders sections", () => {
    const sections: FormSection[] = [
      {
        title: "Test",
        items: [
          { key: "Email", value: "user@example.com" },
          { key: "Message", value: "Hello there" },
        ],
      },
    ];

    const html = generateFormResultHtml(sections);
    expect(html).toContain("Test");
    expect(html).toContain("Email");
    expect(html).toContain("user@example.com");
  });

  it("renderEmailTemplate stamps the footer from the clock", async () => {
    const html = await withClock("2026-10-01T12:00:00Z", () =>
      renderEmailTemplate({
        title: "Enquiry",
        contentHtml: "<p>Hi</p>",
        brandName: "Example",
      }),
    );
    // Midday UTC, so the date reads the same in every timezone the runner might be in.
    expect(html).toContain("Example contact form on 01/10/2026");
  });

  it("renderEmailTemplate wraps content and title", async () => {
    const html = await renderEmailTemplate({
      title: "Contact",
      contentHtml: "<p>Body</p>",
      brandName: "example-brand",
    });
    expect(html).toContain("Contact");
    expect(html).toContain("<p>Body</p>");
    expect(html).toContain("example-brand");
  });
});
