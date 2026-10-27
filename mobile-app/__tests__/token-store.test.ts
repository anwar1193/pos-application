jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import * as SecureStore from "expo-secure-store";
import {
  SESSION_TOKEN_KEY,
  clearStoredToken,
  getStoredToken,
  storeToken,
} from "@/auth/token-store";

const getItemAsync = SecureStore.getItemAsync as jest.Mock;
const setItemAsync = SecureStore.setItemAsync as jest.Mock;
const deleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

describe("token store", () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    await clearStoredToken();
    jest.clearAllMocks();
  });

  it("reads the persisted token from secure storage", async () => {
    getItemAsync.mockResolvedValue("persisted-token");

    await expect(getStoredToken()).resolves.toBe("persisted-token");
    expect(getItemAsync).toHaveBeenCalledWith(SESSION_TOKEN_KEY);
    expect(SESSION_TOKEN_KEY).toBe("pos.mobile.session_token");
  });

  it("persists the token when remember is checked", async () => {
    await storeToken("fresh-token", true);

    expect(setItemAsync).toHaveBeenCalledWith(SESSION_TOKEN_KEY, "fresh-token");
    expect(deleteItemAsync).not.toHaveBeenCalled();
  });

  it("keeps a non-remembered token in memory without persisting it", async () => {
    await storeToken("session-only", false);

    expect(setItemAsync).not.toHaveBeenCalled();
    expect(deleteItemAsync).toHaveBeenCalledWith(SESSION_TOKEN_KEY);
    await expect(getStoredToken()).resolves.toBe("session-only");
  });

  it("clears both persisted and in-memory tokens", async () => {
    await storeToken("to-clear", true);
    getItemAsync.mockResolvedValue(null);

    await clearStoredToken();

    expect(deleteItemAsync).toHaveBeenCalledWith(SESSION_TOKEN_KEY);
    await expect(getStoredToken()).resolves.toBeNull();
  });

  it("falls back to memory when secure storage cannot be read", async () => {
    await storeToken("memory-token", false);
    getItemAsync.mockRejectedValue(new Error("keychain unavailable"));

    await expect(getStoredToken()).resolves.toBe("memory-token");
  });
});
