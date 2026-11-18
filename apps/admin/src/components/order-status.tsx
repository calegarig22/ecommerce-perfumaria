import { ORDER_STATUS_LABEL, type OrderStatus } from "@perfumaria/db/orders";

const TONE: Record<OrderStatus, string> = {
  pending_payment: "bg-nude text-muted",
  paid: "bg-warn/15 text-warn",
  preparing: "bg-caramel/20 text-accent-deep",
  shipped: "bg-ok/10 text-ok",
  delivered: "bg-ok/10 text-ok",
  canceled: "bg-danger/10 text-danger",
  expired: "bg-nude text-muted",
  refunded: "bg-danger/10 text-danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${TONE[status]}`}>{ORDER_STATUS_LABEL[status]}</span>;
}
