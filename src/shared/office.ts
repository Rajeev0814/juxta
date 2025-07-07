/** Word / Excel / PowerPoint Open-XML documents whose text Juxta can extract and diff. */
export function isOfficePath(p: string): boolean {
  return /\.(docx|xlsx|pptx)$/i.test(p)
}
