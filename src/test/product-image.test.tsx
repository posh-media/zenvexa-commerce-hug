import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProductImage } from "@/components/zenvexa/product-image";
import { ProductCard } from "@/components/zenvexa/storefront";
import { AdminGate } from "@/components/zenvexa/admin";
import { StoreProvider } from "@/components/zenvexa/store-context";
import { products, type Product } from "@/lib/commerce";

vi.mock("@/lib/firebase-client", () => ({
  firebaseMode: false,
  emulatorMode: false,
  firebaseClient: vi.fn(),
  callBackend: vi.fn(),
}));
vi.mock("@/components/zenvexa/firebase-commerce", () => ({
  useFirebaseCommerce: () => ({
    user: null,
    staffRole: "",
    catalog: [],
    orders: [],
    loading: false,
    error: "",
  }),
  FirebaseAccount: () => null,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});
const placeholder = "/catalog/missing.svg";

describe("shared product image", () => {
  it.each([
    "https://images.example.test/product.webp",
    "/catalog/eco.webp",
    "http://127.0.0.1:9199/v0/b/test/o/product.png",
    "data:image/png;base64,iVBORw0KGgo=",
  ])("preserves an accepted original image: %s", (src) => {
    render(<ProductImage src={src} alt="Product" />);
    fireEvent.load(screen.getByAltText("Product"));
    expect(screen.getByAltText("Product")).toHaveAttribute("src", src);
    expect(screen.getByAltText("Product")).toHaveAttribute("data-product-image", "original");
  });

  it.each([
    undefined,
    null,
    "",
    "   ",
    42,
    false,
    {},
    [],
    ["/image.png"],
    "not a URL",
    "https://",
    "javascript:alert(1)",
    "file:///product.png",
  ])("handles missing or malformed image value %j", (src) => {
    render(<ProductImage src={src} alt="Product" />);
    expect(screen.getByAltText("Product")).toHaveAttribute("src", placeholder);
  });

  it("recovers an image that already failed before hydration attaches error handlers", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    render(<ProductImage src="/failed-before-hydration.webp" alt="Product" />);
    expect(screen.getByAltText("Product")).toHaveAttribute("src", placeholder);
  });

  it("switches a failed image to the placeholder without retry loops or srcset overrides", () => {
    const onError = vi.fn();
    render(
      <ProductImage
        src="https://images.example.test/broken.webp"
        srcSet="https://images.example.test/broken-2x.webp 2x"
        alt="Product"
        onError={onError}
      />,
    );
    const image = screen.getByAltText("Product");
    fireEvent.error(image);
    expect(image).toHaveAttribute("src", placeholder);
    expect(image).not.toHaveAttribute("srcset");
    fireEvent.error(image);
    fireEvent.error(image);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(image).toHaveAttribute("src", placeholder);
  });

  it("resets failure state when the image changes, including returning to an earlier URL", () => {
    const first = "https://images.example.test/first.webp";
    const next = "https://images.example.test/new-upload.webp";
    const { rerender } = render(<ProductImage src={first} alt="Product" />);
    fireEvent.error(screen.getByAltText("Product"));
    rerender(<ProductImage src={next} alt="Product" />);
    expect(screen.getByAltText("Product")).toHaveAttribute("src", next);
    fireEvent.error(screen.getByAltText("Product"));
    expect(screen.getByAltText("Product")).toHaveAttribute("src", placeholder);
    rerender(<ProductImage src={first} alt="Product" />);
    expect(screen.getByAltText("Product")).toHaveAttribute("src", first);
  });

  it("keeps size, classes, lazy loading and caller styles throughout fallback", () => {
    render(
      <ProductImage
        src="/broken.webp"
        alt="Product"
        width={77}
        height={77}
        className="thumbnail rounded"
        loading="lazy"
        style={{ maxWidth: "100%", objectFit: "cover" }}
      />,
    );
    const image = screen.getByAltText("Product");
    expect(image).toHaveStyle({ objectFit: "cover" });
    fireEvent.error(image);
    expect(image).toHaveAttribute("width", "77");
    expect(image).toHaveAttribute("height", "77");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveClass("thumbnail", "rounded");
    expect(image).toHaveStyle({ maxWidth: "100%", objectFit: "contain" });
    expect(image.parentElement?.querySelectorAll("img")).toHaveLength(1);
  });

  it("renders fallback for all 50 catalogue images without changing source product data", () => {
    const before = JSON.stringify(products);
    render(
      <>
        {products.map((p) => (
          <ProductImage key={p.id} src={p.image} alt={p.id} width={48} height={48} />
        ))}
      </>,
    );
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(50);
    images.forEach((image) => {
      fireEvent.error(image);
      expect(image).toHaveAttribute("src", placeholder);
    });
    expect(JSON.stringify(products)).toBe(before);
  });
});

describe("image fallback in existing views", () => {
  it("retains the storefront product card dimensions and handles missing Firestore-like image data", () => {
    const product = { ...products[0]!, image: null } as unknown as Product;
    render(
      <StoreProvider>
        <ProductCard p={product} />
      </StoreProvider>,
    );
    const image = screen.getByAltText(product.title);
    expect(image).toHaveAttribute("src", placeholder);
    expect(image).toHaveAttribute("width", "400");
    expect(image).toHaveAttribute("height", "300");
    expect(image.parentElement).toHaveClass("product-photo");
  });

  it("uses the same fallback for the demo admin preview and prioritizes a replacement URL", () => {
    localStorage.setItem("zenvexa-role", "admin");
    render(
      <StoreProvider>
        <AdminGate />
      </StoreProvider>,
    );
    expect(screen.getByAltText("Product preview")).toHaveAttribute("src", placeholder);
    const input = screen.getByPlaceholderText("https://…");
    fireEvent.change(input, { target: { value: "https://images.example.test/admin.webp" } });
    expect(screen.getByAltText("Product preview")).toHaveAttribute(
      "src",
      "https://images.example.test/admin.webp",
    );
    fireEvent.error(screen.getByAltText("Product preview"));
    expect(screen.getByAltText("Product preview")).toHaveAttribute("src", placeholder);
    fireEvent.change(input, { target: { value: "https://images.example.test/replacement.webp" } });
    expect(screen.getByAltText("Product preview")).toHaveAttribute(
      "src",
      "https://images.example.test/replacement.webp",
    );
  });
});
