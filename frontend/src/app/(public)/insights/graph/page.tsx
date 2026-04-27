import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ConceptGraph from '@/components/ConceptGraph';
import { getPublicFlags } from '@/lib/featureFlags';

export const metadata: Metadata = {
  title: 'Concept Graph – Ai Salon',
  description:
    'Explore the web of ideas, themes, and open questions that connect Ai Salon conversations across cities and sessions.',
};

export default async function ConceptGraphPage() {
  const flags = await getPublicFlags();
  if (!flags.insights_enabled) notFound();
  return <ConceptGraph />;
}
