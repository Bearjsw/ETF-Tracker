import { formatManagerDisplay } from "@/lib/managers";

type Props = {
  managers: string[];
  current?: string;
  action?: string;
  extraParams?: Record<string, string>;
};

export function ManagerFilter({ managers, current, action = "", extraParams = {} }: Props) {
  return (
    <form method="get" action={action} className="card flex flex-wrap items-end gap-3">
      <div className="min-w-[12rem] flex-1">
        <label htmlFor="manager" className="text-label mb-1.5 block">
          운용사 필터
        </label>
        <select id="manager" name="manager" defaultValue={current ?? ""} className="select-input w-full">
          <option value="">전체 운용사</option>
          {managers.map((m) => (
            <option key={m} value={m}>
              {formatManagerDisplay(m)}
            </option>
          ))}
        </select>
      </div>
      {Object.entries(extraParams).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <button type="submit" className="btn-primary">
        적용
      </button>
      {current ? (
        <a href={action || "?"} className="btn-ghost text-sm">
          초기화
        </a>
      ) : null}
    </form>
  );
}
