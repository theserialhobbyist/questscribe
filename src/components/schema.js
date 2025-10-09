import { Schema } from 'prosemirror-model'

// Custom schema that extends basic schema with marker nodes
export const markerSchema = new Schema({
  nodes: {
    doc: {
      content: 'block+'
    },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() { return ['p', 0] }
    },
    heading: {
      attrs: { level: { default: 1 } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 1 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 4 } },
        { tag: 'h5', attrs: { level: 5 } },
        { tag: 'h6', attrs: { level: 6 } }
      ],
      toDOM(node) { return ['h' + node.attrs.level, 0] }
    },
    blockquote: {
      content: 'block+',
      group: 'block',
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() { return ['blockquote', 0] }
    },
    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM() { return ['hr'] }
    },
    code_block: {
      content: 'text*',
      group: 'block',
      code: true,
      defining: true,
      marks: '',
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM() { return ['pre', ['code', 0]] }
    },
    text: {
      group: 'inline'
    },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM() { return ['br'] }
    },
    // Custom marker node
    marker: {
      inline: true,
      group: 'inline',
      atom: true,
      attrs: {
        id: {},
        entityId: {},
        changes: { default: [] },
        visual: { default: { icon: '⭐', color: '#FFD700' } },
        description: { default: '' },
        createdAt: { default: 0 },
        modifiedAt: { default: 0 }
      },
      parseDOM: [{
        tag: 'span.marker-node',
        getAttrs(dom) {
          return {
            id: dom.getAttribute('data-id'),
            entityId: dom.getAttribute('data-entity-id'),
            changes: JSON.parse(dom.getAttribute('data-changes') || '[]'),
            visual: JSON.parse(dom.getAttribute('data-visual') || '{"icon":"⭐","color":"#FFD700"}'),
            description: dom.getAttribute('data-description') || '',
            createdAt: parseInt(dom.getAttribute('data-created-at') || '0'),
            modifiedAt: parseInt(dom.getAttribute('data-modified-at') || '0')
          }
        }
      }],
      toDOM(node) {
        return ['span', {
          class: 'marker-node',
          'data-id': node.attrs.id,
          'data-entity-id': node.attrs.entityId,
          'data-changes': JSON.stringify(node.attrs.changes),
          'data-visual': JSON.stringify(node.attrs.visual),
          'data-description': node.attrs.description,
          'data-created-at': node.attrs.createdAt,
          'data-modified-at': node.attrs.modifiedAt,
          style: `color: ${node.attrs.visual.color}; background-color: ${node.attrs.visual.color}; cursor: pointer; font-size: 16px; padding: 2px 4px; border-radius: 3px;`,
          contenteditable: 'false'
        }, node.attrs.visual.icon]
      }
    }
  },
  marks: {
    strong: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b', getAttrs: node => node.style.fontWeight !== 'normal' && null },
        { style: 'font-weight', getAttrs: value => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null }
      ],
      toDOM() { return ['strong', 0] }
    },
    em: {
      parseDOM: [
        { tag: 'i' },
        { tag: 'em' },
        { style: 'font-style=italic' }
      ],
      toDOM() { return ['em', 0] }
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() { return ['code', 0] }
    },
    link: {
      attrs: {
        href: {},
        title: { default: null }
      },
      inclusive: false,
      parseDOM: [{
        tag: 'a[href]',
        getAttrs(dom) {
          return { href: dom.getAttribute('href'), title: dom.getAttribute('title') }
        }
      }],
      toDOM(node) { return ['a', node.attrs, 0] }
    }
  }
})
