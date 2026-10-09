// "ORD-1009-0042": month and day, then the day's counter. The counter is what people say out
// loud ("order 42"), so it is bold and the date part is muted.
//
// `id` is only a fallback for a backend that doesn't send order numbers yet.
export function OrderNumber({
  number,
  id,
  stacked = false,
}: {
  number?: string | null;
  id?: number;
  /** Date part above the counter, for compact cards */
  stacked?: boolean;
}) {
  if (!number) return <span className="order-no">#{id}</span>;

  const split = number.lastIndexOf('-') + 1;
  return (
    <span className={`order-no ${stacked ? 'order-no-stacked' : ''}`} aria-label={`Order ${number}`}>
      <span className="order-no-date">{number.slice(0, split)}</span>
      <strong>{number.slice(split)}</strong>
    </span>
  );
}

/** Plain-text version, for sentences and attributes. */
export const orderLabel = (o: { orderNumber?: string | null; id: number }) => o.orderNumber ?? `#${o.id}`;
