export type ImportedCard = { term: string; definition: string };

export type QuizletParseIssueCode = "empty_input" | "single_column" | "missing_definition";

export type QuizletParseIssue = {
  code: QuizletParseIssueCode;
  message: string;
  row?: number;
};

export type QuizletParseOptions = {
  termSeparator?: string;
  rowSeparator?: string;
};

export type QuizletParseResult = {
  cards: ImportedCard[];
  rowCount: number;
  issues: QuizletParseIssue[];
};

const DEFAULT_TERM_SEPARATOR = "\t";
const DEFAULT_ROW_SEPARATOR = "\n";

export function parseQuizletExport(text: string, options: QuizletParseOptions = {}): QuizletParseResult {
  const termSeparator = options.termSeparator ?? DEFAULT_TERM_SEPARATOR;
  const rowSeparator = options.rowSeparator ?? DEFAULT_ROW_SEPARATOR;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.trim()) {
    return {
      cards: [],
      rowCount: 0,
      issues: [{ code: "empty_input", message: "Paste the text from Quizlet's Export dialog first." }],
    };
  }

  const rawRows = splitOutsideQuotes(normalized, rowSeparator).filter((row) => row.trim().length > 0);
  const cards: ImportedCard[] = [];
  const issues: QuizletParseIssue[] = [];
  let singleColumnRows = 0;

  rawRows.forEach((rawRow, index) => {
    const fields = splitOutsideQuotes(rawRow, termSeparator);
    if (fields.length < 2) {
      singleColumnRows += 1;
      return;
    }

    const term = unquote(fields[0]).trim();
    const definition = unquote(fields.slice(1).join(termSeparator)).trim();
    if (!term && !definition) return;
    if (!term || !definition) {
      issues.push({
        code: "missing_definition",
        row: index + 1,
        message: `Row ${index + 1} is missing a ${term ? "definition" : "term"}.`,
      });
      return;
    }
    cards.push({ term, definition });
  });

  if (cards.length === 0 && singleColumnRows > 0) {
    issues.unshift({
      code: "single_column",
      message:
        "Every pasted row looked like one column. Check the separator Quizlet exported between term and definition, then select Tab, Comma, or enter the custom separator here.",
    });
  }

  return { cards, rowCount: rawRows.length, issues };
}

function splitOutsideQuotes(input: string, separator: string): string[] {
  if (!separator) return [input];
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (inQuotes && input[i + 1] === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (!inQuotes && input.startsWith(separator, i)) {
      parts.push(current);
      current = "";
      i += separator.length - 1;
      continue;
    }

    current += char;
  }

  parts.push(current);
  return parts;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed.replace(/""/g, '"');
}
