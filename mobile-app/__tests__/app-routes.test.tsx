import { render, screen } from "@testing-library/react-native";
import IndexScreen from "../app/index";
import AppLayout from "../app/(app)/_layout";

const mockAuth = jest.fn();
const mockRedirect = jest.fn();

jest.mock("@/auth/auth-context", () => ({
  useAuth: () => mockAuth(),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return React.createElement(Text, { testID: "redirect" }, href);
    },
    Stack: () => React.createElement(Text, { testID: "stack" }, "stack"),
  };
});

describe("app routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends an authenticated user from / to the dashboard", async () => {
    mockAuth.mockReturnValue({ status: "authenticated" });

    await render(<IndexScreen />);

    expect(mockRedirect).toHaveBeenCalledWith("/(app)/dashboard");
  });

  it("sends an unauthenticated user from / to login", async () => {
    mockAuth.mockReturnValue({ status: "unauthenticated" });

    await render(<IndexScreen />);

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("holds on the loading state while the session is restored", async () => {
    mockAuth.mockReturnValue({ status: "loading" });

    await render(<IndexScreen />);

    expect(screen.getByTestId("screen-loading")).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("guards the app group and redirects unauthenticated users to login", async () => {
    mockAuth.mockReturnValue({ status: "unauthenticated" });

    await render(<AppLayout />);

    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(screen.queryByTestId("stack")).toBeNull();
  });

  it("renders the app stack for an authenticated user", async () => {
    mockAuth.mockReturnValue({ status: "authenticated" });

    await render(<AppLayout />);

    expect(screen.getByTestId("stack")).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});