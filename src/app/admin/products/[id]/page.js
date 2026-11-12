'use client';
import { useParams } from 'next/navigation';
import ProductEditor from '../../_components/ProductEditor';
import { useAdmin } from '../../_components/hooks';
import { QueryState } from '../../_components/ui';

export default function EditProductPage() {
  const { id } = useParams();
  const q = useAdmin(`/api/admin/products/${id}`, { refetchOnMount: 'always' });
  // key: remount the form with fresh values after each save (new variants get their ids).
  return (
    <QueryState query={q}>
      {(d) => <ProductEditor key={`${d.product.id}-${d.product.updated_at}`} product={d.product} />}
    </QueryState>
  );
}
