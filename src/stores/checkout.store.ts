import { create } from "zustand";
import type { DeliveryOptionId } from "@/lib/cart";
import type { Order } from "@/types/order";
import type { PaymentMethod } from "@/types/order";
import type { Address } from "@/types/user";
import { LAST_ORDER_KEY, writeJsonStorage } from "@/lib/cart";

type CheckoutStep = "address" | "shipping" | "payment" | "review";

export type CheckoutCustomer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type CheckoutState = {
  step: CheckoutStep;
  customer: CheckoutCustomer;
  shippingAddress: Address | null;
  deliveryNotes: string;
  deliveryOptionId: DeliveryOptionId;
  paymentMethod: PaymentMethod | null;
  couponCode: string;
  couponDiscount: number;
  submitting: boolean;
  error: string | null;
  lastOrder: Order | null;
};

type CheckoutActions = {
  setStep: (step: CheckoutStep) => void;
  setCustomer: (customer: Partial<CheckoutCustomer>) => void;
  setShippingAddress: (address: Address | null) => void;
  setDeliveryNotes: (notes: string) => void;
  setDeliveryOptionId: (id: DeliveryOptionId) => void;
  setPaymentMethod: (method: PaymentMethod | null) => void;
  setCouponCode: (code: string) => void;
  setCouponDiscount: (discount: number) => void;
  setSubmitting: (submitting: boolean) => void;
  setError: (error: string | null) => void;
  setLastOrder: (order: Order | null) => void;
  reset: () => void;
};

const emptyCustomer: CheckoutCustomer = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

const initialState: CheckoutState = {
  step: "address",
  customer: emptyCustomer,
  shippingAddress: null,
  deliveryNotes: "",
  deliveryOptionId: "express",
  paymentMethod: null,
  couponCode: "",
  couponDiscount: 0,
  submitting: false,
  error: null,
  lastOrder: null,
};

export const useCheckoutStore = create<CheckoutState & CheckoutActions>()(
  (set) => ({
    ...initialState,
    setStep: (step) => set({ step }),
    setCustomer: (customer) =>
      set((state) => ({ customer: { ...state.customer, ...customer } })),
    setShippingAddress: (shippingAddress) => set({ shippingAddress }),
    setDeliveryNotes: (deliveryNotes) => set({ deliveryNotes }),
    setDeliveryOptionId: (deliveryOptionId) => set({ deliveryOptionId }),
    setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
    setCouponCode: (couponCode) => set({ couponCode }),
    setCouponDiscount: (couponDiscount) => set({ couponDiscount }),
    setSubmitting: (submitting) => set({ submitting }),
    setError: (error) => set({ error }),
    setLastOrder: (lastOrder) => {
      if (lastOrder) writeJsonStorage(LAST_ORDER_KEY, lastOrder);
      set({ lastOrder });
    },
    reset: () => set({ ...initialState, lastOrder: null }),
  }),
);
