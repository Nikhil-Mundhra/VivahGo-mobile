import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clerkState = {
  clerk: { loaded: false },
  signIn: null,
  signUp: null,
};

vi.mock("@clerk/react", () => ({
  useClerk: () => clerkState.clerk,
  useSignIn: () => ({ signIn: clerkState.signIn }),
  useSignUp: () => ({ signUp: clerkState.signUp }),
}));

describe("EmailOtpLogin", () => {
  beforeEach(() => {
    clerkState.clerk = { loaded: false };
    clerkState.signIn = null;
    clerkState.signUp = null;
    vi.useFakeTimers();
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_local");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("shows an enabled retry button after Clerk loading times out", async () => {
    const { default: EmailOtpLogin } = await import("./EmailOtpLogin.jsx");

    render(<EmailOtpLogin onLoginSuccess={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    const retryButton = screen.getByRole("button", { name: "Retry" });
    expect(retryButton).toBeEnabled();
    expect(screen.getByText("Email login took too long to initialize. Refresh the page and try again.")).toBeInTheDocument();
  });

  it("keeps retry available after timeout instead of trapping the user in a disabled state", async () => {
    const { default: EmailOtpLogin } = await import("./EmailOtpLogin.jsx");

    render(<EmailOtpLogin onLoginSuccess={vi.fn()} />);
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    const retryButton = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);

    expect(retryButton).toBeEnabled();
    expect(screen.queryByText("Email login is not ready yet. Please wait a moment and try again.")).not.toBeInTheDocument();
  });

  it("enables email login once Clerk is ready and an email is entered", async () => {
    clerkState.clerk = { loaded: true };
    clerkState.signIn = {
      create: vi.fn().mockResolvedValue({}),
      emailCode: {
        sendCode: vi.fn().mockResolvedValue({}),
      },
    };
    clerkState.signUp = {
      create: vi.fn(),
      verifications: {
        sendEmailCode: vi.fn(),
      },
    };

    const { default: EmailOtpLogin } = await import("./EmailOtpLogin.jsx");

    render(<EmailOtpLogin onLoginSuccess={vi.fn()} />);

    const actionButton = screen.getByRole("button", { name: "Get code" });
    expect(actionButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Enter your email"), {
      target: { value: "planner@example.com" },
    });

    expect(screen.getByRole("button", { name: "Get code" })).toBeEnabled();
  });
});
