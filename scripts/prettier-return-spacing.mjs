import { doc, util } from 'prettier'
import { printers as estreePrinters } from 'prettier/plugins/estree'

const nativePrinter = estreePrinters.estree
const { hardline } = doc.builders

// Add only the line breaks that the native statement/comment printer does not emit.
function returnPrefix(path, options) {
  const { node, parent } = path
  const { originalText, locEnd } = options
  const leading = node.comments?.filter((comment) => comment.leading && !comment.printed)
  const comment = leading?.at(-1)

  if (comment) {
    const end = locEnd(comment)

    if (util.isNextLineEmpty(originalText, end)) {

      return []
    }

    if (nativePrinter.isBlockComment(comment) && !util.hasNewline(originalText, end)) {

      return [hardline, hardline]
    }

    return [hardline]
  }

  if (parent?.type === 'LabeledStatement') {

    return [hardline, hardline]
  }

  const previous = path.siblings?.slice(0, path.index).findLast((statement) => {

    return statement.type !== 'EmptyStatement'
  })
  const directive = parent?.directives?.at(-1)
  const preceding = previous ?? directive

  if (preceding) {
    const end = locEnd(preceding)
    const rawEnd = preceding.range?.[1] ?? preceding.end
    const hasBlank = util.isNextLineEmpty(originalText, end)
    const hasBlankAfterSemicolon = rawEnd !== end && util.isNextLineEmpty(originalText, rawEnd)

    if (hasBlank || hasBlankAfterSemicolon) {

      return []
    }
  }

  return [hardline]
}

function print(path, options, printChild, args) {
  const printed = nativePrinter.print(path, options, printChild, args)

  if (path.node.type !== 'ReturnStatement') {

    return printed
  }

  return [...returnPrefix(path, options), printed]
}

const estree = { ...nativePrinter, print }

export const printers = { estree }
