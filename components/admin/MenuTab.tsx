'use client';

import { useState, type FormEvent } from 'react';
import { api, apiFieldErrors } from '@/lib/api';
import { useAction, useApi } from '@/lib/hooks';
import { formatMoney } from '@/lib/format';
import { productFormSchema, zodFieldErrors } from '@/lib/schemas';
import type { Category, Product, Station } from '@/lib/types';
import { Alert, Empty, Field, Loader } from '@/components/ui';

const EMPTY_PRODUCT = { name: '', categoryId: '', price: '', stationId: '' };

// '' in a station <select> means "no override"
const toStationId = (value: string) => (value ? Number(value) : null);

export function MenuTab() {
  const categories = useApi<{ categories: Category[] }>('/menu/categories');
  const products = useApi<{ products: Product[] }>('/menu/products');
  const stations = useApi<{ stations: Station[] }>('/stations');
  const { busy, error: actionError, setError, run } = useAction();

  const [filter, setFilter] = useState<number | 'all'>('all');
  const [categoryName, setCategoryName] = useState('');
  const [product, setProduct] = useState(EMPTY_PRODUCT);
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});

  const categoryList = categories.data?.categories ?? [];
  const stationList = (stations.data?.stations ?? []).filter((s) => s.isActive);
  const defaultStation = stations.data?.stations.find((s) => s.isDefault);
  const productList = (products.data?.products ?? []).filter((p) => filter === 'all' || p.categoryId === filter);
  const reloadAll = () => Promise.all([categories.reload(), products.reload()]);

  const addCategory = (e: FormEvent) => {
    e.preventDefault();
    const name = categoryName.trim();
    if (name.length < 2) return setError('Category name must be at least 2 characters');
    run('category:new', async () => {
      await api('/menu/categories', { method: 'POST', body: { name } });
      setCategoryName('');
      await categories.reload();
    });
  };

  const renameCategory = (c: Category) => {
    const name = window.prompt('New category name', c.name)?.trim();
    if (!name || name === c.name) return;
    run(`category:${c.id}`, async () => {
      await api(`/menu/categories/${c.id}`, { method: 'PATCH', body: { name } });
      await reloadAll();
    });
  };

  const setCategoryStation = (c: Category, value: string) =>
    run(`category:${c.id}`, async () => {
      await api(`/menu/categories/${c.id}`, { method: 'PATCH', body: { stationId: toStationId(value) } });
      await reloadAll();
    });

  const deleteCategory = (c: Category) => {
    if (!window.confirm(`Delete the "${c.name}" category?`)) return;
    run(`category:${c.id}`, async () => {
      await api(`/menu/categories/${c.id}`, { method: 'DELETE' });
      if (filter === c.id) setFilter('all');
      await categories.reload();
    });
  };

  const addProduct = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = productFormSchema.safeParse(product);
    if (!parsed.success) return setProductErrors(zodFieldErrors(parsed.error));
    setProductErrors({});
    await run('product:new', async () => {
      try {
        await api('/menu/products', {
          method: 'POST',
          body: { ...parsed.data, stationId: toStationId(product.stationId) },
        });
        setProduct(EMPTY_PRODUCT);
        await reloadAll();
      } catch (err) {
        setProductErrors(apiFieldErrors(err));
      }
    });
  };

  const updateProduct = (p: Product, body: Partial<Pick<Product, 'price' | 'isAvailable' | 'name' | 'stationId'>>) =>
    run(`product:${p.id}`, async () => {
      await api(`/menu/products/${p.id}`, { method: 'PATCH', body });
      await products.reload();
    });

  const editPrice = (p: Product) => {
    const input = window.prompt(`New price for ${p.name}`, String(p.price));
    if (input === null) return;
    const price = Number(input);
    if (!Number.isInteger(price) || price < 0) return setError('Price must be a whole, non-negative number');
    updateProduct(p, { price });
  };

  const deleteProduct = (p: Product) => {
    if (!window.confirm(`Delete "${p.name}" from the menu?`)) return;
    run(`product:${p.id}`, async () => {
      await api(`/menu/products/${p.id}`, { method: 'DELETE' });
      await reloadAll();
    });
  };

  return (
    <div className="admin-grid">
      <section className="card">
        <h2>Products</h2>
        <Alert onClose={() => setError(null)}>{actionError}</Alert>
        <div className="tabs">
          <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            All
          </button>
          {categoryList.map((c) => (
            <button key={c.id} className={`tab ${filter === c.id ? 'active' : ''}`} onClick={() => setFilter(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
        {products.loading ? (
          <Loader />
        ) : productList.length === 0 ? (
          <Empty title="No products" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Station</th>
                  <th>Available</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {productList.map((p) => (
                  <tr key={p.id} className={p.isAvailable ? '' : 'inactive-row'}>
                    <td>
                      <strong>{p.name}</strong>
                      <div className="muted small">{p.category.name}</div>
                    </td>
                    <td>{formatMoney(p.price)}</td>
                    <td>
                      <select
                        className="select-sm"
                        aria-label={`Station for ${p.name}`}
                        value={p.stationId ?? ''}
                        disabled={busy === `product:${p.id}`}
                        onChange={(e) => updateProduct(p, { stationId: toStationId(e.target.value) })}
                      >
                        <option value="">{`From category (${p.category.station?.name ?? defaultStation?.name ?? 'default'})`}</option>
                        {stationList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox"
                        aria-label={`${p.name} available`}
                        checked={p.isAvailable}
                        disabled={busy === `product:${p.id}`}
                        onChange={(e) => updateProduct(p, { isAvailable: e.target.checked })}
                      />
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => editPrice(p)} disabled={busy === `product:${p.id}`}>
                          Edit price
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteProduct(p)} disabled={busy === `product:${p.id}`}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="stack">
        <section className="card">
          <h2>Add product</h2>
          <form className="stack" onSubmit={addProduct} noValidate>
            <Alert>{productErrors.form}</Alert>
            <Field label="Name" htmlFor="p-name" error={productErrors.name}>
              <input id="p-name" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} />
            </Field>
            <Field label="Category" htmlFor="p-category" error={productErrors.categoryId}>
              <select
                id="p-category"
                value={product.categoryId}
                onChange={(e) => setProduct({ ...product, categoryId: e.target.value })}
              >
                <option value="">Choose…</option>
                {categoryList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Station" htmlFor="p-station">
              <select
                id="p-station"
                value={product.stationId}
                onChange={(e) => setProduct({ ...product, stationId: e.target.value })}
              >
                <option value="">Same as category</option>
                {stationList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price" htmlFor="p-price" error={productErrors.price}>
              <input
                id="p-price"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={product.price}
                onChange={(e) => setProduct({ ...product, price: e.target.value })}
              />
            </Field>
            <button className="btn btn-dark" disabled={busy === 'product:new'}>
              Add product
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Categories</h2>
          {categories.error && <Alert>{categories.error.message}</Alert>}
          <table className="table" style={{ marginBottom: 14 }}>
            <tbody>
              {categoryList.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name} <span className="muted small">({c.productCount})</span>
                  </td>
                  <td>
                    <select
                      className="select-sm"
                      aria-label={`Station for ${c.name}`}
                      value={c.stationId ?? ''}
                      disabled={busy === `category:${c.id}`}
                      onChange={(e) => setCategoryStation(c, e.target.value)}
                    >
                      <option value="">{`Default (${defaultStation?.name ?? '—'})`}</option>
                      {stationList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => renameCategory(c)} disabled={busy === `category:${c.id}`}>
                        Rename
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteCategory(c)} disabled={busy === `category:${c.id}`}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form className="inline-form" onSubmit={addCategory}>
            <input
              aria-label="New category name"
              placeholder="New category"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
            <button className="btn btn-primary" disabled={busy === 'category:new'}>
              Add
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
