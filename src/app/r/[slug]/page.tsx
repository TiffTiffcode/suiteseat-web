import { serverApiGet } from '@/lib/api';
import BookingFlow from './BookingFlow';

type Values = Record<string, string | number | boolean | null | undefined>;
type BusinessRow = { _id: string; values?: Values };

export default async function Page(
  props: { params: Promise<{ slug: string }> }   // 👈 make params a Promise
) {
  const { slug } = await props.params;            // 👈 await it

  const rows = await serverApiGet<BusinessRow[]>(
    `/public/records?dataType=Business&slug=${encodeURIComponent(slug)}`
  );
  const biz = Array.isArray(rows) ? rows[0] : rows;

  if (!biz?._id) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold">Business not found</h1>
        <p>Check the URL slug.</p>
      </div>
    );
  }

  const v = biz.values || {};
  const name =
    (v.businessName as string) ||
    (v.name as string) ||
    (v['Business Name'] as string) ||
    slug;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{name}</h1>
      <BookingFlow businessId={biz._id} />
    </div>
  );
}
