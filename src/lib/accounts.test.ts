import { describe, expect, it } from "vitest";
import { hashPassword, passwordSchema, sameText, usernameSchema, verifyPassword } from "./accounts";
import { cleanAvatar, cleanColor } from "./profile";
import { sha256 } from "./server";

describe("accounts", () => {
  it("never stores the password itself, and verifies it", () => {
    const stored = hashPassword("hunter22");
    expect(stored).not.toContain("hunter22");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("hunter22", stored)).toBe(true);
    expect(verifyPassword("hunter23", stored)).toBe(false);
    expect(verifyPassword("hunter22", "garbage")).toBe(false);
  });

  it("salts: the same password hashes differently each time", () => {
    expect(hashPassword("same-password")).not.toBe(hashPassword("same-password"));
  });

  it("normalises and validates usernames and passwords", () => {
    expect(usernameSchema.parse("  Sam_01 ")).toBe("sam_01");
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("has space").success).toBe(false);
    expect(passwordSchema.safeParse("12345").success).toBe(false);
    expect(passwordSchema.safeParse("123456").success).toBe(true);
  });

  it("compares reset codes exactly", () => {
    expect(sameText("4821", "4821")).toBe(true);
    expect(sameText("4821", "4822")).toBe(false);
    expect(sameText("4821", "48210")).toBe(false);
  });

  it("only allows known avatars and colours", () => {
    expect(cleanAvatar("🐼")).toBe("🐼");
    expect(cleanAvatar("<script>")).toBe("🦊");
    expect(cleanColor("teal")).toBe("teal");
    expect(cleanColor("url(evil)")).toBe("coral");
  });

  it("hashes session and room secrets", () => {
    expect(sha256("abc")).toHaveLength(64);
    expect(sha256("abc")).not.toBe(sha256("abd"));
  });
});
