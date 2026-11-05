import deviconData from './framework-catalog-data.json';

interface DeviconEntry {
  name: string;
  altnames?: string[];
  fontVariants?: string[];
}

export interface FrameworkOption {
  value: string;
  label: string;
  iconClass: string;
  searchText: string;
}

const entries = deviconData as DeviconEntry[];

function labelFor(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toLocaleUpperCase('en-US') + part.slice(1))
    .join(' ');
}

function iconClassFor(name: string, variants: string[] = []): string {
  const variant = variants.find((value) => !value.endsWith('-wordmark')) ?? 'plain';
  return `devicon-${name}-${variant} colored framework-icon`;
}

const catalog: FrameworkOption[] = entries
  .map((entry) => {
    const label = labelFor(entry.name);
    return {
      value: label,
      label,
      iconClass: iconClassFor(entry.name, entry.fontVariants),
      searchText: [label, entry.name, ...(entry.altnames ?? [])].join(' ').toLocaleLowerCase(),
    };
  })
  .filter((entry, index, all) => all.findIndex((other) => other.value === entry.value) === index);

const springIcon = catalog.find((entry) => entry.value === 'Spring');
if (!springIcon) throw new Error('Devicon catalog is missing the Spring icon.');

export const frameworkOptions: FrameworkOption[] = [
  ...catalog,
  {
    ...springIcon,
    value: 'Spring Boot',
    label: 'Spring Boot',
    searchText: 'spring boot spring springframework',
  },
].sort((a, b) => a.label.localeCompare(b.label));

export function frameworkIconClass(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  return (
    frameworkOptions.find(
      (option) =>
        option.value.toLocaleLowerCase() === normalized ||
        option.searchText.split(' ').includes(normalized),
    )?.iconClass ?? 'framework-icon'
  );
}
