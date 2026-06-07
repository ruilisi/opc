// Markdown <-> ProseMirror conversion for the collaborative DocEditor.
//
// prosemirror-markdown's defaults are keyed to the prosemirror-schema-basic
// node/mark names (em, strong, bullet_list, ...). Tiptap's StarterKit uses
// different names (italic, bold, bulletList, ...) and different attrs
// (orderedList.start, codeBlock.language). So we re-map the default
// serializers onto Tiptap's names and build a parser token map to match.
//
// Both helpers are built against the *live* editor schema and only register
// handlers for node/mark types that actually exist, so they stay correct even
// if the StarterKit configuration changes.
import {
  MarkdownSerializer,
  MarkdownParser,
  defaultMarkdownSerializer,
} from '@tiptap/pm/markdown'
import type { Schema, Node as PMNode } from '@tiptap/pm/model'
import MarkdownIt from 'markdown-it'

type SerializerNodes = ConstructorParameters<typeof MarkdownSerializer>[0]
type SerializerMarks = ConstructorParameters<typeof MarkdownSerializer>[1]

const D = defaultMarkdownSerializer.nodes
const M = defaultMarkdownSerializer.marks

// Tiptap-node-name -> markdown serializer. Defaults are reused where the attrs
// are compatible; orderedList/codeBlock are overridden for Tiptap's attr names.
const NODE_SERIALIZERS: SerializerNodes = {
  blockquote: D.blockquote,
  paragraph: D.paragraph,
  text: D.text,
  heading: D.heading,
  horizontalRule: D.horizontal_rule,
  hardBreak: D.hard_break,
  image: D.image,
  bulletList: D.bullet_list,
  listItem: D.list_item,
  orderedList(state, node) {
    const start = (node.attrs.start as number) || 1
    const maxW = String(start + node.childCount - 1).length
    const space = state.repeat(' ', maxW + 2)
    state.renderList(node, space, (i) => {
      const nStr = String(start + i)
      return state.repeat(' ', maxW - nStr.length) + nStr + '. '
    })
  },
  codeBlock(state, node) {
    const lang = (node.attrs.language as string) || ''
    state.write('```' + lang + '\n')
    state.text(node.textContent, false)
    state.ensureNewLine()
    state.write('```')
    state.closeBlock(node)
  },
}

const MARK_SERIALIZERS: SerializerMarks = {
  italic: M.em,
  bold: M.strong,
  code: M.code,
  link: M.link,
  strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
}

// markdown-it token name -> parser spec, keyed to Tiptap node/mark names.
type ParseSpec = ConstructorParameters<typeof MarkdownParser>[2][string]
const TOKEN_SPECS: Record<string, ParseSpec & { __target: string; __isMark?: boolean }> = {
  blockquote: { block: 'blockquote', __target: 'blockquote' },
  paragraph: { block: 'paragraph', __target: 'paragraph' },
  list_item: { block: 'listItem', __target: 'listItem' },
  bullet_list: { block: 'bulletList', __target: 'bulletList' },
  ordered_list: {
    block: 'orderedList',
    getAttrs: (tok) => ({ start: +(tok.attrGet('start') ?? 1) || 1 }),
    __target: 'orderedList',
  },
  heading: {
    block: 'heading',
    getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
    __target: 'heading',
  },
  code_block: { block: 'codeBlock', noCloseToken: true, __target: 'codeBlock' },
  fence: {
    block: 'codeBlock',
    getAttrs: (tok) => ({ language: tok.info || null }),
    noCloseToken: true,
    __target: 'codeBlock',
  },
  hr: { node: 'horizontalRule', __target: 'horizontalRule' },
  hardbreak: { node: 'hardBreak', __target: 'hardBreak' },
  image: {
    node: 'image',
    getAttrs: (tok) => ({
      src: tok.attrGet('src'),
      title: tok.attrGet('title') || null,
      alt: tok.children?.[0]?.content || null,
    }),
    __target: 'image',
  },
  em: { mark: 'italic', __target: 'italic', __isMark: true },
  strong: { mark: 'bold', __target: 'bold', __isMark: true },
  s: { mark: 'strike', __target: 'strike', __isMark: true },
  code_inline: { mark: 'code', noCloseToken: true, __target: 'code', __isMark: true },
  link: {
    mark: 'link',
    getAttrs: (tok) => ({ href: tok.attrGet('href'), title: tok.attrGet('title') || null }),
    __target: 'link',
    __isMark: true,
  },
}

// Serialize the current document to Markdown. Any node type without an explicit
// serializer falls back to rendering its content, so serialization never throws.
export function serializeMarkdown(schema: Schema, doc: PMNode): string {
  const nodes: SerializerNodes = {}
  for (const name of Object.keys(NODE_SERIALIZERS)) {
    if (schema.nodes[name]) nodes[name] = NODE_SERIALIZERS[name]
  }
  for (const name of Object.keys(schema.nodes)) {
    if (name === 'doc' || nodes[name]) continue
    nodes[name] = (state, node) => {
      if (node.isText) state.text(node.text ?? '')
      else if (node.isTextblock) {
        state.renderInline(node)
        state.closeBlock(node)
      } else if (node.isBlock) {
        state.renderContent(node)
        state.closeBlock(node)
      }
    }
  }
  const marks: SerializerMarks = {}
  for (const name of Object.keys(MARK_SERIALIZERS)) {
    if (schema.marks[name]) marks[name] = MARK_SERIALIZERS[name]
  }
  // Markdown has no syntax for some marks (e.g. underline). Without a serializer
  // MarkdownSerializer throws on any text carrying that mark, so register a
  // no-op for every remaining schema mark — the text survives, the mark drops.
  for (const name of Object.keys(schema.marks)) {
    if (!marks[name]) marks[name] = { open: '', close: '', mixable: true }
  }
  return new MarkdownSerializer(nodes, marks).serialize(doc)
}

// Parse Markdown into a ProseMirror doc node for the given schema.
export function parseMarkdown(schema: Schema, text: string): PMNode {
  const md = MarkdownIt({ html: false, linkify: true })
  const tokens: ConstructorParameters<typeof MarkdownParser>[2] = {}
  for (const tokName of Object.keys(TOKEN_SPECS)) {
    const { __target, __isMark, ...spec } = TOKEN_SPECS[tokName]
    const exists = __isMark ? !!schema.marks[__target] : !!schema.nodes[__target]
    if (exists) tokens[tokName] = spec
  }
  const parsed = new MarkdownParser(schema, md, tokens).parse(text)
  return parsed ?? schema.topNodeType.createAndFill()!
}
