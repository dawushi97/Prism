import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true
});

const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'ul',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td'
];

const ALLOWED_ATTRIBUTES = [
  'href',
  'rel',
  'target',
  'title',
  'align',
  'src',
  'alt'
];

export const renderMarkdown = (content: string): string => {
  const dirtyHtml = marked.parse(content) as string;
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTRIBUTES
  });
};
