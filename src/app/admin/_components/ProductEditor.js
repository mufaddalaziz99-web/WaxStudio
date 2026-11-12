'use client';
import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert, App, Button, Card, Col, Form, Input, InputNumber, Popconfirm, Row, Select, Space, Switch, Table, Tooltip, Typography,
} from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { slugify } from '@/lib/rules';
import { api, useAdmin } from './hooks';
import { ImageInput, ImageListInput } from './ImageInputs';
import { PageHeader, applyFieldError } from './ui';

const TAX_RATES = [0, 5, 12, 18, 28].map((r) => ({ value: r, label: `${r}%` }));

const EMPTY = {
  name: '',
  slug: '',
  short_description: '',
  description: '',
  price: null,
  compare_at_price: null,
  stock: 0,
  sku: '',
  category_id: null,
  images: [],
  tags: [],
  highlights: [],
  specs: [],
  faqs: [],
  how_to_use: [],
  tagline: '',
  badge: '',
  rated_for: [],
  claims: [],
  ingredients: [],
  free_from: [],
  weight_grams: null,
  length_cm: null,
  breadth_cm: null,
  height_cm: null,
  hsn_code: '',
  tax_rate: 18,
  max_per_order: 10,
  is_hidden: false,
  is_featured: false,
  sort_order: 0,
  variants: [],
};

function toFormValues(p) {
  if (!p) return EMPTY;
  return {
    ...EMPTY,
    ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, p[k] ?? EMPTY[k]])),
    tax_rate: Number(p.tax_rate ?? 18),
    variants: (p.variants || []).map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku || '',
      price: v.price,
      compare_at_price: v.compare_at_price,
      stock: v.stock,
      weight_grams: v.weight_grams,
      image: v.image || null,
      swatch: v.swatch || '',
      badge: v.badge || '',
      is_hidden: v.is_hidden,
    })),
  };
}

const nonEmpty = (s) => typeof s === 'string' && s.trim().length > 0;

function toPayload(v) {
  return {
    ...v,
    slug: v.slug?.trim() || undefined,
    sku: v.sku?.trim() || null,
    hsn_code: v.hsn_code?.trim() || null,
    category_id: v.category_id || null,
    compare_at_price: v.compare_at_price ?? null,
    weight_grams: v.weight_grams ?? null,
    length_cm: v.length_cm ?? null,
    breadth_cm: v.breadth_cm ?? null,
    height_cm: v.height_cm ?? null,
    stock: v.stock ?? 0,
    sort_order: v.sort_order ?? 0,
    max_per_order: v.max_per_order ?? 10,
    images: v.images || [],
    tags: (v.tags || []).map((t) => String(t).trim()).filter(Boolean),
    highlights: (v.highlights || []).filter(nonEmpty),
    how_to_use: (v.how_to_use || []).filter(nonEmpty),
    specs: (v.specs || []).filter((s) => nonEmpty(s?.label) && nonEmpty(s?.value)),
    faqs: (v.faqs || []).filter((f) => nonEmpty(f?.q) && nonEmpty(f?.a)),
    tagline: v.tagline?.trim() || '',
    badge: v.badge?.trim() || null,
    rated_for: (v.rated_for || []).map((t) => String(t).trim()).filter(Boolean),
    claims: (v.claims || []).filter(nonEmpty),
    ingredients: (v.ingredients || []).filter((i) => nonEmpty(i?.name)).map((i) => ({ name: i.name.trim(), benefit: (i.benefit || '').trim() })),
    free_from: (v.free_from || []).map((t) => String(t).trim()).filter(Boolean),
    variants: (v.variants || []).map((x, i) => ({
      ...(x.id ? { id: x.id } : {}),
      name: x.name,
      sku: x.sku?.trim() || null,
      price: x.price ?? null,
      compare_at_price: x.compare_at_price ?? null,
      stock: x.stock ?? 0,
      weight_grams: x.weight_grams ?? null,
      image: x.image || null,
      swatch: x.swatch?.trim() || null,
      badge: x.badge?.trim() || null,
      sort_order: i,
      is_hidden: Boolean(x.is_hidden),
    })),
  };
}

/** Editable list of plain strings (highlights, how-to steps). */
function StringList({ name, placeholder, addLabel, max = 12, textarea }) {
  return (
    <Form.List name={name}>
      {(fields, { add, remove, move }) => (
        <>
          {fields.map((field, i) => (
            <Space key={field.key} align="start" style={{ display: 'flex', marginBottom: 8 }}>
              <Typography.Text type="secondary" style={{ width: 20, display: 'inline-block', paddingTop: 5 }}>
                {i + 1}.
              </Typography.Text>
              <Form.Item name={field.name} style={{ marginBottom: 0, flex: 1, minWidth: 260 }}>
                {textarea ? <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} placeholder={placeholder} maxLength={300} /> : <Input placeholder={placeholder} maxLength={200} />}
              </Form.Item>
              <Button type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up" />
              <Button type="text" icon={<ArrowDownOutlined />} disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down" />
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} aria-label="Remove" />
            </Space>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add('')} disabled={fields.length >= max}>
            {addLabel}
          </Button>
        </>
      )}
    </Form.List>
  );
}

/** Editable list of two-field objects (specs {label,value}, faqs {q,a}). */
function PairList({ name, keys, placeholders, addLabel, max = 20, wide }) {
  return (
    <Form.List name={name}>
      {(fields, { add, remove, move }) => (
        <>
          {fields.map((field, i) => (
            <Row key={field.key} gutter={8} style={{ marginBottom: 8 }} wrap={false} align="top">
              <Col flex={wide ? '1 1 40%' : '0 0 34%'}>
                <Form.Item name={[field.name, keys[0]]} style={{ marginBottom: 0 }}>
                  <Input placeholder={placeholders[0]} maxLength={wide ? 200 : 60} />
                </Form.Item>
              </Col>
              <Col flex="1 1 auto">
                <Form.Item name={[field.name, keys[1]]} style={{ marginBottom: 0 }}>
                  {wide ? <Input.TextArea autoSize={{ minRows: 1, maxRows: 5 }} placeholder={placeholders[1]} maxLength={1000} /> : <Input placeholder={placeholders[1]} maxLength={200} />}
                </Form.Item>
              </Col>
              <Col flex="none">
                <Button type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up" />
                <Button type="text" icon={<ArrowDownOutlined />} disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down" />
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} aria-label="Remove" />
              </Col>
            </Row>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ [keys[0]]: '', [keys[1]]: '' })} disabled={fields.length >= max}>
            {addLabel}
          </Button>
        </>
      )}
    </Form.List>
  );
}

function VariantsTable({ productPrice }) {
  return (
    <Form.List name="variants">
      {(fields, { add, remove, move }) => {
        const columns = [
          {
            title: '',
            width: 64,
            render: (_, field, i) => (
              <Space size={0} orientation="vertical">
                <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up" />
                <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down" />
              </Space>
            ),
          },
          {
            title: 'Name *',
            width: 170,
            render: (_, field) => (
              <>
                <Form.Item name={[field.name, 'id']} hidden>
                  <Input />
                </Form.Item>
                <Form.Item name={[field.name, 'name']} rules={[{ required: true, whitespace: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                  <Input placeholder="e.g. 100 g" maxLength={60} />
                </Form.Item>
              </>
            ),
          },
          {
            title: 'SKU',
            width: 130,
            render: (_, field) => (
              <Form.Item name={[field.name, 'sku']} style={{ marginBottom: 0 }}>
                <Input maxLength={60} />
              </Form.Item>
            ),
          },
          {
            title: <Tooltip title="Leave empty to use the product price">Price ₹</Tooltip>,
            width: 110,
            render: (_, field) => (
              <Form.Item name={[field.name, 'price']} style={{ marginBottom: 0 }}>
                <InputNumber min={0} precision={0} placeholder={productPrice != null ? String(productPrice) : ''} style={{ width: '100%' }} />
              </Form.Item>
            ),
          },
          {
            title: 'MRP ₹',
            width: 100,
            render: (_, field) => (
              <Form.Item name={[field.name, 'compare_at_price']} style={{ marginBottom: 0 }}>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            ),
          },
          {
            title: 'Stock *',
            width: 100,
            render: (_, field) => (
              <Form.Item name={[field.name, 'stock']} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 0 }}>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            ),
          },
          {
            title: <Tooltip title="Leave empty to use the product weight">Weight g</Tooltip>,
            width: 100,
            render: (_, field) => (
              <Form.Item name={[field.name, 'weight_grams']} style={{ marginBottom: 0 }}>
                <InputNumber min={0} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            ),
          },
          {
            title: 'Image',
            width: 170,
            render: (_, field) => (
              <Form.Item name={[field.name, 'image']} style={{ marginBottom: 0 }}>
                <ImageInput size={40} />
              </Form.Item>
            ),
          },
          {
            title: 'Swatch',
            width: 120,
            render: (_, field) => (
              <Form.Item
                name={[field.name, 'swatch']}
                rules={[{ pattern: /^#[0-9a-fA-F]{3,8}$/, message: '#hex' }]}
                style={{ marginBottom: 0 }}
              >
                <SwatchInput />
              </Form.Item>
            ),
          },
          {
            title: <Tooltip title='Small label on the size chip, e.g. "Best value"'>Badge</Tooltip>,
            width: 120,
            render: (_, field) => (
              <Form.Item name={[field.name, 'badge']} style={{ marginBottom: 0 }}>
                <Input maxLength={30} placeholder="Best value" />
              </Form.Item>
            ),
          },
          {
            title: 'Hidden',
            width: 70,
            align: 'center',
            render: (_, field) => (
              <Form.Item name={[field.name, 'is_hidden']} valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch size="small" />
              </Form.Item>
            ),
          },
          {
            title: '',
            width: 48,
            render: (_, field) => (
              <Popconfirm title="Remove this variant?" description="Variants that were ordered are hidden instead." onConfirm={() => remove(field.name)}>
                <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove variant" />
              </Popconfirm>
            ),
          },
        ];
        return (
          <>
            {fields.length > 0 && (
              <Table rowKey="key" size="small" columns={columns} dataSource={fields} pagination={false} scroll={{ x: 1200 }} style={{ marginBottom: 12 }} />
            )}
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => add({ name: '', sku: '', price: null, compare_at_price: null, stock: 0, weight_grams: null, image: null, swatch: '', is_hidden: false })}
              disabled={fields.length >= 30}
            >
              Add variant
            </Button>
          </>
        );
      }}
    </Form.List>
  );
}

function SwatchInput({ value, onChange }) {
  const ok = /^#[0-9a-fA-F]{3,8}$/.test(value || '');
  return (
    <Input
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder="#c8a27a"
      maxLength={20}
      prefix={<span style={{ width: 14, height: 14, borderRadius: 7, border: '1px solid #ddd', background: ok ? value : 'transparent', display: 'inline-block' }} />}
    />
  );
}

export default function ProductEditor({ product }) {
  const isNew = !product;
  const router = useRouter();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const slugTouched = useRef(!isNew);
  const cats = useAdmin('/api/admin/categories');
  const initialValues = useMemo(() => toFormValues(product), [product]);
  const price = Form.useWatch('price', form);
  const variants = Form.useWatch('variants', form);
  const slug = Form.useWatch('slug', form);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      const body = toPayload(values);
      const r = await api(isNew ? '/api/admin/products' : `/api/admin/products/${product.id}`, { method: isNew ? 'POST' : 'PUT', body });
      await qc.invalidateQueries({ queryKey: ['admin'] });
      message.success(isNew ? 'Product created' : r.restocked ? 'Saved — back-in-stock emails are going out' : 'Product saved');
      if (isNew) router.replace(`/admin/products/${r.product.id}`);
      else form.setFieldValue('slug', r.product.slug);
    } catch (e) {
      applyFieldError(form, e);
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()}>
      {isNew ? 'Create product' : 'Save'}
    </Button>
  );

  return (
    <>
      <PageHeader
        title={isNew ? 'New product' : product.name}
        subtitle={<Link href="/admin/products">← All products</Link>}
        extra={
          <>
            {!isNew && (
              <Button icon={<EyeOutlined />} href={`/product/${product.slug}`} target="_blank">
                View on store
              </Button>
            )}
            {saveButton}
          </>
        }
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={onFinish}
        onFinishFailed={({ errorFields }) => {
          message.error('Please fix the highlighted fields');
          if (errorFields?.[0]) form.scrollToField(errorFields[0].name);
        }}
        onValuesChange={(changed) => {
          if ('slug' in changed) slugTouched.current = true;
          if ('name' in changed && !slugTouched.current) form.setFieldValue('slug', slugify(changed.name));
        }}
        scrollToFirstError
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Card size="small" title="Basics">
                <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: 'Enter a name' }]}>
                  <Input maxLength={160} />
                </Form.Item>
                <Form.Item
                  name="short_description"
                  label="Short description"
                  extra="Shown under the title and in search results."
                >
                  <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={400} showCount />
                </Form.Item>
                <Form.Item name="description" label="Description">
                  <Input.TextArea autoSize={{ minRows: 6, maxRows: 20 }} maxLength={10000} />
                </Form.Item>
              </Card>

              <Card size="small" title="Images">
                <Form.Item name="images" style={{ marginBottom: 0 }} extra="The first image is the main image. JPG, PNG, WebP or AVIF, up to 8 MB.">
                  <ImageListInput folder="products" />
                </Form.Item>
              </Card>

              <Card size="small" title="Pricing & stock">
                <Row gutter={12}>
                  <Col xs={12} md={6}>
                    <Form.Item name="price" label="Price (₹)" rules={[{ required: true, message: 'Enter a price' }]}>
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Item name="compare_at_price" label="MRP / was (₹)" extra="Shown struck through if higher.">
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Item
                      name="stock"
                      label="Stock"
                      extra={variants?.length ? 'Not used — each variant has its own stock.' : undefined}
                    >
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} disabled={Boolean(variants?.length)} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Item name="max_per_order" label="Max per order">
                      <InputNumber min={1} max={50} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Item name="sku" label="SKU">
                      <Input maxLength={60} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Item name="hsn_code" label="HSN code">
                      <Input maxLength={20} />
                    </Form.Item>
                  </Col>
                  <Col xs={12} md={6}>
                    <Form.Item name="tax_rate" label="GST % (included in price)">
                      <Select options={TAX_RATES} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Card size="small" title="Variants" extra={<Typography.Text type="secondary">Sizes, packs or shades</Typography.Text>}>
                <VariantsTable productPrice={price} />
              </Card>

              <Card size="small" title="Product page content">
                <Row gutter={12}>
                  <Col xs={24} md={16}>
                    <Form.Item name="tagline" label="Tagline" extra="One line under the title.">
                      <Input maxLength={160} placeholder="Smooth skin, naturally." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="badge" label="Badge" extra="Shown on the image and cards.">
                      <Input maxLength={30} placeholder="Bestseller" />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="rated_for" label="Highly rated for" extra="Short chips, press Enter after each.">
                  <Select mode="tags" tokenSeparators={[',']} open={false} placeholder="Smooth skin, Gentle" />
                </Form.Item>
                <Form.Item name="free_from" label="Free from" extra="Shown as round badges, press Enter after each.">
                  <Select mode="tags" tokenSeparators={[',']} open={false} placeholder="Parabens, Sulphates" />
                </Form.Item>
                <Typography.Text strong>Claims (ticked list)</Typography.Text>
                <div style={{ margin: '8px 0 16px' }}>
                  <StringList name="claims" placeholder="e.g. Gentle on skin" addLabel="Add claim" max={8} />
                </div>
                <Typography.Text strong>Key ingredients</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <PairList name="ingredients" keys={['name', 'benefit']} placeholders={['Ingredient', 'What it does']} addLabel="Add ingredient" max={12} wide />
                </div>
              </Card>

              <Card size="small" title="Highlights">
                <StringList name="highlights" placeholder="e.g. No heating needed" addLabel="Add highlight" />
              </Card>

              <Card size="small" title="How to use">
                <StringList name="how_to_use" placeholder="Step" addLabel="Add step" textarea />
              </Card>

              <Card size="small" title="Specifications">
                <PairList name="specs" keys={['label', 'value']} placeholders={['Label (e.g. Net weight)', 'Value (e.g. 100 g)']} addLabel="Add spec" />
              </Card>

              <Card size="small" title="FAQs">
                <PairList name="faqs" keys={['q', 'a']} placeholders={['Question', 'Answer']} addLabel="Add FAQ" wide />
              </Card>
            </Space>
          </Col>

          <Col xs={24} xl={8}>
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Card size="small" title="Visibility">
                <Form.Item name="is_hidden" label="Hidden from the store" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item name="is_featured" label="Featured" valuePropName="checked" extra="Featured products lead the home page.">
                  <Switch />
                </Form.Item>
                <Form.Item name="sort_order" label="Sort order" extra="Lower numbers come first.">
                  <InputNumber precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </Card>

              <Card size="small" title="Organisation">
                <Form.Item name="category_id" label="Category">
                  <Select
                    allowClear
                    loading={cats.isPending}
                    placeholder="No category"
                    options={(cats.data?.categories || []).map((c) => ({ value: c.id, label: c.is_hidden ? `${c.name} (hidden)` : c.name }))}
                  />
                </Form.Item>
                <Form.Item name="tags" label="Tags" extra="Used by search. Press Enter after each tag.">
                  <Select mode="tags" tokenSeparators={[',']} open={false} placeholder="hair removal, natural wax" />
                </Form.Item>
              </Card>

              <Card size="small" title="SEO / URL">
                <Form.Item
                  name="slug"
                  label="URL slug"
                  extra={
                    <>
                      /product/{slugify(slug || '') || '…'}
                      {!isNew && product.redirects?.length > 0 && (
                        <div>Old URLs that redirect here: {product.redirects.map((r) => `/product/${r}`).join(', ')}</div>
                      )}
                    </>
                  }
                >
                  <Input maxLength={90} />
                </Form.Item>
                {!isNew && slug && slugify(slug) !== product.slug && (
                  <Alert type="info" showIcon title="Changing the slug keeps the old URL working through a redirect." />
                )}
              </Card>

              <Card size="small" title="Shipping">
                <Row gutter={12}>
                  <Col span={24}>
                    <Form.Item name="weight_grams" label="Weight per unit (g)" extra="Leave empty to use the store default.">
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="length_cm" label="L (cm)">
                      <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="breadth_cm" label="B (cm)">
                      <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="height_cm" label="H (cm)">
                      <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
              <div style={{ textAlign: 'right' }}>{saveButton}</div>
            </Space>
          </Col>
        </Row>
      </Form>
    </>
  );
}
