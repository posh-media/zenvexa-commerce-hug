import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { StoreProvider, useStore } from "@/components/zenvexa/store-context";
import { AdminGate } from "@/components/zenvexa/admin";
import { Shop } from "@/components/zenvexa/storefront";
import { callBackend } from "@/lib/firebase-client";

const backend = vi.hoisted(() => ({
  user: null,
  authLoading: false,
  staffLoading: false,
  staffRole: "",
  catalog: [],
  orders: [],
  loading: false,
  error: "",
  catalogueError: "",
  deliveryError: "",
  catalogueCategories: ["All Merchandise"],
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/lib/firebase-client", () => ({
  firebaseMode: true,
  firebaseClient: vi.fn(() => ({ auth: {} })),
  callBackend: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  sendEmailVerification: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/components/zenvexa/firebase-commerce", () => ({
  useFirebaseCommerce: () => backend,
  FirebaseAccount: () => null,
}));
afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  backend.catalog = [];
  backend.user = null;
  backend.authLoading = false;
  backend.staffLoading = false;
  backend.staffRole = "";
  backend.error = "";
  backend.catalogueError = "";
  backend.deliveryError = "";
  vi.clearAllMocks();
});
function Probe() {
  const store = useStore();
  return (
    <>
      <p>{`catalog:${store.catalog.length};orders:${store.orders.length};staff:${store.staffRole}`}</p>
      <span>{`view:${store.view}`}</span>
    </>
  );
}
it("Firebase mode ignores demo catalogue, orders and a forged browser admin role", () => {
  localStorage.setItem("zenvexa-role", "admin");
  localStorage.setItem("zenvexa-catalog-v2", JSON.stringify([{ id: "forged" }]));
  localStorage.setItem("zenvexa-orders-v2", JSON.stringify([{ id: "demo" }]));
  render(
    <StoreProvider>
      <Probe />
      <AdminGate />
    </StoreProvider>,
  );
  expect(screen.getByText("catalog:0;orders:0;staff:")).toBeInTheDocument();
  expect(screen.getByText("Access Denied — Admin Role Required")).toBeInTheDocument();
  expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(screen.queryByText("Demo Admin Login")).not.toBeInTheDocument();
  expect(localStorage.getItem("zenvexa-orders-v2")).toContain("demo");
});
it("a payment redirect opens owned history but never verifies or fabricates payment", () => {
  window.history.replaceState({}, "", "/?paymentOrder=untrusted-reference&paid=true");
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );
  expect(screen.getByText("view:orders")).toBeInTheDocument();
  expect(screen.getByText("catalog:0;orders:0;staff:")).toBeInTheDocument();
  expect(callBackend).not.toHaveBeenCalled();
});
it("keeps the branded hero visible when remote catalogue reads are denied without rendering a mock deal", () => {
  backend.catalogueError =
    "Catalogue unavailable (permission-denied). Public Firestore rules or connectivity are blocking product reads.";
  backend.error = backend.catalogueError;
  const { container } = render(
    <StoreProvider>
      <Shop />
    </StoreProvider>,
  );
  expect(container.querySelector(".hero")).toBeInTheDocument();
  expect(screen.getByAltText(/Everyday Nigerian essentials/i)).toBeInTheDocument();
  expect(container.querySelector(".deal-card")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("permission-denied");
  expect(container.querySelectorAll(".product-card")).toHaveLength(0);
});
it("submits email and password to Firebase Auth and displays a safe credential error", async () => {
  vi.mocked(signInWithEmailAndPassword).mockRejectedValue({ code: "auth/invalid-credential" });
  render(
    <StoreProvider>
      <AdminGate />
    </StoreProvider>,
  );
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: " staff@example.com " },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "sample-password" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
    expect.anything(),
    "staff@example.com",
    "sample-password",
  );
});
it("denies an authenticated account without an active staff record", () => {
  backend.user = {
    uid: "ordinary-user",
    email: "customer@example.com",
    emailVerified: true,
    isAnonymous: false,
  } as never;
  render(
    <StoreProvider>
      <AdminGate />
    </StoreProvider>,
  );
  expect(screen.getByText("Access Denied — Staff Role Required")).toBeInTheDocument();
  expect(screen.getByText(/customer@example\.com is signed in/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(signOut).toHaveBeenCalled();
});
