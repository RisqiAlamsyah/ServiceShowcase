import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const getUserById = vi.fn();

vi.mock("@/auth", () => ({ auth }));
vi.mock("@/server/user/service", () => ({ getUserById }));

const { AuthError, getCurrentUser, requireRole, requireUser } =
  await import("@/server/auth/guards");

beforeEach(() => {
  auth.mockReset();
  getUserById.mockReset();
});

describe("requireUser", () => {
  it("menolak tanpa sesi (UNAUTHENTICATED) tanpa menyentuh DB", async () => {
    auth.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("menolak sesi yang akunnya sudah tidak ada di DB", async () => {
    auth.mockResolvedValue({ user: { id: "cuid-hilang" } });
    getUserById.mockResolvedValue(null);
    await expect(requireUser()).rejects.toBeInstanceOf(AuthError);
  });

  it("mengembalikan role/plan dari DB, bukan dari token", async () => {
    auth.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } }); // klaim token palsu diabaikan
    getUserById.mockResolvedValue({
      id: "u1",
      email: "a@b.co",
      name: null,
      role: "USER",
      plan: "FREE",
    });
    const user = await requireUser();
    expect(user.role).toBe("USER");
    expect(getUserById).toHaveBeenCalledWith("u1");
  });
});

describe("getCurrentUser", () => {
  it("null bila tidak login", async () => {
    auth.mockResolvedValue({ user: {} });
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("requireRole", () => {
  it("menolak peran yang tidak diizinkan (FORBIDDEN) dan meloloskan yang diizinkan", () => {
    expect(() => requireRole({ role: "USER" }, ["ADMIN"])).toThrowError(AuthError);
    expect(() => requireRole({ role: "ADMIN" }, ["ADMIN"])).not.toThrow();
  });
});
