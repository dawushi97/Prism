import { html, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import {
  Bot,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  FileJson,
  GripVertical,
  Languages,
  Menu,
  Minus,
  MoreHorizontal,
  Settings,
  Share2,
  Type,
  Upload,
  User,
  Wrench,
  X
} from 'lucide';

type IconNode = [tag: string, attrs: Record<string, string | number | undefined>][];

const ICONS = {
  Settings,
  Menu,
  Type,
  Languages,
  Braces,
  Share2,
  User,
  Bot,
  Wrench,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Check,
  Eye,
  EyeOff,
  FileJson,
  GripVertical,
  Minus,
  Upload,
  X
} as const satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

export interface IconOptions {
  slashed?: boolean;
  size?: number;
  strokeWidth?: number;
}

const attrsToString = (
  attrs: Record<string, string | number | undefined>
): string =>
  Object.entries(attrs)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${String(value)}"`)
    .join(' ');

export const renderIcon = (
  name: IconName,
  options: IconOptions = {}
): TemplateResult => {
  const node = ICONS[name];
  const size = options.size ?? 16;
  const strokeWidth = options.strokeWidth ?? 1.75;
  const shapes = node
    .map(([tag, attrs]) => `<${tag} ${attrsToString(attrs)} />`)
    .join('');
  const slash = options.slashed
    ? '<line x1="4" y1="20" x2="20" y2="4" />'
    : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `${shapes}${slash}</svg>`;
  return html`${unsafeHTML(svg)}`;
};
