export interface Connector {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'coming_soon' | 'available';
}

export const CONNECTORS: Connector[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Import email threads and correspondence for context injection before sessions.',
    icon: '\u2709\ufe0f',
    status: 'coming_soon',
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    description: 'Pull in meeting notes, proposals, and briefs directly from your Drive.',
    icon: '\ud83d\udcc4',
    status: 'coming_soon',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Import channel conversations and DMs for richer session context.',
    icon: '\ud83d\udcac',
    status: 'coming_soon',
  },
  {
    id: 'salesforce',
    name: 'Salesforce CRM',
    description: 'Sync deal notes, contact history, and opportunity data automatically.',
    icon: '\u2601\ufe0f',
    status: 'coming_soon',
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Pull contact records and deal pipeline data for session preparation.',
    icon: '\ud83c\udfaf',
    status: 'coming_soon',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Import pages, databases, and wikis as context for your AI agents.',
    icon: '\ud83d\uddd2\ufe0f',
    status: 'coming_soon',
  },
];
