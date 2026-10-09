'use client';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { api, apiFieldErrors } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { formatMoney } from '@/lib/format';
import { orderFormSchema, zodFieldErrors } from '@/lib/schemas';
import { Icon } from '@/components/Icon';
import { Alert, Empty, Field, Guard, Loader, PageHeader } from '@/components/ui';
import type { Category, Driver, Order, Product } from '@/lib/types';

type CustomerForm = { customerName: string; customerPhone: string; location: string; notes: string; driverId: string };

const EMPTY_CUSTOMER: CustomerForm = { customerName: '', customerPhone: '', location: '', notes: '', driverId: '' };

export default function NewOrderPage() {
  return (
    <Guard permissions={['orders.create']}>
      <NewOrder />
    </Guard>
  );
}

function NewOrder() {
  const categories = useApi<{ categories: Category[] }>('/menu/categories');
  const products = useApi<{ products: Product[] }>('/menu/products?available=true');
  const drivers = useApi<{ drivers: Driver[] }>('/drivers', { interval: 15_000, live: ['orders'] });

  const [categoryId, setCategoryId] = useState<number | 'all'>('all');
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [cart, setCart] = useState<Record<number, number>>({}); // productId -> quantity
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Order | null>(null);

  const productList = useMemo(() => products.data?.products ?? [], [products.data]);
  const productById = useMemo(() => new Map(productList.map((p) => [p.id, p])), [productList]);
  const visibleProducts = categoryId === 'all' ? productList : productList.filter((p) => p.categoryId === categoryId);
  const availableDrivers = (drivers.data?.drivers ?? []).filter((d) => d.availabilityStatus === 'AVAILABLE');

  const lines = Object.entries(cart)
    .map(([id, quantity]) => ({ product: productById.get(Number(id)), quantity }))
    .filter((l): l is { product: Product; quantity: number } => Boolean(l.product));
  const total = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  const setField =
    (key: keyof CustomerForm) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setCustomer((c) => ({ ...c, [key]: e.target.value }));
  const changeQty = (productId: number, delta: number) =>
    setCart((c) => {
      const next = Math.min(50, (c[productId] ?? 0) + delta);
      const { [productId]: _, ...rest } = c;
      return next > 0 ? { ...rest, [productId]: next } : rest;
    });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setCreated(null);
    const parsed = orderFormSchema.safeParse({
      ...customer,
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
    });
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));

    const { notes, ...rest } = parsed.data;
    setErrors({});
    setSubmitting(true);
    try {
      const { order } = await api<{ order: Order }>('/orders', {
        method: 'POST',
        body: {
          ...rest,
          ...(notes && { notes }),
          ...(customer.driverId && { driverId: Number(customer.driverId) }),
        },
      });
      setCreated(order);
      setCustomer(EMPTY_CUSTOMER);
      setCart({});
      drivers.reload();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setErrors(apiFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="New order" />

      {created && (
        <Alert kind="success" onClose={() => setCreated(null)}>
          Order #{created.id} created ({formatMoney(created.totalAmount)}).{' '}
          <Link href="/orders">View orders</Link>
        </Alert>
      )}
      <Alert>{errors.form}</Alert>

      <form className="order-form-layout" onSubmit={onSubmit} noValidate>
        <div className="stack">
          <section className="card">
            <h2>Customer</h2>
            <div className="form-grid">
              <Field label="Customer name" htmlFor="customerName" error={errors.customerName}>
                <input id="customerName" value={customer.customerName} onChange={setField('customerName')} autoComplete="off" />
              </Field>
              <Field label="Phone" htmlFor="customerPhone" error={errors.customerPhone}>
                <input
                  id="customerPhone"
                  type="tel"
                  value={customer.customerPhone}
                  onChange={setField('customerPhone')}
                  placeholder="+250 7XX XXX XXX"
                />
              </Field>
              <Field label="Delivery location" htmlFor="location" error={errors.location} className="span-2">
                <input
                  id="location"
                  value={customer.location}
                  onChange={setField('location')}
                  
                />
              </Field>
              <div className="span-2">
                <Field label="Notes (optional)" htmlFor="notes" error={errors.notes}>
                  <textarea id="notes" value={customer.notes} onChange={setField('notes')} rows={2} />
                </Field>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Menu</h2>
            <div className="tabs">
              <button type="button" className={`tab ${categoryId === 'all' ? 'active' : ''}`} onClick={() => setCategoryId('all')}>
                All
              </button>
              {(categories.data?.categories ?? []).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`tab ${categoryId === c.id ? 'active' : ''}`}
                  onClick={() => setCategoryId(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
            {products.loading ? (
              <Loader />
            ) : products.error ? (
              <Alert>{products.error.message}</Alert>
            ) : visibleProducts.length ? (
              <div className="product-grid">
                {visibleProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`product-tile ${cart[p.id] ? 'in-cart' : ''}`}
                    onClick={() => changeQty(p.id, 1)}
                    aria-label={`Add ${p.name}`}
                  >
                    {cart[p.id] && <span className="in-cart-qty">{cart[p.id]}</span>}
                    <span>{p.name}</span>
                    <span className="muted small">{p.category.name}</span>
                    <span className="price">{formatMoney(p.price)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty title="No menu items available" />
            )}
          </section>
        </div>

        <aside className="card cart">
          <h2>Order summary</h2>
          {lines.length ? (
            <ul className="cart-lines">
              {lines.map(({ product, quantity }) => (
                <li key={product.id} className="cart-line">
                  <span>{product.name}</span>
                  <span className="qty-control">
                    <button type="button" className="icon-btn" onClick={() => changeQty(product.id, -1)} aria-label={`Remove one ${product.name}`}>
                      <Icon name="minus" size={14} />
                    </button>
                    <span>{quantity}</span>
                    <button type="button" className="icon-btn" onClick={() => changeQty(product.id, 1)} aria-label={`Add one ${product.name}`}>
                      <Icon name="plus" size={14} />
                    </button>
                  </span>
                  <span>{formatMoney(product.price * quantity)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No items added</p>
          )}
          {errors.items && <span className="field-error">{errors.items}</span>}

          <div className="cart-total">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>

          <Field label="Driver (optional)" htmlFor="driverId">
            <select id="driverId" value={customer.driverId} onChange={setField('driverId')}>
              <option value="">Assign later</option>
              {availableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <button className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send to kitchen'}
          </button>
        </aside>
      </form>
    </>
  );
}
