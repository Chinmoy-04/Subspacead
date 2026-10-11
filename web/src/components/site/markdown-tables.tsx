import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

/** Renders the subset of Markdown that results/tables.md uses: headings, paragraphs and pipe tables. */
export function MarkdownTables({ source }: { source: string }) {
  const lines = source.split(/\r?\n/);
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith("|")) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) block.push(lines[i++]);
      const [head, , ...body] = block;
      const right = cells(block[1] ?? "").map((c) => c.endsWith(":"));
      out.push(
        <div key={`t${i}`} className="overflow-x-auto" data-lenis-prevent>
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-foreground text-left text-muted-foreground">
                {cells(head).map((c, j) => (
                  <th key={j} scope="col" className={`py-2 pr-4 font-normal ${right[j] ? "text-right" : ""}`}>
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r} className="border-b border-border">
                  {cells(row).map((c, j) => (
                    <td key={j} className={`py-2 pr-4 ${right[j] ? "text-right" : ""}`}>
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      out.push(
        level <= 2 ? (
          <h3 key={i} className="mt-6 text-lg font-medium">{inline(h[2])}</h3>
        ) : (
          <h4 key={i} className="mt-4 font-mono text-xs tracking-wide text-muted-foreground uppercase">{inline(h[2])}</h4>
        )
      );
    } else if (line.trim()) {
      out.push(
        <p key={i} className="text-sm text-muted-foreground">{inline(line)}</p>
      );
    }
    i++;
  }
  return <div className="flex flex-col gap-3">{out}</div>;
}
