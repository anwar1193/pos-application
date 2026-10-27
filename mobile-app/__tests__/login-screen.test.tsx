import { Alert } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ApiError } from "@/api/client";
import LoginScreen from "../app/login";

const mockSignIn = jest.fn();
const mockReplace = jest.fn();

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => ({
    status: "unauthenticated",
    session: null,
    token: null,
    signIn: mockSignIn,
    signOut: jest.fn(),
  }),
}));

jest.mock("expo-router", () => ({
  router: { replace: mockReplace },
}));

async function fillCredentials(
  email = "rani@demostore.id",
  password = "demoKasir2026!",
) {
  await fireEvent.changeText(screen.getByTestId("login-email"), email);
  await fireEvent.changeText(screen.getByTestId("login-password"), password);
}

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignIn.mockResolvedValue(undefined);
  });

  it("shows required messages when submitted empty", async () => {
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(screen.getByText("Email wajib diisi.")).toBeTruthy();
    expect(screen.getByText("Password wajib diisi.")).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format", async () => {
    await render(<LoginScreen />);

    await fillCredentials("bukan-email", "rahasia");
    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(screen.getByText("Format email tidak valid.")).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("trims the email and remembers the terminal by default", async () => {
    await render(<LoginScreen />);

    await fillCredentials("  rani@demostore.id  ", "demoKasir2026!");
    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(mockSignIn).toHaveBeenCalledWith({
      email: "rani@demostore.id",
      password: "demoKasir2026!",
      remember: true,
    });
  });

  it("maps invalid credentials to the Indonesian message", async () => {
    mockSignIn.mockRejectedValueOnce(
      new ApiError("Email atau password salah.", {
        code: "AUTH_INVALID_CREDENTIALS",
        status: 401,
      }),
    );
    await render(<LoginScreen />);

    await fillCredentials();
    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(await screen.findByText("Email atau password salah.")).toBeTruthy();
  });

  it("explains when the account cannot use the cashier app", async () => {
    mockSignIn.mockRejectedValueOnce(
      new ApiError("Anda tidak memiliki akses.", { code: "FORBIDDEN", status: 403 }),
    );
    await render(<LoginScreen />);

    await fillCredentials();
    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(
      await screen.findByText("Akun ini belum memiliki akses aplikasi kasir."),
    ).toBeTruthy();
  });

  it("toggles password visibility", async () => {
    await render(<LoginScreen />);

    expect(screen.getByTestId("login-password").props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByTestId("login-password-toggle"));

    expect(screen.getByTestId("login-password").props.secureTextEntry).toBe(false);
  });

  it("disables the submit button while signing in", async () => {
    let resolveSignIn: (() => void) | undefined;
    mockSignIn.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveSignIn = resolve; }),
    );
    await render(<LoginScreen />);

    await fillCredentials();
    const pressing = fireEvent.press(screen.getByTestId("login-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("login-submit").props.accessibilityState.disabled).toBe(true),
    );

    await act(async () => {
      resolveSignIn?.();
    });
    await pressing;
  });

  it("shows help when the user forgot the password", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByTestId("login-forgot"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Lupa sandi?",
      expect.stringContaining("manajer toko"),
    );
    alertSpy.mockRestore();
  });
});
