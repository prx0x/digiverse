type Tab = { id: string; label: string };

type Props = {
  tabs: Tab[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export function Tabs({ tabs, value, onChange, className = '' }: Props) {
  return (
    <div className={`tabs ${className}`.trim()} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          className="tabs__tab"
          aria-selected={value === tab.id}
          id={`tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
