'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { api, apiFieldErrors } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isAllOrId, paginate, useAction, useApi, usePageState, useQueryState } from '@/lib/hooks';
import { formatMoney } from '@/lib/format';
import { productFormSchema, zodFieldErrors } from '@/lib/schemas';
import type { Category, Product, Station } from '@/lib/types';
import { Alert, Field, Loader, Pagination } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Modal, Switch } from '@/components/Modal';

// '' in a station <select> means "no override"
const toStationId = (value: string) => (value ? Number(value) : null);

type Selection = number | 'all';

const ITEMS_PER_PAGE = 20;

export function MenuTab() {
  const categories = useApi<{ categories: Category[] }>('/menu/categories');
  const products = useApi<{ products: Product[] }>('/menu/products');
  const stations = useApi<{ stations: Station[] }>('/stations');
  const { busy, error: actionError, setError, run } = useAction();
  const { can } = useAuth();
  const canCreate = can('menu.create');
  const canEdit = can('menu.update');
  const canDelete = can('menu.delete');

  const [categoryParam, setCategoryParam] = useQueryState<string>('category', isAllOrId, 'all');
  const selected: Selection = categoryParam === 'all' ? 'all' : Number(categoryParam);
  const setSelected = (value: Selection) => setCategoryParam(String(value));
  const [search, setSearch] = useState('');
  const [page, setPage] = usePageState(`${categoryParam}|${search.trim().toLowerCase()}`);
  const [itemDialog, setItemDialog] = useState<Product | 'new' | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<Category | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const categoryList = useMemo(() => categories.data?.categories ?? [], [categories.data]);
  const allProducts = useMemo(() => products.data?.products ?? [], [products.data]);
  const stationList = (stations.data?.stations ?? []).filter((s) => s.isActive);
  const defaultStation = stations.data?.stations.find((s) => s.isDefault);

  const category = selected === 'all' ? null : (categoryList.find((c) => c.id === selected) ?? null);
  const query = search.trim().toLowerCase();
  const visible = allProducts.filter(
    (p) => (selected === 'all' || p.categoryId === selected) && (!query || p.name.toLowerCase().includes(query)),
  );

  const shown = paginate(visible, page, ITEMS_PER_PAGE);

  const reloadAll = () => Promise.all([categories.reload(), products.reload()]);

  const toggleAvailable = (p: Product, isAvailable: boolean) =>
    run(`product:${p.id}`, async () => {
      await api(`/menu/products/${p.id}`, { method: 'PATCH', body: { isAvailable } });
      await products.reload();
    });

  const deleteProduct = (p: Product) =>
    run(`product:${p.id}`, async () => {
      try {
        await api(`/menu/products/${p.id}`, { method: 'DELETE' });
        await reloadAll();
      } finally {
        setDeleting(null);
      }
    });

  if (categories.loading || products.loading) return <Loader />;
  const loadError = categories.error ?? products.error;
  if (loadError) return <Alert>{loadError.message}</Alert>;

  const stationOf = (p: Product) => p.station?.name ?? p.category.station?.name ?? defaultStation?.name ?? '—';
  const categoryStation = (c: Category) => c.station?.name ?? `${defaultStation?.name ?? 'Default station'} (default)`;

  return (
    <>
      <Alert onClose={() => setError(null)}>{actionError}</Alert>

      <div className="menu-manager">
        {/* ---- Categories ---- */}
        <aside className="card menu-categories">
          <header className="menu-categories-head">
            <h2>Categories</h2>
            {canCreate && (
              <button className="btn btn-ghost btn-sm" onClick={() => setCategoryDialog('new')}>
                <Icon name="plus" size={15} /> New
              </button>
            )}
          </header>
          <nav className="menu-category-list" aria-label="Categories">
            <button
              className={`menu-category ${selected === 'all' ? 'active' : ''}`}
              aria-current={selected === 'all' ? 'true' : undefined}
              onClick={() => setSelected('all')}
            >
              <span className="menu-category-name">All items</span>
              <span className="menu-category-count">{allProducts.length}</span>
            </button>
            {categoryList.map((c) => (
              <button
                key={c.id}
                className={`menu-category ${selected === c.id ? 'active' : ''}`}
                aria-current={selected === c.id ? 'true' : undefined}
                onClick={() => setSelected(c.id)}
              >
                <span className="menu-category-name">
                  {c.name}
                  <span className="menu-category-station">{categoryStation(c)}</span>
                </span>
                <span className="menu-category-count">{c.productCount}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ---- Items ---- */}
        <section className="card menu-items">
          <header className="menu-items-head">
            <div>
              <h2>{category ? category.name : 'All items'}</h2>
              <p className="muted small">
                {category
                  ? `Prepared at ${categoryStation(category)} · ${category.productCount} item${category.productCount === 1 ? '' : 's'}`
                  : `${allProducts.length} items in ${categoryList.length} categories`}
              </p>
            </div>
            <div className="menu-items-actions">
              {category && (canEdit || canDelete) && (
                <button className="btn btn-ghost" onClick={() => setCategoryDialog(category)}>
                  <Icon name="pencil" size={15} /> Edit category
                </button>
              )}
              {canCreate && (
                <button className="btn btn-primary" onClick={() => setItemDialog('new')} disabled={!categoryList.length}>
                  <Icon name="plus" size={16} /> Add item
                </button>
              )}
            </div>
          </header>

          <div className="menu-search">
            <Icon name="search" size={16} />
            <input
              type="search"
              placeholder="Search items"
              aria-label="Search items"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {visible.length === 0 ? (
            <div className="menu-empty">
              <strong>{query ? 'No items match your search' : 'No items in this category yet'}</strong>
              {!query && canCreate && (
                <button className="btn btn-dark btn-sm" onClick={() => setItemDialog('new')} disabled={!categoryList.length}>
                  <Icon name="plus" size={15} /> Add an item
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table menu-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Price</th>
                    <th>Prepared at</th>
                    <th>Available</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {shown.items.map((p) => (
                    <tr key={p.id} className={p.isAvailable ? '' : 'is-unavailable'}>
                      <td>
                        <strong>{p.name}</strong>
                        {selected === 'all' && <div className="muted small">{p.category.name}</div>}
                      </td>
                      <td className="nowrap">{formatMoney(p.price)}</td>
                      <td>
                        {stationOf(p)}
                        {p.station && (
                          <span className="badge badge-neutral menu-override" title="Set on this item, not its category">
                            Item setting
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="menu-availability">
                          <Switch
                            checked={p.isAvailable}
                            disabled={!canEdit || busy === `product:${p.id}`}
                            label={`${p.name} available`}
                            onChange={(on) => toggleAvailable(p, on)}
                          />
                          <span className="muted small">{p.isAvailable ? 'On menu' : 'Sold out'}</span>
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          {canEdit && (
                            <button className="icon-btn" onClick={() => setItemDialog(p)} aria-label={`Edit ${p.name}`} title="Edit">
                              <Icon name="pencil" size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="icon-btn icon-btn-danger"
                              onClick={() => setDeleting(p)}
                              aria-label={`Delete ${p.name}`}
                              title="Delete"
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={shown.page} total={shown.total} size={ITEMS_PER_PAGE} onPage={setPage} />
        </section>
      </div>

      {itemDialog && (
        <ItemDialog
          item={itemDialog === 'new' ? null : itemDialog}
          defaultCategoryId={category?.id}
          categories={categoryList}
          stations={stationList}
          defaultStationName={defaultStation?.name}
          onClose={() => setItemDialog(null)}
          onSaved={async () => {
            setItemDialog(null);
            await reloadAll();
          }}
        />
      )}

      {categoryDialog && (
        <CategoryDialog
          category={categoryDialog === 'new' ? null : categoryDialog}
          stations={stationList}
          defaultStationName={defaultStation?.name}
          onClose={() => setCategoryDialog(null)}
          onSaved={async (id) => {
            setCategoryDialog(null);
            await reloadAll();
            setSelected(id);
          }}
          onDeleted={async () => {
            setCategoryDialog(null);
            setSelected('all');
            await reloadAll();
          }}
        />
      )}

      <Modal
        open={deleting !== null}
        size="sm"
        title="Delete item?"
        description={deleting ? `“${deleting.name}” will be removed from the menu.` : undefined}
        onClose={() => setDeleting(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger-solid"
              disabled={!deleting || busy === `product:${deleting.id}`}
              onClick={() => deleting && deleteProduct(deleting)}
            >
              Delete item
            </button>
          </>
        }
      >
        <p className="muted small" style={{ margin: 0 }}>
          Items that appear in past orders can&apos;t be deleted. Switch them to <strong>Sold out</strong> instead, which keeps
          your order history intact.
        </p>
      </Modal>
    </>
  );
}

// ---- Item dialog (add / edit) ----

interface ItemDialogProps {
  item: Product | null;
  defaultCategoryId?: number;
  categories: Category[];
  stations: Station[];
  defaultStationName?: string;
  onClose: () => void;
  onSaved: () => void;
}

function ItemDialog({ item, defaultCategoryId, categories, stations, defaultStationName, onClose, onSaved }: ItemDialogProps) {
  const [values, setValues] = useState({
    name: item?.name ?? '',
    categoryId: String(item?.categoryId ?? defaultCategoryId ?? ''),
    price: item ? String(item.price) : '',
    stationId: item?.stationId ? String(item.stationId) : '',
  });
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const categoryStation = categories.find((c) => String(c.id) === values.categoryId)?.station?.name;
  const inherited = categoryStation ?? (defaultStationName ? `${defaultStationName}, the default` : 'the default station');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = productFormSchema.safeParse(values);
    if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
    setErrors({});
    setSaving(true);
    try {
      const body = { ...parsed.data, stationId: toStationId(values.stationId), isAvailable };
      await api(item ? `/menu/products/${item.id}` : '/menu/products', { method: item ? 'PATCH' : 'POST', body });
      onSaved();
    } catch (err) {
      setErrors(apiFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={item ? 'Edit item' : 'Add item'}
      description={item ? undefined : 'New items appear on the order screen straight away.'}
      onClose={onClose}
      onSubmit={onSubmit}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-dark" disabled={saving}>
            {saving ? 'Saving…' : item ? 'Save changes' : 'Add item'}
          </button>
        </>
      }
    >
      <div className="stack">
        <Alert>{errors.form}</Alert>
        <Field label="Item name" htmlFor="it-name" error={errors.name}>
          <input id="it-name" value={values.name} onChange={set('name')} placeholder="e.g. Beef Pilau" autoFocus />
        </Field>
        <div className="form-grid">
          <Field label="Category" htmlFor="it-category" error={errors.categoryId}>
            <select id="it-category" value={values.categoryId} onChange={set('categoryId')}>
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price" htmlFor="it-price" error={errors.price}>
            <div className="input-prefix">
              <span>RWF</span>
              <input
                id="it-price"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={values.price}
                onChange={set('price')}
                placeholder="0"
              />
            </div>
          </Field>
        </div>
        <Field
          label="Prepared at"
          htmlFor="it-station"
          hint="Only change this if the item is made somewhere other than the rest of its category."
        >
          <select id="it-station" value={values.stationId} onChange={set('stationId')}>
            <option value="">{`Same as category (${inherited})`}</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="switch-row">
          <div>
            <strong>Available</strong>
            <p className="muted small">Turn off when the item is sold out. Customer Care won&apos;t be able to order it.</p>
          </div>
          <Switch checked={isAvailable} label="Available" onChange={setIsAvailable} />
        </div>
      </div>
    </Modal>
  );
}

// ---- Category dialog (add / edit / delete) ----

interface CategoryDialogProps {
  category: Category | null;
  stations: Station[];
  defaultStationName?: string;
  onClose: () => void;
  onSaved: (id: number) => void;
  onDeleted: () => void;
}

function CategoryDialog({ category, stations, defaultStationName, onClose, onSaved, onDeleted }: CategoryDialogProps) {
  const canDelete = useAuth().can('menu.delete');
  const [name, setName] = useState(category?.name ?? '');
  const [stationId, setStationId] = useState(category?.stationId ? String(category.stationId) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setErrors({ name: 'Name must be at least 2 characters' });
    setErrors({});
    setSaving(true);
    try {
      const body = { name: name.trim(), stationId: toStationId(stationId) };
      const res = await api<{ category: Category }>(category ? `/menu/categories/${category.id}` : '/menu/categories', {
        method: category ? 'PATCH' : 'POST',
        body,
      });
      onSaved(res.category.id);
    } catch (err) {
      setErrors(apiFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!category) return;
    setSaving(true);
    try {
      await api(`/menu/categories/${category.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  const itemCount = category?.productCount ?? 0;

  return (
    <Modal
      open
      size="sm"
      title={category ? 'Edit category' : 'New category'}
      onClose={onClose}
      onSubmit={onSubmit}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-dark" disabled={saving}>
            {saving ? 'Saving…' : category ? 'Save changes' : 'Create category'}
          </button>
        </>
      }
    >
      <div className="stack">
        <Alert>{errors.form}</Alert>
        <Field label="Name" htmlFor="cat-name" error={errors.name}>
          <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Drinks" autoFocus />
        </Field>
        <Field label="Prepared at" htmlFor="cat-station" hint="Every item in this category goes to this station's kitchen screen.">
          <select id="cat-station" value={stationId} onChange={(e) => setStationId(e.target.value)}>
            <option value="">{`Default station${defaultStationName ? ` (${defaultStationName})` : ''}`}</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        {category && canDelete && (
          <div className="danger-zone">
            {confirmDelete ? (
              <>
                <span>Delete “{category.name}” permanently?</span>
                <span className="danger-zone-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </button>
                  <button type="button" className="btn btn-danger-solid btn-sm" onClick={remove} disabled={saving}>
                    Delete
                  </button>
                </span>
              </>
            ) : (
              <>
                <span className="muted small">
                  {itemCount
                    ? `Move or delete its ${itemCount} item${itemCount === 1 ? '' : 's'} before deleting this category.`
                    : 'This category has no items.'}
                </span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={itemCount > 0}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Icon name="trash" size={14} /> Delete category
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
