import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { ApiError } from "@/api/client";
import { AuthProvider, useAuth } from "@/auth/auth-context";

const mockGetSession = jest.fn();
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockGetStoredToken = jest.fn();
const mockStoreToken = jest.fn();
const mockClearStoredToken = jest.fn();

jest.mock("@/api/auth", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  login: (...args: unknown[]) => mockLogin(...args),
  logout: (...args: unknown[]) => mockLogout(...args),
}));

jest.mock("@/auth/token-store", () => ({
  getStoredToken: (...args: unknown[]) => mockGetStoredToken(...args),
  storeToken: (...args: unknown[]) => mockStoreToken(...args),
  clearStoredToken: (...args: unknown[]) => mockClearStoredToken(...args),
}));

const session = {
  user: { id: "usr_1", name: "Rani", email: "rani@demostore.id", phone: null, lastLoginAt: null },
  organization: { id: "org_1", name: "Demo Store", slug: "demo-store", timezone: "Asia/Jakarta", currency: "IDR" },
  membership: {
    id: "mem_1",
    roleId: "role_cashier",
    roleCode: "cashier",
    roleName: "Kasir",
    defaultBranchId: "brn_1",
    status: "active",
  },
  permissions: ["sale.view", "shift.view"],
};

function Probe() {
  const { status, signOut } = useAuth();
  return (
    <>
      <Text testID="status">{status}</Text>
      <Pressable
        testID="sign-out"
        onPress={() => {
          void signOut();
        }}
      >
        <Text>Keluar</Text>
      </Pressable>
    </>
  );
}

async function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearStoredToken.mockResolvedValue(undefined);
    mockStoreToken.mockResolvedValue(undefined);
  });

  it("restores an authenticated session from the stored token", async () => {
    mockGetStoredToken.mockResolvedValue("token-1");
    mockGetSession.mockResolvedValue(session);

    await renderProvider();

    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("authenticated"));
    expect(mockGetSession).toHaveBeenCalledWith("token-1");
  });

  it("keeps the stored token when the session check fails without a verdict", async () => {
    mockGetStoredToken.mockResolvedValue("token-1");
    mockGetSession.mockRejectedValue(
      new ApiError("Tidak dapat terhubung ke server.", {
        code: "NETWORK_ERROR",
        status: 0,
      }),
    );

    await renderProvider();

    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("unauthenticated"));
    expect(mockClearStoredToken).not.toHaveBeenCalled();
  });

  it("clears the stored token when the session has expired", async () => {
    mockGetStoredToken.mockResolvedValue("token-1");
    mockGetSession.mockRejectedValue(
      new ApiError("Sesi Anda berakhir.", { code: "AUTH_SESSION_EXPIRED", status: 401 }),
    );

    await renderProvider();

    await waitFor(() => expect(mockClearStoredToken).toHaveBeenCalled());
    expect(screen.getByTestId("status").props.children).toBe("unauthenticated");
  });

  it("signs out locally before the revoke request finishes", async () => {
    mockGetStoredToken.mockResolvedValue("token-1");
    mockGetSession.mockResolvedValue(session);
    mockLogout.mockImplementation(() => new Promise(() => {}));

    await renderProvider();
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("authenticated"));

    await fireEvent.press(screen.getByTestId("sign-out"));

    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("unauthenticated"));
    expect(mockClearStoredToken).toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalledWith("token-1");
  });
});