type Props = {
  title: string;
  description?: string;
  meta?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, description, meta, action }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{description}</p>
        ) : null}
        {meta ? <p className="mt-2 text-xs text-[var(--muted-foreground)]">{meta}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
