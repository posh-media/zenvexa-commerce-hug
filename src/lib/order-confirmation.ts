export function orderConfirmationCopy(order: {
  paymentStatus?: string;
  paymentMethod?: string;
  orderStatus?: string;
  status?: string;
} | null) {
  if (!order) return { title: "Order status", description: "We could not load your order. Please check your order history or contact support." };
  if (order.paymentStatus === "paid") return { title: "Thank you — your payment is confirmed", description: "Your payment has been verified. Follow your order's progress with order tracking." };
  if (order.paymentStatus === "refunded") return { title: "Payment refunded", description: "Your order records show a refund. Contact support if you need help." };
  if (order.paymentStatus === "failed" || [order.orderStatus, order.status].includes("cancelled")) return { title: "Payment not completed", description: "Check your payment status before retrying. You can resume payment from your order history." };
  if (order.paymentMethod === "cash-on-delivery" && [order.orderStatus, order.status].includes("confirmed")) return { title: "Your delivery order is confirmed", description: "Your remaining balance is payable on delivery. Check tracking for your order's payment breakdown." };
  return { title: "Order received — payment awaiting confirmation", description: "Payment has not been confirmed yet. Verify your payment or check order history before retrying." };
}
