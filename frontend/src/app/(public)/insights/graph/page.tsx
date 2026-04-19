import type { Metadata } from 'next';
import ConceptGraph from '@/components/ConceptGraph';

export const metadata: Metadata = {
  title: 'Concept Graph – Ai Salon',
  description:
    'Explore the web of ideas, themes, and open questions that connect Ai Salon conversations across cities and sessions.',
};

export default function ConceptGraphPage() {
  return <ConceptGraph />;
}
